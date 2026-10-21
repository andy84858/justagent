import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillTestAI from '@/components/Skill/SkillTestAI.vue'
import { useSkillStore } from '@/stores/skillStore'
import popDialog from '@/services/popDialog'

vi.mock('@/services/popDialog', () => ({ default: { toast: vi.fn(), confirm: vi.fn(), alert: vi.fn() } }))

describe('SkillTestAI：AI 出題、答題 Agent 作答、使用者標註正確答案', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // 答題 Agent 不讓使用者選，直接按「生成測試情境」，由 store 自動挑可調用的 Agent
  async function generate(w: ReturnType<typeof mount>) {
    await w.find('.ai-generate-btn').trigger('click')
    await new Promise(r => setTimeout(r, 950))
    await w.vm.$nextTick()
  }

  it('初始空狀態：不列 Agent 讓使用者選，「生成測試情境」可以直接按', () => {
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    expect(w.find('.ai-idle-hint').exists()).toBe(true)
    expect(w.find('.ai-agent-option').exists()).toBe(false)
    const btn = w.find('.ai-generate-btn')
    expect(btn.text()).toContain('生成測試情境')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('點「生成測試情境」：由可調用的 Agent 作答，每張情境卡只顯示題目與標註正確答案的兩個按鈕（Agent 的判斷送出後才揭曉）', async () => {
    const store = useSkillStore()
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    await generate(w)

    expect(store.aiTestAnsweringAgent).toBe('客服中心助理')
    expect(w.find('.ai-answering-agent').text()).toContain('客服中心助理')
    const cards = w.findAll('.scenario-card')
    expect(cards.length).toBeGreaterThanOrEqual(6)
    const first = cards[0]
    // 送出答案前不顯示 Agent 的判斷，避免使用者被它影響
    expect(first.find('.scenario-agent-answer').exists()).toBe(false)
    expect(first.text()).toContain('這句話正確來說，該不該觸發這顆技能？')
    const btns = first.findAll('.scenario-answer-btns button')
    expect(btns.map(b => b.text())).toEqual(['該觸發', '不該觸發'])
    expect(w.find('.ai-report').exists()).toBe(false)
  }, 10000)

  it('題目生成完成後跳 toast 提示（不推進對話河道）；重新生成也一樣', async () => {
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    await generate(w)
    expect(popDialog.toast).toHaveBeenCalledTimes(1)
    expect(vi.mocked(popDialog.toast).mock.calls[0][0]).toContain('生成完成')

    await w.find('.ai-regenerate-btn').trigger('click')
    await new Promise(r => setTimeout(r, 950))
    await w.vm.$nextTick()
    expect(popDialog.toast).toHaveBeenCalledTimes(2)
  }, 10000)

  it('選答案：按鈕變選中樣式，但還不計分（不會立刻顯示答對／答錯）', async () => {
    const store = useSkillStore()
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    await store.generateAITestScenarios('sys-cs-001')
    await w.vm.$nextTick()

    const sc = store.aiTestScenarios[0]
    const card = w.findAll('.scenario-card')[0]
    const correctBtnIndex = sc.agentAnswer ? 0 : 1
    const btns = card.findAll('.scenario-answer-btns button')
    await btns[correctBtnIndex].trigger('click')
    await w.vm.$nextTick()

    expect(btns[correctBtnIndex].classes()).toContain('is-selected')
    expect(btns[correctBtnIndex === 0 ? 1 : 0].classes()).not.toContain('is-selected')
    expect(card.find('.scenario-answer-btns').exists()).toBe(true) // 還沒送出，按鈕沒消失
    expect(card.text()).not.toContain('答對了')
    expect(store.aiTestScenarios[0].status).toBe('pending')
  }, 10000)

  it('還沒全部選完：「送出答案」反灰，點了也不會計分', async () => {
    const store = useSkillStore()
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    await store.generateAITestScenarios('sys-cs-001')
    await w.vm.$nextTick()

    const sc = store.aiTestScenarios[0]
    const card = w.findAll('.scenario-card')[0]
    const correctBtnIndex = sc.agentAnswer ? 0 : 1
    await card.findAll('.scenario-answer-btns button')[correctBtnIndex].trigger('click')
    await w.vm.$nextTick()

    const submitBtn = w.find('.ai-submit-btn')
    expect(submitBtn.attributes('disabled')).toBeDefined()
    await submitBtn.trigger('click')
    await w.vm.$nextTick()
    expect(store.aiTestReport).toBeNull()
  }, 10000)

  it('全部選完按「送出答案」：一次計分，答對的卡片顯示「答對了」、答案按鈕消失', async () => {
    const store = useSkillStore()
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    await store.generateAITestScenarios('sys-cs-001')
    await w.vm.$nextTick()

    const scenarios = [...store.aiTestScenarios]
    const cards = w.findAll('.scenario-card')
    for (let i = 0; i < scenarios.length; i++) {
      const correctBtnIndex = scenarios[i].agentAnswer ? 0 : 1
      await cards[i].findAll('.scenario-answer-btns button')[correctBtnIndex].trigger('click')
    }
    await w.vm.$nextTick()

    const submitBtn = w.find('.ai-submit-btn')
    expect(submitBtn.attributes('disabled')).toBeUndefined()
    await submitBtn.trigger('click')
    await w.vm.$nextTick()

    const sc = scenarios[0]
    const card = cards[0]
    expect(card.find('.scenario-answer-btns').exists()).toBe(false)
    expect(card.text()).toContain('答對了')
    expect(card.text()).toContain(sc.expectedTrigger ? '該觸發' : '不該觸發')
    // 答對時，使用者自己選的答案 pill 跟正確答案 pill 應該顯示同一個字樣，且用「對」的樣式
    const pills = card.findAll('.result-answer-pill')
    expect(pills[0].classes()).toContain('pill--pass')
    expect(pills[0].text()).toContain(sc.expectedTrigger ? '該觸發' : '不該觸發')
    expect(store.aiTestReport).not.toBeNull()
  }, 10000)

  it('全部選完送出，其中一題答錯：卡片顯示「答錯了」、使用者自己選的答案，與正確答案說明', async () => {
    const store = useSkillStore()
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    await store.generateAITestScenarios('sys-cs-001')
    await w.vm.$nextTick()

    const scenarios = [...store.aiTestScenarios]
    const cards = w.findAll('.scenario-card')
    for (let i = 0; i < scenarios.length; i++) {
      // 第一題故意選跟正確答案相反的，其餘都選對，確保送出按鈕會啟用且第一題一定答錯
      const btnIndex = i === 0
        ? (scenarios[i].agentAnswer ? 1 : 0)
        : (scenarios[i].agentAnswer ? 0 : 1)
      await cards[i].findAll('.scenario-answer-btns button')[btnIndex].trigger('click')
    }
    await w.vm.$nextTick()
    await w.find('.ai-submit-btn').trigger('click')
    await w.vm.$nextTick()

    const sc = scenarios[0]
    const card = cards[0]
    expect(card.text()).toContain('答錯了')
    // 送出後才揭曉 Agent 的判斷與理由
    expect(card.find('.scenario-agent-answer').text()).toContain(sc.agentAnswer ? '觸發' : '不觸發')
    expect(card.find('.scenario-agent-reasoning').text()).toBe(sc.agentReasoning)
    // Agent 的判斷跟使用者標註的正確答案各自是獨立的 UI 樣式（pill）——
    // 標註跟 Agent 判斷相反，所以這裡斷言兩顆 pill 的文字剛好相反
    const pills = card.findAll('.result-answer-pill')
    expect(pills[0].text()).toContain('Agent 判斷')
    expect(pills[0].text()).toContain(sc.agentAnswer ? '該觸發' : '不該觸發')
    expect(pills[0].classes()).toContain('pill--fail')
    expect(pills[1].text()).toContain('正確答案')
    expect(pills[1].text()).toContain(sc.agentAnswer ? '不該觸發' : '該觸發')
    expect(pills[1].classes()).toContain('pill--neutral')
  }, 10000)

  it('全部答完後顯示測試報告：答對題數、分類統計、總結文字', async () => {
    const store = useSkillStore()
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    await store.generateAITestScenarios('sys-cs-001')
    await w.vm.$nextTick()

    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario('sys-cs-001', sc.id, sc.agentAnswer)
    }
    await w.vm.$nextTick()

    const report = w.find('.ai-report')
    expect(report.exists()).toBe(true)
    expect(report.text()).toContain(`Agent 答對 ${store.aiTestScenarios.length} / ${store.aiTestScenarios.length}`)
    expect(report.text()).toContain('100%')
    expect(w.find('.report-summary').text()).toBeTruthy()
    // 分類統計只留「觸發邊緣」，不列「正常流程」「邊界情況」
    const tagRows = w.findAll('.report-tag-row').map(r => r.text())
    expect(tagRows).toHaveLength(1)
    expect(tagRows[0]).toContain('觸發邊緣')
  }, 10000)

  it('「重新生成」會清空已作答的情境重新出題', async () => {
    const store = useSkillStore()
    const w = mount(SkillTestAI, { props: { skillId: 'sys-cs-001' } })
    await store.generateAITestScenarios('sys-cs-001')
    store.answerAITestScenario('sys-cs-001', store.aiTestScenarios[0].id, store.aiTestScenarios[0].agentAnswer)
    await w.vm.$nextTick()
    expect(w.findAll('.status-badge').length).toBeGreaterThan(0)

    await w.find('.ai-regenerate-btn').trigger('click')
    await new Promise(r => setTimeout(r, 950))
    await w.vm.$nextTick()

    expect(store.aiTestScenarios.every(s => s.status === 'pending')).toBe(true)
    expect(w.find('.status-badge').exists()).toBe(false)
  }, 10000)

  it('不管 Agent 全對或沒全對，交卷後「下一步」都有可以按的「啟用技能」；還沒交卷時沒有', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能', instructions: 'x', description: 'y', assignedAgents: ['工程助理'] })
    const wrapper = mount(SkillTestAI, { props: { skillId: id } })

    expect(wrapper.find('.ai-enable-btn').exists()).toBe(false) // 還沒生成測試情境

    await store.generateAITestScenarios(id)
    await wrapper.vm.$nextTick()
    const scenarios = [...store.aiTestScenarios]
    expect(scenarios.length).toBeGreaterThan(1)

    for (let i = 0; i < scenarios.length - 1; i++) {
      store.answerAITestScenario(id, scenarios[i].id, !scenarios[i].agentAnswer)
    }
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.ai-enable-btn').exists()).toBe(false) // 還有題目 pending，aiTestReport 仍是 null

    store.answerAITestScenario(id, scenarios.at(-1)!.id, scenarios.at(-1)!.agentAnswer)
    await wrapper.vm.$nextTick()
    expect(store.aiTestReport!.correct).not.toBe(store.aiTestReport!.total) // 確認這次真的不是 100%
    const btn = wrapper.find('.report-next .ai-enable-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('100% 全對：顯示啟用按鈕，點擊走 SkillEnableFlow 並在確認後呼叫 setAssignedAgents + toggleSkill', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '待測技能2', instructions: 'x', description: 'y', assignedAgents: [] })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario(id, sc.id, sc.agentAnswer) // 全部答對
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
    const id = store.createPersonalSkill({ name: '待測技能3', instructions: 'x', description: 'y', assignedAgents: [] })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario(id, sc.id, sc.agentAnswer)
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

  it('已經啟用的技能：「啟用技能」反灰（避免誤按變成停用），引導文字說不用再啟用', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '已啟用技能', instructions: 'x', description: 'y', assignedAgents: [] })
    store.toggleSkill(id) // 模擬「已經是上線中的技能」
    expect(store.findSkill(id)!.isEnabled).toBe(true)

    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario(id, sc.id, sc.agentAnswer) // 全部答對
    }
    expect(store.aiTestReport!.correct).toBe(store.aiTestReport!.total)

    const wrapper = mount(SkillTestAI, { props: { skillId: id } })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.ai-enable-btn').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.report-next').text()).toContain('不用再啟用')
  })

  it('跨技能的舊報告不會外洩：技能 A 測完 100% 後，掛載技能 B 的元件不應該顯示啟用按鈕', async () => {
    const store = useSkillStore()
    const idA = store.createPersonalSkill({ name: '技能A', instructions: 'x', description: 'y', assignedAgents: [] })
    const idB = store.createPersonalSkill({ name: '技能B', instructions: 'x', description: 'y', assignedAgents: [] })

    await store.generateAITestScenarios(idA)
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario(idA, sc.id, sc.agentAnswer) // A 全部答對
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

  // 儲存歸儲存、啟用歸啟用：還沒存檔的草稿測完不能直接啟用，要先按「儲存」；
  // 存檔後 skillId 換成真正的技能 id（migrateAITestState 把這輪結果帶過去），「啟用技能」就能按
  it('還沒存檔的草稿：「啟用技能」反灰、引導先儲存；存檔後可以按，沒全對也直接走 Agent 確認', async () => {
    const store = useSkillStore()
    await store.generateAITestScenarios('draft-xyz', { name: '草稿技能2', description: 'y', capabilities: [] })
    const scenarios = [...store.aiTestScenarios]
    for (const sc of scenarios) store.answerAITestScenario('draft-xyz', sc.id, !sc.agentAnswer)
    expect(store.aiTestReport!.correct).not.toBe(store.aiTestReport!.total)

    const wrapper = mount(SkillTestAI, { props: { skillId: 'draft-xyz' } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.ai-enable-btn').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.report-next').text()).toContain('先按「儲存」')
    expect(wrapper.text()).not.toContain('儲存並啟用')

    const realId = store.createPersonalSkill({ name: '草稿技能2', instructions: 'x', description: 'y', assignedAgents: ['工程助理'] })
    store.migrateAITestState('draft-xyz', realId)
    await wrapper.setProps({ skillId: realId })
    expect(wrapper.find('.ai-enable-btn').attributes('disabled')).toBeUndefined()

    await wrapper.find('.ai-enable-btn').trigger('click')
    await wrapper.vm.$nextTick()
    expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
    const agentDialog = new DOMWrapper(document.body).find('.enable-agent-dialog')
    expect(agentDialog.exists()).toBe(true)
    await agentDialog.findAll('button').find(b => b.text().includes('確認並啟用'))!.trigger('click')
    expect(store.findSkill(realId)!.isEnabled).toBe(true)
  })
})

