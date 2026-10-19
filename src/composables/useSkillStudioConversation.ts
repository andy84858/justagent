import { ref, computed } from 'vue'
import { useSkillStore, canEnableSkill } from '@/stores/skillStore'
import type { ChatMessage, Skill, SkillCapability, SkillFile, AITestReport } from '@/stores/skillStore'
export type { Skill }
import { REPORT_CATEGORIES, SECTION_MAP } from '@/constants/reportSections'
import { parseHashtags } from '@/utils/hashtags'
import type { AdviceMode, BackendDraft, BackendNote, BackendSkillVersion } from '@/services/skillConversationApi'
import {
  describeConversationError,
  openConversation,
  openModifyConversation,
  saveConversation,
  sendConversationMessage,
} from '@/services/skillConversationApi'
import { useBackendSkillStore } from '@/stores/backendSkillStore'
import { useBackendTestStore } from '@/stores/backendTestStore'

// AI 賦能（SkillStudio）的對話狀態與規則式 mock 回覆。
// 這裡是頁面唯一的狀態來源：左側對話、右側預覽都只讀這裡的 draft／messages。

export type StudioMode = 'create' | 'edit'
export type StudioMethod = 'chat' | 'blocks'

export interface SkillDraft {
  name: string
  skillCode?: string            // 後端對話的技能代號（agent 用的英文代號）；name 放給使用者看的顯示名稱
  description: string
  instructions: string
  triggerHint: string
  capabilities: SkillCapability[]
  assignedAgents: string[]      // 只有積木方式會在這裡填寫；對話方式維持空陣列，走啟用時的指派流程
  keywords: string[]            // 只有積木方式會在這裡填寫，規則同 assignedAgents
  files: SkillFile[]
  method: StudioMethod | null   // null = 尚未選擇建立方式
  sectionIds: string[]          // 積木方式的已選章節（依序）
}

export interface StudioAction { id: string; label: string }
export interface StudioMessage extends ChatMessage { actions?: StudioAction[] }
export interface StudioReply { content: string; patch?: Partial<SkillDraft>; actions?: StudioAction[] }
export interface StudioSuggestion { icon: string; label: string; prefill: string }

// block 存放／還原用的可序列化快照
export interface StudioSnapshot {
  mode: StudioMode
  savedSkillId: string | null
  draft: SkillDraft
  messages: StudioMessage[]
  // 選填：關卡分流位置與待處理的相近技能 id。選填是為了向下相容舊快照（早於這兩個欄位
  // 存在時寫入的），hydrate() 遇到 undefined 會分別退回 'active' 與 null
  gateStage?: GateStage
  pendingSimilarSkillId?: string | null
  gatheringRawText?: string
  gatheringRound?: number
  awaitingSupplement?: boolean
}

export const DEFAULT_OPENING_MESSAGE = '你好，我是技能建立助理。描述你想讓 Agent 幫你做什麼，我會先擬一版設定放在右側。'
// 從「建立技能」按鈕進來，意圖已經確定是「建立」，開場白不用再留「或是要調整既有的」
// 這種模糊空間——跟 loadSkill()／askAboutSkill 各自的開場白算同一組、依入口區分語氣
const GATE_OPENING_MESSAGE = '你好，我是技能建立助理。跟我說說你想讓 Agent 幫你做什麼，我會先幫你擬一版設定內容。'

export function emptyDraft(): SkillDraft {
  return { name: '', description: '', instructions: '', triggerHint: '', capabilities: [], assignedAgents: [], keywords: [], files: [], method: null, sectionIds: [] }
}

// ── 意圖判斷與關卡分流（AI 賦能「用對話建立」路徑，接在既有解析規則之前）──

export type GateStage =
  | 'intent'            // 每則新訊息的起點：判斷「建立」／「修改」／太模糊
  | 'findModifyTarget'  // 已知是修改意圖，但找不到相近技能，等使用者說出要改哪一項
  | 'gathering'         // 從零開始建立：固定追問幾輪補充資訊
  | 'confirmKnownInfo'  // 白話摘要確認，確認後才真正產出結構化草稿
  | 'gate2'             // 建立意圖找到相近做法，問沿用/改他/另開一份/講別的
  | 'clarify'           // 多輪問答補齊草稿內容（沿用既有 interpretStudioMessage 的抽取規則）
  | 'gate3'             // 最終確認「內容如下…這樣可以嗎？」
  | 'active'            // 分流完畢，既有的 interpretStudioMessage 接手
  | 'confirmStartNew'   // 修改模式下使用者明確說要建立新技能：確認是否放下目前的修改

// 「我要講別的」時的暫存快照：只存在單次連線的記憶體內（一個 ref），
// 不寫入 skillStore、離開頁面或重新整理就消失，跟 skillStore 既有的
// myDrafts／DraftSkill（Library／企業技能送審草稿）完全無關
export interface PausedDraft {
  gateStage: GateStage
  messages: StudioMessage[]
  draft: SkillDraft
  pendingSimilarSkillId: string | null
}

const MODIFY_SIGNAL = /修改|調整|更新/
const BUILD_VERBS = /教|建立|新增|記一個|記成|記錄|固定|流程|SOP/
const BUILD_NOUNS = /技能|skill|規定|做法/i

// 規則式關鍵字比對，不是真語意理解，跟既有風格一致。
// 「建立」是預設值：任何不是明確「修改」訊號、且不是短到看不出內容的輸入都當作建立意圖。
// 「太模糊」只保留給真的看不出任何內容的極短回覆（例如「嗯」）。
export function classifyBuildOrModify(text: string): 'build' | 'modify' | 'ambiguous' {
  const t = text.trim()
  if (MODIFY_SIGNAL.test(t)) return 'modify'
  const hasBuildSignal = BUILD_VERBS.test(t) || BUILD_NOUNS.test(t)
  if (t.length > 4 || hasBuildSignal) return 'build'
  return 'ambiguous'
}

const GATHERING_QUESTIONS = [
  '還有沒有需要特別注意的情況或例外？',
  '大概的執行步驟是什麼？麻煩條列一下。',
]

// 每一題追問之前，先用關鍵字（或字數夠長，看起來已經交代過怎麼做）判斷使用者是不是已經講過了，
// 講過就跳過這題，不重複問——規則式判斷，不是真的語意理解，跟這個檔案既有風格一致
const EXCEPTION_HINT = /例外|異常|萬一|如果.{0,10}(就|請|要)|錯誤|失敗/
const STEPS_HINT = /先.{0,10}(再|然後|接著)|步驟|流程|依序|依次/
const STEPS_LENGTH_HINT = 60

function isGatheringQuestionAnswered(index: number, text: string): boolean {
  if (index === 0) return EXCEPTION_HINT.test(text)
  if (index === 1) return STEPS_HINT.test(text) || text.trim().length > STEPS_LENGTH_HINT
  return false
}

// 關卡二專用的語意分類器
function classifyGate2(text: string): 'follow' | 'edit' | 'new' | 'else' | null {
  if (/照.{0,4}做|沿用他|用現有的/.test(text)) return 'follow'
  if (/改他|修改他|調整他|改一下(他|這個|這份)/.test(text)) return 'edit'
  if (/另外|新增一份|開一份新的|重新弄一份|不要沿用|記.{0,4}新的|新的一份/.test(text)) return 'new'
  if (/講別的|別的事|其他事|換個話題|先不管這個|等一下再/.test(text)) return 'else'
  return null
}

// 關卡三專用的語意分類器。順序很重要：retry 的「不對」要先檢查，
// 否則「不對，我要改」會先被 confirm 規則裡的「對」字誤判
function classifyGate3(text: string): 'confirm' | 'retry' | null {
  if (/不對|不是|改一下|再改|不行|等等|漏了/.test(text)) return 'retry'
  if (/可以|對|沒問題|存吧|好|確認|儲存|沒錯|就這樣/.test(text)) return 'confirm'
  return null
}

