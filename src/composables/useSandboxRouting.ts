import { ref, computed } from 'vue'
import { useSkillStore, AVAILABLE_AGENTS } from '@/stores/skillStore'
import type { Skill, SkillVersion } from '@/stores/skillStore'

// 全系統對話測試沙盒（V2 版型 A／B 共用）：使用者面對的是「所有 Agent＋所有已啟用技能」，
// 不是預先鎖定一顆技能。每則訊息都跑一次模擬路由——在技能池裡比對內容相似度，
// 決定由哪個 Agent 接手、觸發哪顆技能，並把沒被選上的候選一起留下來給追蹤面板看，
// 這樣「誤觸發／漏觸發」才看得出來。
//
// 「包含草稿」開關：關＝只有已啟用技能的生效版本（等同正式環境）；
// 開＝草稿也一起進池子，看它們上線後會不會被觸發、會不會搶走別人：
//   - 有草稿／審核中版本的技能，改用最新那個版本取代生效版本
//   - 還沒啟用的個人技能、建立中的草稿也加入
// 開關只影響這個 composable 的狀態，不會寫回 store。

export interface RoutingCandidate {
  skillId: string
  name: string
  versionName: string
  agent: string
  score: number
  matchedTerms: string[]
  isDraft: boolean
}

export interface RoutingTrace {
  agent: string
  triggered: RoutingCandidate | null
  reason: string
  // 有分數但沒被選上的候選（依分數排序，最多 4 筆）
  runnersUp: RoutingCandidate[]
  tools: { name: string; latencyMs: number }[]
}

export interface SandboxMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  trace?: RoutingTrace
}

// 分數低於這個值視為「沒有任何技能符合」，由通用助理直接回覆
const TRIGGER_MIN_SCORE = 1

// 口語常見、對判斷技能沒有鑑別度的雙字詞，不算進相似度（不然「怎麼」「一下」到處都會中）
const STOP_BIGRAMS = new Set(['幫我', '一下', '怎麼', '如何', '什麼', '可以', '這個', '這週', '今天', '我們', '你們', '一個'])
// 含這些虛字的雙字詞（例如「週的」「好了」）也不算，同樣沒有鑑別度
const FILLER_CHARS = /[的了嗎呢吧啊喔和與及或]/
const FALLBACK_AGENT = '通用助理'

const DEFAULT_PROMPTS = [
  '幫我整理這週的業績週報',
  '客戶想退貨，該怎麼回覆？',
  '查一下 A 倉的庫存',
  '把昨天的會議重點摘要一下',
  '今天天氣如何？',
]

interface PoolEntry {
  skill: Pick<Skill, 'id' | 'name' | 'description' | 'capabilities' | 'keywords' | 'assignedAgents'>
  versionName: string
  text: string
  isDraft: boolean
}

function matchedBigrams(message: string, text: string): string[] {
  const grams = new Set<string>()
  for (let i = 0; i < text.length - 1; i++) grams.add(text.slice(i, i + 2))
  const hits: string[] = []
  for (let i = 0; i < message.length - 1; i++) {
    const g = message.slice(i, i + 2)
    if (grams.has(g) && /^[\p{L}\p{N}]{2}$/u.test(g) && !STOP_BIGRAMS.has(g) && !FILLER_CHARS.test(g) && !hits.includes(g)) hits.push(g)
  }
  return hits
}

function skillText(s: Pick<Skill, 'name' | 'description' | 'capabilities' | 'keywords'>): string {
  return [s.name, s.description ?? '', ...(s.capabilities ?? []), ...(s.keywords ?? [])].join(' ')
}

// 技能最新的草稿／審核中版本（versions 依建立順序排，取最後一個）
function latestDraftVersion(skill: Skill): SkillVersion | undefined {
  return [...(skill.versions ?? [])].reverse().find(v => v.status === 'draft' || v.status === 'reviewing')
}

