import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillManagement from '../SkillManagement.vue'
import { useSkillStore } from '@/stores/skillStore'
import { consumeSkillHandoff } from '@/composables/useSkillHandoff'

// 「我的技能」分頁新增「建議建立的技能」區塊：agent 完成任務後放進佇列的建議，
// 使用者在這裡決定「建立」（帶著預填草稿導向 AI 賦能）或「不用了」（直接丟棄）。
describe('SkillManagement 建議建立的技能', () => {
  let currentWrapper: VueWrapper | null = null

  afterEach(() => {
    currentWrapper?.unmount()
    currentWrapper = null
  })

  async function mountPage() {
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div/>' } },
        { path: '/view/Skills', name: 'SkillManagement', component: SkillManagement },
        { path: '/view/SkillEditor', name: 'SkillEditor', component: { template: '<div/>' } },
      ],
    })
    await router.push('/view/Skills')
    await router.isReady()
    const wrapper = mount(
      { template: '<router-view />' },
      { global: { plugins: [router], stubs: { AppBreadcrumb: true, LibraryBrowseModal: true, SkillDetailDrawer: true, UpstreamUpdateDrawer: true, SkillReviewDrawer: true, BatchUpdateModal: true } } },
    )
    currentWrapper = wrapper
    return { wrapper: wrapper.findComponent(SkillManagement), router }
  }

  it('沒有待處理建議時不顯示這個區塊', async () => {
    setActivePinia(createPinia())
    // 預設佇列裡有幾筆示範假資料（見 skillStore.ts 的 MOCK_SUGGESTIONS），
    // 這裡測的是真的清空之後的樣子，先清掉才有乾淨的起點
    const store = useSkillStore()
    store.pendingSuggestions.map(s => s.id).forEach(id => store.dismissSuggestion(id))
    const { wrapper } = await mountPage()
    expect(wrapper.find('.skill-suggestion-queue').exists()).toBe(false)
  })

  it('預設收合：只看得到一行摘要（含筆數），看不到個別建議內容', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    store.pendingSuggestions.map(s => s.id).forEach(id => store.dismissSuggestion(id))
    store.addSuggestion({
      id: 'conv4-sales-report', name: '產品銷售報告整理', description: '查詢並產出報告',
      steps: ['查詢數據', '套用規範產出'],
      reason: '查詢銷售資料＋套用部門報告規範', conversationId: 'conv4',
    })
    const { wrapper } = await mountPage()
    const queue = wrapper.find('.skill-suggestion-queue')
    expect(queue.exists()).toBe(true)
    expect(queue.text()).toContain('1 個 AI 建議建立的技能')
    expect(wrapper.find('.ssq-list').exists()).toBe(false)
    expect(queue.text()).not.toContain('產品銷售報告整理')
  })

  it('點摘要列展開：顯示佇列裡的建議名稱與來源流程；再點一次收合回去', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    store.pendingSuggestions.map(s => s.id).forEach(id => store.dismissSuggestion(id))
    store.addSuggestion({
      id: 'conv4-sales-report', name: '產品銷售報告整理', description: '查詢並產出報告',
      steps: ['查詢數據', '套用規範產出'],
      reason: '查詢銷售資料＋套用部門報告規範', conversationId: 'conv4',
    })
    const { wrapper } = await mountPage()
    await wrapper.find('.ssq-header').trigger('click')
    const queue = wrapper.find('.skill-suggestion-queue')
    expect(queue.text()).toContain('產品銷售報告整理')
    expect(queue.text()).toContain('查詢銷售資料＋套用部門報告規範')

    await wrapper.find('.ssq-header').trigger('click')
    expect(wrapper.find('.ssq-list').exists()).toBe(false)
  })

  it('按「建立」：設定交接資料、從佇列移除、導向 AI 賦能並帶 ?from=', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    store.pendingSuggestions.map(s => s.id).forEach(id => store.dismissSuggestion(id))
    store.addSuggestion({
      id: 'conv4-sales-report', name: '產品銷售報告整理', description: '查詢並產出報告',
      steps: ['查詢數據', '套用規範產出'],
      reason: '查詢銷售資料＋套用部門報告規範', conversationId: 'conv4',
    })
    const { wrapper, router } = await mountPage()
    await wrapper.find('.ssq-header').trigger('click')
    const push = vi.spyOn(router, 'push')
    const buildBtn = wrapper.find('.skill-suggestion-queue [data-action="build"]')
    await buildBtn.trigger('click')

    expect(push).toHaveBeenCalledWith({ query: { from: 'conv4' } })
    expect(store.pendingSuggestions).toEqual([])
    const handoff = consumeSkillHandoff()
    expect(handoff?.origin).toEqual({ conversationId: 'conv4', reason: '查詢銷售資料＋套用部門報告規範' })
    expect(handoff?.prefill.name).toBe('產品銷售報告整理')
  })

  it('按「不用了」：直接從佇列移除，不導向也不設定交接資料', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    store.pendingSuggestions.map(s => s.id).forEach(id => store.dismissSuggestion(id))
    store.addSuggestion({
      id: 'conv4-sales-report', name: '產品銷售報告整理', description: '查詢並產出報告',
      steps: ['查詢數據', '套用規範產出'],
      reason: '查詢銷售資料＋套用部門報告規範', conversationId: 'conv4',
    })
    const { wrapper, router } = await mountPage()
    await wrapper.find('.ssq-header').trigger('click')
    const push = vi.spyOn(router, 'push')
    const dismissBtn = wrapper.find('.skill-suggestion-queue [data-action="dismiss"]')
    await dismissBtn.trigger('click')

    expect(push).not.toHaveBeenCalled()
    expect(store.pendingSuggestions).toEqual([])
    expect(consumeSkillHandoff()).toBeNull()
  })

  // 統計列的「N 個 AI 建議技能待處理」入口：跟「個技能等待審核」同一套 pill 徽章語彙，
  // 讓使用者不用先滑到頁面下方才發現有新建議
  it('統計列顯示「N 個 AI 建議技能待處理」，點擊捲動到建議佇列', async () => {
    setActivePinia(createPinia())
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const store = useSkillStore()
    store.pendingSuggestions.map(s => s.id).forEach(id => store.dismissSuggestion(id))
    store.addSuggestion({
      id: 'conv4-sales-report', name: '產品銷售報告整理', description: '查詢並產出報告',
      steps: ['查詢數據', '套用規範產出'],
      reason: '查詢銷售資料＋套用部門報告規範', conversationId: 'conv4',
    })
    const { wrapper } = await mountPage()
    const stat = wrapper.find('.skill-stat--suggestion')
    expect(stat.exists()).toBe(true)
    expect(stat.text()).toContain('1')
    expect(stat.text()).toContain('個 AI 建議技能待處理')

    expect(wrapper.find('.ssq-list').exists()).toBe(false)
    await stat.trigger('click')
    expect(scrollIntoView).toHaveBeenCalled()
    expect(wrapper.find('.ssq-list').exists()).toBe(true)
  })

  it('沒有待處理建議時，統計列不顯示這個入口', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    store.pendingSuggestions.map(s => s.id).forEach(id => store.dismissSuggestion(id))
    const { wrapper } = await mountPage()
    expect(wrapper.find('.skill-stat--suggestion').exists()).toBe(false)
  })

  // 佇列本來就是 v-for 列表，每個項目的「建立」「不用了」都用各自的 id 操作，
  // 這裡驗證多筆同時存在時，動到其中一筆不會影響到另一筆
  it('同時有多筆建議：各自獨立顯示，處理其中一筆不影響其他筆', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    store.pendingSuggestions.map(s => s.id).forEach(id => store.dismissSuggestion(id))
    store.addSuggestion({
      id: 'suggest-a', name: '建議技能A', description: 'x',
      steps: [], reason: '來源A', conversationId: 'conv4',
    })
    store.addSuggestion({
      id: 'suggest-b', name: '建議技能B', description: 'x',
      steps: [], reason: '來源B', conversationId: 'conv5',
    })
    const { wrapper } = await mountPage()

    const stat = wrapper.find('.skill-stat--suggestion')
    expect(stat.text()).toContain('2')

    await wrapper.find('.ssq-header').trigger('click')
    const items = wrapper.findAll('.ssq-item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('建議技能A')
    expect(items[1].text()).toContain('建議技能B')

    const dismissBtnA = items[0].find('[data-action="dismiss"]')
    await dismissBtnA.trigger('click')

    expect(store.pendingSuggestions).toEqual([
      expect.objectContaining({ id: 'suggest-b' }),
    ])
    const remaining = wrapper.findAll('.ssq-item')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].text()).toContain('建議技能B')
  })
})