// 白話摘要文字：規則式串接，不是真的語意濃縮，跟這個檔案既有的其他函式風格一致
function buildKnownInfoSummary(rawText: string): string {
  return `我理解你想做的是：${rawText.trim()}\n\n這樣的理解對嗎？`
}

// confirmKnownInfo 專用的語意分類器。順序很重要：retry 的「不對」要先檢查，
// 否則「不對，我要改」會先被 confirm 規則裡的「對」字誤判——跟既有 classifyGate3 同樣的慣例
function classifyKnownInfoConfirm(text: string): 'confirm' | 'retry' | null {
  if (/不對|不是|還要補充|還有|再說|不完整|漏了/.test(text)) return 'retry'
  if (/對|沒錯|正確|可以|沒問題|就這樣/.test(text)) return 'confirm'
  return null
}

// 規則式比對使用者描述跟既有個人技能的 name／triggerHint／instructions 有沒有重疊，
// 回傳重疊分數最高的那一顆；沒有重疊回傳 null。
//
// 用「連續中文字元」切詞（/[一-龥]{2,}/）在這裡行不通：使用者一句話通常是一整串
// 中文、中間沒有空格或標點斷開（例如「我要處理銷售報告的事情」），regex 會把整句話
// 貪婪比對成單一一個「詞」，永遠不可能完整出現在技能名稱／說明這種短很多的字串裡，
// 等於這個函式永遠回傳 null。改用「二字滑動窗」（character bigram）算重疊比例，
// 不需要真的中文斷詞也能抓出「兩段文字有沒有提到同樣的詞彙」，是這類輕量比對常見的做法。
export function findSimilarSkill(text: string, skills: Skill[]): Skill | null {
  const t = text.trim()
  if (t.length < 2) return null
  const textGrams = new Set<string>()
  for (let i = 0; i < t.length - 1; i++) textGrams.add(t.slice(i, i + 2))
  let best: { skill: Skill; score: number } | null = null
  for (const skill of skills) {
    const haystack = `${skill.name}${skill.triggerHint ?? ''}${skill.instructions ?? ''}`
    let score = 0
    for (let i = 0; i < haystack.length - 1; i++) {
      if (textGrams.has(haystack.slice(i, i + 2))) score++
    }
    if (score > 0 && (!best || score > best.score)) best = { skill, score }
  }
  return best?.skill ?? null
}

const RESUME_HINTS = /繼續|剛才|接著|接續|回到|上次那個/

// 是否要接回被「我要講別的」中斷的草稿：訊息裡有接續關鍵字，或直接提到暫存草稿的名稱
export function wantsToResume(text: string, paused: PausedDraft): boolean {
  return RESUME_HINTS.test(text) || (!!paused.draft.name && text.includes(paused.draft.name))
}

// 關卡三要顯示的草稿內容摘要
export function formatDraftSummary(draft: SkillDraft): string {
  const lines = [
    `名稱：${draft.name || '（未命名）'}`,
    `觸發時機：${draft.triggerHint || '（未設定）'}`,
    `指令：${draft.instructions || '（未撰寫）'}`,
  ]
  if (draft.capabilities.length) {
    lines.push(`覆蓋能力：${draft.capabilities.map(c => `#${c}`).join(' ')}`)
  }
  return lines.join('\n')
}

const CLARIFY_DONE_HINT = /沒有漏了|寫成做法|可以寫了|這樣就好/

const NOT_IMPLEMENTED_REPLY = '這部分我還在學怎麼幫你直接處理，目前只能先帶你到技能建立/修改的流程。之後會補上「直接套用技能」的功能。'

// 由已儲存的技能還原出一份草稿（loadSkill／hydrate 基準共用，避免兩處各寫一次欄位對應）
export function draftFromSkill(s: Skill): SkillDraft {
  return {
    name: s.name,
    description: s.description ?? '',
    instructions: s.instructions ?? '',
    triggerHint: s.triggerHint ?? '',
    capabilities: [...(s.capabilities ?? [])],
    assignedAgents: [...(s.assignedAgents ?? [])],
    keywords: [...(s.keywords ?? [])],
    files: [...(s.files ?? [])],
    method: s.composition ? 'blocks' : 'chat',
    sectionIds: [...(s.composition?.sectionIds ?? [])],
  }
}

// 積木 → 草稿：步驟＝章節依序編號，能力＝章節，觸發條件＝涵蓋到的分類
export function deriveFromSections(sectionIds: string[]): Pick<SkillDraft, 'instructions' | 'triggerHint' | 'capabilities'> {
  const sections = sectionIds.map(id => SECTION_MAP[id]).filter((s): s is NonNullable<typeof s> => !!s)
  if (sections.length === 0) return { instructions: '', triggerHint: '', capabilities: [] }
  const lines = sections.map((s, i) => `${i + 1}. ${s.name}：${s.description}`)
  const catIds = new Set(sections.map(s => s.categoryId))
  const labels = REPORT_CATEGORIES.filter(c => catIds.has(c.id)).map(c => c.label).join('、')
  return {
    instructions: `依序產出以下章節：\n${lines.join('\n')}`,
    triggerHint: `當使用者要求產出行銷報告，或提到「${labels}」相關分析時`,
    // 章節名稱有些含空白（例如「TA 明細資料」），hashtag 不支援空白，轉成能力標籤時去掉
    capabilities: sections.map(s => s.name.replace(/\s+/g, '')),
  }
}

// 積木 →「說明」／「觸發情境」建議：跟 deriveFromSections 同一批分類標籤，只是拼成
// 一句話。各自獨立成自己的函式（不塞進 deriveFromSections 的回傳物件），因為這兩項
// 在積木流程裡改成手動必填欄位、不再隨選章節自動覆蓋，只負責「AI 建議」按鈕按下去時
// 產生候選內容。生成 3 句不同措辭讓使用者挑一句，而不是算一句就直接套用或跳確認覆蓋——
// 使用者主動挑中哪句，那個動作本身就是確認，不用再多一層「要覆蓋嗎」
export function suggestDescriptionVariants(sectionIds: string[]): string[] {
  const sections = sectionIds.map(id => SECTION_MAP[id]).filter((s): s is NonNullable<typeof s> => !!s)
  if (sections.length === 0) return []
  const catIds = new Set(sections.map(s => s.categoryId))
  const labels = REPORT_CATEGORIES.filter(c => catIds.has(c.id)).map(c => c.label).join('、')
  return [
    `彙整${labels}相關章節的行銷報告`,
    `整理${labels}相關資料，產出一份行銷週報`,
    `依${labels}章節彙總而成的行銷報告摘要`,
  ]
}

export function suggestTriggerHintVariants(sectionIds: string[]): string[] {
  const sections = sectionIds.map(id => SECTION_MAP[id]).filter((s): s is NonNullable<typeof s> => !!s)
  if (sections.length === 0) return []
  const catIds = new Set(sections.map(s => s.categoryId))
  const labels = REPORT_CATEGORIES.filter(c => catIds.has(c.id)).map(c => c.label).join('、')
  return [
    `當使用者要求產出行銷報告，或提到「${labels}」相關分析時`,
    `使用者詢問${labels}相關數據、想了解最新進度時`,
    `需要彙整${labels}資訊、產出週期性報告時`,
  ]
}

const ACTION_CONFIRM: StudioAction = { id: 'confirm', label: '看起來沒問題，儲存' }
const ACTION_TRIGGER: StudioAction = { id: 'trigger', label: '觸發條件要更精準' }
const ACTION_STEP: StudioAction = { id: 'step', label: '再補一個步驟' }

// 測試沒全對時的引導訊息：使用者可能是自己答錯題目（想重新測），也可能根本不在意
// 這次沒全對（想先不改直接啟用），不是每次都真的要改技能內容
const ACTION_RETEST: StudioAction = { id: 'retest', label: '重新測試' }
const ACTION_FORCE_ENABLE: StudioAction = { id: 'force-enable', label: '不改，直接啟用' }

// 修改模式下，使用者在對話裡明確說要建立「新」技能：要跟「只是在描述這顆技能的
// 新能力/新步驟」區分開，所以一定要有「新」字＋建立動詞＋技能/skill 字樣，
// 不是隨便一句含「建立」兩字的話就觸發
const WANTS_NEW_SKILL_WHILE_EDITING = /(建立|新增|開|做|記)(一個|一份)?新(的)?(技能|skill)|新(的)?技能|另外(建|做|開|弄)(一個|一份)/i
const ACTION_START_NEW_CONFIRM: StudioAction = { id: 'start-new-confirm', label: '對，開新的' }
const ACTION_START_NEW_CANCEL: StudioAction = { id: 'start-new-cancel', label: '不是，我想問別的' }

const CREATE_SUGGESTIONS: StudioSuggestion[] = [
  { icon: 'inventory_2', label: '幫我建立一個能查 ERP 庫存的技能', prefill: '幫我建立一個能查 ERP 庫存的技能' },
  { icon: 'summarize', label: '把每週會議逐字稿整理成週報', prefill: '把每週會議逐字稿整理成週報' },
  { icon: 'description', label: '依部門報告規範自動產出月報', prefill: '依部門報告規範自動產出月報' },
]

// 依技能實際有沒有內容決定動詞（已經有 vs. 還沒有）
function editSuggestions(draft: SkillDraft): StudioSuggestion[] {
  return [
    draft.instructions
      ? { icon: 'terminal', label: '調整技能指令', prefill: '我想調整技能指令，' }
      : { icon: 'terminal', label: '撰寫技能指令', prefill: '幫我撰寫技能指令，' },
    draft.capabilities.length
      ? { icon: 'checklist', label: '調整覆蓋能力', prefill: '我想調整覆蓋能力，' }
      : { icon: 'checklist', label: '新增覆蓋能力', prefill: '幫我新增覆蓋能力，' },
    draft.triggerHint
      ? { icon: 'bolt', label: '調整觸發條件', prefill: '觸發條件改成' }
      : { icon: 'bolt', label: '設定觸發條件', prefill: '觸發條件是' },
  ]
}

const NAME_MAX = 12

export function extractSkillName(text: string): string {
  const t = text.trim()
  if (!t) return '新技能'
  const firstLine = t.split('\n')[0].trim() || t
  // 先把括號內容（全形／半形）拿掉再斷句取字：不然像「（第一個工作天）」這種插入語
  // 剛好卡在斷句點前面，會把名稱硬切在括號中間，看起來很怪。整句都是括號內容時退回
  // 原本的 firstLine，避免抓出空字串
  const candidate = firstLine.replace(/[（(][^）)]*[）)]/g, '').trim() || firstLine
  // 終止詞不能退回 $（字串結尾）：否則像「…需要統計上一個月的…」這種「需要」只是
  // 一般用語、後面根本沒有「的技能／的 Skill」的句子，也會被硬吃到字串結尾當成名稱，
  // 抓出一長串斷在詞中間的怪名字。沒有終止詞就該直接判定不比對，退回下面的逗號斷句規則
  const m = candidate.match(/(?:建立|幫我做|需要)(.*?)(?:的技能|的 ?Skill)/i)
  let picked = m ? m[1] : candidate.split(/[，。！？、；：,.!?;:]/)[0]
  picked = picked
    .replace(/^(一個|一顆|一份|一套|一支)/, '')
    .replace(/^(能夠|能|可以|會)/, '')
    .trim()
  if (!picked) return '新技能'
  return picked.length > NAME_MAX ? picked.slice(0, NAME_MAX) : picked
}

