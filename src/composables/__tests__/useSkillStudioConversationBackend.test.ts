import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useSkillStudioConversation } from '@/composables/useSkillStudioConversation'
import * as api from '@/services/skillConversationApi'

vi.mock('@/services/skillConversationApi', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/skillConversationApi')>()),
  openConversation: vi.fn(),
  sendConversationMessage: vi.fn(),
  openModifyConversation: vi.fn(),
  saveConversation: vi.fn(),
  listBackendSkills: vi.fn().mockResolvedValue([]),
  listBackendSkillVersions: vi.fn().mockResolvedValue([]),
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

const savedV1: api.BackendSkillVersion = {
  skill_id: 's1', version: 1, name: 'weekly-notes', display_name: '週報整理', description: '每週五整理', content: '# 步驟', tested: false, created_at: '2026-10-19T00:00:00Z',
}
const draftTurn = {
  reply: '擬好了', note: { topic: '', steps: [] }, stage: 'DRAFT', blocked: [],
  draft: { name: 'weekly-notes', display_name: '週報整理', description: '每週五整理', content: '# 步驟' },
}

describe('儲存與修改（後端技能）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubEnv('VITE_SKILL_AGENT_API', 'true')
    vi.mocked(api.openConversation).mockResolvedValue({ ...opened })
    vi.mocked(api.sendConversationMessage).mockResolvedValue(draftTurn)
    vi.mocked(api.listBackendSkills).mockResolvedValue([])
    vi.mocked(api.listBackendSkillVersions).mockResolvedValue([])
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetAllMocks()
  })

  it('儲存：呼叫後端 save，記下技能代號與版本，草稿不再算有未儲存變更', async () => {
    vi.mocked(api.saveConversation).mockResolvedValue(savedV1)
    const c = startChat()
    await c.send('做週報')
    expect(c.isDirty.value).toBe(true)
    const saved = await c.saveToBackend()
    expect(api.saveConversation).toHaveBeenCalledWith('c1')
    expect(saved).toEqual(savedV1)
    expect(c.backendSkillId.value).toBe('s1')
    expect(c.savedVersion.value).toEqual(savedV1)
    expect(c.isDirty.value).toBe(false)
  })

  it('儲存後清單重讀，看得到新版本', async () => {
    vi.mocked(api.saveConversation).mockResolvedValue(savedV1)
    const c = startChat()
    await c.send('做週報')
    await c.saveToBackend()
    expect(api.listBackendSkills).toHaveBeenCalled()
    expect(api.listBackendSkillVersions).toHaveBeenCalledWith('s1')
  })

  it('儲存失敗：白話提示、回 null、草稿仍算未儲存', async () => {
    vi.mocked(api.saveConversation).mockRejectedValue(
      Object.assign(new Error('x'), { isAxiosError: true, response: { status: 409, data: { detail: '還沒有草稿可以存' } } }),
    )
    const c = startChat()
    await c.send('做週報')
    expect(await c.saveToBackend()).toBeNull()
    expect(c.errorHint.value).toBe('還沒有草稿可以存')
    expect(c.isDirty.value).toBe(true)
  })

  it('還沒開過對話就按儲存：講原因，不打後端', async () => {
    const c = startChat()
    expect(await c.saveToBackend()).toBeNull()
    expect(c.errorHint.value).toContain('草稿')
    expect(api.saveConversation).not.toHaveBeenCalled()
  })

  it('從清單進修改：用來源版本開對話，草稿載入、模式是 edit', async () => {
    vi.mocked(api.openModifyConversation).mockResolvedValue({
      ...opened, conversation_id: 'c9', mode: 'modify', reply: '你好，想改哪裡？', draft: draftTurn.draft,
    })
    const c = useSkillStudioConversation()
    const ok = await c.loadBackendSkill('s1', 3)
    expect(ok).toBe(true)
    expect(api.openModifyConversation).toHaveBeenCalledWith('s1', 3, 'jev')
    expect(c.mode.value).toBe('edit')
    expect(c.conversationId.value).toBe('c9')
    expect(c.backendSkillId.value).toBe('s1')
    expect(c.draft.value.instructions).toBe('# 步驟')
    expect(c.draft.value.method).toBe('chat')
    expect(c.isDirty.value).toBe(false)
    expect(c.messages.value.at(-1)?.content).toBe('你好，想改哪裡？')
  })

  it('修改後再講話與儲存都走後端（存回去由後端新增版本）', async () => {
    vi.mocked(api.openModifyConversation).mockResolvedValue({ ...opened, conversation_id: 'c9', mode: 'modify', draft: draftTurn.draft })
    vi.mocked(api.saveConversation).mockResolvedValue({ ...savedV1, version: 4 })
    const c = useSkillStudioConversation()
    await c.loadBackendSkill('s1', 3)
    await c.send('把步驟改一下')
    expect(api.sendConversationMessage).toHaveBeenCalledWith('c9', '把步驟改一下')
    const saved = await c.saveToBackend()
    expect(saved?.version).toBe(4)
  })

  it('載入失敗：白話提示、回 false', async () => {
    vi.mocked(api.openModifyConversation).mockRejectedValue(
      Object.assign(new Error('x'), { isAxiosError: true, response: { status: 404, data: { detail: '找不到這個版本' } } }),
    )
    const c = useSkillStudioConversation()
    expect(await c.loadBackendSkill('s1', 9)).toBe(false)
    expect(c.errorHint.value).toBe('找不到這個版本')
  })

  it('startCreate 重開：技能代號與已存版本清掉', async () => {
    vi.mocked(api.saveConversation).mockResolvedValue(savedV1)
    const c = startChat()
    await c.send('做週報')
    await c.saveToBackend()
    c.startCreate()
    expect(c.backendSkillId.value).toBeNull()
    expect(c.savedVersion.value).toBeNull()
  })
})

describe('describeConversationError', () => {
  it('後端 detail 原文帶出', () => {
    const err = Object.assign(new Error('x'), { isAxiosError: true, response: { status: 409, data: { detail: '對話已結束' } } })
    expect(api.describeConversationError(err)).toBe('對話已結束')
  })
})