describe('SkillTestAI：交卷後在測試報告裡引導下一步（不推進對話河道）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('全對、已存檔還沒啟用：引導按「啟用技能」', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '引導技能A', instructions: 'x', description: 'y', assignedAgents: ['工程助理'] })
    const w = mount(SkillTestAI, { props: { skillId: id } })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) store.answerAITestScenario(id, sc.id, sc.agentAnswer)
    await w.vm.$nextTick()
    const next = w.find('.report-next')
    expect(next.classes()).toContain('is-pass')
    expect(next.text()).toContain('啟用技能')
    expect(w.find('.report-next-retest').exists()).toBe(false)
  }, 10000)

  it('全對、已經是啟用中：說不用再啟用，「啟用技能」反灰', async () => {
    const store = useSkillStore()
    const w = mount(SkillTestAI, { props: { skillId: 'personal-001' } })
    await store.generateAITestScenarios('personal-001')
    for (const sc of [...store.aiTestScenarios]) store.answerAITestScenario('personal-001', sc.id, sc.agentAnswer)
    await w.vm.$nextTick()
    expect(w.find('.report-next').text()).toContain('不用再啟用')
    expect(w.find('.report-next .ai-enable-btn').attributes('disabled')).toBeDefined()
  }, 10000)

  it('沒全對：列出怎麼改（用呼叫端給的 editHint）、怎麼重測；「重新測試」直接重新出題', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '引導技能B', instructions: 'x', description: 'y', assignedAgents: ['工程助理'] })
    const w = mount(SkillTestAI, { props: { skillId: id, editHint: '到對話裡告訴 Agent 哪裡要調整' } })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) store.answerAITestScenario(id, sc.id, !sc.agentAnswer)
    await w.vm.$nextTick()
    const next = w.find('.report-next')
    expect(next.classes()).toContain('is-fail')
    expect(next.text()).toContain(`判斷錯了 ${store.aiTestScenarios.length} 題`)
    expect(next.text()).toContain('到對話裡告訴 Agent 哪裡要調整')
    expect(next.text()).toContain('重新測試')

    await w.find('.report-next-retest').trigger('click')
    await new Promise(r => setTimeout(r, 950))
    await w.vm.$nextTick()
    expect(store.aiTestScenarios.every(s => s.status === 'pending')).toBe(true)
    expect(w.find('.ai-report').exists()).toBe(false)
  }, 10000)

  it('沒全對也有啟用那一行：已存檔就指向「啟用技能」；草稿還沒存檔則先引導「儲存」', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '引導技能C', instructions: 'x', description: 'y', assignedAgents: ['工程助理'] })
    const w = mount(SkillTestAI, { props: { skillId: id } })
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) store.answerAITestScenario(id, sc.id, !sc.agentAnswer)
    await w.vm.$nextTick()
    expect(w.find('.report-next').text()).toContain('測過就能啟用、不用全對')
    expect(w.find('.report-next .ai-enable-btn').attributes('disabled')).toBeUndefined()

    const d = mount(SkillTestAI, { props: { skillId: 'draft-guide', draftContext: { name: '草稿', description: 'y', capabilities: [], assignedAgents: ['工程助理'] } } })
    await store.generateAITestScenarios('draft-guide', { name: '草稿', description: 'y', capabilities: [], assignedAgents: ['工程助理'] })
    for (const sc of [...store.aiTestScenarios]) store.answerAITestScenario('draft-guide', sc.id, !sc.agentAnswer)
    await d.vm.$nextTick()
    expect(d.find('.report-next').text()).toContain('先按「儲存」')
    expect(d.find('.report-next .ai-enable-btn').attributes('disabled')).toBeDefined()
  }, 10000)
})
