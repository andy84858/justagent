import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useSkillStore } from '@/stores/skillStore'
import {
  DEFAULT_OPENING_MESSAGE,
  deriveFromSections,
  suggestDescriptionVariants,
  suggestTriggerHintVariants,
  emptyDraft,
  extractSkillName,
  interpretStudioMessage,
  useSkillStudioConversation,
  classifyBuildOrModify,
  findSimilarSkill,
  wantsToResume,
  formatDraftSummary,
} from '@/composables/useSkillStudioConversation'
import type { Skill, PausedDraft } from '@/composables/useSkillStudioConversation'

describe('extractSkillName', () => {
  it('取「建立／幫我做／需要」之後、「的技能／的 Skill」之前的片段，並去掉量詞與「能／可以」', () => {
    expect(extractSkillName('幫我建立一個能查 ERP 庫存的技能')).toBe('查 ERP 庫存')
    expect(extractSkillName('我需要一個可以整理會議紀錄的 Skill')).toBe('整理會議紀錄')
  })
  it('沒有關鍵字時取第一個子句前 12 字', () => {
    expect(extractSkillName('把每週會議逐字稿整理成週報，要有待辦')).toBe('把每週會議逐字稿整理成週')
  })
  it('空字串退回「新技能」', () => {
    expect(extractSkillName('   ')).toBe('新技能')
  })
  it('多行輸入（gathering 累積文字）：第一行沒有關鍵字比對、也沒有標點時，只取第一行內容，不跨行帶出換行字元', () => {
    const name = extractSkillName('每週整理銷售報告給主管\n遇到月底要加上對比\n先抓數字再寫摘要')
    expect(name).not.toContain('\n')
    expect(name).toBe('每週整理銷售報告給主管')
  })
  it('句子裡有「需要」但後面沒有「的技能／的 Skill」終止詞：不誤判成關鍵字句型，退回逗號斷句規則，不會抓到字串結尾變成一長串斷在詞中間的怪名字', () => {
    const name = extractSkillName('我每個月都要產出月報表，需要統計上個月各項數據，這件事情以後每個月都要做')
    expect(name).toBe('我每個月都要產出月報表')
  })
  it('斷句前先拿掉括號內容（全形／半形）：不會把名稱硬切在括號中間', () => {
    const name = extractSkillName('我每個月月初（第一個工作天）都固定要產出給總公司的月報表（csv格式），資料來源是ERP 系統')
    expect(name).not.toContain('（')
    expect(name).not.toContain('）')
    expect(name).toBe('我每個月月初都固定要產出')
  })
  it('整句都是括號內容：拿掉括號後變空字串，退回原本的第一行內容，不會回傳「新技能」', () => {
    const name = extractSkillName('（這整句都是括號內容）')
    expect(name).not.toBe('新技能')
    expect(name).toContain('括號內容')
  })
})

describe('interpretStudioMessage', () => {
  it('建立模式第一句：產生名稱／說明／觸發／三步驟／兩項能力，並帶三個動作 chip', () => {
    const reply = interpretStudioMessage('幫我建立一個能查 ERP 庫存的技能', emptyDraft(), 'create')
    expect(reply.patch?.name).toBe('查 ERP 庫存')
    expect(reply.patch?.description).toBe('幫我建立一個能查 ERP 庫存的技能')
    expect(reply.patch?.triggerHint).toBe('當使用者提到「查 ERP 庫存」相關需求時')
    expect(reply.patch?.instructions?.split('\n')).toHaveLength(3)
    expect(reply.patch?.capabilities).toHaveLength(2)
    expect(reply.actions?.map(a => a.label)).toEqual(['看起來沒問題，儲存', '觸發條件要更精準', '再補一個步驟'])
  })

  it('改名：優先取引號內文字', () => {
    const draft = { ...emptyDraft(), name: '舊' }
    const reply = interpretStudioMessage('名稱改成「庫存速查」', draft, 'edit')
    expect(reply.patch?.name).toBe('庫存速查')
    expect(reply.content).toContain('庫存速查')
  })

  it('觸發：更新 triggerHint', () => {
    const draft = { ...emptyDraft(), name: 'x' }
    const reply = interpretStudioMessage('觸發條件改成當使用者問缺貨時', draft, 'edit')
    expect(reply.patch?.triggerHint).toBe('當使用者問缺貨時')
  })

  it('加步驟：依現有步驟數接續編號', () => {
    const draft = { ...emptyDraft(), name: 'x', instructions: '1. a\n2. b\n3. c' }
    const reply = interpretStudioMessage('再補一個步驟', draft, 'edit')
    expect(reply.patch?.instructions).toBe('1. a\n2. b\n3. c\n4. 檢查輸出結果，必要時補充說明')
    expect(reply.content).toBe('已追加第 4 步。')
  })

  it('加能力：push 一項 capability（hashtag，不支援空白）', () => {
    const draft = { ...emptyDraft(), name: 'x', capabilities: ['a'] }
    const reply = interpretStudioMessage('還能匯出PDF', draft, 'edit')
    expect(reply.patch?.capabilities).toHaveLength(2)
    expect(reply.patch?.capabilities?.[1]).toBe('匯出PDF')
  })

  it('加能力：一句話講多個（空白分隔），各自成一個 hashtag', () => {
    const draft = { ...emptyDraft(), name: 'x', capabilities: ['a'] }
    const reply = interpretStudioMessage('還能匯出成 Excel', draft, 'edit')
    expect(reply.patch?.capabilities).toEqual(['a', '匯出成', 'Excel'])
    expect(reply.content).toBe('已新增 2 項覆蓋能力。')
  })

  it('動作 chip「看起來沒問題，儲存」不改草稿，只回提示', () => {
    const draft = { ...emptyDraft(), name: 'x', instructions: '1. a' }
    const reply = interpretStudioMessage('看起來沒問題，儲存', draft, 'create')
    expect(reply.patch).toBeUndefined()
    expect(reply.content).toContain('儲存為個人技能')
  })

  it('其他訊息：附加到 instructions', () => {
    const draft = { ...emptyDraft(), name: 'x', instructions: '1. a' }
    const reply = interpretStudioMessage('語氣要親切一點', draft, 'edit')
    expect(reply.patch?.instructions).toBe('1. a\n\n（依對話更新）語氣要親切一點')
  })

  it('一般領域句子含「叫」不誤判成改名：附加到 instructions，name 不變', () => {
    const draft = { ...emptyDraft(), name: 'x', instructions: '1. a' }
    const reply = interpretStudioMessage('庫存不足時要自動叫貨', draft, 'edit')
    expect(reply.patch?.name).toBeUndefined()
    expect(reply.patch?.instructions).toBe('1. a\n\n（依對話更新）庫存不足時要自動叫貨')
  })

  it('一般領域句子含「補」不誤判成加步驟：附加到 instructions，不新增編號步驟', () => {
    const draft = { ...emptyDraft(), name: 'x', instructions: '1. a' }
    const reply = interpretStudioMessage('補貨流程要通知採購', draft, 'edit')
    expect(reply.patch?.instructions).toBe('1. a\n\n（依對話更新）補貨流程要通知採購')
  })
})

