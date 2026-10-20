import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSkillStore } from '@/stores/skillStore'

describe('skillStore — AI test state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('setSelectedSkill resets AI test state', () => {
    const store = useSkillStore()
    // Seed some state
    store.aiTestScenarios.push({
      id: 'x', tag: 'normal', input: 'test', expectedBehavior: 'ok', expectedTrigger: true,
      status: 'correct', userAnswer: true,
    })
    store.aiTestReport = {
      total: 1, correct: 1,
      byTag: { normal: { total: 1, correct: 1 }, boundary: { total: 0, correct: 0 }, trigger_edge: { total: 0, correct: 0 } },
      summary: 'all good',
    }

    store.setSelectedSkill('sys-cs-001')

    expect(store.aiTestScenarios).toHaveLength(0)
    expect(store.aiTestReport).toBeNull()
    expect(store.aiTestIsGenerating).toBe(false)
  })
})

describe('generateAITestScenarios', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('sets scenarios with correct structure for known skillId，含明確的正確答案 expectedTrigger', async () => {
    const store = useSkillStore()
    await store.generateAITestScenarios('sys-cs-001')

    expect(store.aiTestScenarios.length).toBeGreaterThanOrEqual(6)
    expect(store.aiTestIsGenerating).toBe(false)
    expect(store.aiTestReport).toBeNull()

    const first = store.aiTestScenarios[0]
    expect(first).toHaveProperty('id')
    expect(first).toHaveProperty('tag')
    expect(first).toHaveProperty('input')
    expect(first).toHaveProperty('expectedBehavior')
    expect(typeof first.expectedTrigger).toBe('boolean')
    expect(first.status).toBe('pending')
    expect(first.userAnswer).toBeUndefined()
  })

  it('每組模擬情境都混有「應該觸發」與「不應該觸發」兩種正確答案，選擇題才有意義', async () => {
    const store = useSkillStore()
    for (const skillId of ['sys-cs-001', 'ext-cs-return-001', 'sys-doc-001', 'sys-meeting-001', 'ext-erp-001']) {
      await store.generateAITestScenarios(skillId)
      const triggers = store.aiTestScenarios.map(s => s.expectedTrigger)
      expect(triggers).toContain(true)
      expect(triggers).toContain(false)
    }
  })

  it('未收錄進模板表的 skillId（含完全不存在的 id）：只產生「觸發邊緣」題目，不再有固定寫死、跟內容無關的「正常流程」「邊界情況」', async () => {
    const store = useSkillStore()
    await store.generateAITestScenarios('unknown-skill-xyz')
    expect(store.aiTestScenarios.length).toBeGreaterThan(0)
    expect(store.aiTestScenarios[0].status).toBe('pending')
    expect(store.aiTestScenarios.every(s => s.tag === 'trigger_edge')).toBe(true)
    // 沒有任何內容可用時，至少要有一個會觸發、一個不會觸發，選擇題才有鑑別度
    const triggers = store.aiTestScenarios.map(s => s.expectedTrigger)
    expect(triggers).toContain(true)
    expect(triggers).toContain(false)
  })

  it('個人技能有覆蓋能力標籤：觸發邊緣題目用這些標籤組成關鍵字輸入，而不是通用句子', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({
      name: '行銷週報快篩',
      instructions: 'x',
      triggerHint: '當使用者要求產出行銷報告時',
      assignedAgents: [],
      capabilities: ['會員人物誌', '活動排行'],
    })
    await store.generateAITestScenarios(id)
    expect(store.aiTestScenarios.every(s => s.tag === 'trigger_edge')).toBe(true)
    expect(store.aiTestScenarios.some(s => s.input.includes('會員人物誌'))).toBe(true)
  })

  it('個人技能沒有覆蓋能力標籤：退回用觸發情境裡的關鍵字；兩者都沒有則退回技能名稱', async () => {
    const store = useSkillStore()
    const withHint = store.createPersonalSkill({
      name: '查詢技能', instructions: 'x', triggerHint: '當使用者詢問庫存數量、倉庫存量、缺貨狀態等相關問題時使用', assignedAgents: [],
    })
    await store.generateAITestScenarios(withHint)
    expect(store.aiTestScenarios.some(s => s.input.includes('庫存'))).toBe(true)

    const bare = store.createPersonalSkill({ name: '裸技能', instructions: 'x', triggerHint: '', assignedAgents: [] })
    await store.generateAITestScenarios(bare)
    expect(store.aiTestScenarios.some(s => s.input === '裸技能')).toBe(true)
  })

  it('積木組裝的技能（有 composition）：觸發情境優先於覆蓋能力，就算覆蓋能力有填也不用', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({
      name: '行銷週報',
      instructions: 'x',
      triggerHint: '當使用者詢問庫存查詢相關問題時',
      assignedAgents: [],
      capabilities: ['會員人物誌', '活動排行'],
      composition: { sectionIds: ['promo_kpi'] },
    })
    await store.generateAITestScenarios(id)
    expect(store.aiTestScenarios.some(s => s.input.includes('庫存查詢'))).toBe(true)
    expect(store.aiTestScenarios.some(s => s.input.includes('會員人物誌'))).toBe(false)
  })

  it('積木組裝的技能：觸發情境抓不到字（太短／空白）才退回覆蓋能力', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({
      name: '行銷週報',
      instructions: 'x',
      triggerHint: '',
      assignedAgents: [],
      capabilities: ['會員人物誌'],
      composition: { sectionIds: ['promo_kpi'] },
    })
    await store.generateAITestScenarios(id)
    expect(store.aiTestScenarios.some(s => s.input.includes('會員人物誌'))).toBe(true)
  })

  it('對話建立的技能（沒有 composition）：維持原本覆蓋能力優先，不受這次調整影響', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({
      name: '行銷週報',
      instructions: 'x',
      triggerHint: '當使用者詢問庫存查詢相關問題時',
      assignedAgents: [],
      capabilities: ['會員人物誌'],
    })
    await store.generateAITestScenarios(id)
    // 只檢查正例（這顆技能自己的關鍵字來源）：反例現在可能因為「沒指派 Agent 時
    // 借用團隊內最相似技能的 Agent」這個新功能，合理地帶進剛好也含「庫存查詢」
    // 字樣的其他技能關鍵字，不代表觸發情境蓋過了覆蓋能力的優先順序
    const positives = store.aiTestScenarios.filter(s => s.expectedTrigger)
    expect(positives.some(s => s.input.includes('會員人物誌'))).toBe(true)
    expect(positives.some(s => s.input.includes('庫存查詢'))).toBe(false)
  })

  it('動態產生的觸發邊緣題目，不管關鍵字多寡都至少 5 題（反例題庫會補齊）', async () => {
    const store = useSkillStore()
    // 完全沒有任何可用內容：只能退回技能名稱當唯一的正例關鍵字
    const bare = store.createPersonalSkill({ name: '裸技能', instructions: 'x', triggerHint: '', assignedAgents: [] })
    await store.generateAITestScenarios(bare)
    expect(store.aiTestScenarios.length).toBeGreaterThanOrEqual(5)
    // 只有一個關鍵字時不該出現「關鍵字重複兩次」的疊字題目
    expect(store.aiTestScenarios.some(s => s.input === '裸技能 裸技能')).toBe(false)

    // 覆蓋能力標籤很多：正例題目變多，但不會爆量也一樣有反例
    const rich = store.createPersonalSkill({
      name: '多能力技能', instructions: 'x', triggerHint: 'y', assignedAgents: [],
      capabilities: ['能力A', '能力B', '能力C', '能力D', '能力E'],
    })
    await store.generateAITestScenarios(rich)
    expect(store.aiTestScenarios.length).toBeGreaterThanOrEqual(5)
    expect(store.aiTestScenarios.some(s => s.expectedTrigger === false)).toBe(true)
  })

  it('搶觸發偵測：共用 Agent 又文字相似的技能，其關鍵字會被當成「觸發邊緣」反例，並在 expectedBehavior 指名是哪顆技能', async () => {
    const store = useSkillStore()
    const aId = store.createPersonalSkill({
      name: '庫存查詢助手A', instructions: '查詢庫存數量與倉庫存量', triggerHint: '當使用者詢問庫存數量、倉庫存量時',
      assignedAgents: ['客服中心助理'], capabilities: ['庫存查詢'],
    })
    const bId = store.createPersonalSkill({
      name: '庫存查詢助手B', instructions: '查詢庫存數量與倉庫存量', triggerHint: '當使用者詢問庫存數量、倉庫存量時',
      assignedAgents: ['客服中心助理'], capabilities: ['庫存盤點'],
    })
    await store.generateAITestScenarios(bId)
    const negative = store.aiTestScenarios.find(s => s.input === '庫存查詢')
    expect(negative).toBeDefined()
    expect(negative!.expectedTrigger).toBe(false)
    expect(negative!.expectedBehavior).toContain('庫存查詢助手A')
    expect(negative!.expectedBehavior).toContain('庫存查詢助手B')
    expect(store.findSkill(aId)).toBeDefined() // 只是確認上面建立成功，避免 aId 被當成未用變數
  })

  it('搶觸發偵測：沒有指派 Agent、團隊內也找不到內容相近的技能可借用時，反例全部退回無關關鍵字池', async () => {
    const store = useSkillStore()
    store.createPersonalSkill({
      name: '沒指派助手A', instructions: 'x', triggerHint: '當使用者詢問測試時', assignedAgents: [], capabilities: ['測試能力'],
    })
    const bId = store.createPersonalSkill({
      name: '沒指派助手B', instructions: 'x', triggerHint: '當使用者詢問測試時', assignedAgents: [], capabilities: ['測試能力'],
    })
    await store.generateAITestScenarios(bId)
    // 沒指派助手A 自己也沒有 Agent，不符合「借用」的候選資格（候選一定要本身有指派
    // Agent 才借得到線索），所以不該出現在反例裡
    expect(store.aiTestScenarios.some(s => s.expectedBehavior.includes('沒指派助手A'))).toBe(false)
  })

  it('搶觸發偵測：沒有指派 Agent 時改用純內容相似度在團隊內找最像的技能，索引回它指派的 Agent 借來測試', async () => {
    const store = useSkillStore()
    const aId = store.createPersonalSkill({
      name: '庫存盤點助手A', instructions: '盤點庫存數量與調撥記錄', triggerHint: '當使用者詢問庫存盤點或調撥時',
      assignedAgents: ['倉儲管理助理'], capabilities: ['庫存盤點'],
    })
    const bId = store.createPersonalSkill({
      name: '庫存盤點助手B', instructions: '盤點庫存數量與調撥記錄', triggerHint: '當使用者詢問庫存盤點或調撥時',
      assignedAgents: [], capabilities: ['庫存覆核'],
    })
    await store.generateAITestScenarios(bId)

    // 敘事文字要講出「推測相似」「借用的 Agent 是誰」，不是憑空冒出來的
    const narration = store.aiTestGenerationNarration.join(' ')
    expect(narration).toContain('庫存盤點助手A')
    expect(narration).toContain('倉儲管理助理')
    expect(narration).toContain('庫存盤點助手B')

    // 借來的 Agent 要真的拿去找競爭技能：庫存盤點助手A 自己就是借用來源，
    // 理所當然也會被抓進來當反例關鍵字
    const negatives = store.aiTestScenarios.filter(s => !s.expectedTrigger)
    expect(negatives.some(s => s.input.includes('庫存盤點'))).toBe(true)
    expect(store.findSkill(aId)).toBeDefined() // 確認上面建立成功，避免 aId 被當成未用變數
  })

  it('搶觸發偵測：競爭技能的關鍵字剛好跟自己的正例一字不差時，直接丟掉這題，不會同一句輸入正反例矛盾', async () => {
    const store = useSkillStore()
    store.createPersonalSkill({
      name: '完全同標籤A', instructions: 'x', triggerHint: 'y', assignedAgents: ['工程助理'], capabilities: ['共用標籤'],
    })
    const bId = store.createPersonalSkill({
      name: '完全同標籤B', instructions: 'x', triggerHint: 'y', assignedAgents: ['工程助理'], capabilities: ['共用標籤'],
    })
    await store.generateAITestScenarios(bId)
    const matches = store.aiTestScenarios.filter(s => s.input === '共用標籤')
    expect(matches).toHaveLength(1)
    expect(matches[0].expectedTrigger).toBe(true)
  })

  it('生成題目期間的敘事文字：有指派 Agent 時講出 Agent 跟找到的相似技能；沒指派時講另一套；每次生成都重算', async () => {
    const store = useSkillStore()
    const aId = store.createPersonalSkill({
      name: '敘事技能A', instructions: '查詢庫存', triggerHint: '當使用者詢問庫存時',
      assignedAgents: ['會議記錄助理'], capabilities: ['庫存查詢'],
    })
    const bId = store.createPersonalSkill({
      name: '敘事技能B', instructions: '查詢庫存', triggerHint: '當使用者詢問庫存時',
      assignedAgents: ['會議記錄助理'], capabilities: ['庫存查詢'],
    })
    await store.generateAITestScenarios(bId)
    expect(store.aiTestGenerationNarration.some(l => l.includes('會議記錄助理'))).toBe(true)
    expect(store.aiTestGenerationNarration.some(l => l.includes('敘事技能A'))).toBe(true)

    const noAgentId = store.createPersonalSkill({ name: '敘事技能C', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    await store.generateAITestScenarios(noAgentId)
    expect(store.aiTestGenerationNarration.some(l => l.includes('還沒有指派 Agent'))).toBe(true)
    expect(store.aiTestGenerationNarration.some(l => l.includes('敘事技能A'))).toBe(false)
    expect(store.findSkill(aId)).toBeDefined()
  })

  it('離開測試步驟（resetAITestState）或切換技能（ensureAITestStateForSkill）時，敘事文字一併清空', async () => {
    const store = useSkillStore()
    await store.generateAITestScenarios('sys-cs-001')
    expect(store.aiTestGenerationNarration.length).toBeGreaterThan(0)
    store.resetAITestState()
    expect(store.aiTestGenerationNarration).toEqual([])

    await store.generateAITestScenarios('sys-cs-001')
    expect(store.aiTestGenerationNarration.length).toBeGreaterThan(0)
    store.ensureAITestStateForSkill('ext-erp-001')
    expect(store.aiTestGenerationNarration).toEqual([])
  })

  it('resets previous scenarios and report when called again', async () => {
    const store = useSkillStore()
    await store.generateAITestScenarios('sys-cs-001')
    store.aiTestScenarios[0].status = 'correct'
    await store.generateAITestScenarios('sys-cs-001')
    expect(store.aiTestScenarios.every(s => s.status === 'pending')).toBe(true)
  })

  // 還沒存檔的草稿想先測試：store 裡還沒有這顆技能（或這個 id 根本不是真正的技能
  // id，只是草稿佔位 id），draftContext 補上目前草稿的 name／triggerHint／capabilities
  // 當作組題關鍵字的來源
  it('skillId 在 store 裡找不到技能、但有帶 draftContext：用 draftContext 的內容組題目關鍵字', async () => {
    const store = useSkillStore()
    await store.generateAITestScenarios('draft-abc', {
      name: '草稿技能',
      triggerHint: '當使用者詢問庫存時',
      capabilities: ['庫存查詢', '缺貨提醒'],
    })
    expect(store.aiTestScenarios.every(s => s.tag === 'trigger_edge')).toBe(true)
    expect(store.aiTestScenarios.some(s => s.input.includes('庫存查詢'))).toBe(true)
  })

  it('skillId 真的對應到技能：優先用 store 裡的技能內容，忽略 draftContext（例如技能已存檔但 draftContext 是舊的）', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({
      name: '已存檔技能', instructions: 'x', triggerHint: 'y', assignedAgents: [], capabilities: ['真正的能力'],
    })
    await store.generateAITestScenarios(id, { name: '不該被用到', triggerHint: '', capabilities: ['不該出現的標籤'] })
    expect(store.aiTestScenarios.some(s => s.input.includes('真正的能力'))).toBe(true)
    expect(store.aiTestScenarios.some(s => s.input.includes('不該出現的標籤'))).toBe(false)
  })

  it('每次產生題目都記下當下的 name／triggerHint／capabilities 快照', async () => {
    const store = useSkillStore()
    await store.generateAITestScenarios('draft-abc', { name: '草稿技能', triggerHint: 'y', capabilities: ['a'] })
    expect(store.aiTestScenariosSnapshot).toBe(JSON.stringify({ name: '草稿技能', triggerHint: 'y', capabilities: ['a'] }))
  })
})

