import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useSkillStudioConversation } from '@/composables/useSkillStudioConversation'
import * as api from '@/services/skillConversationApi'

vi.mock('@/services/skillConversationApi', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/skillConversationApi')>()),
  openConversation: vi.fn(),
  sendConversationMessage: vi.fn(),
}))

const opened: api.OpenedConversation = { conversation_id: 'c1', mode: 'create', advice_mode: 'jev', reply: '', draft: null, note: { topic: '', steps: [] }, stage: 'START', blocked: [] }

function startChat() {
  const c = useSkillStudioConversation()
  c.startCreate()
  c.chooseMethod('chat')
  return c
}

describe('後端對話（VITE_SKILL_AGENT_API=true）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubEnv('VITE_SKILL_AGENT_API', 'true')
    vi.mocked(api.openConversation).mockResolvedValue({ ...opened })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetAllMocks()
  })

  it('第一句才開對話，之後沿用同一個代號；顯示後端回覆', async () => {
    vi.mocked(api.sendConversationMessage).mockResolvedValue({ reply: '你好，想做什麼？', draft: null, note: { topic: '', steps: [] }, stage: 'START', blocked: [] })
    const c = startChat()
    await c.send('我想做一個整理週報的技能')
    await c.send('每週五用')
    expect(api.openConversation).toHaveBeenCalledTimes(1)
    expect(api.sendConversationMessage).toHaveBeenLastCalledWith('c1', '每週五用')
    expect(c.conversationId.value).toBe('c1')
    expect(c.messages.value.some(m => m.role === 'agent' && m.content === '你好，想做什麼？')).toBe(true)
    expect(c.isRunning.value).toBe(false)
  })

  it('便利貼用後端回傳的，重開對話清掉', async () => {
    vi.mocked(api.sendConversationMessage).mockResolvedValue({
      reply: '記下了', draft: null, stage: 'CLARIFY', blocked: [],
      note: { topic: '客訴電話', steps: ['先跟客戶要訂單編號'] },
    })
    const c = startChat()
    await c.send('先跟客戶要訂單編號')
    expect(c.note.value).toEqual({ topic: '客訴電話', steps: ['先跟客戶要訂單編號'] })
    c.startCreate()
    expect(c.note.value).toEqual({ topic: '', steps: [] })
  })

  it('草稿用後端回傳的（content 對到 instructions）', async () => {
    vi.mocked(api.sendConversationMessage).mockResolvedValue({
      reply: '擬好了', note: { topic: '', steps: [] }, stage: 'DRAFT', blocked: [],
      draft: { name: 'weekly-notes', display_name: '週報整理', description: '每週五整理', content: '# 步驟' },
    })
    const c = startChat()
    await c.send('做週報')
    expect(c.draft.value.name).toBe('週報整理')
    expect(c.draft.value.skillCode).toBe('weekly-notes')
    expect(c.draft.value.description).toBe('每週五整理')
    expect(c.draft.value.instructions).toBe('# 步驟')
  })

  it('被硬閘門擋時，對話裡講清楚原因', async () => {
    vi.mocked(api.sendConversationMessage).mockResolvedValue({ reply: '', draft: null, note: { topic: '', steps: [] }, stage: 'CLARIFY', blocked: ['還沒問清楚使用情境'] })
    const c = startChat()
    await c.send('直接幫我寫')
    expect(c.blockedReasons.value).toEqual(['還沒問清楚使用情境'])
    expect(c.messages.value.at(-1)?.content).toContain('還沒問清楚使用情境')
  })

  it('後端失敗：白話提示出現在對話與 errorHint，下一句成功後清空', async () => {
    vi.mocked(api.sendConversationMessage)
      .mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true }))
      .mockResolvedValueOnce({ reply: 'ok', draft: null, note: { topic: '', steps: [] }, stage: 'START', blocked: [] })
    const c = startChat()
    await c.send('第一句')
    expect(c.errorHint.value).toContain('連不上技能後端')
    expect(c.messages.value.at(-1)?.content).toContain('連不上技能後端')
    expect(c.isRunning.value).toBe(false)
    await c.send('再試一次')
    expect(c.errorHint.value).toBe('')
  })

  it('startCreate 重開：對話代號清掉，下一句開新對話', async () => {
    vi.mocked(api.sendConversationMessage).mockResolvedValue({ reply: 'hi', draft: null, note: { topic: '', steps: [] }, stage: 'START', blocked: [] })
    const c = startChat()
    await c.send('a')
    c.startCreate()
    expect(c.conversationId.value).toBeNull()
  })
})

describe('模式切換器（advice_mode）', () => {
  const turn = { reply: 'hi', draft: null, note: { topic: '', steps: [] }, stage: 'START', blocked: [] }
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubEnv('VITE_SKILL_AGENT_API', 'true')
    // 後端會把收到的模式原樣回傳
    vi.mocked(api.openConversation).mockImplementation(async mode => ({ ...opened, advice_mode: mode ?? 'jev' }))
    vi.mocked(api.sendConversationMessage).mockResolvedValue(turn)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetAllMocks()
  })

  it('預設 Jev＋LLM', () => {
    const c = startChat()
    expect(c.adviceMode.value).toBe('jev')
  })

  it('選純 LLM，建立對話時帶 llm', async () => {
    const c = startChat()
    c.setAdviceMode('llm')
    await c.send('做週報')
    expect(api.openConversation).toHaveBeenCalledWith('llm')
  })

  it('沒選就帶 jev', async () => {
    const c = startChat()
    await c.send('做週報')
    expect(api.openConversation).toHaveBeenCalledWith('jev')
  })

  it('對話開始後鎖住，切換無效', async () => {
    const c = startChat()
    c.setAdviceMode('llm')
    expect(c.adviceModeLocked.value).toBe(false)
    await c.send('做週報')
    expect(c.adviceModeLocked.value).toBe(true)
    c.setAdviceMode('jev')
    expect(c.adviceMode.value).toBe('llm')
  })

  it('重開新對話：解鎖並回到預設', async () => {
    const c = startChat()
    c.setAdviceMode('llm')
    await c.send('做週報')
    c.startCreate()
    expect(c.adviceModeLocked.value).toBe(false)
    expect(c.adviceMode.value).toBe('jev')
  })

  it('建立對話失敗時不鎖，還能改選', async () => {
    vi.mocked(api.openConversation).mockRejectedValueOnce(Object.assign(new Error('x'), { isAxiosError: true }))
    const c = startChat()
    await c.send('做週報')
    expect(c.adviceModeLocked.value).toBe(false)
  })
})

describe('describeConversationError', () => {
  it('後端 detail 原文帶出', () => {
    const err = Object.assign(new Error('x'), { isAxiosError: true, response: { status: 409, data: { detail: '對話已結束' } } })
    expect(api.describeConversationError(err)).toBe('對話已結束')
  })
})