describe('useSkillStudioConversation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('startCreate() 無 prefill：建立模式、method 為 null、沒有訊息、canSave 為 false', () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    expect(c.mode.value).toBe('create')
    expect(c.draft.value).toEqual(emptyDraft())
    expect(c.draft.value.method).toBe(null)
    expect(c.messages.value).toHaveLength(0)
    expect(c.canSave.value).toBe(false)
    expect(c.isDirty.value).toBe(false)
  })

  it('send 推入使用者訊息、800ms 後套用 patch 並推入 Agent 回覆', async () => {
    const c = useSkillStudioConversation()
    c.startCreate({}, '開場白')
    c.chooseMethod('chat')
    const p = c.send('幫我建立一個能查 ERP 庫存的技能')
    expect(c.isRunning.value).toBe(true)
    expect(c.messages.value.at(-1)?.role).toBe('user')
    await vi.advanceTimersByTimeAsync(800)
    await p
    expect(c.isRunning.value).toBe(false)
    expect(c.draft.value.name).toBe('查 ERP 庫存')
    expect(c.messages.value.at(-1)?.role).toBe('agent')
    expect(c.messages.value.at(-1)?.actions).toHaveLength(3)
    expect(c.canSave.value).toBe(true)
    expect(c.isDirty.value).toBe(true)
  })

  it('save 於建立模式呼叫 createPersonalSkill（ai_assisted）、轉成 edit 模式並清除 dirty', async () => {
    const store = useSkillStore()
    const c = useSkillStudioConversation()
    c.startCreate({}, '開場白')
    c.chooseMethod('chat')
    const p = c.send('幫我建立一個能查 ERP 庫存的技能')
    await vi.advanceTimersByTimeAsync(800)
    await p
    const id = c.save()
    expect(id).toBeTruthy()
    expect(c.mode.value).toBe('edit')
    expect(c.savedSkillId.value).toBe(id)
    expect(c.isDirty.value).toBe(false)
    const skill = store.findSkill(id!)!
    expect(skill.creationMethod).toBe('ai_assisted')
    expect(skill.name).toBe('查 ERP 庫存')
    // 個人技能建立時一律未啟用，要先通過 AI 快速測試（或明確選擇略過）才能開
    expect(skill.isEnabled).toBe(false)
  })

  it('loadSkill 對個人技能回 true 並帶入草稿；對 Library 技能／不存在 id 回 false', () => {
    const c = useSkillStudioConversation()
    expect(c.loadSkill('personal-001')).toBe(true)
    expect(c.mode.value).toBe('edit')
    expect(c.draft.value.name).toBe('週報自動生成')
    expect(c.messages.value[0].content).toContain('週報自動生成')
    expect(c.loadSkill('sys-cs-001')).toBe(false)
    expect(c.loadSkill('nope')).toBe(false)
  })

  it('loadSkill 帶 intent="ask"：開場白換一句「剛剛測試」的問句，不是預設「要改」的版本', () => {
    const c1 = useSkillStudioConversation()
    c1.loadSkill('personal-001', 'edit')
    const editOpening = c1.messages.value[0].content

    const c2 = useSkillStudioConversation()
    expect(c2.loadSkill('personal-001', 'ask')).toBe(true)
    expect(c2.mode.value).toBe('edit')
    const askOpening = c2.messages.value[0].content
    expect(askOpening).toContain('週報自動生成')
    expect(askOpening).toContain('測試')
    expect(askOpening).not.toBe(editOpening)
  })

  it('save 於修改模式呼叫 applyStudioPatch，內容寫回 store', async () => {
    const store = useSkillStore()
    const c = useSkillStudioConversation()
    c.loadSkill('personal-001')
    const p = c.send('名稱改成「週報小幫手」')
    await vi.advanceTimersByTimeAsync(800)
    await p
    expect(c.isDirty.value).toBe(true)
    c.save()
    expect(store.findSkill('personal-001')!.name).toBe('週報小幫手')
    expect(c.isDirty.value).toBe(false)
  })

  it('canSave 為 false 時 save 回 null 且不建立技能', () => {
    const store = useSkillStore()
    const before = store.myPersonalSkills.length
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    expect(c.save()).toBeNull()
    expect(store.myPersonalSkills.length).toBe(before)
  })

  it('suggestionChips：建立模式三則固定；修改模式依內容有無切換動詞', () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    expect(c.suggestionChips.value).toHaveLength(3)
    expect(c.suggestionChips.value[0].label).toBe('幫我建立一個能查 ERP 庫存的技能')
    c.loadSkill('personal-001')
    const labels = c.suggestionChips.value.map(s => s.label)
    expect(labels).toContain('調整技能指令')
    expect(labels).toContain('調整觸發條件')
  })

  it('startCreate(prefill, openingMessage)：草稿預填、isDirty 為 true、canSave 依內容、開場訊息採用指定文字', () => {
    const c = useSkillStudioConversation()
    c.startCreate(
      { name: '產品銷售報告整理', instructions: '1. 查詢\n2. 套用規範', triggerHint: '偵測到整理需求' },
      '這顆技能來自本對話的「查詢銷售資料」流程。'
    )
    expect(c.mode.value).toBe('create')
    expect(c.draft.value.name).toBe('產品銷售報告整理')
    expect(c.draft.value.description).toBe('')
    expect(c.draft.value.method).toBe('chat')
    expect(c.isDirty.value).toBe(true)
    expect(c.canSave.value).toBe(true)
    expect(c.messages.value).toHaveLength(1)
    expect(c.messages.value[0].content).toBe('這顆技能來自本對話的「查詢銷售資料」流程。')
  })

  it('預填後的第一句走改名規則，不會被「第一句擬草稿」規則覆寫', async () => {
    const c = useSkillStudioConversation()
    c.startCreate({ name: '舊名', instructions: '1. a' })
    const p = c.send('名稱改成「新名」')
    await vi.advanceTimersByTimeAsync(800)
    await p
    expect(c.draft.value.name).toBe('新名')
    expect(c.draft.value.instructions).toBe('1. a')
  })

  it('toSnapshot / hydrate 往返：內容一致、create 模式下 hydrate 後 isDirty=true（內容與空白不同）、之後新訊息 id 不重複', async () => {
    const a = useSkillStudioConversation()
    a.startCreate({}, '開場白')
    a.chooseMethod('chat')
    const p = a.send('幫我建立一個能查 ERP 庫存的技能')
    await vi.advanceTimersByTimeAsync(800)
    await p
    const snap = a.toSnapshot()
    expect(snap.mode).toBe('create')
    expect(snap.draft.name).toBe('查 ERP 庫存')
    expect(snap.messages).toHaveLength(3)

    const b = useSkillStudioConversation()
    b.hydrate(snap)
    expect(b.draft.value).toEqual(snap.draft)
    expect(b.messages.value.map(m => m.id)).toEqual(snap.messages.map(m => m.id))
    // 未儲存過（create 模式），基準是空草稿，所以 hydrate 後仍算「未儲存變更」
    expect(b.isDirty.value).toBe(true)
    // 深拷貝：改 b 不影響 snap
    b.updateFiles([])
    b.draft.value.capabilities.push('x')
    expect(snap.draft.capabilities).toHaveLength(2)

    const q = b.send('再補一個步驟')
    await vi.advanceTimersByTimeAsync(800)
    await q
    const ids = b.messages.value.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('hydrate 基準取自已儲存技能：loadSkill 後 toSnapshot／新實例 hydrate，isDirty 應為 false；再改草稿才變 true', () => {
    const a = useSkillStudioConversation()
    a.loadSkill('personal-001')
    const snap = a.toSnapshot()

    const b = useSkillStudioConversation()
    b.hydrate(snap)
    expect(b.isDirty.value).toBe(false)

    b.draft.value.name = '改個名字'
    expect(b.isDirty.value).toBe(true)
  })

  it('detachSavedSkill：清掉 savedSkillId、退回 create、isDirty 為 true', () => {
    const c = useSkillStudioConversation()
    c.loadSkill('personal-001')
    expect(c.isDirty.value).toBe(false)
    c.detachSavedSkill()
    expect(c.savedSkillId.value).toBeNull()
    expect(c.mode.value).toBe('create')
    expect(c.isDirty.value).toBe(true)
    expect(c.draft.value.name).toBe('週報自動生成') // 草稿內容保留
  })

  it('chooseMethod(chat) 推開場訊息；chooseMethod(blocks) 不推訊息且 suggestionChips 為空', () => {
    const a = useSkillStudioConversation()
    a.startCreate()
    a.chooseMethod('chat')
    expect(a.draft.value.method).toBe('chat')
    expect(a.messages.value).toHaveLength(1)
    // 無 prefill 走意圖判斷關卡（見「gateStage：進入點」），開場白不是既有 DEFAULT_OPENING_MESSAGE
    expect(a.messages.value[0].content).not.toBe(DEFAULT_OPENING_MESSAGE)
    expect(a.gateStage.value).toBe('intent')
    const b = useSkillStudioConversation()
    b.startCreate()
    b.chooseMethod('blocks')
    expect(b.draft.value.method).toBe('blocks')
    expect(b.messages.value).toHaveLength(0)
    expect(b.suggestionChips.value).toEqual([])
  })

  it('method 不列入 dirty 比對：光選方式不算未儲存變更，選完再改內容才算', () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('blocks')
    expect(c.isDirty.value).toBe(false)
    c.updateBlocks({ sectionIds: ['promo_kpi'] })
    expect(c.isDirty.value).toBe(true)
  })

  it('toSnapshot / hydrate 往返：gathering 階段累積的原始文字與追問輪數要一併帶過去，不會在新實例裡被重置成初始值', async () => {
    const sendAndWait = async (c: ReturnType<typeof useSkillStudioConversation>, text: string) => {
      const p = c.send(text)
      await vi.advanceTimersByTimeAsync(800)
      await p
    }
    const a = useSkillStudioConversation()
    a.startCreate()
    a.chooseMethod('chat')
    await sendAndWait(a, '我要新增一份規定')
    expect(a.gateStage.value).toBe('gathering')
    await sendAndWait(a, '沒有特殊例外')
    expect(a.gateStage.value).toBe('gathering')

    const snap = a.toSnapshot()
    expect(snap.gatheringRawText).toBe('我要新增一份規定\n沒有特殊例外')
    expect(snap.gatheringRound).toBe(2)

    const b = useSkillStudioConversation()
    b.hydrate(snap)

    // 同一句下一則訊息送給兩個實例，如果 gatheringRawText／gatheringRound 有正確帶過去，
    // 兩邊應該產生一模一樣的下一句 Agent 回覆（都轉進 confirmKnownInfo，摘要內容一致）；
    // 如果 hydrate 沒帶到，b 的 gatheringRawText 會是空字串、gatheringRound 會是 0，
    // 送出同一句話後會表現成「還在追問第一輪」而不是「已經問完兩輪、轉摘要確認」
    await sendAndWait(a, '照標準流程執行')
    await sendAndWait(b, '照標準流程執行')
    expect(a.gateStage.value).toBe('confirmKnownInfo')
    expect(b.gateStage.value).toBe('confirmKnownInfo')
    expect(b.messages.value.at(-1)!.content).toBe(a.messages.value.at(-1)!.content)
  })

  it('只選了方式的快照被另一個實例 hydrate：isDirty 仍為 false（method 差異不該跨實例變成未儲存變更）', () => {
    const a = useSkillStudioConversation()
    a.startCreate()
    a.chooseMethod('blocks')
    const snap = a.toSnapshot()

    const b = useSkillStudioConversation()
    b.hydrate(snap)
    expect(b.draft.value.method).toBe('blocks')
    expect(b.isDirty.value).toBe(false)
  })

  it('loadSkill 後 isDirty 仍為 false（method 由有無 composition 推得，不影響 dirty 基準）', () => {
    const c = useSkillStudioConversation()
    expect(c.loadSkill('personal-001')).toBe(true)
    expect(c.draft.value.method).toBe('chat') // personal-001 無 composition
    expect(c.isDirty.value).toBe(false)
  })

  it('deriveFromSections：編號步驟、分類觸發條件、每章一項能力；空清單全空', () => {
    const d = deriveFromSections(['promo_kpi', 'ta_gender'])
    expect(d.instructions).toBe('依序產出以下章節：\n1. 促銷核心 KPI：完成訂單數、GMV、折扣總額、折扣佔比、規則數。\n2. 性別分布：會員性別分布資料，圖表自動生成。')
    expect(d.triggerHint).toBe('當使用者要求產出行銷報告，或提到「TA 用戶畫像、行銷活動成效」相關分析時')
    // hashtag 不支援空白，章節名稱含空白的（「促銷核心 KPI」）轉成能力標籤時去掉
    expect(d.capabilities).toEqual(['促銷核心KPI', '性別分布'])
    expect(deriveFromSections([])).toEqual({ instructions: '', triggerHint: '', capabilities: [] })
    expect(deriveFromSections(['nope']).instructions).toBe('')
  })

  it('suggestDescriptionVariants／suggestTriggerHintVariants：各回傳 3 句不同措辭；空清單回傳空陣列', () => {
    const descriptions = suggestDescriptionVariants(['promo_kpi', 'ta_gender'])
    expect(descriptions).toHaveLength(3)
    expect(new Set(descriptions).size).toBe(3) // 三句彼此不同，不是同一句重複三次
    descriptions.forEach(d => expect(d).toContain('TA 用戶畫像、行銷活動成效'))

    const triggerHints = suggestTriggerHintVariants(['promo_kpi', 'ta_gender'])
    expect(triggerHints).toHaveLength(3)
    expect(new Set(triggerHints).size).toBe(3)
    triggerHints.forEach(t => expect(t).toContain('TA 用戶畫像、行銷活動成效'))

    expect(suggestDescriptionVariants([])).toEqual([])
    expect(suggestTriggerHintVariants([])).toEqual([])
  })

  it('updateBlocks：只在 blocks 方式生效；sectionIds 變動只重推導技能指令，不自動覆蓋說明／觸發情境／關鍵字／覆蓋能力', () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('blocks')
    expect(c.canSave.value).toBe(false)
    c.updateBlocks({ name: '行銷週報' })
    expect(c.canSave.value).toBe(false) // 還沒有章節
    c.updateBlocks({ sectionIds: ['promo_kpi'] })
    expect(c.draft.value.instructions).toContain('1. 促銷核心 KPI')
    // 說明／觸發情境／覆蓋能力改成手動必填欄位，不再隨選章節自動覆蓋
    expect(c.draft.value.capabilities).toHaveLength(0)
    expect(c.draft.value.triggerHint).toBe('')
    expect(c.canSave.value).toBe(false) // 還缺說明／觸發情境／關鍵字／覆蓋能力／指派 Agent
    expect(c.isDirty.value).toBe(true)
    c.updateBlockDescription('每週一產出')
    c.updateBlockTriggerHint('當使用者要求產出週報時')
    c.updateBlockKeywords(['週報'])
    c.updateBlockCapabilities(['促銷核心KPI'])
    c.updateBlockAssignedAgents(['客服中心助理'])
    expect(c.draft.value.description).toBe('每週一產出')
    expect(c.draft.value.instructions).toContain('1. 促銷核心 KPI') // 未重推導、未清空
    expect(c.canSave.value).toBe(true)

    const chat = useSkillStudioConversation()
    chat.startCreate()
    chat.chooseMethod('chat')
    chat.updateBlocks({ sectionIds: ['promo_kpi'] })
    expect(chat.draft.value.sectionIds).toEqual([])
  })

  it('save（blocks）：寫入 composition／creationMethod manual／指派 Agent；loadSkill 還原 method 與 sectionIds 且不推訊息', () => {
    const store = useSkillStore()
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('blocks')
    c.updateBlocks({ name: '行銷週報', sectionIds: ['promo_kpi', 'ch_kpi'] })
    c.updateBlockDescription('每週一產出')
    c.updateBlockTriggerHint('當使用者要求產出週報時')
    c.updateBlockKeywords(['週報'])
    c.updateBlockCapabilities(['促銷核心KPI'])
    c.updateBlockAssignedAgents(['客服中心助理'])
    const id = c.save()!
    const s = store.findSkill(id)!
    expect(s.composition).toEqual({ sectionIds: ['promo_kpi', 'ch_kpi'] })
    expect(s.creationMethod).toBe('manual')
    expect(s.assignedAgents).toEqual(['客服中心助理'])
    expect(s.keywords).toEqual(['週報'])

    const d = useSkillStudioConversation()
    expect(d.loadSkill(id)).toBe(true)
    expect(d.draft.value.method).toBe('blocks')
    expect(d.draft.value.sectionIds).toEqual(['promo_kpi', 'ch_kpi'])
    expect(d.draft.value.assignedAgents).toEqual(['客服中心助理'])
    expect(d.draft.value.keywords).toEqual(['週報'])
    expect(d.messages.value).toHaveLength(0)
    expect(d.isDirty.value).toBe(false)

    const e = useSkillStudioConversation()
    e.loadSkill('personal-001')
    expect(e.draft.value.method).toBe('chat')
    expect(e.messages.value).toHaveLength(1)
  })
})