describe('migrateAITestState', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('草稿佔位 id 換成真正的技能 id：aiTestScenariosSkillId 跟著改，不會被當成換了一顆技能而清掉', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '剛存檔的技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    await store.generateAITestScenarios('draft-abc', { name: '剛存檔的技能', triggerHint: 'y', capabilities: [] })
    store.migrateAITestState('draft-abc', id)
    expect(store.aiTestScenariosSkillId).toBe(id)
    expect(store.aiTestScenarios.length).toBeGreaterThan(0)
    // 原本因為 id 不對應不到技能而沒寫入的 ensureAITestStateForSkill，現在用新 id 檢查應該維持現狀
    store.ensureAITestStateForSkill(id)
    expect(store.aiTestScenariosSkillId).toBe(id)
  })

  it('已經有完整測試報告：把答對比例寫回剛存檔的技能，不用為了同樣內容重新作答一次', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '剛存檔的技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    await store.generateAITestScenarios('draft-abc', { name: '剛存檔的技能', triggerHint: 'y', capabilities: [] })
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario('draft-abc', sc.id, sc.expectedTrigger)
    }
    expect(store.aiTestReport!.correct).toBe(store.aiTestReport!.total)

    store.migrateAITestState('draft-abc', id)
    expect(store.findSkill(id)!.aiTestPassRate).toBe(1)
  })

  it('fromId 跟目前的 aiTestScenariosSkillId 不一致：什麼都不做（例如使用者沒測過就直接存檔）', () => {
    const store = useSkillStore()
    store.migrateAITestState('draft-never-tested', 'personal-some-id')
    expect(store.aiTestScenariosSkillId).toBeNull()
  })
})

