import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillManagement from '../SkillManagement.vue'
import { useSkillStore } from '@/stores/skillStore'

// 個人技能啟用前要先通過 AI 快速測試（或明確選擇略過），這裡測技能詳情抽屜
// 「啟用技能」按鈕接上的決策對話框：沒過關就攔下來，不直接切換。
describe('SkillManagement 啟用前的測試閘門', () => {
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
      { global: { plugins: [router], stubs: { AppBreadcrumb: true, LibraryBrowseModal: true, SkillReviewDrawer: true, UpstreamUpdateDrawer: true, BatchUpdateModal: true } } },
    )
    currentWrapper = wrapper
    return { wrapper: wrapper.findComponent(SkillManagement), router }
  }

  it('技能從沒測過：點「啟用技能」不會直接切換，改彈出決策對話框', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    const { wrapper } = await mountPage()
    ;(wrapper.vm as any).detailSkillId = id
    await wrapper.vm.$nextTick()

    const toggleBtn = new DOMWrapper(document.body).find('.dm-toggle-btn')
    expect(toggleBtn.text()).toContain('啟用技能')
    await toggleBtn.trigger('click')

    expect(store.findSkill(id)!.isEnabled).toBe(false)
    const dialog = new DOMWrapper(document.body).find('.enable-gate-dialog')
    expect(dialog.exists()).toBe(true)
    expect(dialog.text()).toContain('還沒測過')
    expect(dialog.text()).not.toContain('視為通過')
  })

  it('測過但有題目不一致：不擋，直接進 Agent 確認，勾選並送出後啟用並指派', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能2', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) store.answerAITestScenario(id, sc.id, !sc.agentAnswer) // 全部不一致
    const { wrapper } = await mountPage()
    ;(wrapper.vm as any).detailSkillId = id
    await wrapper.vm.$nextTick()
    await new DOMWrapper(document.body).find('.dm-toggle-btn').trigger('click')
    await wrapper.vm.$nextTick()

    expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
    expect(store.findSkill(id)!.isEnabled).toBe(false) // 還沒真的啟用，還在 Agent 確認步驟
    const agentDialog = new DOMWrapper(document.body).find('.enable-agent-dialog')
    expect(agentDialog.exists()).toBe(true)

    await agentDialog.findAll('.se-agent-chip').find(c => c.text().includes('通用助理'))!.trigger('click')
    await agentDialog.findAll('button').find(b => b.text().includes('確認並啟用'))!.trigger('click')

    expect(store.findSkill(id)!.isEnabled).toBe(true)
    expect(store.findSkill(id)!.assignedAgents).toEqual(['通用助理'])
    expect(new DOMWrapper(document.body).find('.enable-agent-dialog').exists()).toBe(false)
  })

  it('已經全對過的技能：點「啟用技能」不彈閘門失敗對話框，但仍要過 Agent 確認才真的啟用', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '已測技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario(id, sc.id, sc.agentAnswer)
    }
    expect(store.findSkill(id)!.aiTestPassRate).toBe(1)

    const { wrapper } = await mountPage()
    ;(wrapper.vm as any).detailSkillId = id
    await wrapper.vm.$nextTick()
    await new DOMWrapper(document.body).find('.dm-toggle-btn').trigger('click')
    await wrapper.vm.$nextTick()

    expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
    expect(store.findSkill(id)!.isEnabled).toBe(false)
    const agentDialog = new DOMWrapper(document.body).find('.enable-agent-dialog')
    expect(agentDialog.exists()).toBe(true)

    await agentDialog.findAll('.se-agent-chip').find(c => c.text().includes('通用助理'))!.trigger('click')
    await agentDialog.findAll('button').find(b => b.text().includes('確認並啟用'))!.trigger('click')
    expect(store.findSkill(id)!.isEnabled).toBe(true)
  })

  it('決策對話框選「取消」：對話框關閉，不啟用、不導頁', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能4', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    const { wrapper, router } = await mountPage()
    const push = vi.spyOn(router, 'push')
    ;(wrapper.vm as any).detailSkillId = id
    await wrapper.vm.$nextTick()
    await new DOMWrapper(document.body).find('.dm-toggle-btn').trigger('click')

    const cancelBtn = new DOMWrapper(document.body).findAll('.enable-gate-dialog button').find(b => b.text().includes('取消'))!
    await cancelBtn.trigger('click')

    expect(push).not.toHaveBeenCalled()
    expect(store.findSkill(id)!.isEnabled).toBe(false)
    expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
  })

  it('停用方向（目前已啟用）：一律直接切換，不檢查、不彈窗', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '要停用的技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    store.toggleSkill(id)
    const { wrapper } = await mountPage()
    ;(wrapper.vm as any).detailSkillId = id
    await wrapper.vm.$nextTick()
    await new DOMWrapper(document.body).find('.dm-toggle-btn').trigger('click')

    expect(store.findSkill(id)!.isEnabled).toBe(false)
    expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
  })
})