describe('classifyBuildOrModify', () => {
  it('含「修改」訊號（不論長短）→ modify', () => {
    expect(classifyBuildOrModify('修改')).toBe('modify')
    expect(classifyBuildOrModify('我想調整一下技能的觸發條件')).toBe('modify')
    expect(classifyBuildOrModify('更新技能內容')).toBe('modify')
  })

  it('含建立訊號，或長度夠長的一般描述 → build（預設值）', () => {
    expect(classifyBuildOrModify('幫我建立一個能查 ERP 庫存的技能')).toBe('build')
    expect(classifyBuildOrModify('把每週會議逐字稿整理成週報')).toBe('build')
  })

  it('極短且無任何訊號 → ambiguous', () => {
    expect(classifyBuildOrModify('嗯')).toBe('ambiguous')
  })

  it('修改訊號優先於長度規則：一有「修改」二字就是 modify，不管多長', () => {
    expect(classifyBuildOrModify('我想要修改一下這個做法的內容跟觸發條件')).toBe('modify')
  })
})

describe('findSimilarSkill', () => {
  const skills: Skill[] = [
    {
      id: 's1', name: '產品銷售報告整理', description: '', type: 'extension', origin: 'manually_created',
      version: '初始版本', isEnabled: true, usageCount: 0, testPassRate: 0, avgLatencyMs: 0,
      triggerHint: '查詢銷售資料', instructions: '整理銷售報告',
    },
  ]

  it('有關鍵字重疊時回傳分數最高的技能', () => {
    expect(findSimilarSkill('我要處理銷售報告的事情', skills)?.id).toBe('s1')
  })

  it('沒有重疊回傳 null', () => {
    expect(findSimilarSkill('今天天氣真好', skills)).toBeNull()
  })

  it('空字串回傳 null', () => {
    expect(findSimilarSkill('', skills)).toBeNull()
  })
})