describe('answerAITestScenario', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('答對：status 變 correct，記下 userAnswer', async () => {
    const store = useSkillStore()
    await store.generateAITestScenarios('sys-cs-001')
    const sc = store.aiTestScenarios[0]
    store.answerAITestScenario('sys-cs-001', sc.id, sc.expectedTrigger)

    const updated = store.aiTestScenarios.find(s => s.id === sc.id)!
    expect(updated.status).toBe('correct')
    expect(updated.userAnswer).toBe(sc.expectedTrigger)
  })

  it('答錯：status 變 incorrect', async () => {
    const store = useSkillStore()
    await store.generateAITestScenarios('sys-cs-001')
    const sc = store.aiTestScenarios[0]
    store.answerAITestScenario('sys-cs-001', sc.id, !sc.expectedTrigger)

    const updated = store.aiTestScenarios.find(s => s.id === sc.id)!
    expect(updated.status).toBe('incorrect')
    expect(updated.userAnswer).toBe(!sc.expectedTrigger)
  })

  it('已作答過的題目再次作答不生效（one-shot）', async () => {
    const store = useSkillStore()
    await store.generateAITestScenarios('sys-cs-001')
    const sc = store.aiTestScenarios[0]
    store.answerAITestScenario('sys-cs-001', sc.id, sc.expectedTrigger)
    store.answerAITestScenario('sys-cs-001', sc.id, !sc.expectedTrigger)
    expect(store.aiTestScenarios.find(s => s.id === sc.id)!.status).toBe('correct')
  })

  it('不存在的 scenarioId 不拋錯、無副作用', async () => {
    const store = useSkillStore()
    await store.generateAITestScenarios('sys-cs-001')
    expect(() => store.answerAITestScenario('sys-cs-001', 'nope', true)).not.toThrow()
    expect(store.aiTestReport).toBeNull()
  })

  it('全部答完才產生報告；答對題數與 byTag 統計正確', async () => {
    const store = useSkillStore()
    await store.generateAITestScenarios('ext-erp-001')
    const scenarios = [...store.aiTestScenarios]
    for (let i = 0; i < scenarios.length - 1; i++) {
      store.answerAITestScenario('ext-erp-001', scenarios[i].id, scenarios[i].expectedTrigger) // 全部答對
      expect(store.aiTestReport).toBeNull() // 還沒答完，不該有報告
    }
    const last = scenarios[scenarios.length - 1]
    store.answerAITestScenario('ext-erp-001', last.id, !last.expectedTrigger) // 故意答錯最後一題

    expect(store.aiTestReport).not.toBeNull()
    expect(store.aiTestReport!.total).toBe(scenarios.length)
    expect(store.aiTestReport!.correct).toBe(scenarios.length - 1)
    const byTagTotal = Object.values(store.aiTestReport!.byTag).reduce((sum, t) => sum + t.total, 0)
    const byTagCorrect = Object.values(store.aiTestReport!.byTag).reduce((sum, t) => sum + t.correct, 0)
    expect(byTagTotal).toBe(scenarios.length)
    expect(byTagCorrect).toBe(scenarios.length - 1)
  })

  it('答完一輪後，答對比例會寫回這顆技能的 aiTestPassRate（有值就是測過）', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '測試技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    await store.generateAITestScenarios(id)
    const scenarios = [...store.aiTestScenarios]
    for (const sc of scenarios) {
      store.answerAITestScenario(id, sc.id, sc.expectedTrigger) // 全部答對
    }
    const skill = store.findSkill(id)!
    expect(skill.aiTestPassRate).toBe(1)
  })

  it('重新生成測驗：該技能的 aiTestPassRate 重設為未測試狀態，isEnabled 不受影響', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '測試技能2', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    store.toggleSkill(id)
    await store.generateAITestScenarios(id)
    for (const sc of [...store.aiTestScenarios]) {
      store.answerAITestScenario(id, sc.id, sc.expectedTrigger)
    }
    expect(store.findSkill(id)!.aiTestPassRate).toBe(1)

    await store.generateAITestScenarios(id) // 重新生成

    const skill = store.findSkill(id)!
    expect(skill.aiTestPassRate).toBeNull()
    expect(skill.isEnabled).toBe(true) // 不會因為重新測驗就被打回停用
  })
})

