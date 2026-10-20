import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SkillTestBackend from '@/components/Skill/SkillTestBackend.vue'
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

async function startedWrapper(conversationId = 'c1') {
  vi.mocked(api.startConversationTest).mockResolvedValue(started)
  const w = mount(SkillTestBackend, { props: { conversationId } })
  await w.find('.custom-main-btn').trigger('click')   // 生成測試情境
  await flushPromises()
  return w
}
const pick = (w: ReturnType<typeof mount>, card: number, label: string) =>
  w.findAll('.scenario-card')[card].findAll('button').find(b => b.text() === label)!.trigger('click')

describe('SkillTestBackend', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('還沒有對話：提示先聊出草稿，沒有出題按鈕', () => {
    const w = mount(SkillTestBackend, { props: { conversationId: null } })
    expect(w.text()).toContain('先跟助理聊出一份草稿')
    expect(w.find('button').exists()).toBe(false)
  })

  it('題目來自後端；選答案不會立刻出結果', async () => {
    const w = await startedWrapper()
    expect(w.findAll('.scenario-card')).toHaveLength(2)
    await pick(w, 0, '該用')
    expect(w.text()).toContain('已作答 1 / 2')
    expect(w.text()).not.toContain('一致')
    expect(api.submitConversationTest).not.toHaveBeenCalled()
  })

  it('沒答完交卷鈕反灰', async () => {
    const w = await startedWrapper()
    await pick(w, 0, '該用')
    const submit = w.findAll('button').find(b => b.text().includes('交卷'))!
    expect(submit.attributes('disabled')).toBeDefined()
  })

  it('交卷後逐題顯示一致或不一致，沒有標準答案、沒有出題理由', async () => {
    vi.mocked(api.submitConversationTest).mockResolvedValue({
      tested: true,
      results: [
        { id: '1', text: '客人要退貨？', user_answer: '該用', consistent: true, failed: false },
        { id: '2', text: '客人問天氣？', user_answer: '該用', consistent: false, failed: false },
      ],
    })
    const w = await startedWrapper()
    await pick(w, 0, '該用')
    await pick(w, 1, '該用')
    await w.findAll('button').find(b => b.text().includes('交卷'))!.trigger('click')
    await flushPromises()
    const cards = w.findAll('.scenario-card')
    expect(cards[0].text()).toContain('一致')
    expect(cards[1].text()).toContain('不一致')
    expect(w.text()).not.toContain('正確答案')
    expect(w.text()).toContain('1 / 2 題與你的判斷一致')
    expect(w.text()).toContain('已算測過')
    expect(w.findAll('.scenario-answer-btns')).toHaveLength(0)
  })

  it('交卷後顯示測過記號要怎麼記下來（由外殼給的說明）', async () => {
    vi.mocked(api.startConversationTest).mockResolvedValue(started)
    vi.mocked(api.submitConversationTest).mockResolvedValue({
      tested: true,
      results: started.questions.map(q => ({ id: q.id, text: q.text, user_answer: '該用' as const, consistent: true, failed: false })),
    })
    const w = mount(SkillTestBackend, { props: { conversationId: 'c1', testedNote: '按「記下測過」，這一版就算測過。' } })
    await w.find('.custom-main-btn').trigger('click')
    await flushPromises()
    await pick(w, 0, '該用')
    await pick(w, 1, '該用')
    await w.findAll('button').find(b => b.text().includes('交卷'))!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('按「記下測過」')
  })

  it('兩場對話各自的測試互不影響', async () => {
    vi.mocked(api.startConversationTest).mockResolvedValue(started)
    const a = mount(SkillTestBackend, { props: { conversationId: 'c1' } })
    await a.find('.custom-main-btn').trigger('click')
    await flushPromises()
    await pick(a, 0, '該用')
    const b = mount(SkillTestBackend, { props: { conversationId: 'c2' } })
    expect(b.text()).toContain('生成測試情境')
    expect(a.text()).toContain('已作答 1 / 2')
  })

  it('出題失敗：白話提示，還能重試', async () => {
    vi.mocked(api.startConversationTest).mockRejectedValue(
      Object.assign(new Error('x'), { isAxiosError: true, response: { status: 502, data: { detail: '出題失敗，請再試一次' } } }),
    )
    const w = mount(SkillTestBackend, { props: { conversationId: 'c1' } })
    await w.find('.custom-main-btn').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('出題失敗，請再試一次')
    expect(w.text()).toContain('生成測試情境')
  })
})