function countSteps(instructions: string): number {
  return instructions.split('\n').filter(line => /^\d+\.\s/.test(line.trim())).length
}

function stripLead(text: string, lead: RegExp): string {
  return text.replace(lead, '').trim()
}

export function interpretStudioMessage(text: string, draft: SkillDraft, mode: StudioMode): StudioReply {
  const t = text.trim()

  if (t === ACTION_CONFIRM.label) {
    return { content: '請按右側「儲存為個人技能」，儲存後就能在「測試」tab 驗證。' }
  }
  if (t === ACTION_TRIGGER.label) {
    return { content: '好，直接告訴我在什麼情況下要觸發這個技能，例如「觸發條件改成當使用者提到缺貨或補貨時」。' }
  }
  if (t === ACTION_STEP.label) {
    const n = countSteps(draft.instructions) + 1
    return {
      patch: { instructions: `${draft.instructions}\n${n}. 檢查輸出結果，必要時補充說明`.trim() },
      content: `已追加第 ${n} 步。`,
    }
  }

  if (mode === 'create' && !draft.name) {
    const name = extractSkillName(t)
    return {
      patch: {
        name,
        description: t,
        triggerHint: `當使用者提到「${name}」相關需求時`,
        instructions: `1. 釐清使用者的輸入與需求範圍\n2. 執行「${name}」\n3. 依指定格式回覆結果`,
        // hashtag 不支援空白，技能名稱若含空白（例如使用者打「查 ERP 庫存」）轉成標籤時去掉
        capabilities: [name.replace(/\s+/g, ''), '結果格式化輸出'],
      },
      content: '我先幫你擬了一版設定，右側可以看到。名稱、觸發條件和步驟都可以再跟我說要怎麼調。',
      actions: [ACTION_CONFIRM, ACTION_TRIGGER, ACTION_STEP],
    }
  }

  if (/名稱|改名|叫做|取名|命名/.test(t)) {
    const quoted = t.match(/[「"'『]([^」"'』]+)[」"'』]/)
    const name = quoted?.[1] ?? stripLead(t, /^.*?(叫做|名稱(是|改成|改為)?|改名(成|為)?|取名(為|成)?|命名(為|成)?)/)
    if (name) return { patch: { name }, content: `已把名稱改成「${name}」。` }
  }

  if (t.includes('觸發')) {
    const hint = stripLead(t, /^.*?觸發(條件)?(是|改成|改為|為|要|：|:)?/) || t
    return { patch: { triggerHint: hint }, content: `觸發條件已更新為：${hint}` }
  }

  if (/步驟|加一步|補一步|補充步驟/.test(t)) {
    const n = countSteps(draft.instructions) + 1
    const body = stripLead(t, /^.*?(步驟|加一步|補一步|補充步驟)(：|:|，)?/) || t
    return { patch: { instructions: `${draft.instructions}\n${n}. ${body}`.trim() }, content: `已追加第 ${n} 步。` }
  }

  if (/能力|還能/.test(t)) {
    const body = stripLead(t, /^.*?(能力|還能)(：|:|，)?/) || t
    // 一句話可能講好幾個能力（空白分隔多個 hashtag），已經在清單裡的不重複加
    const added = parseHashtags(body).filter(tag => !draft.capabilities.includes(tag))
    return {
      patch: { capabilities: [...draft.capabilities, ...added] },
      content: added.length > 1 ? `已新增 ${added.length} 項覆蓋能力。` : '已新增一項覆蓋能力。',
    }
  }

  return {
    patch: { instructions: `${draft.instructions}\n\n（依對話更新）${t}`.trim() },
    content: '已根據你的描述更新技能指令，右側可以看到變更。',
  }
}

// method 不算「內容」，故不列入 dirty 比對：它只是建立方式的選擇，只有 startCreate()（整份
// 草稿重置）才會再變，選了方式本身不該讓草稿變成「有未儲存變更」
function serialize(d: SkillDraft): string {
  return JSON.stringify({ ...d, method: undefined, files: d.files.map(f => f.id) })
}

