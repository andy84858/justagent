import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBackendTestStore } from '@/stores/backendTestStore'
import * as api from '@/services/skillConversationApi'

vi.mock('@/services/skillConversationApi', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/skillConversationApi')>()),
  startConversationTest: vi.fn(),
  submitConversationTest: vi.fn(),
}))

const started: api.StartedTest = {
  questions: [{ id: '1', text: '客人要退貨？' }, { id: '2', text: '客人問天氣？' }],
  options: ['該用', '不該用'],
}
const submitted: api.SubmittedTest = {
  tested: true,
  results: [
    { id: '1', text: '客人要退貨？', user_answer: '該用', consistent: true, failed: false },
    { id: '2', text: '客人問天氣？', user_answer: '該用', consistent: false, failed: false },
  ],
}

describe('backendTestStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('沒開始過：idle，沒有題目', () => {
    const t = useBackendTestStore()
    expect(t.stateOf('c1').phase).toBe('idle')
    expect(t.stateOf('c1').questions).toEqual([])
  })

  it('start：題目來自後端，進入作答，答案清空', async () => {
    vi.mocked(api.startConversationTest).mockResolvedValue(started)
    const t = useBackendTestStore()
    await t.start('c1')
    expect(api.startConversationTest).toHaveBeenCalledWith('c1')
    expect(t.stateOf('c1').phase).toBe('answering')
    expect(t.stateOf('c1').questions).toHaveLength(2)
  })

  it('選答案不會計分：只記下，沒有結果、沒有測過', async () => {
    vi.mocked(api.startConversationTest).mockResolvedValue(started)
    const t = useBackendTestStore()
    await t.start('c1')
    t.setAnswer('c1', '1', '該用')
    expect(t.stateOf('c1').answers).toEqual({ '1': '該用' })
    expect(t.stateOf('c1').results).toEqual([])
    expect(t.stateOf('c1').tested).toBe(false)
    expect(api.submitConversationTest).not.toHaveBeenCalled()
  })

  it('沒答完不能交卷：不打後端', async () => {
    vi.mocked(api.startConversationTest).mockResolvedValue(started)
    const t = useBackendTestStore()
    await t.start('c1')
    t.setAnswer('c1', '1', '該用')
    expect(t.canSubmit('c1')).toBe(false)
    await t.submit('c1')
    expect(api.submitConversationTest).not.toHaveBeenCalled()
  })

  it('交卷：逐題一致與否，tested 為真，之後不能再改答案', async () => {
    vi.mocked(api.startConversationTest).mockResolvedValue(started)
    vi.mocked(api.submitConversationTest).mockResolvedValue(submitted)
    const t = useBackendTestStore()
    await t.start('c1')
    t.setAnswer('c1', '1', '該用')
    t.setAnswer('c1', '2', '該用')
    expect(t.canSubmit('c1')).toBe(true)
    await t.submit('c1')
    expect(api.submitConversationTest).toHaveBeenCalledWith('c1', { '1': '該用', '2': '該用' })
    expect(t.stateOf('c1').phase).toBe('submitted')
    expect(t.stateOf('c1').results.map(r => r.consistent)).toEqual([true, false])
    expect(t.stateOf('c1').tested).toBe(true)
    t.setAnswer('c1', '1', '不該用')
    expect(t.stateOf('c1').answers['1']).toBe('該用')
  })

  it('兩場對話同時在測，狀態互不影響', async () => {
    vi.mocked(api.startConversationTest).mockResolvedValue(started)
    vi.mocked(api.submitConversationTest).mockResolvedValue(submitted)
    const t = useBackendTestStore()
    await t.start('c1')
    await t.start('c2')
    t.setAnswer('c1', '1', '該用')
    t.setAnswer('c1', '2', '該用')
    await t.submit('c1')
    t.setAnswer('c2', '1', '不該用')
    expect(t.stateOf('c1').phase).toBe('submitted')
    expect(t.stateOf('c2').phase).toBe('answering')
    expect(t.stateOf('c2').answers).toEqual({ '1': '不該用' })
    expect(t.stateOf('c2').tested).toBe(false)
  })

  it('出題失敗：白話提示，回到 idle 可重試', async () => {
    vi.mocked(api.startConversationTest).mockRejectedValue(
      Object.assign(new Error('x'), { isAxiosError: true, response: { status: 502, data: { detail: '出題失敗，請再試一次' } } }),
    )
    const t = useBackendTestStore()
    await t.start('c1')
    expect(t.stateOf('c1').phase).toBe('idle')
    expect(t.stateOf('c1').errorHint).toBe('出題失敗，請再試一次')
  })

  it('交卷失敗：白話提示，答案還在、還能再交', async () => {
    vi.mocked(api.startConversationTest).mockResolvedValue(started)
    vi.mocked(api.submitConversationTest).mockRejectedValueOnce(
      Object.assign(new Error('x'), { isAxiosError: true, response: { status: 409, data: { detail: '草稿改過了，請重新測試' } } }),
    )
    const t = useBackendTestStore()
    await t.start('c1')
    t.setAnswer('c1', '1', '該用')
    t.setAnswer('c1', '2', '不該用')
    await t.submit('c1')
    expect(t.stateOf('c1').errorHint).toBe('草稿改過了，請重新測試')
    expect(t.stateOf('c1').phase).toBe('answering')
    expect(t.stateOf('c1').answers).toEqual({ '1': '該用', '2': '不該用' })
  })

  it('reset：該場對話回到沒測過', async () => {
    vi.mocked(api.startConversationTest).mockResolvedValue(started)
    const t = useBackendTestStore()
    await t.start('c1')
    t.reset('c1')
    expect(t.stateOf('c1').phase).toBe('idle')
  })
})
