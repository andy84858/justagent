import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillStudioWorkspace from '@/components/Skill/SkillStudioWorkspace.vue'
import popDialog from '@/services/popDialog'
import { useSkillStore } from '@/stores/skillStore'
import { useAiviewerStore } from '@/stores/AiViewerStore'
import { setSkillHandoff, consumeSkillHandoff } from '@/composables/useSkillHandoff'

vi.mock('@/services/popDialog', () => ({
  default: { toast: vi.fn(), confirm: vi.fn(), alert: vi.fn() },
}))

async function chooseChat(wrapper: any) {
  await wrapper.findAll('.smc-card')[0].trigger('click')
  await flushPromises()
}

let currentWrapper: VueWrapper | null = null

function mountWorkspace(initialQuery: Record<string, string> = {}) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/view/AiViewer', name: 'AiViewer', component: { template: '<div/>' } },
    ],
  })
  const wrapper = mount(SkillStudioWorkspace, {
    props: { initialQuery },
    global: { plugins: [router] },
  })
  currentWrapper = wrapper
  return { wrapper, router }
}

describe('SkillStudioWorkspace', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // SkillEnableFlow 的對話框透過 <Teleport to="body"> 掛在 document.body 上，
  // 不會隨 wrapper 卸載自動清掉，沒清的話下一個測試會撿到上一輪殘留的對話框
  // （同一個修法見 SkillStudioDrawer.test.ts／SkillEditor.enableGate.test.ts）
  afterEach(() => {
    currentWrapper?.unmount()
    currentWrapper = null
  })

  it('無 initialQuery：建立模式，左側 chip「建立新技能」，右側預覽空狀態', async () => {
    const { wrapper } = mountWorkspace()
    await flushPromises()
    expect(wrapper.find('.SkillMethodChooser').exists()).toBe(true)
    expect(wrapper.find('.studio-chat-col .ssc-mode-chip').exists()).toBe(false)
    await chooseChat(wrapper)
    expect(wrapper.find('.studio-chat-col .ssc-mode-chip').text()).toContain('建立新技能')
    expect(wrapper.text()).toContain('尚未命名的技能')
  })

  it('抽屜模式：不提供附加檔案功能', async () => {
    const { wrapper } = mountWorkspace()
    await flushPromises()
    await chooseChat(wrapper)
    expect(wrapper.text()).not.toContain('附加檔案')
  })

  it('method: chat：跳過 SkillMethodChooser，直接進對話模式', async () => {
    const { wrapper } = mountWorkspace({ method: 'chat' })
    await flushPromises()
    expect(wrapper.find('.SkillMethodChooser').exists()).toBe(false)
    expect(wrapper.find('.SkillStudioChat').exists()).toBe(true)
  })

  it('method: blocks：跳過 SkillMethodChooser，直接進積木流程（預設停在「基本設定」子步驟）', async () => {
    const { wrapper } = mountWorkspace({ method: 'blocks' })
    await flushPromises()
    expect(wrapper.find('.SkillMethodChooser').exists()).toBe(false)
    expect(wrapper.find('.SkillBlockBasicsForm').exists()).toBe(true)
    expect(wrapper.find('.SkillBlockComposer').exists()).toBe(false)
    await wrapper.findAll('.sbc-step-tab')[1].trigger('click')
    expect(wrapper.find('.SkillBlockComposer').exists()).toBe(true)
  })

  it('skillId 個人技能：修改模式，預覽帶入該技能內容', async () => {
    const { wrapper } = mountWorkspace({ skillId: 'personal-001' })
    await flushPromises()
    expect(wrapper.find('.ssc-mode-chip').text()).toContain('修改：週報自動生成')
    expect(wrapper.find('.ssp-title').text()).toBe('週報自動生成')
  })

  it('修改模式：按「放棄修改」，草稿已變更（dirty）時先確認，確認後草稿重設回已儲存版本並 emit discard', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { wrapper } = mountWorkspace({ skillId: 'personal-001' })
      await flushPromises()
      const input = wrapper.find('.SkillStudioChat input.custom-input')
      await input.setValue('名稱改成「亂改的名字」')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()
      expect(wrapper.find('.ssp-title').text()).toBe('亂改的名字')

      const discardBtn = wrapper.findAll('.studio-save-footer button').find(b => b.text().includes('放棄修改'))!
      await discardBtn.trigger('click')
      expect(popDialog.confirm).toHaveBeenCalledWith('有未儲存的變更，確定要放棄嗎？', '放棄變更', '留下', expect.any(Function))
      expect(wrapper.emitted('discard')).toBeUndefined()

      const onConfirm = vi.mocked(popDialog.confirm).mock.calls[0][3] as () => void
      onConfirm()
      await flushPromises()
      expect(wrapper.find('.ssp-title').text()).toBe('週報自動生成')
      expect(wrapper.emitted('discard')).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('儲存／放棄固定在左欄，切到「測試」tab 依然看得到、按得到，不會跟著 tab 消失', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { wrapper } = mountWorkspace({ skillId: 'personal-001' })
      await flushPromises()
      const input = wrapper.find('.SkillStudioChat input.custom-input')
      await input.setValue('名稱改成「亂改的名字」')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()

      // 切到測試 tab
      await wrapper.findAll('.ssp-tab-btn')[1].trigger('click')
      await flushPromises()
      expect(wrapper.find('.ssp-test-body').exists()).toBe(true)

      // SkillStudioPreview 本身不再重複渲染儲存／放棄（hideFooter）
      expect(wrapper.find('.ssp-footer').exists()).toBe(false)

      // 左欄的儲存／放棄仍然看得到、按得到
      const saveBtn = wrapper.find('.studio-save-btn')
      expect(saveBtn.exists()).toBe(true)
      expect(saveBtn.attributes('disabled')).toBeUndefined()
      const discardBtn = wrapper.findAll('.studio-save-footer button').find(b => b.text().includes('放棄修改'))!
      expect(discardBtn.exists()).toBe(true)

      await saveBtn.trigger('click')
      expect(popDialog.toast).toHaveBeenCalledWith('已儲存修改')
    } finally {
      vi.useRealTimers()
    }
  })

  describe('有測試紀錄時，儲存鍵升級成「儲存並啟用」', () => {
    it('沒有測試紀錄：維持「儲存修改」，點擊走原本單純存檔的邏輯', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      try {
        const { wrapper } = mountWorkspace({ skillId: 'personal-001' })
        await flushPromises()
        const input = wrapper.find('.SkillStudioChat input.custom-input')
        await input.setValue('名稱改成「亂改的名字」')
        await input.trigger('keydown.enter')
        await vi.advanceTimersByTimeAsync(800)
        await flushPromises()

        const saveBtn = wrapper.find('.studio-save-btn')
        expect(saveBtn.text()).toContain('儲存修改')
        expect(saveBtn.attributes('disabled')).toBeUndefined()
        await saveBtn.trigger('click')
        expect(popDialog.toast).toHaveBeenCalledWith('已儲存修改')
      } finally {
        vi.useRealTimers()
      }
    })

    it('personal-001（本來就啟用中）測到 100%：按鈕變「儲存並啟用」，點擊直接進 Agent 確認（不會先看到閘門失敗對話框），確認後不會把已啟用的技能切回停用', async () => {
      const store = useSkillStore()
      expect(store.findSkill('personal-001')!.isEnabled).toBe(true)
      const { wrapper } = mountWorkspace({ skillId: 'personal-001' })
      await flushPromises()
      await store.generateAITestScenarios('personal-001')
      for (const sc of [...store.aiTestScenarios]) {
        store.answerAITestScenario('personal-001', sc.id, sc.agentAnswer) // 全對
      }
      await flushPromises()

      const saveBtn = wrapper.find('.studio-save-btn')
      expect(saveBtn.text()).toContain('儲存並啟用')
      await saveBtn.trigger('click')
      await flushPromises()

      expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
      const agentDialog = new DOMWrapper(document.body).find('.enable-agent-dialog')
      expect(agentDialog.exists()).toBe(true)
      await agentDialog.findAll('.se-agent-chip').find(c => c.text().includes('通用助理'))!.trigger('click')
      await agentDialog.findAll('button').find(b => b.text().includes('確認並啟用'))!.trigger('click')

      expect(store.findSkill('personal-001')!.isEnabled).toBe(true) // 還是啟用中，沒被切回停用
      // 對話框預先勾好原本指派的 Agent，再多勾一個「通用助理」
      expect(store.findSkill('personal-001')!.assignedAgents).toEqual(['會議記錄助理', '業務分析助理', '通用助理'])
    })

    it('尚未啟用的技能測到非 100%：按鈕變「儲存並啟用」，測過就不擋，直接走 Agent 確認並真的啟用', async () => {
      const store = useSkillStore()
      const id = store.createPersonalSkill({ name: '待啟用技能', instructions: 'x', triggerHint: 'y', assignedAgents: [] })
      expect(store.findSkill(id)!.isEnabled).toBe(false)
      const { wrapper } = mountWorkspace({ skillId: id })
      await flushPromises()
      await store.generateAITestScenarios(id)
      const scenarios = [...store.aiTestScenarios]
      expect(scenarios.length).toBeGreaterThan(1)
      for (let i = 0; i < scenarios.length - 1; i++) {
        store.answerAITestScenario(id, scenarios[i].id, !scenarios[i].agentAnswer)
      }
      store.answerAITestScenario(id, scenarios.at(-1)!.id, scenarios.at(-1)!.agentAnswer)
      expect(store.aiTestReport!.correct).not.toBe(store.aiTestReport!.total)
      await flushPromises()

      const saveBtn = wrapper.find('.studio-save-btn')
      expect(saveBtn.text()).toContain('儲存並啟用')
      await saveBtn.trigger('click')
      await flushPromises()

      expect(new DOMWrapper(document.body).find('.enable-gate-dialog').exists()).toBe(false)
      const agentDialog = new DOMWrapper(document.body).find('.enable-agent-dialog')
      expect(agentDialog.exists()).toBe(true)
      await agentDialog.findAll('.se-agent-chip').find(c => c.text().includes('通用助理'))!.trigger('click')
      await agentDialog.findAll('button').find(b => b.text().includes('確認並啟用'))!.trigger('click')

      expect(store.findSkill(id)!.isEnabled).toBe(true)
    })

    it('取消：不存任何東西，isEnabled 不受影響', async () => {
      const store = useSkillStore()
      const { wrapper } = mountWorkspace({ skillId: 'personal-001' })
      await flushPromises()
      await store.generateAITestScenarios('personal-001')
      for (const sc of [...store.aiTestScenarios]) {
        store.answerAITestScenario('personal-001', sc.id, sc.agentAnswer)
      }
      await flushPromises()

      await wrapper.find('.studio-save-btn').trigger('click')
      await flushPromises()
      const agentDialog = new DOMWrapper(document.body).find('.enable-agent-dialog')
      await agentDialog.findAll('button').find(b => b.text().includes('取消'))!.trigger('click')

      expect(store.findSkill('personal-001')!.isEnabled).toBe(true)
      expect(store.findSkill('personal-001')!.assignedAgents).toEqual(['會議記錄助理', '業務分析助理']) // 原本的指派沒被動到
    })
  })

  it('修改模式：草稿沒有變更時按「放棄修改」，不用確認，直接 emit discard', async () => {
    const { wrapper } = mountWorkspace({ skillId: 'personal-001' })
    await flushPromises()
    const discardBtn = wrapper.findAll('.studio-save-footer button').find(b => b.text().includes('放棄修改'))!
    await discardBtn.trigger('click')
    expect(popDialog.confirm).not.toHaveBeenCalled()
    expect(wrapper.emitted('discard')).toHaveLength(1)
  })

  it('skillId + intent=ask：修改模式，但開場白是「剛剛測試」的問句，不是預設要改的版本', async () => {
    const { wrapper } = mountWorkspace({ skillId: 'personal-001', intent: 'ask' })
    await flushPromises()
    expect(wrapper.find('.ssc-mode-chip').text()).toContain('修改：週報自動生成')
    const firstBubble = wrapper.find('.chat-bubble')
    expect(firstBubble.text()).toContain('週報自動生成')
    expect(firstBubble.text()).toContain('測試')
    expect(firstBubble.text()).not.toContain('告訴我想改哪裡')
  })

  it('skillId 是 Library 技能：toast 提示並退回建立模式', async () => {
    const { wrapper } = mountWorkspace({ skillId: 'sys-cs-001' })
    await flushPromises()
    expect(popDialog.toast).toHaveBeenCalledWith('Library 技能請先在技能管理複製為個人技能')
    expect(wrapper.find('.SkillMethodChooser').exists()).toBe(true)
  })

  it('skillId 不存在：toast「找不到這個技能」並退回建立模式', async () => {
    const { wrapper } = mountWorkspace({ skillId: 'nope-999' })
    await flushPromises()
    expect(popDialog.toast).toHaveBeenCalledWith('找不到這個技能')
    expect(wrapper.find('.SkillMethodChooser').exists()).toBe(true)
  })

  it('tab: test：預設切到測試 tab', async () => {
    const { wrapper } = mountWorkspace({ skillId: 'personal-001', tab: 'test' })
    await flushPromises()
    expect(wrapper.findAll('.ssp-tab-btn')[1].classes()).toContain('is-active')
  })

  it('skillId 不存在且 tab=test：退回建立模式並強制回到預覽 tab', async () => {
    const { wrapper } = mountWorkspace({ skillId: 'nope-999', tab: 'test' })
    await flushPromises()
    expect(popDialog.toast).toHaveBeenCalledWith('找不到這個技能')
    expect(wrapper.find('.SkillMethodChooser').exists()).toBe(true)
    expect(wrapper.findAll('.ssp-tab-btn')[0].classes()).toContain('is-active')
  })

  it('送出訊息 → 草稿更新 → 儲存 → 建立個人技能、toast、自動切到測試 tab', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { wrapper } = mountWorkspace()
      await flushPromises()
      await chooseChat(wrapper)
      const store = useSkillStore()
      store.myPersonalSkills.forEach(s => store.deletePersonalSkill(s.id))
      const before = store.myPersonalSkills.length
      const input = wrapper.find('.SkillStudioChat input.custom-input')
      await input.setValue('幫我建立一個能查 ERP 庫存的技能')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()

      await input.setValue('沒有特殊例外')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()

      await input.setValue('照標準流程執行')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()

      await input.setValue('對，沒錯')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()

      expect(wrapper.find('.ssp-title').text()).toBe('查 ERP 庫存')
      await wrapper.find('.studio-save-btn').trigger('click')
      await flushPromises()
      expect(store.myPersonalSkills.length).toBe(before + 1)
      expect(popDialog.toast).toHaveBeenCalledWith('已儲存為個人技能，可到「測試」tab 驗證')
      expect(wrapper.findAll('.ssp-tab-btn')[1].classes()).toContain('is-active')
      expect(wrapper.find('.ssc-mode-chip').text()).toContain('修改：查 ERP 庫存')
    } finally {
      vi.useRealTimers()
    }
  })

  it('同名個人技能時顯示提示 banner，改成不同名後消失，儲存仍可用', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { wrapper } = mountWorkspace()
      await flushPromises()
      await chooseChat(wrapper)
      const store = useSkillStore()
      // 清單非空時，建立意圖的訊息會先卡在 gate1（見 useSkillStudioConversation 的意圖判斷關卡）；
      // 這裡要測的是名稱衝突 banner 本身，先清空清單讓 chat 建立訊息直接進 active、照舊擬草稿，
      // 草稿擬好之後再直接呼叫 store 補回一顆同名（週報自動生成）的個人技能來觸發衝突判斷
      store.myPersonalSkills.forEach(s => store.deletePersonalSkill(s.id))
      const input = wrapper.find('.SkillStudioChat input.custom-input')
      // 這個測試接著要送出「自由格式」的改名訊息，那只有在 gateStage 'active' 才會走
      // interpretStudioMessage 的改名規則，所以要走完整輪：第一句描述 → 兩輪追問 →
      // confirmKnownInfo 確認 → gate3 確認，最後一步會實際落地一顆個人技能，但這個測試
      // 不檢查 myPersonalSkills.length，只驗證 name-conflict-banner 與儲存按鈕的狀態
      await input.setValue('幫我建立一個能查 ERP 庫存的技能')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()

      await input.setValue('沒有特殊例外')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()

      await input.setValue('照標準流程執行')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()

      await input.setValue('對，沒錯')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()

      await input.setValue('先不指派')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()

      await input.setValue('這樣可以，存到個人技能')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()

      store.createPersonalSkill({ name: '週報自動生成', instructions: '', triggerHint: '', assignedAgents: [] })
      await flushPromises()

      await input.setValue('名稱改成「週報自動生成」')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()
      expect(wrapper.find('.name-conflict-banner').exists()).toBe(true)
      expect(wrapper.find('.studio-save-btn').attributes('disabled')).toBeUndefined()

      await input.setValue('名稱改成「庫存速查」')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()
      expect(wrapper.find('.name-conflict-banner').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('修改模式：右側不提供「直接編輯」「到技能管理」，因為現在是抽屜，離開這兩個入口都不合理', async () => {
    const { wrapper } = mountWorkspace({ skillId: 'personal-001' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('直接編輯')
    expect(wrapper.text()).not.toContain('到技能管理')
    expect(wrapper.text()).toContain('測試沙盒')
  })

  it('exposed applyQuery：外部呼叫可以重新套用（模擬外殼守衛通過後的行為）', async () => {
    const { wrapper } = mountWorkspace({ skillId: 'personal-001' })
    await flushPromises()
    expect(wrapper.find('.ssc-mode-chip').text()).toContain('修改：週報自動生成')
    ;(wrapper.vm as any).applyQuery({})
    await flushPromises()
    expect(popDialog.confirm).not.toHaveBeenCalled()
    expect(wrapper.find('.SkillMethodChooser').exists()).toBe(true)
  })

  it('測試相關的提示（生成中敘事、生成完成、測試報告）都不推進左側對話河道', async () => {
    const store = useSkillStore()
    const { wrapper } = mountWorkspace({ skillId: 'personal-001' })
    await flushPromises()
    const before = wrapper.findAll('.chat-bubble').length

    await store.generateAITestScenarios('personal-001')
    await flushPromises()
    store.aiTestReport = { total: 5, correct: 3, byTag: {} as any, summary: '' }
    await flushPromises()

    expect(wrapper.findAll('.chat-bubble')).toHaveLength(before)
  })

  it('修改模式下說要建立新技能，點「對，開新的」確認：導向全新的建立流程（conv 自己切不了路由，靠 requestNewSkillDrawer 訊號橋接）', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { wrapper, router } = mountWorkspace({ skillId: 'personal-001' })
      await flushPromises()
      const push = vi.spyOn(router, 'push')
      const input = wrapper.find('.SkillStudioChat input.custom-input')

      await input.setValue('我要建立一個新技能')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()
      const confirmChip = wrapper.findAll('.ssc-action-chip').find(b => b.text().includes('對，開新的'))!
      expect(confirmChip).toBeDefined()

      await confirmChip.trigger('click')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()
      expect(push).toHaveBeenCalledWith({ query: { method: 'chat' } })
    } finally {
      vi.useRealTimers()
    }
  })

  it('修改模式下說要建立新技能，點「不是，我想問別的」：留在原本修改畫面，不導航', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { wrapper, router } = mountWorkspace({ skillId: 'personal-001' })
      await flushPromises()
      const push = vi.spyOn(router, 'push')
      const input = wrapper.find('.SkillStudioChat input.custom-input')

      await input.setValue('我要建立一個新技能')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()
      const cancelChip = wrapper.findAll('.ssc-action-chip').find(b => b.text().includes('不是，我想問別的'))!

      await cancelChip.trigger('click')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()
      expect(push).not.toHaveBeenCalled()
      expect(wrapper.find('.ssc-mode-chip').text()).toContain('修改：週報自動生成')
    } finally {
      vi.useRealTimers()
    }
  })

  it('選「用行銷積木組裝」：基本設定／積木組成兩個子步驟；填必填欄位、勾章節、儲存 → 個人技能有 composition 與指派 Agent', async () => {
    const { wrapper } = mountWorkspace()
    await flushPromises()
    await wrapper.findAll('.smc-card')[1].trigger('click')
    await flushPromises()
    expect(wrapper.find('.studio-chat-col .SkillBlockBasicsForm').exists()).toBe(true)
    expect(wrapper.find('.SkillStudioChat').exists()).toBe(false)
    expect(wrapper.find('.studio-composer-head .ssc-mode-chip').classes()).toContain('ssc-mode-chip--create')
    await wrapper.find('.sbbf-name-input').setValue('行銷週報')

    await wrapper.findAll('.sbc-step-tab')[1].trigger('click')
    await wrapper.findAll('.sbc-palette-item').find(i => i.text().includes('活動排行'))!.find('.sbc-add-btn').trigger('click')
    await flushPromises()
    expect(wrapper.find('.ssp-title').text()).toBe('行銷週報')
    expect(wrapper.text()).toContain('活動排行：各促銷活動帶動效果排行')

    // 回「基本設定」補齊其餘必填欄位：存不了，按鈕才有意義可以測
    await wrapper.findAll('.sbc-step-tab')[0].trigger('click')
    await wrapper.find('.sce-tag-input').setValue('週報')
    await wrapper.find('.sce-tag-input').trigger('keydown.enter') // 關鍵字：AI 建議要先有關鍵字才給產生
    await wrapper.find('.sbbf-textarea').setValue('每週一產出的行銷週報')
    const aiBtns = wrapper.findAll('.sbbf-ai-btn')
    await aiBtns[1].trigger('click') // 觸發情境：開出 3 句候選
    await flushPromises()
    await wrapper.findAll('.sbbf-suggestion-chip')[0].trigger('click') // 選第一句套用
    await aiBtns[2].trigger('click') // 覆蓋能力：欄位是空的，AI 建議直接套用、不跳確認
    await wrapper.find('.se-agent-chip').trigger('click')
    await flushPromises()

    await wrapper.find('.studio-save-btn').trigger('click')
    await flushPromises()
    const store = useSkillStore()
    expect(store.myPersonalSkills[0].composition).toEqual({ sectionIds: ['promo_ranking'] })
    expect(store.myPersonalSkills[0].assignedAgents).toHaveLength(1)
  })

  it('skillId 指向有 composition 的技能：切到積木組成子步驟可見勾選還原', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '渠道週報', instructions: '依序產出以下章節：\n1. 渠道核心 KPI', triggerHint: 't', isEnabled: true, assignedAgents: [], composition: { sectionIds: ['ch_kpi'] } })
    const { wrapper } = mountWorkspace({ skillId: id })
    await flushPromises()
    expect(wrapper.find('.SkillBlockBasicsForm').exists()).toBe(true)
    await wrapper.findAll('.sbc-step-tab')[1].trigger('click')
    expect(wrapper.find('.SkillBlockComposer').exists()).toBe(true)
    expect(wrapper.findAll('.sbc-list .sbc-item-name').map(n => n.text())).toEqual(['渠道核心 KPI'])
    expect(wrapper.find('.studio-composer-head .ssc-mode-chip').classes()).toContain('ssc-mode-chip--edit')
  })

  describe('conv4 交接（方案三）', () => {
    it('from: conv4 但沒有交接資料：退回一般建立模式，不顯示返回連結', async () => {
      const { wrapper } = mountWorkspace({ from: 'conv4' })
      await flushPromises()
      expect(wrapper.find('.SkillMethodChooser').exists()).toBe(true)
      expect(wrapper.find('.studio-back-link').exists()).toBe(false)
    })

    it('from: conv4 且有交接資料：直接進對話模式、套用預填草稿與開場白，並顯示返回連結', async () => {
      setSkillHandoff({
        prefill: { name: '產品銷售報告整理', instructions: '1. 查詢資料\n2. 套用規範產出' },
        openingMessage: '這顆技能來自本對話的「查詢銷售資料」流程，設定我先填好了。',
        origin: { conversationId: 'conv4', reason: '查詢銷售資料＋套用部門報告規範' },
      })
      const { wrapper, router } = mountWorkspace({ from: 'conv4' })
      await flushPromises()
      expect(wrapper.find('.SkillMethodChooser').exists()).toBe(false)
      expect(wrapper.find('.ssp-title').text()).toBe('產品銷售報告整理')
      expect(wrapper.text()).toContain('這顆技能來自本對話的「查詢銷售資料」流程')
      expect(wrapper.find('.studio-origin-bar').text()).toContain('來自本對話的「查詢銷售資料＋套用部門報告規範」流程')

      const back = wrapper.find('.studio-back-link')
      expect(back.exists()).toBe(true)
      const push = vi.spyOn(router, 'push')
      await back.trigger('click')
      expect(popDialog.confirm).toHaveBeenCalledWith('有未儲存的變更，確定要放棄嗎？', '放棄變更', '留下', expect.any(Function))
      expect(push).not.toHaveBeenCalled()
      const onConfirm = vi.mocked(popDialog.confirm).mock.calls[0][3] as () => void
      onConfirm()
      expect(push).toHaveBeenCalledWith({ name: 'AiViewer' })
      expect(useAiviewerStore().conv4Msgs).toEqual([])
    })

    it('儲存後再按返回：conv4 對話會補一句「已建立」確認訊息', async () => {
      setSkillHandoff({
        prefill: { name: '產品銷售報告整理', instructions: '1. 查詢資料' },
        openingMessage: '開場白',
        origin: { conversationId: 'conv4', reason: '查詢銷售資料＋套用部門報告規範' },
      })
      const { wrapper, router } = mountWorkspace({ from: 'conv4' })
      await flushPromises()
      await wrapper.find('.studio-save-btn').trigger('click')
      await flushPromises()
      await wrapper.find('.studio-back-link').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('AiViewer')
      const aiviewer = useAiviewerStore()
      expect(aiviewer.conv4Msgs.at(-1)).toMatchObject({
        agent: 'brain',
        msg: '✅ 個人技能「產品銷售報告整理」已建立完成。',
      })
    })

    it('交接資料只套用一次：讀過就清空', async () => {
      setSkillHandoff({
        prefill: { name: '一次性草稿' },
        openingMessage: '開場白',
        origin: { conversationId: 'conv4', reason: 'x' },
      })
      mountWorkspace({ from: 'conv4' })
      await flushPromises()
      expect(consumeSkillHandoff()).toBeNull()
    })

  })
})