export function useSkillStudioConversation() {
  const store = useSkillStore()

  const mode = ref<StudioMode>('create')
  const savedSkillId = ref<string | null>(null)
  // 還沒存檔的草稿想先測試：AI 測試狀態是用 id 當 key 掛在 store 上的，草稿沒有
  // 真正的技能 id 可用，所以產生一個不會跟真正技能 id 撞衫的佔位 id。每次開始
  // 一份全新草稿（startCreate）都重新產生一個，這樣切換到另一份全新草稿時，
  // store 的 ensureAITestStateForSkill 才能正確判斷「這是不同一份」、清掉舊測試結果
  function generateDraftTestId(): string {
    return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
  const draftTestId = ref(generateDraftTestId())
  // 任何需要「這份草稿的 AI 測試要掛在哪個 id 底下」的地方都讀這個，不要直接讀
  // savedSkillId——已經存檔就用真正的技能 id，還沒存檔就退回草稿佔位 id
  const testSkillId = computed(() => savedSkillId.value ?? draftTestId.value)
  const draft = ref<SkillDraft>(emptyDraft())
  const snapshot = ref(serialize(draft.value))
  const messages = ref<StudioMessage[]>([])
  const isRunning = ref(false)
  let seq = 0

  // 後端對話（VITE_SKILL_AGENT_API=true 才啟用，沒開就維持下面的模擬回覆）：
  // 只有「新建＋對話方式」走後端；修改既有技能要後端的技能代號與版本，等技能清單接上後端再接
  const conversationId = ref<string | null>(null)
  // 這場對話由誰判斷：Jev＋LLM 或純 LLM。建立對話時帶給後端，對話開始後就鎖住
  const adviceMode = ref<AdviceMode>('jev')
  const adviceModeLocked = computed(() => conversationId.value !== null)
  const note = ref<BackendNote>({ topic: '', steps: [] })   // 便利貼：後端暫存，儲存前顯示在預覽
  const blockedReasons = ref<string[]>([])   // 最近一輪被硬閘門擋下的白話原因，沒被擋是空陣列
  const errorHint = ref('')                  // 最近一次後端失敗的白話提示，成功後清空
  const backendEnabled = () => import.meta.env.VITE_SKILL_AGENT_API === 'true'
  // 後端技能：存過或從清單載入的技能代號，與最近一次存下的版本（記得「這一版測過」與否）
  const backendSkillId = ref<string | null>(null)
  const savedVersion = ref<BackendSkillVersion | null>(null)
  // 最近一次儲存是「存成新版本」還是「沒改內容、只把那一版標成測過」
  const lastSaveKind = ref<'new' | 'marked' | null>(null)
  // 新建＋對話方式走後端；從後端載入的修改對話（已有對話代號）也走後端
  const usesBackend = () => backendEnabled() && draft.value.method === 'chat'
    && (mode.value === 'create' || conversationId.value !== null)
  const showAdviceModeSwitch = computed(() => usesBackend())

  // 這場對話的草稿交過卷了（記號在儲存時寫進版本）
  const draftTested = computed(() =>
    !!conversationId.value && useBackendTestStore().stateOf(conversationId.value).tested
  )

  // 後端模式下儲存按鈕該長什麼樣：內容沒改就不新增版本，測過的話只把那一版標成測過
  const backendSaveAction = computed<{ label: string; enabled: boolean; hint: string }>(() => {
    const first = !backendSkillId.value
    const newLabel = first ? '儲存為個人技能' : '儲存為新版本'
    if (isDirty.value || (first && !savedVersion.value)) {
      return { label: newLabel, enabled: canSave.value, hint: '' }
    }
    // 內容跟已存的（或來源）那一版一樣
    const alreadyTested = savedVersion.value?.tested ?? false
    if (draftTested.value && !alreadyTested) return { label: '記下測過', enabled: true, hint: '' }
    if (savedVersion.value) return { label: newLabel, enabled: false, hint: '' }
    return { label: newLabel, enabled: false, hint: '內容還沒修改，沒有新版本可存。要啟用請先到「測試」做一次測試。' }
  })

  // 測過之後，告訴使用者這個記號會怎麼記下來；已經記下就不用說
  const testedNote = computed(() => {
    if (!draftTested.value || (savedVersion.value?.tested ?? false)) return ''
    return isDirty.value || !backendSkillId.value
      ? '按「儲存」時，這個記號會一起記在新版本上。'
      : '按「記下測過」，這一版就算測過（不會多出新版本）。'
  })

  function setAdviceMode(next: AdviceMode): void {
    if (adviceModeLocked.value) return
    adviceMode.value = next
  }

  const gateStage = ref<GateStage>('active')
  const pendingSimilarSkillId = ref<string | null>(null)
  const pausedDraft = ref<PausedDraft | null>(null)
  const gatheringRawText = ref('')        // 從零開始建立時，累積的原始文字（第一句描述＋追問答案）
  const gatheringRound = ref(0)           // gathering 階段已經問過幾輪追問（0～2）
  const awaitingSupplement = ref(false)   // confirmKnownInfo 階段是否正在等一句開放式補充內容
  // 測試沒全對時選「重新測試」：composable 自己呼叫得到 store.generateAITestScenarios，
  // 但切不了外殼（SkillStudioWorkspace）自己管的 activeTab——這個旗標讓外殼知道要
  // 切到測試 tab，讀到之後要自己歸零，單次訊號不是常駐狀態
  const requestTestTab = ref(false)
  // 修改模式下確認要開始建立新技能：composable 自己導不了路由，這個旗標讓外殼
  // 知道要把抽屜切去全新的建立流程，讀到之後要自己歸零
  const requestNewSkillDrawer = ref(false)

  const isDirty = computed(() => serialize(draft.value) !== snapshot.value)
  // 積木方式多幾項必填：說明／觸發情境／覆蓋能力／指派 Agent 都要user自己填過才能存——
  // 這幾項不再隨選章節自動覆蓋（見 updateBlockTriggerHint 等函式），必須手動確認過一次
  const canSave = computed(() => {
    if (!draft.value.name.trim() || !draft.value.instructions.trim()) return false
    if (draft.value.method === 'blocks') {
      return !!draft.value.description.trim()
        && !!draft.value.triggerHint.trim()
        && draft.value.capabilities.length > 0
        && draft.value.assignedAgents.length > 0
        && draft.value.keywords.length > 0
    }
    return true
  })
  // 建立模式：有名稱＋指令就能存；修改模式：還要真的有改動——
  // 跟 canSave 分開是因為 canSave 只管「欄位填完了沒」，這個還管「有沒有東西要存」
  const saveEnabled = computed(() => mode.value === 'create' ? canSave.value : canSave.value && isDirty.value)
  // 積木方式必填欄位比較多（說明／觸發情境／覆蓋能力／指派 Agent），存不了的時候
  // 直接列出還缺什麼，不要讓使用者自己猜按鈕為什麼反灰
  const missingFieldsHint = computed(() => {
    if (saveEnabled.value || draft.value.method !== 'blocks') return ''
    const missing: string[] = []
    if (!draft.value.name.trim()) missing.push('技能名稱')
    if (!draft.value.instructions.trim()) missing.push('積木組成（至少選一個章節）')
    if (!draft.value.description.trim()) missing.push('說明')
    if (!draft.value.triggerHint.trim()) missing.push('觸發情境')
    if (!draft.value.capabilities.length) missing.push('覆蓋能力')
    if (!draft.value.keywords.length) missing.push('關鍵字')
    if (!draft.value.assignedAgents.length) missing.push('指派 Agent')
    return missing.length ? `還缺：${missing.join('、')}` : ''
  })
  const suggestionChips = computed<StudioSuggestion[]>(() => {
    if (draft.value.method !== 'chat') return []
    return mode.value === 'create' ? CREATE_SUGGESTIONS : editSuggestions(draft.value)
  })

  function push(m: Omit<StudioMessage, 'id'>) {
    messages.value.push({ id: `studio-${++seq}`, ...m })
  }

  // 建立意圖確立後的路由：先查有沒有相近做法（不管清單空不空，findSimilarSkill 對空清單
  // 自然回傳 null）——找到就進關卡二問清楚要沿用/改/另開；沒找到（含清單本來就是空的）
  // 就開始一輪全新的資訊蒐集流程，不再先問關卡一那句「照規定/改規定/記一份新的」
  function routeBuildIntent(text: string): void {
    const similar = findSimilarSkill(text, store.myPersonalSkills)
    if (similar) {
      pendingSimilarSkillId.value = similar.id
      gateStage.value = 'gate2'
      push({ role: 'agent', content: `您已經有一份「${similar.name}」，這次要沿用他、改他還是記一份新的？` })
      return
    }
    startGathering(text)
  }

  // 開始一輪全新的資訊蒐集：重置累積文字與追問輪數，把這句話存進去，
  // 再交給 advanceGathering 判斷第一題要不要問
  function startGathering(text: string): void {
    gatheringRawText.value = text
    gatheringRound.value = 0
    awaitingSupplement.value = false
    gateStage.value = 'gathering'
    advanceGathering()
  }

  // 從目前 gatheringRound 開始，跳過使用者已經在累積文字裡講過的題目；
  // 全部題目都講過的話，直接進 confirmKnownInfo（不重複問已經回答過的內容）
  function advanceGathering(): void {
    while (gatheringRound.value < GATHERING_QUESTIONS.length) {
      if (!isGatheringQuestionAnswered(gatheringRound.value, gatheringRawText.value)) {
        push({ role: 'agent', content: GATHERING_QUESTIONS[gatheringRound.value] })
        gatheringRound.value += 1
        return
      }
      gatheringRound.value += 1
    }
    gateStage.value = 'confirmKnownInfo'
    push({ role: 'agent', content: buildKnownInfoSummary(gatheringRawText.value) })
  }

  // 唯一的頂層意圖路由：gateStage === 'intent' 時呼叫，
  // 也是關卡二「本關比對不到」時的新話題重定向共用邏輯
  function routeIntent(text: string): void {
    const kind = classifyBuildOrModify(text)

    if (kind === 'modify') {
      // 清單本來就是空的：沒有任何技能可以修改，問「要改哪一項」沒有意義。
      // 引導使用者改成描述要建立的內容，下一句話重新整個判斷一次
      if (store.myPersonalSkills.length === 0) {
        gateStage.value = 'intent'
        push({ role: 'agent', content: '目前還沒有任何個人技能可以修改，要不要先告訴我想建立什麼做法？' })
        return
      }
      const similar = findSimilarSkill(text, store.myPersonalSkills)
      if (similar) {
        loadSkill(similar.id)
        return
      }
      gateStage.value = 'findModifyTarget'
      push({ role: 'agent', content: '要修改哪一項技能？請直接說出技能名稱，或描述一下內容，我幫你找。' })
      return
    }

    if (kind === 'build') {
      routeBuildIntent(text)
      return
    }

    // kind === 'ambiguous'：明確設回 'intent'，不能假設呼叫端本來就是 'intent'——
    // 這個函式也會被其他關卡「本關比對不到」時當成重定向呼叫，那時候 gateStage
    // 還是原本那一關的值（例如 'gate2'），不明確設定的話會卡在錯的關卡
    gateStage.value = 'intent'
    push({ role: 'agent', content: '你想要記一個新做法，還是要修改現有的？直接跟我說就可以。' })
  }

  // gateStage !== 'active' 時，每則訊息都先經過這裡，依目前所在的關卡分派給對應的分支處理
  function handleGateMessage(text: string): void {
    const t = text.trim()
    const stage = gateStage.value

    if (stage === 'intent') {
      routeIntent(t)
      return
    }

    if (stage === 'findModifyTarget') {
      const similar = findSimilarSkill(t, store.myPersonalSkills)
      if (similar) {
        loadSkill(similar.id)
        return
      }
      push({ role: 'agent', content: `還是沒找到符合「${t}」的技能，可以換個說法，或直接說出正確的技能名稱嗎？` })
      return
    }

    if (stage === 'gathering') {
      gatheringRawText.value += `\n${t}`
      advanceGathering()
      return
    }

    if (stage === 'confirmKnownInfo') {
      if (awaitingSupplement.value) {
        gatheringRawText.value += `\n${t}`
        awaitingSupplement.value = false
        push({ role: 'agent', content: buildKnownInfoSummary(gatheringRawText.value) })
        return
      }
      const k = classifyKnownInfoConfirm(t)
      if (k === 'confirm') {
        const reply = interpretStudioMessage(gatheringRawText.value, draft.value, mode.value)
        if (reply.patch) draft.value = { ...draft.value, ...reply.patch }
        gateStage.value = 'gate3'
        push({
          role: 'agent',
          content: `我準備幫您記成這份做法，內容如下：\n${formatDraftSummary(draft.value)}\n這樣可以嗎？`,
        })
        return
      }
      if (k === 'retry') {
        awaitingSupplement.value = true
        push({ role: 'agent', content: '好，那請告訴我還要補充什麼。' })
        return
      }
      push({ role: 'agent', content: buildKnownInfoSummary(gatheringRawText.value) })
      return
    }

    if (stage === 'gate2') {
      const g2 = classifyGate2(t)
      if (g2 === 'follow') {
        pendingSimilarSkillId.value = null
        gateStage.value = 'active'
        push({ role: 'agent', content: NOT_IMPLEMENTED_REPLY })
        return
      }
      if (g2 === 'edit') {
        const id = pendingSimilarSkillId.value
        pendingSimilarSkillId.value = null
        if (id) loadSkill(id)
        return
      }
      if (g2 === 'new') {
        pendingSimilarSkillId.value = null
        // 保留 method：draft.value = emptyDraft() 會把 method 也清成 null，
        // SkillStudio.vue／skillBuilderViewBox.vue 都用 !conv.draft.value.method 判斷要不要
        // 顯示 SkillMethodChooser 取代掉聊天面板，這裡是在聊天面板裡回話，不能把它自己的
        // 前提條件清掉
        draft.value = { ...emptyDraft(), method: draft.value.method }
        gateStage.value = 'intent'
        push({ role: 'agent', content: '好，那我們重新開一份。請描述這份做法的內容。' })
        return
      }
      if (g2 === 'else') {
        pausedDraft.value = {
          gateStage: 'gate2',
          messages: [...messages.value],
          draft: { ...draft.value },
          pendingSimilarSkillId: pendingSimilarSkillId.value,
        }
        pendingSimilarSkillId.value = null
        // 同上：保留 method，否則這句話推出去的當下聊天面板就會被 SkillMethodChooser 取代
        draft.value = { ...emptyDraft(), method: draft.value.method }
        messages.value = []
        // 刻意不重設 seq：pausedDraft.messages 裡還留著用舊 seq 產生的訊息 id，
        // 之後 Task 6 接回來時會把這些訊息原封不動塞回 messages.value；如果這裡把
        // seq 歸零，接下來這段新話題（甚至同一輪還沒接回去前）推的新訊息就會產生
        // 跟 paused.messages 撞號的 id（例如都從 studio-1 開始），SkillStudioChat.vue
        // 用 :key="msg.id" 渲染會出問題。seq 只增不減才能保證任何時候都不撞號
        gateStage.value = 'intent'
        push({ role: 'agent', content: '好，你想問什麼或想做什麼？' })
        return
      }
      pendingSimilarSkillId.value = null
      routeIntent(t)
      return
    }

    if (stage === 'confirmStartNew') {
      // 錨定在開頭比對：避免「不是」這種否定句因為含有「是」字被誤判成確認
      if (t === ACTION_START_NEW_CONFIRM.label || /^(對|沒錯|開新的|是)/.test(t)) {
        // 使用者在這裡已經確認過了，不要讓即將導航的路由守衛又跳一次「有未儲存變更」
        // 確認對話框——先把草稿悄悄重設回已儲存版本（沒有要存的東西了，不用管 isDirty）
        if (mode.value === 'edit' && savedSkillId.value) {
          const skill = store.findSkill(savedSkillId.value)
          if (skill) {
            draft.value = draftFromSkill(skill)
            snapshot.value = serialize(draft.value)
          }
        }
        requestNewSkillDrawer.value = true
        push({ role: 'agent', content: '好，幫你開一個新的建立流程。' })
        return
      }
      gateStage.value = 'active'
      push({ role: 'agent', content: '好，那我們繼續剛剛的修改。' })
      return
    }

    if (stage === 'clarify') {
      // 測試沒全對引導訊息的兩個 action chip（也接受相近的自由輸入）：使用者可能是
      // 自己答題答錯了想重新測，或根本不在意這次沒全對、先不改直接啟用——兩者都
      // 不是要改技能內容，提早判斷掉，不要落到下面的自由文字編輯規則
      if (t === ACTION_RETEST.label || /重新測|重測|換一批|再測一次|重新出題/.test(t)) {
        // testSkillId：還沒存檔就用草稿佔位 id，draftContext 補上草稿目前的
        // name／triggerHint／capabilities 當作組題關鍵字的來源（store 裡還找不到
        // 這顆技能，或技能存在但草稿已經改過還沒存）
        store.generateAITestScenarios(testSkillId.value, {
          name: draft.value.name,
          triggerHint: draft.value.triggerHint,
          capabilities: draft.value.capabilities,
        })
        requestTestTab.value = true
        gateStage.value = 'active'
        push({ role: 'agent', content: '好，已經換一批新題目了，到「測試」tab 繼續作答。' })
        return
      }
      if (t === ACTION_FORCE_ENABLE.label || /不改.{0,4}啟用|直接啟用|先不改|先不用改/.test(t)) {
        // 已經測過就能啟用，不要求全對；沒測過的話閘門不放行，維持停用並講清楚原因
        const saved = savedSkillId.value ? store.findSkill(savedSkillId.value) : null
        gateStage.value = 'active'
        if (!saved || !canEnableSkill(saved)) {
          push({ role: 'agent', content: '這一版還沒測過，要先到「測試」tab 做一次測試（交卷就算測過，不用全對），才能啟用。' })
          return
        }
        if (!saved.isEnabled) store.toggleSkill(saved.id)
        push({ role: 'agent', content: `已啟用「${draft.value.name}」，之後想再調整的話隨時都可以跟我說。` })
        return
      }
      if (CLARIFY_DONE_HINT.test(t)) {
        gateStage.value = 'gate3'
        push({
          role: 'agent',
          content: `我準備幫您記成這份做法，內容如下：\n${formatDraftSummary(draft.value)}\n這樣可以嗎？`,
        })
        return
      }
      const reply = interpretStudioMessage(t, draft.value, mode.value)
      if (reply.patch) draft.value = { ...draft.value, ...reply.patch }
      push({ role: 'agent', content: reply.content, actions: reply.actions })
      return
    }

    if (stage === 'gate3') {
      const g3 = classifyGate3(t)
      if (g3 === 'confirm') {
        const savedId = save()
        if (!savedId) {
          // save() 在 canSave 為 false（草稿沒有名稱或指令）時回傳 null；這裡可能發生在
          // clarify 的第一句話就剛好命中 CLARIFY_DONE_HINT，直接跳過補齊內容就進了關卡三。
          // 留在／退回 clarify 讓使用者補內容，不能悶不吭聲地轉 active（等於對話卡死）
          const missing = [
            !draft.value.name.trim() ? '名稱' : null,
            !draft.value.instructions.trim() ? '指令內容' : null,
          ].filter((x): x is string => !!x)
          gateStage.value = 'clarify'
          push({ role: 'agent', content: `這份草稿還缺${missing.join('、')}，麻煩先補齊，再跟我說一次「這樣就好」確認。` })
          return
        }
        gateStage.value = 'active'
        push({ role: 'agent', content: `已存成個人技能「${draft.value.name}」，可以到「測試」tab 驗證。` })
        return
      }
      if (g3 === 'retry') {
        gateStage.value = 'clarify'
        push({ role: 'agent', content: '好，繼續說你想怎麼調整。' })
        return
      }
      push({
        role: 'agent',
        content: `我不太確定你的意思——這份做法要存成個人技能嗎？內容如下：\n${formatDraftSummary(draft.value)}\n請直接說「可以」或「還要改」。`,
      })
      return
    }
  }

  // 無 prefill：等使用者選建立方式（method null、沒有訊息）。
  // 有 prefill（Agent 建議）：一律對話方式，直接推開場。snapshot 基準刻意維持空草稿，
  // 讓預填一開始就是「有未儲存變更」，使用者得按儲存才會寫進技能
  function startCreate(prefill?: Partial<SkillDraft>, openingMessage?: string): void {
    mode.value = 'create'
    savedSkillId.value = null
    if (conversationId.value) useBackendTestStore().reset(conversationId.value)
    conversationId.value = null
    backendSkillId.value = null
    savedVersion.value = null
    lastSaveKind.value = null
    adviceMode.value = 'jev'
    note.value = { topic: '', steps: [] }
    blockedReasons.value = []
    errorHint.value = ''
    draftTestId.value = generateDraftTestId()
    const base = emptyDraft()
    draft.value = {
      ...base,
      ...prefill,
      capabilities: [...(prefill?.capabilities ?? base.capabilities)],
      files: [...(prefill?.files ?? base.files)],
      sectionIds: [...(prefill?.sectionIds ?? base.sectionIds)],
      method: prefill ? 'chat' : null,
    }
    snapshot.value = serialize(emptyDraft())
    messages.value = []
    seq = 0
    // 有 prefill：來源（例如方案三 conv4 交接）已經知道使用者要幹嘛，略過整套關卡
    gateStage.value = prefill ? 'active' : 'intent'
    // 清掉上一輪對話可能留下的暫存狀態：不清的話，「我要講別的」留下的 pausedDraft 會在
    // seq 已經歸零的新一輪裡被接回去，跟新訊息的 id 撞號；pendingSimilarSkillId 也可能
    // 指向這輪根本沒問過的東西
    pausedDraft.value = null
    pendingSimilarSkillId.value = null
    gatheringRawText.value = ''
    gatheringRound.value = 0
    awaitingSupplement.value = false
    if (prefill) push({ role: 'agent', content: openingMessage ?? DEFAULT_OPENING_MESSAGE })
  }

  function chooseMethod(method: StudioMethod): void {
    if (draft.value.method) return
    draft.value = { ...draft.value, method }
    if (method === 'chat' && messages.value.length === 0) {
      // 後端自己有階段，不用前端的關卡分流
      gateStage.value = backendEnabled() ? 'active' : 'intent'
      push({ role: 'agent', content: GATE_OPENING_MESSAGE })
    }
  }

  // 積木方式的輸入：名稱直接寫；章節變動只重推導「技能指令」——說明／觸發情境／覆蓋能力
  // 改成「基本設定」步驟的手動必填欄位，不再每次選章節就被悄悄蓋掉，使用者要調整
  // 得自己編輯，或按「AI 建議」主動套用（見 updateBlockTriggerHint 等函式）
  function updateBlocks(patch: { name?: string; sectionIds?: string[] }): void {
    if (draft.value.method !== 'blocks') return
    const next: SkillDraft = { ...draft.value }
    if (patch.name !== undefined) next.name = patch.name
    if (patch.sectionIds !== undefined) {
      next.sectionIds = [...patch.sectionIds]
      next.instructions = deriveFromSections(next.sectionIds).instructions
    }
    draft.value = next
  }

  // 積木流程「基本設定」步驟的三個手動欄位：使用者直接編輯，或透過「AI 建議」套用
  // deriveFromSections()／suggestDescriptionFromSections() 算出的建議值——都是整份取代，
  // 不做局部合併，覆蓋與否（要不要先問使用者）交給呼叫端（表單元件）的確認對話框處理
  function updateBlockDescription(value: string): void {
    if (draft.value.method !== 'blocks') return
    draft.value = { ...draft.value, description: value }
  }
  function updateBlockTriggerHint(value: string): void {
    if (draft.value.method !== 'blocks') return
    draft.value = { ...draft.value, triggerHint: value }
  }
  function updateBlockCapabilities(value: SkillCapability[]): void {
    if (draft.value.method !== 'blocks') return
    draft.value = { ...draft.value, capabilities: [...value] }
  }
  function updateBlockAssignedAgents(value: string[]): void {
    if (draft.value.method !== 'blocks') return
    draft.value = { ...draft.value, assignedAgents: [...value] }
  }
  function updateBlockKeywords(value: string[]): void {
    if (draft.value.method !== 'blocks') return
    draft.value = { ...draft.value, keywords: [...value] }
  }

  // intent 'edit'：從技能卡片點進來，已經知道要調整內容。
  // intent 'ask'：從測試沙盒點進來，剛測完可能只是想問問題，不代表一定要改東西——
  // 開場白故意不預設「要改」，留給使用者自己決定要不要動手調整
  function loadSkill(skillId: string, intent: 'edit' | 'ask' = 'edit'): boolean {
    const s = store.findSkill(skillId)
    if (!s || s.zone !== 'personal') return false
    mode.value = 'edit'
    savedSkillId.value = skillId
    draft.value = draftFromSkill(s)
    snapshot.value = serialize(draft.value)
    messages.value = []
    gateStage.value = 'active'  // 修改既有技能：已經知道要幹嘛，不用再問一輪
    // 同 startCreate()：清掉可能殘留的暫存狀態，不然舊的 pausedDraft 之後被接回來時，
    // gateStage／draft／messages／pendingSimilarSkillId 會被暫存快照蓋過去，但 mode／
    // savedSkillId 不在 PausedDraft 裡、不會一起還原，會變成「草稿內容是暫存的那份，
    // savedSkillId 卻指向這裡剛載入的技能」，之後 gate3 confirm 一存就存錯技能
    pausedDraft.value = null
    pendingSimilarSkillId.value = null
    gatheringRawText.value = ''
    gatheringRound.value = 0
    awaitingSupplement.value = false
    if (draft.value.method === 'chat') {
      const opening = intent === 'ask'
        ? `你好，我是這裡的助理。剛剛測試「${s.name}」時如果有哪裡想確認或討論，都可以直接問我，需要調整內容的話我們再一起處理。`
        : `你好，我們來調整「${s.name}」。告訴我想改哪裡，右側會即時反映。`
      push({ role: 'agent', content: opening })
    }
    return true
  }

  // 後端草稿（內文欄位叫 content）對到前端草稿（叫 instructions）
  function applyBackendDraft(backendDraft: BackendDraft): void {
    draft.value = {
      ...draft.value,
      name: backendDraft.display_name || backendDraft.name,
      skillCode: backendDraft.name,
      description: backendDraft.description,
      instructions: backendDraft.content,
    }
  }

  // 從清單進修改：用指定來源版本開後端對話，草稿載入進來；之後存回去由後端新增版本，來源版本不動
  async function loadBackendSkill(skillId: string, version: number): Promise<boolean> {
    try {
      const opened = await openModifyConversation(skillId, version, adviceMode.value)
      startCreate()
      mode.value = 'edit'
      conversationId.value = opened.conversation_id
      adviceMode.value = opened.advice_mode
      backendSkillId.value = skillId
      draft.value = { ...draft.value, method: 'chat' }
      if (opened.draft) applyBackendDraft(opened.draft)
      note.value = opened.note
      gateStage.value = 'active'
      snapshot.value = serialize(draft.value)
      if (opened.reply) push({ role: 'agent', content: opened.reply })
      return true
    } catch (error) {
      errorHint.value = describeConversationError(error)
      return false
    }
  }

  // 按「儲存」：後端把目前草稿寫成新版本（便利貼不寫）。成功回新版本，失敗回 null 並留白話提示
  async function saveToBackend(): Promise<BackendSkillVersion | null> {
    if (!conversationId.value) {
      errorHint.value = '還沒有草稿可以存，請先跟助理聊幾句。'
      return null
    }
    try {
      // 沒改內容時後端不新增版本，只標記；先記下來，存完才知道要怎麼跟使用者說
      const wasClean = !isDirty.value && (backendSkillId.value !== null || savedVersion.value !== null)
      const saved = await saveConversation(conversationId.value)
      backendSkillId.value = saved.skill_id
      savedVersion.value = saved
      lastSaveKind.value = wasClean ? 'marked' : 'new'
      errorHint.value = ''
      snapshot.value = serialize(draft.value)
      await useBackendSkillStore().refreshAfterSave(saved.skill_id)
      return saved
    } catch (error) {
      errorHint.value = describeConversationError(error)
      return null
    }
  }

  // 一句話交給後端：第一句才開對話，之後都用同一個對話代號。
  // 草稿以後端回傳的為準；被擋或失敗都在對話裡講清楚，不靜默
  async function sendToBackend(text: string): Promise<void> {
    try {
      if (!conversationId.value) {
        const opened = await openConversation(adviceMode.value)
        conversationId.value = opened.conversation_id
        adviceMode.value = opened.advice_mode   // 以後端確認的模式為準
      }
      const turn = await sendConversationMessage(conversationId.value, text)
      errorHint.value = ''
      blockedReasons.value = turn.blocked
      note.value = turn.note
      if (turn.draft) {
        const before = JSON.stringify([draft.value.skillCode, draft.value.name, draft.value.description, draft.value.instructions])
        applyBackendDraft(turn.draft)
        const after = JSON.stringify([draft.value.skillCode, draft.value.name, draft.value.description, draft.value.instructions])
        // 草稿改過，已出的題與答案不再對得上，後端也會拒收交卷；作廢讓使用者重新測
        if (before !== after) useBackendTestStore().reset(conversationId.value)
      }
      if (turn.reply) push({ role: 'agent', content: turn.reply })
      if (turn.blocked.length) {
        // 同一個原因可能被擋多次（模型同一輪重試），去重後一條一行
        push({ role: 'agent', content: `這一步先不能做：\n${[...new Set(turn.blocked)].join('\n')}` })
      }
    } catch (error) {
      errorHint.value = describeConversationError(error)
      push({ role: 'agent', content: errorHint.value })
    }
  }

  async function send(text: string): Promise<void> {
    const t = text.trim()
    if (!t || isRunning.value) return
    push({ role: 'user', content: t })
    isRunning.value = true
    if (usesBackend()) {
      await sendToBackend(t)
      isRunning.value = false
      return
    }
    await new Promise(r => setTimeout(r, 800))

    if (pausedDraft.value && wantsToResume(t, pausedDraft.value)) {
      const paused = pausedDraft.value
      gateStage.value = paused.gateStage
      messages.value = [...paused.messages]
      draft.value = paused.draft
      pendingSimilarSkillId.value = paused.pendingSimilarSkillId
      pausedDraft.value = null
      push({ role: 'agent', content: `好，回到剛才「${paused.draft.name || '那個'}」繼續。` })
      isRunning.value = false
      return
    }

    if (gateStage.value === 'active') {
      // 修改模式下，使用者在這裡明確說要建立「新」技能：先確認要不要放下目前的修改，
      // 不要直接把這句話當成編輯內容、用 interpretStudioMessage 的「其他訊息附加到
      // instructions」規則吃掉
      if (mode.value === 'edit' && WANTS_NEW_SKILL_WHILE_EDITING.test(t)) {
        gateStage.value = 'confirmStartNew'
        push({
          role: 'agent',
          content: '你是想先放下目前的修改，開始建立一份全新的技能嗎？',
          actions: [ACTION_START_NEW_CONFIRM, ACTION_START_NEW_CANCEL],
        })
        isRunning.value = false
        return
      }
      const reply = interpretStudioMessage(t, draft.value, mode.value)
      if (reply.patch) draft.value = { ...draft.value, ...reply.patch }
      push({ role: 'agent', content: reply.content, actions: reply.actions })
    } else {
      handleGateMessage(t)
    }
    isRunning.value = false
  }

  function save(): string | null {
    if (!canSave.value) return null
    const d = draft.value
    if (mode.value === 'create') {
      // 個人技能一律以未啟用落地，見 skillStore.ts 的 createPersonalSkill() 註解——
      // 要先通過 AI 快速測試（或使用者明確選擇略過）才能開，這裡不用也不該再傳 isEnabled
      const id = store.createPersonalSkill({
        name: d.name.trim(),
        description: d.description,
        instructions: d.instructions,
        triggerHint: d.triggerHint,
        assignedAgents: d.method === 'blocks' ? [...d.assignedAgents] : [],
        capabilities: [...d.capabilities],
        keywords: d.method === 'blocks' ? [...d.keywords] : [],
        files: [...d.files],
        composition: d.method === 'blocks' ? { sectionIds: [...d.sectionIds] } : undefined,
        creationMethod: d.method === 'blocks' ? 'manual' : 'ai_assisted',
      })
      mode.value = 'edit'
      // 存檔前如果已經用草稿佔位 id 測過，把測試結果轉記到這個剛拿到的真正 id 上，
      // 不要讓 testSkillId 從 draftTestId 換成 id 後，被當成「另一顆技能」清掉
      store.migrateAITestState(draftTestId.value, id)
      savedSkillId.value = id
    } else if (savedSkillId.value) {
      store.applyStudioPatch(savedSkillId.value, {
        name: d.name.trim(),
        description: d.description,
        instructions: d.instructions,
        triggerHint: d.triggerHint,
        capabilities: d.capabilities,
        assignedAgents: d.method === 'blocks' ? [...d.assignedAgents] : undefined,
        keywords: d.method === 'blocks' ? [...d.keywords] : undefined,
        composition: d.method === 'blocks' ? { sectionIds: [...d.sectionIds] } : undefined,
      })
      store.updateSkillFiles(savedSkillId.value, d.files)
    }
    snapshot.value = serialize(draft.value)
    return savedSkillId.value
  }

  function updateFiles(files: SkillFile[]): void {
    draft.value = { ...draft.value, files }
  }

  // AI 快速測試結果出來：全對就主動引導去啟用（不轉關卡，純推一句訊息，跟現有
  // save() 之後「可以到「測試」tab 驗證」是同一種寫法）；沒全對則退回既有的 clarify
  // 補齊流程（沿用「多輪問答補齊草稿內容」的既有語意，不新增一個專門的關卡）
  function notifyTestResult(report: AITestReport): void {
    if (report.total === 0) return
    if (report.correct === report.total) {
      // 「啟用技能」要有真正存進 store、而且還沒啟用的技能才會出現（isFullPass
      // 的條件，見 SkillTestAI.vue）——這裡的引導訊息要跟那個條件對齊，不然會叫
      // 使用者去點一個根本不存在的按鈕：還沒存檔先引導儲存；已經是啟用中的技能
      // （例如修改一顆早就上線的技能，這次又測到滿分）沒有按鈕可點，單純恭喜就好
      const existingSkill = savedSkillId.value ? store.findSkill(savedSkillId.value) : null
      let content: string
      if (!savedSkillId.value) {
        content = '太好了，這次全部答對了！先按左下角「儲存」，存檔後就能到測試報告點「啟用技能」了。'
      } else if (existingSkill?.isEnabled) {
        content = '太好了，這次全部答對了！這顆技能本來就是啟用中的狀態，不用再做其他動作。'
      } else {
        content = '太好了，這次全部答對了！到右側的測試報告點「啟用技能」，確認一下哪些 Agent 可以用之後就能上線了。'
      }
      push({ role: 'agent', content })
      return
    }
    const rate = Math.round((report.correct / report.total) * 100)
    gateStage.value = 'clarify'
    // 不附快捷按鈕——全部靠使用者自己打字，下面 clarify 分支本來就認得
    // 「重新測試」「不改，直接啟用」這兩種意圖（含同義的自由輸入）
    push({
      role: 'agent',
      content: `剛剛的測試沒有全部通過（答對 ${report.correct}/${report.total}，${rate}%），要不要跟我說說看哪裡需要調整？我會幫你補齊或修正做法內容。也可能是你剛剛答題時選錯了，或這次先不處理也沒關係。`,
    })
  }

  function toSnapshot(): StudioSnapshot {
    return JSON.parse(JSON.stringify({
      mode: mode.value,
      savedSkillId: savedSkillId.value,
      draft: draft.value,
      messages: messages.value,
      gateStage: gateStage.value,
      pendingSimilarSkillId: pendingSimilarSkillId.value,
      gatheringRawText: gatheringRawText.value,
      gatheringRound: gatheringRound.value,
      awaitingSupplement: awaitingSupplement.value,
    }))
  }

  function hydrate(snap: StudioSnapshot): void {
    const copy: StudioSnapshot = JSON.parse(JSON.stringify(snap))
    mode.value = copy.mode
    savedSkillId.value = copy.savedSkillId
    draft.value = copy.draft
    messages.value = copy.messages
    // 舊快照（早於這兩個欄位存在時寫入）沒有這兩個值，退回原本的預設：gateStage 當作
    // 已經分流完畢、pendingSimilarSkillId 當作沒有待處理的相近技能
    gateStage.value = copy.gateStage ?? 'active'
    pendingSimilarSkillId.value = copy.pendingSimilarSkillId ?? null
    gatheringRawText.value = copy.gatheringRawText ?? ''
    gatheringRound.value = copy.gatheringRound ?? 0
    awaitingSupplement.value = copy.awaitingSupplement ?? false
    // dirty 基準取自「目前已儲存的內容」而非「這份快照本身」：isDirty 才會是
    // 「跟已存的技能（或空白，若還沒存過）不一樣」，而不是「跟上次 hydrate 不一樣」
    const saved = copy.savedSkillId ? store.findSkill(copy.savedSkillId) : undefined
    snapshot.value = saved ? serialize(draftFromSkill(saved)) : serialize(emptyDraft())
    // 接續既有訊息 id，避免之後 push 撞號
    seq = copy.messages.reduce((max, m) => Math.max(max, Number(m.id.replace('studio-', '')) || 0), 0)
  }

  // block 指到的技能已被刪除時：草稿保留，但退回建立模式，下次儲存會建立新技能
  function detachSavedSkill(): void {
    savedSkillId.value = null
    mode.value = 'create'
    snapshot.value = serialize(emptyDraft())
  }

  return {
    mode, savedSkillId, testSkillId, draft, messages, isRunning, conversationId, backendSkillId, savedVersion, loadBackendSkill, saveToBackend, usesBackend, backendSaveAction, testedNote, lastSaveKind, draftTested, adviceMode, adviceModeLocked, showAdviceModeSwitch, setAdviceMode, note, blockedReasons, errorHint, isDirty, canSave, saveEnabled, missingFieldsHint, suggestionChips, gateStage, requestTestTab, requestNewSkillDrawer,
    startCreate, chooseMethod, updateBlocks, updateBlockDescription, updateBlockTriggerHint, updateBlockCapabilities, updateBlockAssignedAgents, updateBlockKeywords,
    loadSkill, send, save, updateFiles, notifyTestResult, toSnapshot, hydrate, detachSavedSkill,
  }
}