describe('wantsToResume', () => {
  const paused: PausedDraft = {
    gateStage: 'gate2',
    messages: [],
    draft: { ...emptyDraft(), name: '產品銷售報告整理' },
    pendingSimilarSkillId: null,
  }

  it('含接續關鍵字 → true', () => {
    expect(wantsToResume('我們繼續剛才的', paused)).toBe(true)
    expect(wantsToResume('回到上次那個', paused)).toBe(true)
  })

  it('直接提到暫存草稿名稱 → true', () => {
    expect(wantsToResume('產品銷售報告整理那份要怎麼弄', paused)).toBe(true)
  })

  it('都沒有 → false', () => {
    expect(wantsToResume('今天天氣真好', paused)).toBe(false)
  })

  it('暫存草稿沒有名稱時，不會誤判空字串包含在任何話裡', () => {
    const noName: PausedDraft = { ...paused, draft: { ...emptyDraft() } }
    expect(wantsToResume('今天天氣真好', noName)).toBe(false)
  })
})

describe('formatDraftSummary', () => {
  it('整理草稿目前欄位成摘要文字', () => {
    const draft = {
      ...emptyDraft(),
      name: '產品銷售報告整理',
      triggerHint: '查詢銷售資料時',
      instructions: '1. 查詢資料\n2. 產出報告',
      capabilities: ['查詢資料'],
    }
    const summary = formatDraftSummary(draft)
    expect(summary).toContain('產品銷售報告整理')
    expect(summary).toContain('查詢銷售資料時')
    expect(summary).toContain('查詢資料')
  })

  it('欄位是空的時候顯示未設定提示，不是空字串', () => {
    const summary = formatDraftSummary(emptyDraft())
    expect(summary).not.toContain('名稱：\n')
    expect(summary).toContain('未命名')
  })
})

describe('gateStage：進入點', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('全新對話（無 prefill）選「用對話建立」：gateStage 是 intent，且推一句開場白（不是既有 DEFAULT_OPENING_MESSAGE）', () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    expect(c.gateStage.value).toBe('intent')
    expect(c.messages.value).toHaveLength(1)
    expect(c.messages.value[0].role).toBe('agent')
  })

  it('有 prefill（例如方案三 conv4 交接）：gateStage 直接是 active，略過整套關卡', () => {
    const c = useSkillStudioConversation()
    c.startCreate({ name: '產品銷售報告整理' }, '開場白')
    expect(c.gateStage.value).toBe('active')
  })

  it('loadSkill（修改既有技能）：gateStage 直接是 active', () => {
    const c = useSkillStudioConversation()
    expect(c.loadSkill('personal-001')).toBe(true)
    expect(c.gateStage.value).toBe('active')
  })
})

describe('意圖判斷（gateStage intent）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  async function sendAndWait(c: ReturnType<typeof useSkillStudioConversation>, text: string) {
    const p = c.send(text)
    await vi.advanceTimersByTimeAsync(800)
    await p
  }

  it('清單為空＋建立意圖：不再有快速路徑，統一轉 gathering 開始追問', async () => {
    const store = useSkillStore()
    store.myPersonalSkills.forEach(s => store.deletePersonalSkill(s.id))
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, '幫我建立一個能查 ERP 庫存的技能')
    expect(c.gateStage.value).toBe('gathering')
    expect(c.messages.value.at(-1)!.content).toBe('還有沒有需要特別注意的情況或例外？')
  })

  it('清單非空＋建立意圖，找到相近做法：不再問關卡一，一句話直接轉 gate2', async () => {
    const store = useSkillStore()
    const target = store.myPersonalSkills[0]
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, `幫我記一個${target.name}的做法`)
    expect(c.gateStage.value).toBe('gate2')
    expect(c.messages.value.at(-1)!.content).toContain(target.name)
  })

  it('清單非空＋建立意圖，找不到相近做法：不再問關卡一，一句話直接轉 gathering', async () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, '我要新增一份規定')
    expect(c.gateStage.value).toBe('gathering')
    expect(c.messages.value.at(-1)!.content).toBe('還有沒有需要特別注意的情況或例外？')
  })

  it('修改意圖，找到相近技能：直接 loadSkill 進修改模式', async () => {
    const store = useSkillStore()
    const target = store.myPersonalSkills[0]
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, `幫我修改${target.name}這個技能`)
    expect(c.gateStage.value).toBe('active')
    expect(c.mode.value).toBe('edit')
    expect(c.savedSkillId.value).toBe(target.id)
  })

  it('修改意圖，找不到相近技能：轉 findModifyTarget', async () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, '我想修改一下技能設定')
    expect(c.gateStage.value).toBe('findModifyTarget')
  })

  it('修改意圖，但清單是空的：回覆沒有技能可改，gateStage 留在 intent', async () => {
    const store = useSkillStore()
    store.myPersonalSkills.forEach(s => store.deletePersonalSkill(s.id))
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, '我想修改一下技能設定')
    expect(c.gateStage.value).toBe('intent')
    expect(c.messages.value.at(-1)!.content).toContain('還沒有任何個人技能可以修改')
  })

  it('太模糊：gateStage 留在 intent，推一句澄清問句', async () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, '嗯')
    expect(c.gateStage.value).toBe('intent')
    expect(c.messages.value.at(-1)!.content).toContain('記一個新做法')
  })
})

describe('findModifyTarget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  async function sendAndWait(c: ReturnType<typeof useSkillStudioConversation>, text: string) {
    const p = c.send(text)
    await vi.advanceTimersByTimeAsync(800)
    await p
  }

  it('第二句提到某顆技能：找到了，直接 loadSkill', async () => {
    const store = useSkillStore()
    const target = store.myPersonalSkills[0]
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, '我想修改一下技能設定')
    expect(c.gateStage.value).toBe('findModifyTarget')
    await sendAndWait(c, target.name)
    expect(c.gateStage.value).toBe('active')
    expect(c.mode.value).toBe('edit')
    expect(c.savedSkillId.value).toBe(target.id)
  })

  it('還是找不到：換句話重問，不是逐字重複入口訊息', async () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, '我想修改一下技能設定')
    const entryMessage = c.messages.value.at(-1)!.content
    await sendAndWait(c, '就是那個東西')
    expect(c.gateStage.value).toBe('findModifyTarget')
    expect(c.messages.value.at(-1)!.content).not.toBe(entryMessage)
  })
})

