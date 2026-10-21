import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { useAiviewerStore } from '@/stores/AiViewerStore'
import { useSkillStore } from '@/stores/skillStore'
import skillBuilderViewBox from '@/components/AiViewer/viewBlock/skillBuilderViewBox.vue'
import { DEFAULT_OPENING_MESSAGE } from '@/composables/useSkillStudioConversation'

vi.mock('@/services/popDialog', () => ({ default: { toast: vi.fn(), confirm: vi.fn(), alert: vi.fn() } }))

function mountBlock(init?: Parameters<ReturnType<typeof useAiviewerStore>['addSkillBuilderBlock']>[0]) {
  const store = useAiviewerStore()
  const id = store.addSkillBuilderBlock(init)
  const block = store.aiViewerBlocks.find((b: any) => b.id === id)
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/view/Skills', name: 'SkillManagement', component: { template: '<div/>' } },
      { path: '/view/SkillTest', name: 'SkillTest', component: { template: '<div/>' } },
      { path: '/view/SkillEditor', name: 'SkillEditor', component: { template: '<div/>' } },
    ],
  })
  const wrapper = mount(skillBuilderViewBox, {
    props: { id, source: block.data },
    global: { plugins: [router], stubs: { SkillTestAI: true, SkillFileUpload: true }, directives: { tooltip: {} } },
  })
  return { wrapper, store, id, block, router }
}

// 掛第二個實例在同一顆 block 上（模擬全螢幕／畫布兩個實例同步），沿用同一顆 block.data
// 讓它 hydrate 目前的 snapshot——用來驗證 gateStage 有沒有正確跟著快照一起還原（見下方測試）
function mountOn(id: string, block: any) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/view/Skills', name: 'SkillManagement', component: { template: '<div/>' } },
      { path: '/view/SkillTest', name: 'SkillTest', component: { template: '<div/>' } },
      { path: '/view/SkillEditor', name: 'SkillEditor', component: { template: '<div/>' } },
    ],
  })
  return mount(skillBuilderViewBox, {
    props: { id, source: block.data },
    global: { plugins: [router], stubs: { SkillTestAI: true, SkillFileUpload: true }, directives: { tooltip: {} } },
  })
}