export function useSandboxRouting() {
  const store = useSkillStore()

  const messages = ref<SandboxMessage[]>([])
  const isRunning = ref(false)
  const includeDrafts = ref(false)

  // 個人＋Library，同 id 只留一筆
  const allSkills = computed<Skill[]>(() => {
    const seen = new Set<string>()
    const result: Skill[] = []
    for (const s of [...store.myPersonalSkills, ...store.flatSkills]) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      result.push(s)
    }
    return result
  })

  // 個人技能沒有版本概念，版本名稱一律留空（畫面上就不會顯示版號）
  const personalIds = computed(() => new Set(store.myPersonalSkills.map(s => s.id)))
  function versionLabel(s: Skill): string {
    return personalIds.value.has(s.id) ? '' : store.getDefaultVersionName(s.id) ?? s.version
  }

  const liveEntries = computed<PoolEntry[]>(() =>
    allSkills.value
      .filter(s => s.isEnabled)
      .map(s => ({
        skill: s,
        versionName: versionLabel(s),
        text: skillText(s),
        isDraft: false,
      }))
  )

  const draftEntries = computed<PoolEntry[]>(() => {
    const entries: PoolEntry[] = []
    for (const s of allSkills.value) {
      const v = latestDraftVersion(s)
      if (v) {
        const merged = { ...s, name: v.name, description: v.description, capabilities: v.capabilities ?? s.capabilities }
        entries.push({ skill: merged, versionName: personalIds.value.has(s.id) ? '' : v.versionName, text: skillText(merged), isDraft: true })
      } else if (!s.isEnabled && personalIds.value.has(s.id)) {
        entries.push({ skill: s, versionName: '', text: skillText(s), isDraft: true })
      }
    }
    for (const d of store.myDrafts) {
      entries.push({ skill: { ...d }, versionName: '', text: skillText(d), isDraft: true })
    }
    return entries
  })

  const pool = computed<PoolEntry[]>(() => {
    if (!includeDrafts.value) return liveEntries.value
    // 同一顆技能有草稿版本時，草稿取代生效版本
    const draftIds = new Set(draftEntries.value.map(e => e.skill.id))
    return [...liveEntries.value.filter(e => !draftIds.has(e.skill.id)), ...draftEntries.value]
  })

  const agentCount = AVAILABLE_AGENTS.length
  const liveSkillCount = computed(() => liveEntries.value.length)
  const draftCount = computed(() => draftEntries.value.length)
  const suggestedPrompts = DEFAULT_PROMPTS

  function route(message: string): RoutingTrace {
    const scored: RoutingCandidate[] = pool.value
      .map(e => {
        const terms = matchedBigrams(message, e.text)
        return {
          skillId: e.skill.id,
          name: e.skill.name,
          versionName: e.versionName,
          agent: e.skill.assignedAgents?.[0] ?? FALLBACK_AGENT,
          score: terms.length,
          matchedTerms: terms.slice(0, 4),
          isDraft: e.isDraft,
        }
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)

    const top = scored[0] && scored[0].score >= TRIGGER_MIN_SCORE ? scored[0] : null
    const runnersUp = scored.filter(c => c !== top).slice(0, 4)
    const agent = top?.agent ?? FALLBACK_AGENT

    let reason: string
    if (top) {
      const terms = top.matchedTerms.map(t => `「${t}」`).join('、')
      const unassigned = !pool.value.find(e => e.skill.id === top.skillId)?.skill.assignedAgents?.length
      reason = `訊息中的 ${terms} 與「${top.name}」的技能說明相符（相似度 ${top.score}），分數最高。`
        + (unassigned ? `這顆技能還沒指派 Agent，暫由${FALLBACK_AGENT}調用。` : `由指派的「${agent}」接手。`)
    } else {
      reason = '沒有任何技能與這句話相關，不調用技能。'
    }

    const tools = top
      ? [
          { name: 'route-to-agent', latencyMs: 42 + Math.round(Math.random() * 30) },
          { name: 'match-skill-description', latencyMs: 120 + Math.round(Math.random() * 80) },
          { name: 'apply-instructions', latencyMs: 200 + Math.round(Math.random() * 120) },
        ]
      : [{ name: 'route-to-agent', latencyMs: 40 + Math.round(Math.random() * 30) }]

    return { agent, triggered: top, reason, runnersUp, tools }
  }

  async function send(text: string): Promise<void> {
    const message = text.trim()
    if (!message || isRunning.value) return
    isRunning.value = true
    messages.value.push({ id: `sb-${Date.now()}`, role: 'user', content: message })
    await new Promise(r => setTimeout(r, 800))
    const trace = route(message)
    messages.value.push({
      id: `sb-${Date.now() + 1}`,
      role: 'agent',
      content: trace.triggered
        ? `（Mock）已調用「${trace.triggered.name}」處理：「${message}」，正在產生結果...`
        : `（Mock）沒有符合的技能，直接以一般對話回覆：「${message}」`,
      trace,
    })
    isRunning.value = false
  }

  function reset(): void {
    messages.value = []
  }

  return {
    messages,
    isRunning,
    includeDrafts,
    agentCount,
    liveSkillCount,
    draftCount,
    suggestedPrompts,
    send,
    reset,
  }
}