describe('關卡二與暫存草稿', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  async function sendAndWait(c: ReturnType<typeof useSkillStudioConversation>, text: string) {
    const p = c.send(text)
    await vi.advanceTimersByTimeAsync(800)
    await p
  }

  async function reachGate2(c: ReturnType<typeof useSkillStudioConversation>, skillName: string) {
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, `幫我記一個${skillName}的做法`)
  }

  it('關卡二選「照現有規定做」：推 TODO 佔位，gateStage 轉 active，清掉 pendingSimilarSkillId', async () => {
    const store = useSkillStore()
    const c = useSkillStudioConversation()
    await reachGate2(c, store.myPersonalSkills[0].name)
    expect(c.gateStage.value).toBe('gate2')
    await sendAndWait(c, '照現有規定做')
    expect(c.gateStage.value).toBe('active')
    expect(c.messages.value.at(-1)!.content).toContain('還在學怎麼幫你直接處理')
  })

  it('關卡二選「改他」：帶入該技能內容進入修改模式，gateStage 轉 active', async () => {
    const store = useSkillStore()
    const target = store.myPersonalSkills[0]
    const c = useSkillStudioConversation()
    await reachGate2(c, target.name)
    await sendAndWait(c, '改他')
    expect(c.gateStage.value).toBe('active')
    expect(c.mode.value).toBe('edit')
    expect(c.savedSkillId.value).toBe(target.id)
    expect(c.draft.value.name).toBe(target.name)
  })

  it('關卡二選「另外新增一份」：空白開始，gateStage 轉 intent 請使用者重新描述，草稿沒有帶入相近技能的內容', async () => {
    const store = useSkillStore()
    const target = store.myPersonalSkills[0]
    const c = useSkillStudioConversation()
    await reachGate2(c, target.name)
    await sendAndWait(c, '另外新增一份')
    expect(c.gateStage.value).toBe('intent')
    expect(c.draft.value.name).toBe('')
    expect(c.draft.value.instructions).toBe('')
    expect(c.messages.value.at(-1)!.content).toBe('好，那我們重新開一份。請描述這份做法的內容。')
  })

  it('關卡二選「另外新增一份」後接著描述新做法：真的走回 gathering，而不是把「重新開一份」那句話本身當成描述', async () => {
    const store = useSkillStore()
    const target = store.myPersonalSkills[0]
    const c = useSkillStudioConversation()
    await reachGate2(c, target.name)
    await sendAndWait(c, '另外新增一份')
    expect(c.gateStage.value).toBe('intent')

    await sendAndWait(c, '教我泡咖啡的順序')
    expect(c.gateStage.value).toBe('gathering')
    expect(c.messages.value.at(-1)!.content).toBe('還有沒有需要特別注意的情況或例外？')
    // gathering 才剛開始問追問，還沒產生結構化草稿，name 應該仍是空的
    expect(c.draft.value.name).toBe('')
  })

  it('關卡二選「我要講別的」：暫存目前對話與草稿，gateStage 回 intent 處理新話題', async () => {
    const store = useSkillStore()
    const target = store.myPersonalSkills[0]
    const c = useSkillStudioConversation()
    await reachGate2(c, target.name)
    const messagesBeforePause = c.messages.value.length
    await sendAndWait(c, '我要講別的')
    expect(c.gateStage.value).toBe('intent')
    expect(c.messages.value.length).toBeLessThan(messagesBeforePause)
    // 換個新話題照常走一輪意圖判斷（太模糊 → 留在 intent 問澄清）
    await sendAndWait(c, '嗯')
    expect(c.gateStage.value).toBe('intent')
    expect(c.messages.value.at(-1)!.content).toContain('記一個新做法')
  })
})

describe('CLARIFY 補齊與關卡三確認', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    // Ensure the store has no matching skills for our test messages
    const store = useSkillStore()
    const hasSomeSkills = store.myPersonalSkills.length > 0
    store.myPersonalSkills.forEach(s => store.deletePersonalSkill(s.id))
    // Re-add one non-matching skill if we need to preserve non-empty state (for "清單非空" flow)
    if (hasSomeSkills) {
      store.createPersonalSkill({
        name: '簽核文件資訊',
        description: '簽核企業檔案',
        instructions: '檢視核簽狀況',
        triggerHint: '需要簽核文件時',
        assignedAgents: [],
        capabilities: ['test'],
        files: [],
      })
    }
  })
  afterEach(() => vi.useRealTimers())

  async function sendAndWait(c: ReturnType<typeof useSkillStudioConversation>, text: string) {
    const p = c.send(text)
    await vi.advanceTimersByTimeAsync(800)
    await p
  }

  // 走完 gathering（3 句話：描述＋2 個追問答案）＋ confirmKnownInfo（1 句確認），
  // 產生結構化草稿並轉關卡三
  async function toGate3(c: ReturnType<typeof useSkillStudioConversation>, buildText: string) {
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, buildText)
    await sendAndWait(c, '沒有特殊例外')
    await sendAndWait(c, '照標準流程執行')
    await sendAndWait(c, '對，沒錯')
    expect(c.gateStage.value).toBe('gate3')
  }

  // 在 toGate3 的基礎上，關卡三選「不對，我要改」退回 clarify
  async function toClarify(c: ReturnType<typeof useSkillStudioConversation>, buildText: string) {
    await toGate3(c, buildText)
    await sendAndWait(c, '不對，我要改')
    expect(c.gateStage.value).toBe('clarify')
  }

  it('clarify 階段一般描述：照既有 interpretStudioMessage 規則更新草稿，不轉關卡', async () => {
    const c = useSkillStudioConversation()
    await toClarify(c, '我要新增一份規定')
    await sendAndWait(c, '觸發條件改成當使用者提到缺貨時')
    expect(c.gateStage.value).toBe('clarify')
    expect(c.draft.value.triggerHint).toContain('缺貨')
  })

  it('clarify 階段說收尾語：轉關卡三，訊息帶草稿摘要', async () => {
    const c = useSkillStudioConversation()
    await toClarify(c, '我要新增一份規定')
    await sendAndWait(c, '沒有漏了，請幫我寫成做法')
    expect(c.gateStage.value).toBe('gate3')
    const last = c.messages.value.at(-1)!
    expect(last.content).toContain(c.draft.value.name)
  })

  it('關卡三選「這樣可以，存到個人技能」：實際呼叫 save()，技能出現在 myPersonalSkills，gateStage 轉 active', async () => {
    const store = useSkillStore()
    const before = store.myPersonalSkills.length
    const c = useSkillStudioConversation()
    await toGate3(c, '我要新增一份規定')
    await sendAndWait(c, '這樣可以，存到個人技能')
    expect(c.gateStage.value).toBe('active')
    expect(store.myPersonalSkills.length).toBe(before + 1)
    expect(c.savedSkillId.value).toBeTruthy()
  })

  it('關卡三選「不對，我要改」：退回 clarify，草稿內容不清空', async () => {
    const c = useSkillStudioConversation()
    await toGate3(c, '我要新增一份規定')
    const nameBeforeRetry = c.draft.value.name
    await sendAndWait(c, '不對，我要改')
    expect(c.gateStage.value).toBe('clarify')
    expect(c.draft.value.name).toBe(nameBeforeRetry)
  })
})

describe('暫存草稿的接續判斷', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  async function sendAndWait(c: ReturnType<typeof useSkillStudioConversation>, text: string) {
    const p = c.send(text)
    await vi.advanceTimersByTimeAsync(800)
    await p
  }

  // 回傳暫停當下（「我要講別的」那句已計入）快照的訊息數，讓呼叫端能驗證
  // 還原後的 messages.value 長度剛好是「暫停快照＋一句銜接語」，藉此鎖定
  // 「接續觸發句不會混進最終還原的對話紀錄」這個行為（見 Step 3 code 下方的注意事項）
  async function pauseWithDraft(c: ReturnType<typeof useSkillStudioConversation>, skillName: string): Promise<number> {
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, `幫我記一個${skillName}的做法`)
    const pausedMessageCount = c.messages.value.length + 1 // +1：即將送出、會被存進快照的「我要講別的」
    await sendAndWait(c, '我要講別的')
    return pausedMessageCount
  }

  it('訊息含接續關鍵字：還原暫停當下的 gateStage／messages／draft，推一句銜接語，接續觸發句不會留在還原後的訊息裡', async () => {
    const store = useSkillStore()
    const target = store.myPersonalSkills[0]
    const c = useSkillStudioConversation()
    const pausedMessageCount = await pauseWithDraft(c, target.name)
    expect(c.gateStage.value).toBe('intent')

    await sendAndWait(c, '我們繼續剛才的')

    expect(c.gateStage.value).toBe('gate2')
    // 還原後只多了一句銜接語：暫存快照本身的訊息數＋1，觸發句「我們繼續剛才的」沒有被塞進去
    expect(c.messages.value.length).toBe(pausedMessageCount + 1)
    expect(c.messages.value.some(m => m.content.includes('我們繼續剛才的'))).toBe(false)
    const last = c.messages.value.at(-1)!
    expect(last.content).toContain('繼續')
  })

  it('訊息沒有接續訊號：正常走當下 gateStage 的路由，暫存草稿維持不動', async () => {
    const store = useSkillStore()
    const target = store.myPersonalSkills[0]
    const c = useSkillStudioConversation()
    await pauseWithDraft(c, target.name)

    await sendAndWait(c, '嗯')

    expect(c.gateStage.value).toBe('intent')
    expect(c.messages.value.at(-1)!.content).toContain('記一個新做法')
  })

  it('沒有暫存草稿時，接續關鍵字就照正常意圖判斷處理（不會誤觸發還原、不會拋錯）', async () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, '嗯')
    // 沒有 pausedDraft，接續檢查整段跳過；'嗯' 這句話太短、沒有任何訊號，
    // classifyBuildOrModify 會判成 ambiguous，gateStage 留在 intent 並推一句澄清問句。
    // pausedDraft 本身不是 useSkillStudioConversation() 回傳值的一部分（純內部狀態），
    // 測試只能斷言可觀察的行為結果，不能直接檢查它的值
    expect(c.gateStage.value).toBe('intent')
    expect(c.messages.value.at(-1)!.content).toContain('記一個新做法')
  })
})