describe('submitAITestAnswers：統一送答案，一次全部計分', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('一次送出全部答案：每一題照各自答案計分，只算一次報告', async () => {
    const store = useSkillStore()
    await store.generateAITestScenarios('ext-erp-001')
    const scenarios = [...store.aiTestScenarios]
    const answers: Record<string, boolean> = {}
    for (let i = 0; i < scenarios.length; i++) {
      // 故意把最後一題答錯，確認批次計分真的是照各題各自的答案、不是全部當同一個值處理
      answers[scenarios[i].id] = i === scenarios.length - 1 ? !scenarios[i].expectedTrigger : scenarios[i].expectedTrigger
    }
    store.submitAITestAnswers('ext-erp-001', answers)

    expect(store.aiTestScenarios.every(s => s.status !== 'pending')).toBe(true)
    expect(store.aiTestReport).not.toBeNull()
    expect(store.aiTestReport!.total).toBe(scenarios.length)
    expect(store.aiTestReport!.correct).toBe(scenarios.length - 1)
  })

  it('answers 沒涵蓋到的題目維持 pending，不產生報告（呼叫端要自己保證送出前已經全選）', async () => {
    const store = useSkillStore()
    await store.generateAITestScenarios('ext-erp-001')
    const scenarios = [...store.aiTestScenarios]
    const answers: Record<string, boolean> = { [scenarios[0].id]: scenarios[0].expectedTrigger }
    store.submitAITestAnswers('ext-erp-001', answers)

    expect(store.aiTestScenarios[0].status).not.toBe('pending')
    expect(store.aiTestScenarios.slice(1).every(s => s.status === 'pending')).toBe(true)
    expect(store.aiTestReport).toBeNull()
  })

  it('答對比例寫回技能的 aiTestPassRate，跟逐題作答的既有行為一致', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '批次送出技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
    await store.generateAITestScenarios(id)
    const scenarios = [...store.aiTestScenarios]
    const answers = Object.fromEntries(scenarios.map(sc => [sc.id, sc.expectedTrigger]))
    store.submitAITestAnswers(id, answers)

    expect(store.findSkill(id)!.aiTestPassRate).toBe(1)
  })
})