describe('skillBuilderViewBox', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('空白 block：先顯示方式選擇、沒有 tab；選對話後出現 對話／預覽／測試 與開場訊息', async () => {
    const { wrapper, block } = mountBlock()
    expect(wrapper.find('.SkillMethodChooser').exists()).toBe(true)
    expect(wrapper.findAll('.skb-tab-btn')).toHaveLength(0)
    await wrapper.findAll('.smc-card')[0].trigger('click')
    await flushPromises()
    expect(block.data.data.snapshot.draft.method).toBe('chat')
    expect(block.data.data.activeTab).toBe('chat')
    expect(wrapper.findAll('.skb-tab-btn').map(t => t.text())).toEqual([expect.stringContaining('對話'), expect.stringContaining('預覽'), expect.stringContaining('測試')])
    // 無 prefill 走意圖判斷關卡（見 useSkillStudioConversation 的 gateStage：進入點），
    // 開場白不是既有的 DEFAULT_OPENING_MESSAGE（那句只給有 prefill 的交接情境用）
    expect(wrapper.text()).not.toContain(DEFAULT_OPENING_MESSAGE)
    expect(wrapper.text()).toContain('你好')
    await wrapper.findAll('.skb-tab-btn')[1].trigger('click')
    expect(block.data.data.activeTab).toBe('preview')
    expect(wrapper.find('.ssp-tabs').exists()).toBe(false)
  })

  it('預填 block：hydrate 後預覽顯示名稱；有 origin 時對話 tab 顯示脈絡條', async () => {
    const { wrapper } = mountBlock({
      prefill: { name: '產品銷售報告整理', instructions: '1. 查詢\n2. 套用' },
      openingMessage: '來自對話的開場',
      origin: { conversationId: 'conv4', reason: '查詢銷售資料＋套用部門報告規範' },
    })
    expect(wrapper.find('.skb-origin-bar').text()).toContain('查詢銷售資料＋套用部門報告規範')
    expect(wrapper.text()).toContain('來自對話的開場')
    await wrapper.findAll('.skb-tab-btn')[1].trigger('click')
    expect(wrapper.find('.ssp-title').text()).toBe('產品銷售報告整理')
    expect(wrapper.find('.ssp-save-btn').attributes('disabled')).toBeUndefined()
  })

  it('對話送出後草稿變動會寫回 snapshot', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { wrapper, block } = mountBlock()
      // 清單非空時，建立意圖的訊息會先卡在 gate1（見 useSkillStudioConversation 的意圖判斷關卡）；
      // 這裡要測的是草稿變動寫回 snapshot 本身，先清空清單讓 chat 建立訊息直接進 active、照舊擬草稿
      const skillStore = useSkillStore()
      skillStore.myPersonalSkills.forEach(s => skillStore.deletePersonalSkill(s.id))
      await wrapper.findAll('.smc-card')[0].trigger('click')
      await flushPromises()
      // 從零開始建立現在一律走 gathering → confirmKnownInfo → gate3 的完整關卡流程，
      // 沒有「一句話直接變 active 草稿」的捷徑了，這裡改成打字逐一驅動整個流程
      async function type(text: string) {
        const input = wrapper.find('.SkillStudioChat input.custom-input')
        await input.setValue(text)
        await input.trigger('keydown.enter')
        await vi.advanceTimersByTimeAsync(800)
        await flushPromises()
      }
      await type('幫我建立一個能查 ERP 庫存的技能')
      await type('沒有特殊例外')
      await type('照標準流程執行就好')
      await type('對，沒錯')
      await type('這樣可以，存到個人技能')
      expect(block.data.data.snapshot.draft.name).toBe('查 ERP 庫存')
      expect(block.blockName).toBe('查 ERP 庫存')
      // 1 則開場白 + 5 輪打字各自的「使用者訊息 + agent 回覆」= 1 + 5*2 = 11
      expect(block.data.data.snapshot.messages.length).toBe(11)
    } finally {
      vi.useRealTimers()
    }
  })

  it('儲存：新建技能先切到對話分頁確認可調用 Agent，回答後才建立個人技能；「在 AI 賦能開啟」儲存前 disabled、儲存後導頁', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { wrapper, block, router } = mountBlock({ prefill: { name: '查庫存', instructions: '1. 查' } })
    const skillStore = useSkillStore()
    const before = skillStore.myPersonalSkills.length
    const openBtn = wrapper.find('.skb-open-studio')
    expect(openBtn.attributes('disabled')).toBeDefined()

    await wrapper.findAll('.skb-tab-btn')[1].trigger('click')
    await wrapper.find('.ssp-save-btn').trigger('click')
    await flushPromises()
    expect(skillStore.myPersonalSkills.length).toBe(before) // 還沒存，先問 Agent
    expect(block.data.data.activeTab).toBe('chat')
    const input = wrapper.find('.SkillStudioChat input.custom-input')
    await input.setValue('工程助理')
    await input.trigger('keydown.enter')
    await vi.advanceTimersByTimeAsync(800)
    await flushPromises()
    vi.useRealTimers()
    expect(skillStore.myPersonalSkills.length).toBe(before + 1)
    expect(skillStore.myPersonalSkills[0].assignedAgents).toEqual(['工程助理'])
    expect(block.data.data.snapshot.savedSkillId).toBe(skillStore.myPersonalSkills[0].id)

    const push = vi.spyOn(router, 'push')
    expect(wrapper.find('.skb-open-studio').attributes('disabled')).toBeUndefined()
    await wrapper.find('.skb-open-studio').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'SkillManagement', query: { skillId: skillStore.myPersonalSkills[0].id } })
  })

  it('snapshot 指到的技能已被刪除：顯示提示、退回建立模式', async () => {
    const skillStore = useSkillStore()
    const store = useAiviewerStore()
    const id = store.addSkillBuilderBlock({ prefill: { name: '查庫存', instructions: '1. 查' } })
    const block = store.aiViewerBlocks.find((b: any) => b.id === id)
    block.data.data.snapshot.mode = 'edit'
    block.data.data.snapshot.savedSkillId = 'personal-gone'
    const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', component: { template: '<div/>' } }] })
    const wrapper = mount(skillBuilderViewBox, {
      props: { id, source: block.data },
      global: { plugins: [router], stubs: { SkillTestAI: true, SkillFileUpload: true }, directives: { tooltip: {} } },
    })
    await flushPromises()
    expect(wrapper.find('.skb-missing-bar').text()).toContain('這顆技能已不存在')
    expect(wrapper.find('.ssc-mode-chip').text()).toContain('建立新技能')
    expect(skillStore.findSkill('personal-gone')).toBeUndefined()
    // detach 後的狀態要寫回 block data，不然其他實例／重新掛載仍看到指向已刪除技能的舊快照
    expect(block.data.data.snapshot.savedSkillId).toBeNull()
    expect(block.data.data.snapshot.mode).toBe('create')
  })

  it('選積木：tab 為 積木／預覽／測試，積木 tab 內又分「基本設定／積木組成」兩步驟；填必填欄位＋勾章節 → 預覽步驟 → 儲存寫入 composition → 出現「產一份報告」→ 點擊放上報告 block 且列消失', async () => {
    const { wrapper, block, store } = mountBlock()
    const skillStore = useSkillStore()
    await wrapper.findAll('.smc-card')[1].trigger('click')
    await flushPromises()
    expect(block.data.data.snapshot.draft.method).toBe('blocks')
    expect(wrapper.findAll('.skb-tab-btn').map(t => t.text())).toEqual([expect.stringContaining('積木'), expect.stringContaining('預覽'), expect.stringContaining('測試')])
    // 預設停在「基本設定」子步驟，不是直接看到積木組成面板
    expect(wrapper.find('.SkillBlockBasicsForm').exists()).toBe(true)
    expect(wrapper.find('.SkillBlockComposer').exists()).toBe(false)

    await wrapper.find('.sbbf-name-input').setValue('行銷週報')

    // 切到「積木組成」子步驟勾章節
    const stepTabs = wrapper.findAll('.sbc-step-tab')
    await stepTabs[1].trigger('click')
    const items = wrapper.findAll('.sbc-palette-item')
    await items.find(i => i.text().includes('促銷核心 KPI'))!.find('.sbc-add-btn').trigger('click')
    await items.find(i => i.text().includes('渠道核心 KPI'))!.find('.sbc-add-btn').trigger('click')
    await flushPromises()
    expect(block.data.data.snapshot.draft.sectionIds).toEqual(['promo_kpi', 'ch_kpi'])
    expect(block.blockName).toBe('行銷週報')

    // 回「基本設定」填其餘必填欄位：說明手打，
    // 關鍵字手打，覆蓋能力用「AI 建議」套用依章節算出的建議（欄位目前是空的，直接套用
    // 不會跳確認對話框），指派 Agent 至少勾一個
    await stepTabs[0].trigger('click')
    await wrapper.find('.sce-tag-input').setValue('週報')
    await wrapper.find('.sce-tag-input').trigger('keydown.enter') // 關鍵字：AI 建議要先有關鍵字才給產生
    await wrapper.find('.sbbf-textarea').setValue('每週一產出的行銷週報')
    const aiBtns = wrapper.findAll('.sbbf-ai-btn')
    await aiBtns[1].trigger('click') // 覆蓋能力
    await wrapper.find('.se-agent-chip').trigger('click')
    await flushPromises()

    await wrapper.findAll('.skb-tab-btn')[1].trigger('click')
    expect(wrapper.find('.ssp-title').text()).toBe('行銷週報')
    // markdown-it 把「1. …」轉成 <ol><li>，數字是瀏覽器產生的 ::marker，不在 textContent 裡，
    // 這裡改驗證章節名稱＋說明確實被 deriveFromSections 帶進技能指令
    expect(wrapper.text()).toContain('促銷核心 KPI：完成訂單數')
    expect(wrapper.findAll('.ssp-cap-chip').map(c => c.text())).toEqual(['#促銷核心KPI', '#渠道核心KPI'])

    const blocksBefore = store.aiViewerBlocks.length
    await wrapper.find('.ssp-save-btn').trigger('click')
    await flushPromises()
    const saved = skillStore.myPersonalSkills[0]
    expect(saved.composition).toEqual({ sectionIds: ['promo_kpi', 'ch_kpi'] })
    expect(saved.creationMethod).toBe('manual')
    expect(saved.assignedAgents).toHaveLength(1)
    expect(block.data.data.activeTab).toBe('test')
    const bar = wrapper.find('.skb-after-save-bar')
    expect(bar.exists()).toBe(true)
    await bar.find('.skb-run-report-btn').trigger('click')
    await flushPromises()
    expect(store.aiViewerBlocks.length).toBe(blocksBefore + 1)
    const report = store.aiViewerBlocks.find((b: any) => b.blockName === '行銷週報.html')
    expect(report.data.blockType).toBe('HTML')
    expect(report.data.data.fileUrl).toBe('/justagent/hurricane_trailsetter_campaign_performance.html')
    expect(wrapper.find('.skb-after-save-bar').exists()).toBe(false)
  })

  it('conv4 預填 block（prefill）直接是對話 tab，沒有方式選擇畫面', () => {
    const { wrapper } = mountBlock({ prefill: { name: 'x', instructions: '1. a' }, openingMessage: '開場' })
    expect(wrapper.find('.SkillMethodChooser').exists()).toBe(false)
    expect(wrapper.find('.SkillStudioChat').exists()).toBe(true)
  })

  // 不清空個人技能清單（故意跟本檔其他測試相反）：關卡流程只有在清單非空時才會走 gate1／gate2，
  // 之前所有走到聊天建立流程的測試都先清空清單以繞開關卡、直接落到 active，導致 gateStage 不是
  // 'active' 時聊天面板真的被掛載渲染這件事，從來沒有被任何一個元件層級的測試驗證過
  it('對話建立走到關卡二（改用打字驅動，不再有 chip）：聊天面板全程保持掛載，選「另外新增一份」後不會被方式選擇畫面取代；另一實例 hydrate 同一份 gate2 快照後，打同樣的話仍走關卡路由（不會誤判成自由輸入把文字寫進技能名稱）', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const skillStore = useSkillStore()
      const target = skillStore.myPersonalSkills[0]

      async function type(w: ReturnType<typeof mount>, text: string) {
        const input = w.find('.SkillStudioChat input.custom-input')
        await input.setValue(text)
        await input.trigger('keydown.enter')
        await vi.advanceTimersByTimeAsync(800)
        await flushPromises()
      }

      async function reachGate2(w: ReturnType<typeof mount>) {
        await w.findAll('.smc-card')[0].trigger('click')
        await flushPromises()
        await type(w, `幫我記一個${target.name}的做法`)
        // 關卡二：找到相近做法，聊天面板還在、方式選擇畫面沒有出現，訊息帶技能名稱，不帶 chip
        expect(w.find('.SkillMethodChooser').exists()).toBe(false)
        expect(w.find('.SkillStudioChat').exists()).toBe(true)
        expect(w.find('.ssc-messages').text()).toContain(target.name)
        expect(w.findAll('.chat-bubble').at(-1)!.findAll('.ssc-action-chip')).toHaveLength(0)
      }

      // ── Critical #1（final review）：draft.value = emptyDraft() 會把 method 也清成 null，
      // SkillMethodChooser 就會取代掉正在推訊息進去的聊天面板；這裡改用打字後仍要成立 ──
      const a = mountBlock()
      await reachGate2(a.wrapper)
      await type(a.wrapper, '我想另外新增一份')
      expect(a.wrapper.find('.SkillMethodChooser').exists()).toBe(false)
      expect(a.wrapper.find('.SkillStudioChat').exists()).toBe(true)
      expect(a.block.data.data.snapshot.draft.method).toBe('chat')
      expect(a.wrapper.find('.ssc-messages').text()).toContain('好，那我們重新開一份。請描述這份做法的內容。')

      // ── Important #2（final review）：另開一顆獨立的 block／實例，停在關卡二（不再往下打），
      // 讓第二個實例 hydrate 這份「卡在 gate2」的快照，驗證 gateStage 有沒有跟著還原 ──
      const b1 = mountBlock()
      await reachGate2(b1.wrapper)

      const b2 = mountOn(b1.id, b1.block)
      await flushPromises()
      expect(b2.find('.ssc-messages').text()).toContain(target.name)

      // 在第二個實例打同一句話：若 hydrate 沒帶回 gateStage，第二個實例會停在預設值
      // 'active'，這句話會被當成自由輸入丟進舊版 interpretStudioMessage，直接把這句話
      // 寫進技能名稱；gateStage 正確還原成 'gate2' 的話，這裡應該正常走 classifyGate2 的
      // 'new' 分支：草稿清空、名稱維持空白，而不是變成這句話本身
      await type(b2, '我想另外新增一份')

      expect(b2.find('.SkillMethodChooser').exists()).toBe(false)
      expect(b2.find('.SkillStudioChat').exists()).toBe(true)
      expect(b1.block.data.data.snapshot.draft.name).toBe('')
      expect(b1.block.data.data.snapshot.draft.method).toBe('chat')
      expect(b2.find('.ssc-messages').text()).toContain('好，那我們重新開一份。請描述這份做法的內容。')
    } finally {
      vi.useRealTimers()
    }
  })
})