describe('關卡訊息不再帶 chip（actions）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  async function sendAndWait(c: ReturnType<typeof useSkillStudioConversation>, text: string) {
    const p = c.send(text)
    await vi.advanceTimersByTimeAsync(800)
    await p
  }

  it('關卡二的訊息（建立意圖找到相近做法）不帶 actions', async () => {
    const store = useSkillStore()
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, `幫我記一個${store.myPersonalSkills[0].name}的做法`)
    expect(c.gateStage.value).toBe('gate2')
    expect(c.messages.value.at(-1)!.actions).toBeUndefined()
  })

  it('findModifyTarget 的訊息（修改意圖找不到相近技能）不帶 actions', async () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, '我想修改一下技能設定')
    expect(c.gateStage.value).toBe('findModifyTarget')
    expect(c.messages.value.at(-1)!.actions).toBeUndefined()
  })

  it('太模糊的澄清問句不帶 actions', async () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, '嗯')
    expect(c.gateStage.value).toBe('intent')
    expect(c.messages.value.at(-1)!.actions).toBeUndefined()
  })
})

describe('classifyGate2（模組內部邏輯，透過 gateStage 行為驗證）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  async function sendAndWait(c: ReturnType<typeof useSkillStudioConversation>, text: string) {
    const p = c.send(text)
    await vi.advanceTimersByTimeAsync(800)
    await p
  }

  async function toGate2(c: ReturnType<typeof useSkillStudioConversation>, skillName: string) {
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, `幫我記一個${skillName}的做法`)
    expect(c.gateStage.value).toBe('gate2')
  }

  it('本關比對到「改他」語意：帶入該技能內容進入修改模式', async () => {
    const store = useSkillStore()
    const target = store.myPersonalSkills[0]
    const c = useSkillStudioConversation()
    await toGate2(c, target.name)
    await sendAndWait(c, '幫我修改他就好')
    expect(c.gateStage.value).toBe('active')
    expect(c.mode.value).toBe('edit')
    expect(c.savedSkillId.value).toBe(target.id)
  })

  it('本關比對到「新的」語意（呼應本關問句自己的用字「記一份新的」，不只認得「另外／新增一份」等固定詞）：轉 intent 重新開一份，不會卡在原地重問同一題', async () => {
    const store = useSkillStore()
    const c = useSkillStudioConversation()
    await toGate2(c, store.myPersonalSkills[0].name)
    await sendAndWait(c, '要記一份新的')
    expect(c.gateStage.value).toBe('intent')
    expect(c.messages.value.at(-1)!.content).toBe('好，那我們重新開一份。請描述這份做法的內容。')
  })

  it('本關比對不到：先清掉 pendingSimilarSkillId，再重定向到新話題判斷（太模糊 → 留在 intent 問澄清）', async () => {
    const store = useSkillStore()
    const c = useSkillStudioConversation()
    await toGate2(c, store.myPersonalSkills[0].name)
    await sendAndWait(c, '嗯')
    expect(c.gateStage.value).toBe('intent')
    expect(c.messages.value.at(-1)!.content).toContain('記一個新做法')
    // 驗證 pendingSimilarSkillId 真的被清掉了：接著描述一個會命中「另一顆」技能的新內容，
    // 應該正確轉去 gate2 並帶那顆技能的名稱，而不是卡在舊的 pendingSimilarSkillId 對應的技能上
    const other = store.myPersonalSkills[1]
    await sendAndWait(c, `幫我記一個${other.name}的做法`)
    expect(c.gateStage.value).toBe('gate2')
    expect(c.messages.value.at(-1)!.content).toContain(other.name)
  })
})

describe('classifyGate3（模組內部邏輯，透過 gateStage 行為驗證，不做新話題重定向）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  async function sendAndWait(c: ReturnType<typeof useSkillStudioConversation>, text: string) {
    const p = c.send(text)
    await vi.advanceTimersByTimeAsync(800)
    await p
  }

  async function toGate3(c: ReturnType<typeof useSkillStudioConversation>) {
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, '我要新增一份規定')
    await sendAndWait(c, '沒有特殊例外')
    await sendAndWait(c, '照標準流程執行')
    await sendAndWait(c, '對，沒錯')
    expect(c.gateStage.value).toBe('gate3')
  }

  it('本關比對到「確認」語意（不是精確 chip 文字）：實際存檔', async () => {
    const store = useSkillStore()
    const before = store.myPersonalSkills.length
    const c = useSkillStudioConversation()
    await toGate3(c)
    await sendAndWait(c, '好的，沒問題')
    expect(c.gateStage.value).toBe('active')
    expect(store.myPersonalSkills.length).toBe(before + 1)
  })

  it('單字「好」也算確認，不用一定要打「好的」：實際存檔', async () => {
    const store = useSkillStore()
    const before = store.myPersonalSkills.length
    const c = useSkillStudioConversation()
    await toGate3(c)
    await sendAndWait(c, '好')
    expect(c.gateStage.value).toBe('active')
    expect(store.myPersonalSkills.length).toBe(before + 1)
  })

  it('本關比對到「不對」語意：不會被「對」字誤判成確認，退回 clarify', async () => {
    const store = useSkillStore()
    const before = store.myPersonalSkills.length
    const c = useSkillStudioConversation()
    await toGate3(c)
    await sendAndWait(c, '不對，我打錯了')
    expect(c.gateStage.value).toBe('clarify')
    expect(store.myPersonalSkills.length).toBe(before)
  })

  it('本關比對不到：純文字重新描述選項，不呼叫 classifyIntent 重定向（草稿內容不因此被清空或跳關）', async () => {
    const c = useSkillStudioConversation()
    await toGate3(c)
    const nameBefore = c.draft.value.name
    await sendAndWait(c, '嗯')
    expect(c.gateStage.value).toBe('gate3')
    expect(c.draft.value.name).toBe(nameBefore)
    expect(c.messages.value.at(-1)!.content).not.toBe('') // 有換句話重述，不是空白
  })
})

