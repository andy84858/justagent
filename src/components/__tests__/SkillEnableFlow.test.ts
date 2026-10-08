import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SkillEnableFlow from '@/components/Skill/SkillEnableFlow.vue'
import { useSkillStore } from '@/stores/skillStore'

let currentWrapper: VueWrapper | null = null

function mountFlow() {
  const wrapper = mount(SkillEnableFlow)
  currentWrapper = wrapper
  return wrapper
}

describe('SkillEnableFlow', () => {
  beforeEach(() => setActivePinia(createPinia()))

  // 對話框透過 <Teleport to="body"> 掛在 document.body 上，
  // 不會隨 wrapper 卸載自動清掉，沒清的話下一個測試會撿到上一輪殘留的對話框
  // （同一個修法見 src/views/__tests__/SkillEditor.enableGate.test.ts）
  afterEach(() => {
    currentWrapper?.unmount()
    currentWrapper = null
  })

  it('沒過測試閘門：顯示還不能啟用對話框；「取消」resolve cancelled', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    const wrapper = mountFlow()
    const promise = (wrapper.vm as any).requestEnable(store.findSkill(id), [])
    await wrapper.vm.$nextTick()

    const dialog = new DOMWrapper(document.body).find('.enable-gate-dialog')
    expect(dialog.exists()).toBe(true)
    expect(dialog.text()).toContain('還沒有做過 AI 快速測試')

    const cancelBtn = new DOMWrapper(document.body).findAll('.enable-gate-dialog button').find(b => b.text().includes('取消'))!
    await cancelBtn.trigger('click')
    expect(await promise).toEqual({ type: 'cancelled' })
    expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
  })

  it('沒過測試閘門：不再提供「去修改技能內容」，「立即測試」是主要按鈕', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能2', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    const wrapper = mountFlow()
    ;(wrapper.vm as any).requestEnable(store.findSkill(id), [])
    await wrapper.vm.$nextTick()

    const buttons = new DOMWrapper(document.body).findAll('.enable-gate-dialog button')
    expect(buttons.some(b => b.text().includes('去修改'))).toBe(false)
    const testBtn = buttons.find(b => b.text().includes('立即測試'))!
    expect(testBtn.classes()).toContain('custom-main-btn')
    expect(buttons.find(b => b.text().includes('視為通過'))!.classes()).not.toContain('custom-main-btn')
  })

  it('沒過測試閘門：選「立即測試」在同一個對話框裡就地測試，原本的選擇按鈕消失；全對後「繼續啟用」進 Agent 確認', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能2b', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    const wrapper = mountFlow()
    const promise = (wrapper.vm as any).requestEnable(store.findSkill(id), [])
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.findAll('.enable-gate-dialog button').find(b => b.text().includes('立即測試'))!.trigger('click')

    expect(body.find('.enable-gate-dialog.is-testing').exists()).toBe(true)
    expect(body.find('.enable-gate-dialog .SkillTestAI').exists()).toBe(true)
    const labels = body.findAll('.enable-gate-dialog .confirm-actions button').map(b => b.text())
    expect(labels.some(t => t.includes('立即測試') || t.includes('視為通過'))).toBe(false)
    const continueBtn = () => body.findAll('.enable-gate-dialog .confirm-actions button').find(b => b.text().includes('繼續啟用'))!
    expect(continueBtn().attributes('disabled')).toBeDefined()

    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario(id, sc.id, sc.expectedTrigger)
    }
    await wrapper.vm.$nextTick()
    expect(continueBtn().attributes('disabled')).toBeUndefined()

    await continueBtn().trigger('click')
    expect(body.find('.enable-gate-dialog').exists()).toBe(false)
    expect(body.find('.enable-agent-dialog').exists()).toBe(true)

    await body.findAll('.enable-agent-dialog .se-agent-chip')[0].trigger('click')
    await body.findAll('.enable-agent-dialog button').find(b => b.text().includes('確認並啟用'))!.trigger('click')
    const outcome = await promise
    expect(outcome.type).toBe('confirmed')
    expect(outcome.wasOverridden).toBe(false)
  })

  it('沒過測試閘門：選「視為通過」會接著顯示 Agent 確認對話框，預填 existingAgents', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能3', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    const wrapper = mountFlow()
    ;(wrapper.vm as any).requestEnable(store.findSkill(id), ['客服中心助理'])
    await wrapper.vm.$nextTick()

    const overrideBtn = new DOMWrapper(document.body).findAll('.enable-gate-dialog button').find(b => b.text().includes('視為通過'))!
    await overrideBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
    const agentDialog = new DOMWrapper(document.body).find('.enable-agent-dialog')
    expect(agentDialog.exists()).toBe(true)
    const preselected = agentDialog.findAll('.se-agent-chip.is-selected').map(c => c.text())
    expect(preselected.some(t => t.includes('客服中心助理'))).toBe(true)
  })

  it('已經 100% 通過：直接進 Agent 確認步驟，不顯示還不能啟用對話框', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '已測技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) store.answerAITestScenario(id, sc.id, sc.expectedTrigger)
    const wrapper = mountFlow()
    ;(wrapper.vm as any).requestEnable(store.findSkill(id), [])
    await wrapper.vm.$nextTick()

    expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
    expect(new DOMWrapper(document.body).find('.enable-agent-dialog').exists()).toBe(true)
  })

  it('Agent 確認步驟：勾選數為 0 時「確認並啟用」disabled；勾 1 個以上可以送出並 resolve confirmed', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能4', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) store.answerAITestScenario(id, sc.id, sc.expectedTrigger)
    const wrapper = mountFlow()
    const promise = (wrapper.vm as any).requestEnable(store.findSkill(id), [])
    await wrapper.vm.$nextTick()

    const confirmBtn = new DOMWrapper(document.body).findAll('.enable-agent-dialog button').find(b => b.text().includes('確認並啟用'))!
    expect(confirmBtn.attributes('disabled')).toBeDefined()

    const chip = new DOMWrapper(document.body).findAll('.se-agent-chip').find(c => c.text().includes('通用助理'))!
    await chip.trigger('click')
    expect(confirmBtn.attributes('disabled')).toBeUndefined()

    await confirmBtn.trigger('click')
    expect(await promise).toEqual({ type: 'confirmed', agents: ['通用助理'], wasOverridden: false })
  })

  it('視為通過後確認送出：wasOverridden 為 true', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能5', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    const wrapper = mountFlow()
    const promise = (wrapper.vm as any).requestEnable(store.findSkill(id), [])
    await wrapper.vm.$nextTick()
    await new DOMWrapper(document.body).findAll('.enable-gate-dialog button').find(b => b.text().includes('視為通過'))!.trigger('click')
    await wrapper.vm.$nextTick()
    await new DOMWrapper(document.body).findAll('.se-agent-chip').find(c => c.text().includes('通用助理'))!.trigger('click')
    await new DOMWrapper(document.body).findAll('.enable-agent-dialog button').find(b => b.text().includes('確認並啟用'))!.trigger('click')
    expect(await promise).toEqual({ type: 'confirmed', agents: ['通用助理'], wasOverridden: true })
  })

  it('Agent 確認步驟按「取消」：resolve cancelled', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能6', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) store.answerAITestScenario(id, sc.id, sc.expectedTrigger)
    const wrapper = mountFlow()
    const promise = (wrapper.vm as any).requestEnable(store.findSkill(id), [])
    await wrapper.vm.$nextTick()
    await new DOMWrapper(document.body).findAll('.enable-agent-dialog button').find(b => b.text().includes('取消'))!.trigger('click')
    expect(await promise).toEqual({ type: 'cancelled' })
  })

  it('requestEnable 被再次呼叫時，前一次還沒 resolve 的 promise 會被 resolve 成 cancelled', async () => {
    const store = useSkillStore()
    const idA = store.createPersonalSkill({ name: '技能A', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    const idB = store.createPersonalSkill({ name: '技能B', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    const wrapper = mountFlow()
    const firstPromise = (wrapper.vm as any).requestEnable(store.findSkill(idA), [])
    await wrapper.vm.$nextTick()

    const secondPromise = (wrapper.vm as any).requestEnable(store.findSkill(idB), [])
    expect(await firstPromise).toEqual({ type: 'cancelled' })

    await wrapper.vm.$nextTick()
    const dialog = new DOMWrapper(document.body).find('.enable-gate-dialog')
    expect(dialog.text()).toContain('技能B') // 第二次呼叫真的接手了對話框

    const cancelBtn = new DOMWrapper(document.body).findAll('.enable-gate-dialog button').find(b => b.text().includes('取消'))!
    await cancelBtn.trigger('click')
    expect(await secondPromise).toEqual({ type: 'cancelled' })
  })
})
