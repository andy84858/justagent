import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillEditor from '@/views/SkillEditor.vue'
import { useSkillStore } from '@/stores/skillStore'

let currentWrapper: VueWrapper | null = null

async function mountEditFor(skillId: string) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/view/SkillEditor', name: 'SkillEditor', component: SkillEditor },
      { path: '/view/Skills', name: 'SkillManagement', component: { template: '<div/>' } },
    ],
  })
  await router.push({ path: '/view/SkillEditor', query: { skillId } })
  await router.isReady()
  const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
  currentWrapper = wrapper
  await flushPromises()
  return { wrapper, router }
}

describe('SkillEditor 編輯模式的啟用測試閘門', () => {
  beforeEach(() => setActivePinia(createPinia()))

  // .enable-gate-dialog 透過 <Teleport to="body"> 掛在 document.body 上，
  // 不會隨 wrapper 卸載自動清掉，沒清的話下一個測試會撿到上一輪殘留的對話框
  afterEach(() => {
    currentWrapper?.unmount()
    currentWrapper = null
  })

  it('技能從沒測過：勾「啟用狀態」並送出，不會直接寫入，改彈出決策對話框', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能', instructions: 'x', triggerHint: 'y', assignedAgents: [], capabilities: ['能力A'] })
    const { wrapper } = await mountEditFor(id)

    // 直接把畫面切到最後一步（確認），不用真的一步一步點過去
    ;(wrapper.findComponent(SkillEditor).vm as any).currentStep = 2
    await wrapper.vm.$nextTick()

    await wrapper.find('.se-toggle input[type="checkbox"]').setValue(true)
    await wrapper.find('.se-footer button.custom-main-btn').trigger('click')
    await flushPromises()

    expect(store.findSkill(id)!.isEnabled).toBe(false)
    // .enable-gate-dialog 是透過 <Teleport to="body"> 掛到 document.body（在
    // SkillEnableFlow.vue 裡），不在 wrapper 的元素樹底下，改用 DOMWrapper 查整個 document.body
    expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(true)
  })

  it('測過但有題目不一致：不擋，Agent 確認對話框勾選並送出後技能被啟用，接著照原本流程導回技能管理頁', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能2', instructions: 'x', triggerHint: 'y', assignedAgents: [], capabilities: ['能力A'] })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) store.answerAITestScenario(id, sc.id, !sc.agentAnswer) // 全部不一致
    const { wrapper, router } = await mountEditFor(id)
    ;(wrapper.findComponent(SkillEditor).vm as any).currentStep = 2
    await wrapper.vm.$nextTick()
    await wrapper.find('.se-toggle input[type="checkbox"]').setValue(true)
    await wrapper.find('.se-footer button.custom-main-btn').trigger('click')
    await flushPromises()

    expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
    expect(store.findSkill(id)!.isEnabled).toBe(false) // 還在 Agent 確認步驟，還沒真的啟用
    const agentDialog = new DOMWrapper(document.body).find('.enable-agent-dialog')
    expect(agentDialog.exists()).toBe(true)

    await agentDialog.findAll('.se-agent-chip').find(c => c.text().includes('通用助理'))!.trigger('click')
    await agentDialog.findAll('button').find(b => b.text().includes('確認並啟用'))!.trigger('click')
    await flushPromises()

    expect(store.findSkill(id)!.isEnabled).toBe(true)
    expect(store.findSkill(id)!.assignedAgents).toEqual(['通用助理'])
    expect(router.currentRoute.value.path).toBe('/view/Skills')
  })

  it('決策對話框選「取消」：對話框關閉，不啟用、停留在編輯頁', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能5', instructions: 'x', triggerHint: 'y', assignedAgents: [], capabilities: ['能力A'] })
    const { wrapper, router } = await mountEditFor(id)
    ;(wrapper.findComponent(SkillEditor).vm as any).currentStep = 2
    await wrapper.vm.$nextTick()
    await wrapper.find('.se-toggle input[type="checkbox"]').setValue(true)
    await wrapper.find('.se-footer button.custom-main-btn').trigger('click')
    await flushPromises()

    const cancelBtn = new DOMWrapper(document.body).findAll('.enable-gate-dialog button').find(b => b.text().includes('取消'))!
    await cancelBtn.trigger('click')
    await flushPromises()

    expect(store.findSkill(id)!.isEnabled).toBe(false)
    expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
    expect(router.currentRoute.value.path).toBe('/view/SkillEditor')
  })

  it('已經全對過的技能：勾「啟用狀態」送出不彈閘門失敗對話框，但仍要過 Agent 確認才真的生效', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '已測技能', instructions: 'x', triggerHint: 'y', assignedAgents: [], capabilities: ['能力A'] })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario(id, sc.id, sc.agentAnswer)
    }
    const { wrapper } = await mountEditFor(id)
    ;(wrapper.findComponent(SkillEditor).vm as any).currentStep = 2
    await wrapper.vm.$nextTick()
    await wrapper.find('.se-toggle input[type="checkbox"]').setValue(true)
    await wrapper.find('.se-footer button.custom-main-btn').trigger('click')
    await flushPromises()

    expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
    expect(store.findSkill(id)!.isEnabled).toBe(false)
    const agentDialog = new DOMWrapper(document.body).find('.enable-agent-dialog')
    expect(agentDialog.exists()).toBe(true)

    await agentDialog.findAll('.se-agent-chip').find(c => c.text().includes('通用助理'))!.trigger('click')
    await agentDialog.findAll('button').find(b => b.text().includes('確認並啟用'))!.trigger('click')
    await flushPromises()
    expect(store.findSkill(id)!.isEnabled).toBe(true)
  })

  it('新建模式：不管表單 isEnabled 預設值是什麼，送出後一律以未啟用落地，不彈任何對話框', async () => {
    const store = useSkillStore()
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div/>' } },
        { path: '/view/SkillEditor', name: 'SkillEditor', component: SkillEditor },
        { path: '/view/Skills', name: 'SkillManagement', component: { template: '<div/>' } },
      ],
    })
    await router.push('/view/SkillEditor')
    await router.isReady()
    const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
    currentWrapper = wrapper
    await flushPromises()

    const editor = wrapper.findComponent(SkillEditor)
    ;(editor.vm as any).form.name = '全新技能'
    ;(editor.vm as any).form.triggerHint = '當使用者需要這個技能時'
    ;(editor.vm as any).form.capabilities = ['能力A']
    ;(editor.vm as any).form.assignedAgents = ['通用助理']
    ;(editor.vm as any).currentStep = 2
    await wrapper.vm.$nextTick()
    await wrapper.find('.se-footer button.custom-main-btn').trigger('click')
    await flushPromises()

    expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
    expect(new DOMWrapper(document.body).find('.enable-agent-dialog').exists()).toBe(false)
    const created = store.myPersonalSkills.find(s => s.name === '全新技能')
    expect(created).toBeDefined()
    expect(created!.isEnabled).toBe(false)
  })

  it('建立模式（沒有 skillId）：看不到「建立後立即啟用」這個勾選', async () => {
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div/>' } },
        { path: '/view/SkillEditor', name: 'SkillEditor', component: SkillEditor },
      ],
    })
    await router.push('/view/SkillEditor')
    await router.isReady()
    const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
    currentWrapper = wrapper
    await flushPromises()
    ;(wrapper.findComponent(SkillEditor).vm as any).currentStep = 2
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.se-confirm-row--toggle').exists()).toBe(false)
  })
})