describe('gathering：最多追問 2 輪，已經講過的題目會跳過', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  async function sendAndWait(c: ReturnType<typeof useSkillStudioConversation>, text: string) {
    const p = c.send(text)
    await vi.advanceTimersByTimeAsync(800)
    await p
  }

  it('第一句描述後推第一個追問問句；答完兩輪追問後轉 confirmKnownInfo，訊息帶白話摘要', async () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, '我要新增一份規定')
    expect(c.gateStage.value).toBe('gathering')
    expect(c.messages.value.at(-1)!.content).toBe('還有沒有需要特別注意的情況或例外？')

    await sendAndWait(c, '沒有特殊例外')
    expect(c.gateStage.value).toBe('gathering')
    expect(c.messages.value.at(-1)!.content).toBe('大概的執行步驟是什麼？麻煩條列一下。')

    await sendAndWait(c, '照標準流程執行')
    expect(c.gateStage.value).toBe('confirmKnownInfo')
    const last = c.messages.value.at(-1)!
    expect(last.content).toContain('我理解你想做的是')
    expect(last.content).toContain('我要新增一份規定')
    expect(last.content).toContain('沒有特殊例外')
    expect(last.content).toContain('照標準流程執行')
  })

  it('第一句描述已經很完整（夠長、看起來已經交代過怎麼做）：只問例外題，不會再多問一次步驟題', async () => {
    // 清空個人技能清單：避免這句很長的描述剛好跟 mock 個人技能（例如「ERP 報表彙整」）
    // bigram 重疊而誤判成「找到相近做法」，導致轉去關卡二而非這裡要測的 gathering 跳題邏輯
    const store = useSkillStore()
    store.myPersonalSkills.forEach(s => store.deletePersonalSkill(s.id))
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    const detailed = '我每個月月初（第一個工作天）都固定要產出給總公司的月報表（csv格式），資料來源是ERP 系統的API傳遞，輸出的檔案名稱：yyyy/mm月報表格式，需要統計上一個月的鞋款各個顏色、鞋碼的銷售雙、銷售金額、銷售淨額、庫存數量。以後每個月都要做這件事情。'
    await sendAndWait(c, detailed)
    expect(c.gateStage.value).toBe('gathering')
    expect(c.messages.value.at(-1)!.content).toBe('還有沒有需要特別注意的情況或例外？')

    await sendAndWait(c, '如果ERP連線異常，導致錯誤三次以上，請聯繫資訊組組長')
    // 步驟題不會再問一次：這句描述已經夠長、看起來已經交代過怎麼做，直接進 confirmKnownInfo
    expect(c.gateStage.value).toBe('confirmKnownInfo')
    expect(c.messages.value.at(-1)!.content).not.toBe('大概的執行步驟是什麼？麻煩條列一下。')
  })

  it('一開始就同時交代了例外跟步驟：兩題都跳過，一句話直接進 confirmKnownInfo', async () => {
    const store = useSkillStore()
    store.myPersonalSkills.forEach(s => store.deletePersonalSkill(s.id))
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, '先確認庫存再產出報表，如果 API 逾時就重試三次，重試失敗才通知窗口')
    expect(c.gateStage.value).toBe('confirmKnownInfo')
  })
})

describe('confirmKnownInfo：白話摘要確認', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  async function sendAndWait(c: ReturnType<typeof useSkillStudioConversation>, text: string) {
    const p = c.send(text)
    await vi.advanceTimersByTimeAsync(800)
    await p
  }

  async function toConfirmKnownInfo(c: ReturnType<typeof useSkillStudioConversation>) {
    c.startCreate()
    c.chooseMethod('chat')
    await sendAndWait(c, '我要新增一份規定')
    await sendAndWait(c, '沒有特殊例外')
    await sendAndWait(c, '照標準流程執行')
    expect(c.gateStage.value).toBe('confirmKnownInfo')
  }

  it('確認：用累積的原始文字產生結構化草稿，直接轉關卡三，不留在 clarify', async () => {
    const c = useSkillStudioConversation()
    await toConfirmKnownInfo(c)
    await sendAndWait(c, '對，沒錯')
    expect(c.gateStage.value).toBe('gate3')
    expect(c.draft.value.name).toBeTruthy()
    expect(c.draft.value.instructions).toBeTruthy()
  })

  it('還要補充：不會重新觸發 gathering 的兩輪固定追問，下一句話直接當成補充內容，重新產生摘要再問一次', async () => {
    const c = useSkillStudioConversation()
    await toConfirmKnownInfo(c)
    await sendAndWait(c, '不對，還要補充')
    expect(c.gateStage.value).toBe('confirmKnownInfo')
    expect(c.messages.value.at(-1)!.content).toBe('好，那請告訴我還要補充什麼。')

    await sendAndWait(c, '還要記得檢查權限')
    expect(c.gateStage.value).toBe('confirmKnownInfo')
    const last = c.messages.value.at(-1)!
    expect(last.content).toContain('我理解你想做的是')
    expect(last.content).toContain('還要記得檢查權限')

    // 補充完後正常確認，草稿內容應該要包含補充進去的文字
    await sendAndWait(c, '對，沒錯')
    expect(c.gateStage.value).toBe('gate3')
  })

  it('看不懂：換句話重述摘要，不清空草稿，不跳關', async () => {
    const c = useSkillStudioConversation()
    await toConfirmKnownInfo(c)
    const rawTextBefore = c.messages.value.at(-1)!.content
    await sendAndWait(c, '嗯')
    expect(c.gateStage.value).toBe('confirmKnownInfo')
    expect(c.messages.value.at(-1)!.content).toBe(rawTextBefore)
  })
})

