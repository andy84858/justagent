import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillTestAI from '@/components/Skill/SkillTestAI.vue'
import { useSkillStore } from '@/stores/skillStore'

describe('SkillTestAI：AI 出題、使用者判斷該不該觸發的選擇題', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始空狀態：顯示「生成測試情境」按鈕', () => {
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    expect(w.find('.ai-idle-hint').exists()).toBe(true)
    const btn = w.find('button')
    expect(btn.text()).toContain('生成測試情境')
  })

  it('點「生成測試情境」：每張情境卡顯示題目、問句，以及「該觸發」「不該觸發」兩個按鈕', async () => {
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    await w.find('button').trigger('click')
    await new Promise(r => setTimeout(r, 950))
    await w.vm.$nextTick()

    const cards = w.findAll('.scenario-card')
    expect(cards.length).toBeGreaterThanOrEqual(6)
    const first = cards[0]
    expect(first.text()).toContain('這句話該不該觸發這顆技能？')
    const btns = first.findAll('.scenario-answer-btns button')
    expect(btns.map(b => b.text())).toEqual(['該觸發', '不該觸發'])
    expect(w.find('.ai-report').exists()).toBe(false)
  }, 10000)

  it('答對：卡片顯示「答對了」，答案按鈕消失', async () => {
    const store = useSkillStore()
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    await store.generateAITestScenarios('sys-cs-001')
    await w.vm.$nextTick()

    const sc = store.aiTestScenarios[0]
    const card = w.findAll('.scenario-card')[0]
    const correctBtnIndex = sc.expectedTrigger ? 0 : 1
    await card.findAll('.scenario-answer-btns button')[correctBtnIndex].trigger('click')
    await w.vm.$nextTick()

    expect(card.find('.scenario-answer-btns').exists()).toBe(false)
    expect(card.text()).toContain('答對了')
    expect(card.text()).toContain(sc.expectedTrigger ? '該觸發' : '不該觸發')
  }, 10000)

  it('答錯：卡片顯示「答錯了」與正確答案說明', async () => {
    const store = useSkillStore()
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    await store.generateAITestScenarios('sys-cs-001')
    await w.vm.$nextTick()

    const sc = store.aiTestScenarios[0]
    const card = w.findAll('.scenario-card')[0]
    // 選跟正確答案相反的按鈕
    const wrongBtnIndex = sc.expectedTrigger ? 1 : 0
    await card.findAll('.scenario-answer-btns button')[wrongBtnIndex].trigger('click')
    await w.vm.$nextTick()

    expect(card.text()).toContain('答錯了')
    expect(card.text()).toContain(sc.expectedBehavior)
  }, 10000)

  it('全部答完後顯示測試報告：答對題數、分類統計、總結文字', async () => {
    const store = useSkillStore()
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    await store.generateAITestScenarios('sys-cs-001')
    await w.vm.$nextTick()

    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario('sys-cs-001', sc.id, sc.expectedTrigger)
    }
    await w.vm.$nextTick()

    const report = w.find('.ai-report')
    expect(report.exists()).toBe(true)
    expect(report.text()).toContain(`${store.aiTestScenarios.length} / ${store.aiTestScenarios.length} 答對`)
    expect(report.text()).toContain('100%')
    expect(w.find('.report-summary').text()).toBeTruthy()
  }, 10000)

  it('「重新生成」會清空已作答的情境重新出題', async () => {
    const store = useSkillStore()
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    await store.generateAITestScenarios('sys-cs-001')
    store.answerAITestScenario('sys-cs-001', store.aiTestScenarios[0].id, store.aiTestScenarios[0].expectedTrigger)
    await w.vm.$nextTick()
    expect(w.findAll('.status-badge').length).toBeGreaterThan(0)

    await w.find('.ai-toolbar button').trigger('click')
    await new Promise(r => setTimeout(r, 950))
    await w.vm.$nextTick()

    expect(store.aiTestScenarios.every(s => s.status === 'pending')).toBe(true)
    expect(w.find('.status-badge').exists()).toBe(false)
  }, 10000)

  it('100% 通過時顯示「啟用技能」按鈕；未 100% 或尚未測試時不顯示', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    const wrapper = mount(SkillTestAI, { props: { skillId: id } })

    expect(wrapper.find('.ai-enable-btn').exists()).toBe(false) // 還沒生成測試情境

    await store.generateAITestScenarios(id)
    await wrapper.vm.$nextTick()
    const scenarios = [...store.aiTestScenarios]
    expect(scenarios.length).toBeGreaterThan(1) // 這個測試要故意答錯至少一題，情境數要夠

    // 除了最後一題以外全部故意答錯，確定 correct !== total（不會意外全對）
    for (let i = 0; i < scenarios.length - 1; i++) {
      store.answerAITestScenario(id, scenarios[i].id, !scenarios[i].expectedTrigger)
    }
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.ai-enable-btn').exists()).toBe(false) // 還有題目 pending，aiTestReport 仍是 null

    store.answerAITestScenario(id, scenarios.at(-1)!.id, scenarios.at(-1)!.expectedTrigger)
    await wrapper.vm.$nextTick()
    expect(store.aiTestReport!.correct).not.toBe(store.aiTestReport!.total) // 確認這次真的不是 100%
    expect(wrapper.find('.ai-enable-btn').exists()).toBe(false)
  })

  it('100% 全對：顯示啟用按鈕，點擊走 SkillEnableFlow 並在確認後呼叫 setAssignedAgents + toggleSkill', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能2', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario(id, sc.id, sc.expectedTrigger) // 全部答對
    }
    expect(store.aiTestReport!.correct).toBe(store.aiTestReport!.total)

    const wrapper = mount(SkillTestAI, { props: { skillId: id } })
    await wrapper.vm.$nextTick()

    const enableBtn = wrapper.find('.ai-enable-btn')
    expect(enableBtn.exists()).toBe(true)
    await enableBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const agentDialog = new DOMWrapper(document.body).find('.enable-agent-dialog')
    expect(agentDialog.exists()).toBe(true) // 100% 直接進 Agent 確認，不會看到閘門失敗對話框
    await agentDialog.findAll('.se-agent-chip').find(c => c.text().includes('通用助理'))!.trigger('click')
    await agentDialog.findAll('button').find(b => b.text().includes('確認並啟用'))!.trigger('click')

    expect(store.findSkill(id)!.isEnabled).toBe(true)
    expect(store.findSkill(id)!.assignedAgents).toEqual(['通用助理'])
  })

  it('confirmed outcome：指派 Agent 並啟用技能', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能3', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario(id, sc.id, sc.expectedTrigger)
    }

    const wrapper = mount(SkillTestAI, { props: { skillId: id } })
    await wrapper.vm.$nextTick()

    // SkillEnableFlow 透過 defineExpose 只暴露 requestEnable，findComponent(...).vm 拿到的是
    // 開發模式下的完整內部 proxy（<script setup> top-level binding 唯讀，寫入會被吃掉），
    // 真正被 SkillTestAI 呼叫的是 template ref 拿到的「exposed」物件本身，
    // 所以改成透過 SkillTestAI 自己的 enableFlowRef（在其未呼叫 defineExpose 的完整 dev proxy 上可讀到）
    // 取得同一個 exposed 物件來 stub，才能真正攔截 handleEnableClick 內的呼叫。
    const enableFlowRef = (wrapper.vm as any).enableFlowRef
    vi.spyOn(enableFlowRef, 'requestEnable').mockResolvedValue({ type: 'confirmed', agents: ['通用助理'] })

    await wrapper.find('.ai-enable-btn').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const skill = store.findSkill(id)!
    expect(skill.isEnabled).toBe(true)
    expect(skill.assignedAgents).toEqual(['通用助理'])
  })

  it('goToTest outcome（理論上不會發生，因為 100% 時閘門不會顯示）：不觸發任何 store 變更', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能4', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario(id, sc.id, sc.expectedTrigger)
    }

    const wrapper = mount(SkillTestAI, { props: { skillId: id } })
    await wrapper.vm.$nextTick()

    const enableFlowRef = (wrapper.vm as any).enableFlowRef
    vi.spyOn(enableFlowRef, 'requestEnable').mockResolvedValue({ type: 'goToTest' })

    await wrapper.find('.ai-enable-btn').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const skill = store.findSkill(id)!
    expect(skill.isEnabled).toBe(false)
    expect(skill.assignedAgents).toEqual([])
  })

  it('已經啟用的技能：即使報告 100% 全對，也不顯示「啟用技能」按鈕（避免誤按變成停用）', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '已啟用技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    store.toggleSkill(id) // 模擬「已經是上線中的技能」
    expect(store.findSkill(id)!.isEnabled).toBe(true)

    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario(id, sc.id, sc.expectedTrigger) // 全部答對
    }
    expect(store.aiTestReport!.correct).toBe(store.aiTestReport!.total)

    const wrapper = mount(SkillTestAI, { props: { skillId: id } })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.ai-enable-btn').exists()).toBe(false)
  })

  it('跨技能的舊報告不會外洩：技能 A 測完 100% 後，掛載技能 B 的元件不應該顯示啟用按鈕', async () => {
    const store = useSkillStore()
    const idA = store.createPersonalSkill({ name: '技能A', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    const idB = store.createPersonalSkill({ name: '技能B', instructions: 'x', triggerHint: 'y', assignedAgents: [] })

    await store.generateAITestScenarios(idA)
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario(idA, sc.id, sc.expectedTrigger) // A 全部答對
    }
    expect(store.aiTestReport!.correct).toBe(store.aiTestReport!.total)
    expect(store.aiTestScenariosSkillId).toBe(idA)

    // 從沒對 B 呼叫過 generateAITestScenarios／setSelectedSkill，全域報告仍是 A 留下的
    const wrapper = mount(SkillTestAI, { props: { skillId: idB } })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.ai-enable-btn').exists()).toBe(false)
    // mount 時的 ensureAITestStateForSkill 應該已經把 A 的舊狀態清掉
    expect(store.aiTestReport).toBeNull()
    expect(store.aiTestScenarios).toEqual([])
  })

  it('「去修改技能內容」（revise）：導向 /view/Skills 並帶上 skillId，不再是靜默丟棄', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待修改技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario(id, sc.id, sc.expectedTrigger)
    }

    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div/>' } },
        { path: '/view/Skills', name: 'SkillManagement', component: { template: '<div/>' } },
      ],
    })
    await router.push('/')
    await router.isReady()
    const push = vi.spyOn(router, 'push')

    const wrapper = mount(SkillTestAI, {
      props: { skillId: id },
      global: { plugins: [router] },
    })
    await wrapper.vm.$nextTick()

    // SkillEnableFlow 透過 defineExpose 只暴露 requestEnable，findComponent(...).vm 拿到的是
    // 開發模式下的完整內部 proxy（<script setup> top-level binding 唯讀，寫入會被吃掉），
    // 真正被 SkillTestAI 呼叫的是 template ref 拿到的「exposed」物件本身，
    // 所以改成透過 SkillTestAI 自己的 enableFlowRef 取得同一個 exposed 物件來 stub。
    const enableFlowRef = (wrapper.vm as any).enableFlowRef
    vi.spyOn(enableFlowRef, 'requestEnable').mockResolvedValue({ type: 'revise' })

    await wrapper.find('.ai-enable-btn').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(push).toHaveBeenCalledWith({ path: '/view/Skills', query: { skillId: id } })
    expect(store.findSkill(id)!.isEnabled).toBe(false)
  })

  // 還沒存檔的草稿先測試：draftTestId 這個佔位 id 在 store 裡找不到對應的技能，
  // 但已經有一份測試紀錄（不限 100%）時，讓使用者一次「存檔並啟用」，不用先存檔
  // 再回來找另一個按鈕重新走一次
  describe('「儲存並啟用」：還沒存檔但已有測試紀錄', () => {
    it('還沒存檔、有測試紀錄：顯示「儲存並啟用」；已存檔或還沒測試過都不顯示', async () => {
      const store = useSkillStore()
      const wrapper = mount(SkillTestAI, { props: { skillId: 'draft-xyz' } })
      expect(wrapper.find('.ai-save-enable-btn').exists()).toBe(false) // 還沒生成測試情境

      await store.generateAITestScenarios('draft-xyz')
      for (const sc of [...store.aiTestScenarios]) {
        store.answerAITestScenario('draft-xyz', sc.id, !sc.expectedTrigger) // 故意答錯，確認不限 100% 也會顯示
      }
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.ai-save-enable-btn').exists()).toBe(true)
      expect(wrapper.find('.ai-enable-btn').exists()).toBe(false) // 不是「啟用技能」，那顆只給已存檔的 100% 用

      // 已存檔的技能不會顯示這顆「儲存並啟用」（已存檔有自己的「啟用技能」按鈕邏輯）
      const id = store.createPersonalSkill({ name: '已存檔技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
      await store.generateAITestScenarios(id)
      const savedWrapper = mount(SkillTestAI, { props: { skillId: id } })
      for (const sc of [...store.aiTestScenarios]) {
        store.answerAITestScenario(id, sc.id, !sc.expectedTrigger)
      }
      await savedWrapper.vm.$nextTick()
      expect(savedWrapper.find('.ai-save-enable-btn').exists()).toBe(false)
    })

    it('canSave=false 時按鈕反灰', async () => {
      const store = useSkillStore()
      const wrapper = mount(SkillTestAI, { props: { skillId: 'draft-xyz', canSave: false } })
      await store.generateAITestScenarios('draft-xyz')
      for (const sc of [...store.aiTestScenarios]) {
        store.answerAITestScenario('draft-xyz', sc.id, sc.expectedTrigger)
      }
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.ai-save-enable-btn').attributes('disabled')).toBeDefined()
    })

    it('點擊：呼叫 requestSaveDraft 同步拿到新技能 id，直接走 SkillEnableFlow（100% 全對時直接進 Agent 確認）', async () => {
      const store = useSkillStore()
      await store.generateAITestScenarios('draft-xyz', { name: '草稿技能', triggerHint: 'y', capabilities: [] })
      for (const sc of [...store.aiTestScenarios]) {
        store.answerAITestScenario('draft-xyz', sc.id, sc.expectedTrigger) // 全對
      }

      // requestSaveDraft 模擬呼叫端的 conv.save()：同步建立真正的技能、轉記測試結果、
      // 回傳新 id，不用靠 emit 再等 prop 非同步反應更新
      const requestSaveDraft = () => {
        const realId = store.createPersonalSkill({ name: '草稿技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
        store.migrateAITestState('draft-xyz', realId)
        return realId
      }
      const wrapper = mount(SkillTestAI, { props: { skillId: 'draft-xyz', canSave: true, requestSaveDraft } })
      await wrapper.vm.$nextTick()

      const saveEnableBtn = wrapper.find('.ai-save-enable-btn')
      expect(saveEnableBtn.exists()).toBe(true)
      expect(saveEnableBtn.attributes('disabled')).toBeUndefined()
      await saveEnableBtn.trigger('click')
      await wrapper.vm.$nextTick()

      const agentDialog = new DOMWrapper(document.body).find('.enable-agent-dialog')
      expect(agentDialog.exists()).toBe(true) // 100% 全對，aiTestPassRate 已經是 1，直接進 Agent 確認
      await agentDialog.findAll('.se-agent-chip').find(c => c.text().includes('通用助理'))!.trigger('click')
      await agentDialog.findAll('button').find(b => b.text().includes('確認並啟用'))!.trigger('click')

      const realId = store.aiTestScenariosSkillId!
      expect(store.findSkill(realId)!.isEnabled).toBe(true)
      expect(store.findSkill(realId)!.assignedAgents).toEqual(['通用助理'])
    })

    it('canSave=false：按鈕反灰，點擊不會觸發任何東西（原生 disabled 行為）', async () => {
      const store = useSkillStore()
      await store.generateAITestScenarios('draft-xyz', { name: '草稿技能', triggerHint: 'y', capabilities: [] })
      for (const sc of [...store.aiTestScenarios]) {
        store.answerAITestScenario('draft-xyz', sc.id, sc.expectedTrigger)
      }
      const requestSaveDraft = vi.fn(() => 'should-not-be-called')
      const wrapper = mount(SkillTestAI, { props: { skillId: 'draft-xyz', canSave: false, requestSaveDraft } })
      await wrapper.vm.$nextTick()

      await wrapper.find('.ai-save-enable-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(requestSaveDraft).not.toHaveBeenCalled()
    })

    it('canSave=true 但 requestSaveDraft 本身回傳 null（例如呼叫端另有判斷拒絕存檔）：不會打開任何對話框，不噴錯', async () => {
      const store = useSkillStore()
      await store.generateAITestScenarios('draft-xyz', { name: '草稿技能', triggerHint: 'y', capabilities: [] })
      for (const sc of [...store.aiTestScenarios]) {
        store.answerAITestScenario('draft-xyz', sc.id, sc.expectedTrigger)
      }
      const requestSaveDraft = vi.fn(() => null)
      const wrapper = mount(SkillTestAI, { props: { skillId: 'draft-xyz', canSave: true, requestSaveDraft } })
      await wrapper.vm.$nextTick()

      await wrapper.find('.ai-save-enable-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(requestSaveDraft).toHaveBeenCalledTimes(1)
      expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
      expect(new DOMWrapper(document.body).find('.enable-agent-dialog').exists()).toBe(false)
    })

    it('沒全對：存檔後照樣測過，不擋，直接走 Agent 確認', async () => {
      const store = useSkillStore()
      await store.generateAITestScenarios('draft-xyz', { name: '草稿技能2', triggerHint: 'y', capabilities: [] })
      const scenarios = [...store.aiTestScenarios]
      expect(scenarios.length).toBeGreaterThan(1)
      for (let i = 0; i < scenarios.length - 1; i++) {
        store.answerAITestScenario('draft-xyz', scenarios[i].id, !scenarios[i].expectedTrigger)
      }
      store.answerAITestScenario('draft-xyz', scenarios.at(-1)!.id, scenarios.at(-1)!.expectedTrigger)
      expect(store.aiTestReport!.correct).not.toBe(store.aiTestReport!.total)

      // 存檔時 migrateAITestState 把這輪結果記到新技能上：測過就能啟用，不看對錯
      const requestSaveDraft = () => {
        const realId = store.createPersonalSkill({ name: '草稿技能2', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
        store.migrateAITestState('draft-xyz', realId)
        return realId
      }
      const wrapper = mount(SkillTestAI, { props: { skillId: 'draft-xyz', canSave: true, requestSaveDraft } })
      await wrapper.vm.$nextTick()

      await wrapper.find('.ai-save-enable-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
      const agentDialog = new DOMWrapper(document.body).find('.enable-agent-dialog')
      expect(agentDialog.exists()).toBe(true)
      await agentDialog.findAll('.se-agent-chip').find(c => c.text().includes('通用助理'))!.trigger('click')
      await agentDialog.findAll('button').find(b => b.text().includes('確認並啟用'))!.trigger('click')

      const realId = store.aiTestScenariosSkillId!
      expect(store.findSkill(realId)!.isEnabled).toBe(true)
    })
  })
})