describe('notifyTestResult：AI 快速測試沒有全對時，左側對話主動引導調整', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('答對比例不是 100%：轉 clarify，推一則帶答對比例的引導訊息', () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    const before = c.messages.value.length
    c.notifyTestResult({ total: 8, correct: 6, byTag: {} as any, summary: '' })
    expect(c.gateStage.value).toBe('clarify')
    expect(c.messages.value.length).toBe(before + 1)
    const last = c.messages.value.at(-1)!
    expect(last.role).toBe('agent')
    expect(last.content).toContain('6/8')
    expect(last.content).toContain('75%')
  })

  it('全對（100%）、已存檔：不轉關卡，推一句引導去右側測試報告點「啟用技能」的訊息', () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '已存檔技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    const c = useSkillStudioConversation()
    c.loadSkill(id)
    const before = c.messages.value.length
    const stageBefore = c.gateStage.value
    c.notifyTestResult({ total: 8, correct: 8, byTag: {} as any, summary: '' })
    expect(c.gateStage.value).toBe(stageBefore) // 不打斷後續對話，維持原本關卡
    expect(c.messages.value.length).toBe(before + 1)
    const last = c.messages.value.at(-1)!
    expect(last.role).toBe('agent')
    expect(last.content).toContain('啟用技能')
    // 對話和預覽是左右並排（見 SkillStudioWorkspace），不是上下堆疊，
    // 「下面」會指錯方向，固定成「右側」跟其他引導訊息的措辭一致
    expect(last.content).toContain('右側的測試報告')
    expect(last.content).not.toContain('下面')
  })

  it('全對（100%）、已存檔但這顆技能早就啟用中：不叫使用者去點一個不會出現的「啟用技能」按鈕', () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '早就上線的技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    store.overrideAndEnableSkill(id) // 先讓它變成啟用中
    expect(store.findSkill(id)!.isEnabled).toBe(true)
    const c = useSkillStudioConversation()
    c.loadSkill(id)
    c.notifyTestResult({ total: 8, correct: 8, byTag: {} as any, summary: '' })
    const last = c.messages.value.at(-1)!
    expect(last.content).toContain('啟用中的狀態')
    expect(last.content).not.toContain('到右側的測試報告點「啟用技能」')
  })

  it('全對（100%）、還沒存檔：引導先儲存，不是叫使用者去點一個還不存在的「啟用技能」按鈕', () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    const before = c.messages.value.length
    c.notifyTestResult({ total: 8, correct: 8, byTag: {} as any, summary: '' })
    expect(c.messages.value.length).toBe(before + 1)
    const last = c.messages.value.at(-1)!
    expect(last.content).toContain('儲存')
    expect(last.content).not.toContain('右側的測試報告')
  })

  it('沒有全對的引導訊息不附快捷按鈕——全部靠使用者自己打字（「重新測試」「不改，直接啟用」）', () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    c.notifyTestResult({ total: 8, correct: 6, byTag: {} as any, summary: '' })
    const last = c.messages.value.at(-1)!
    expect(last.actions).toBeUndefined()
  })

  it('點「重新測試」：呼叫 store.generateAITestScenarios 重新出題、設定 requestTestTab 單次訊號、轉回 active（不是自由文字編輯）', async () => {
    vi.useFakeTimers()
    try {
      const store = useSkillStore()
      const id = store.createPersonalSkill({ name: '待重測技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
      const spy = vi.spyOn(store, 'generateAITestScenarios')
      const c = useSkillStudioConversation()
      c.loadSkill(id)
      c.notifyTestResult({ total: 8, correct: 6, byTag: {} as any, summary: '' })
      expect(c.gateStage.value).toBe('clarify')
      expect(c.requestTestTab.value).toBe(false)

      const p = c.send('重新測試')
      await vi.advanceTimersByTimeAsync(800)
      await p
      // 已存檔：testSkillId 就是真正的技能 id；draftContext 補上目前草稿的
      // name／triggerHint／capabilities，store 裡找不到技能或技能內容是舊版時可以退回用它
      expect(spy).toHaveBeenCalledWith(id, { name: '待重測技能', triggerHint: 'y', capabilities: [] })
      expect(c.requestTestTab.value).toBe(true)
      expect(c.gateStage.value).toBe('active')
      expect(c.messages.value.at(-1)!.content).toContain('換一批新題目')
    } finally {
      vi.useRealTimers()
    }
  })

  it('還沒存檔的草稿點「重新測試」：一樣能重新出題，掛在草稿佔位 testSkillId 底下，不要求先存檔', async () => {
    vi.useFakeTimers()
    try {
      const store = useSkillStore()
      const spy = vi.spyOn(store, 'generateAITestScenarios')
      const c = useSkillStudioConversation()
      c.startCreate()
      c.chooseMethod('chat')
      c.notifyTestResult({ total: 8, correct: 6, byTag: {} as any, summary: '' })

      const p = c.send('重新測試')
      await vi.advanceTimersByTimeAsync(800)
      await p
      expect(c.savedSkillId.value).toBeNull()
      expect(spy).toHaveBeenCalledWith(c.testSkillId.value, expect.objectContaining({ name: c.draft.value.name }))
      expect(c.requestTestTab.value).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('點「不改，直接啟用」：呼叫 store.overrideAndEnableSkill 直接啟用，不改任何草稿內容，轉回 active', async () => {
    vi.useFakeTimers()
    try {
      const store = useSkillStore()
      const id = store.createPersonalSkill({ name: '待啟用技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
      expect(store.findSkill(id)!.isEnabled).toBe(false)
      const c = useSkillStudioConversation()
      c.loadSkill(id)
      c.notifyTestResult({ total: 8, correct: 6, byTag: {} as any, summary: '' })

      const p = c.send('不改，直接啟用')
      await vi.advanceTimersByTimeAsync(800)
      await p
      const skill = store.findSkill(id)!
      expect(skill.isEnabled).toBe(true)
      expect(skill.aiTestOverridden).toBe(true)
      expect(skill.instructions).toBe('x') // 沒有改動草稿內容
      expect(c.gateStage.value).toBe('active')
      expect(c.messages.value.at(-1)!.content).toContain('已啟用')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('notifyTestGenerating：生成測試情境中的敘事文字，對話建立的技能要推進對話串', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('method 為 chat：推一則 agent 訊息，內容是敘事文字合併成一段', () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    const before = c.messages.value.length
    c.notifyTestGenerating(['正在查看可調用的 Agent：客服中心助理。', '正在產生測試情境...'])
    expect(c.messages.value.length).toBe(before + 1)
    const last = c.messages.value.at(-1)!
    expect(last.role).toBe('agent')
    expect(last.content).toContain('客服中心助理')
    expect(last.content).toContain('正在產生測試情境')
  })

  it('method 為 blocks：no-op，不會推訊息（積木方式沒有對話串，維持顯示在測試 tab 自己的敘事泡泡）', () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('blocks')
    const before = c.messages.value.length
    c.notifyTestGenerating(['正在查看可調用的 Agent：客服中心助理。'])
    expect(c.messages.value.length).toBe(before)
  })

  it('空陣列（例如測試狀態被清空時）：no-op，不會推空白訊息', () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    const before = c.messages.value.length
    c.notifyTestGenerating([])
    expect(c.messages.value.length).toBe(before)
  })
})

describe('notifyTestGenerated：題目真的生成完成時，對話建立的技能要推一句完成訊息', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('method 為 chat：推一則 agent 訊息，內容提到生成完成', () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('chat')
    const before = c.messages.value.length
    c.notifyTestGenerated()
    expect(c.messages.value.length).toBe(before + 1)
    const last = c.messages.value.at(-1)!
    expect(last.role).toBe('agent')
    expect(last.content).toContain('生成完成')
  })

  it('method 為 blocks：no-op，不會推訊息（積木方式沒有對話串）', () => {
    const c = useSkillStudioConversation()
    c.startCreate()
    c.chooseMethod('blocks')
    const before = c.messages.value.length
    c.notifyTestGenerated()
    expect(c.messages.value.length).toBe(before)
  })
})

describe('修改模式下明確說要建立新技能：先確認，確認後捨棄目前修改開新流程', () => {
  beforeEach(() => setActivePinia(createPinia()))

  function makeEditingConv() {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '查 ERP 庫存', instructions: '1. 查詢', triggerHint: '問庫存時', assignedAgents: [] })
    const c = useSkillStudioConversation()
    c.loadSkill(id)
    return { store, c, id }
  }

  it('建立模式下不受影響：確認用的 confirmStartNew 關卡只會在修改模式出現', async () => {
    vi.useFakeTimers()
    try {
      const c = useSkillStudioConversation()
      c.startCreate()
      c.chooseMethod('chat')
      const p = c.send('我要建立一個新技能')
      await vi.advanceTimersByTimeAsync(800)
      await p
      expect(c.gateStage.value).not.toBe('confirmStartNew')
      expect(c.messages.value.at(-1)!.actions?.map(a => a.label)).not.toEqual(['對，開新的', '不是，我想問別的'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('一般編輯指令（含「建立」字樣但不是「新技能」）不會誤判：正常走自由編輯', async () => {
    vi.useFakeTimers()
    try {
      const { c } = makeEditingConv()
      const before = c.draft.value.instructions
      const p = c.send('再補一個步驟：建立工單')
      await vi.advanceTimersByTimeAsync(800)
      await p
      expect(c.gateStage.value).toBe('active')
      expect(c.draft.value.instructions).not.toBe(before)
    } finally {
      vi.useRealTimers()
    }
  })

  it('修改模式下說要建立新技能：轉 confirmStartNew，推確認訊息並帶兩個 action chip', async () => {
    vi.useFakeTimers()
    try {
      const { c } = makeEditingConv()
      const p = c.send('我要建立一個新技能')
      await vi.advanceTimersByTimeAsync(800)
      await p
      expect(c.gateStage.value).toBe('confirmStartNew')
      const last = c.messages.value.at(-1)!
      expect(last.content).toContain('放下目前的修改')
      expect(last.actions?.map(a => a.label)).toEqual(['對，開新的', '不是，我想問別的'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('點「對，開新的」：草稿悄悄重設回已儲存版本（isDirty 歸零），設定 requestNewSkillDrawer 單次訊號', async () => {
    vi.useFakeTimers()
    try {
      const { c, id } = makeEditingConv()
      // 先改動草稿，模擬使用者在問出「要開新的」之前已經講過一些修改
      const p1 = c.send('改成先確認庫存地點')
      await vi.advanceTimersByTimeAsync(800)
      await p1
      expect(c.isDirty.value).toBe(true)

      const p2 = c.send('我要建立一個新技能')
      await vi.advanceTimersByTimeAsync(800)
      await p2
      expect(c.requestNewSkillDrawer.value).toBe(false)

      const p3 = c.send('對，開新的')
      await vi.advanceTimersByTimeAsync(800)
      await p3
      expect(c.draft.value.instructions).toBe('1. 查詢') // 回到原本已儲存的版本
      expect(c.isDirty.value).toBe(false)
      expect(c.requestNewSkillDrawer.value).toBe(true)
      expect(c.savedSkillId.value).toBe(id)
    } finally {
      vi.useRealTimers()
    }
  })

  it('點「不是，我想問別的」：留在修改模式，轉回 active 繼續原本的修改', async () => {
    vi.useFakeTimers()
    try {
      const { c, id } = makeEditingConv()
      const p1 = c.send('我要建立一個新技能')
      await vi.advanceTimersByTimeAsync(800)
      await p1
      expect(c.gateStage.value).toBe('confirmStartNew')

      const p2 = c.send('不是，我想問別的')
      await vi.advanceTimersByTimeAsync(800)
      await p2
      expect(c.gateStage.value).toBe('active')
      expect(c.requestNewSkillDrawer.value).toBe(false)
      expect(c.mode.value).toBe('edit')
      expect(c.savedSkillId.value).toBe(id)

      // 確認「繼續原本修改」是真的可以繼續編輯，不是卡死
      const p3 = c.send('改成先確認庫存地點')
      await vi.advanceTimersByTimeAsync(800)
      await p3
      expect(c.draft.value.instructions).not.toBe('1. 查詢')
    } finally {
      vi.useRealTimers()
    }
  })
})
