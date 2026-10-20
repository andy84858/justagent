import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { useAiviewerStore } from '@/stores/AiViewerStore'
import { useSkillStore } from '@/stores/skillStore'
import skillBuilderViewBox from '@/components/AiViewer/viewBlock/skillBuilderViewBox.vue'

vi.mock('@/services/popDialog', () => ({ default: { toast: vi.fn(), confirm: vi.fn(), alert: vi.fn() } }))

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

describe('two skillBuilderViewBox instances on one block', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('A dirty via chat, B saves -> A picks up the save (edit mode, disabled), no duplicate skill even if A saves again', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const store = useAiviewerStore()
      const skillStore = useSkillStore()
      // 清單非空時，建立意圖的訊息會先卡在 gate1（見 useSkillStudioConversation 的意圖判斷關卡）；
      // 這裡要測的是雙實例同步本身，先清空清單讓 chat 建立訊息直接進 active、照舊擬草稿
      skillStore.myPersonalSkills.forEach(s => skillStore.deletePersonalSkill(s.id))
      const before = skillStore.myPersonalSkills.length
      const id = store.addSkillBuilderBlock()
      const block = store.aiViewerBlocks.find((b: any) => b.id === id)

      const A = mountOn(id, block) // canvas instance
      await A.findAll('.smc-card')[0].trigger('click')
      await flushPromises()
      const input = A.find('.SkillStudioChat input.custom-input')
      // 新的多輪 gathering 流程：第一句描述 → 兩輪追問 → confirmKnownInfo 確認，
      // 才會落在 gate3（草稿已擬好但尚未儲存），維持這裡「B 儲存前 A 的草稿已是最新」的測試意圖
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

      // 新建技能存檔前要先確認可調用 Agent
      await input.setValue('通用助理')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()

      expect(block.data.data.snapshot.draft.name).toBe('查 ERP 庫存')

      const B = mountOn(id, block) // fullscreen instance, hydrates A's state
      await flushPromises()
      store.updateSkillBuilderBlock(id, { activeTab: 'preview' })
      await flushPromises()
      await B.find('.ssp-save-btn').trigger('click')
      await flushPromises()
      expect(skillStore.myPersonalSkills.length).toBe(before + 1)
      expect(block.data.data.snapshot.savedSkillId).not.toBeNull()

      B.unmount()
      await flushPromises()
      store.updateSkillBuilderBlock(id, { activeTab: 'preview' })
      await flushPromises()

      // A should have picked up B's save: edit mode, savedSkillId set, save button disabled (not dirty)
      expect(A.find('.ssp-save-btn').attributes('disabled')).toBeDefined()
      await A.find('.ssp-save-btn').trigger('click')
      await flushPromises()
      expect(skillStore.myPersonalSkills.length).toBe(before + 1) // still just one
    } finally {
      vi.useRealTimers()
    }
  })

  it('A saves, B renames via chat -> A shows the new title, save enabled, status badge shows 有未儲存變更', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const store = useAiviewerStore()
      const id = store.addSkillBuilderBlock({ prefill: { name: '查庫存', instructions: '1. 查' } })
      const block = store.aiViewerBlocks.find((b: any) => b.id === id)
      const A = mountOn(id, block)
      store.updateSkillBuilderBlock(id, { activeTab: 'preview' })
      await flushPromises()
      await A.find('.ssp-save-btn').trigger('click') // 新建技能：先被攔下來、切到對話分頁問可調用 Agent
      await flushPromises()
      expect(block.data.data.activeTab).toBe('chat')
      const aInput = A.find('.SkillStudioChat input.custom-input')
      await aInput.setValue('通用助理') // 回答完 A 自己存檔 -> edit mode
      await aInput.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()
      expect(block.data.data.snapshot.savedSkillId).not.toBeNull()

      const B = mountOn(id, block)
      await flushPromises()
      const input = B.find('.SkillStudioChat input.custom-input')
      await input.setValue('名稱改成「新名」')
      await input.trigger('keydown.enter')
      await vi.advanceTimersByTimeAsync(800)
      await flushPromises()
      expect(block.data.data.snapshot.draft.name).toBe('新名')
      B.unmount()
      await flushPromises()

      store.updateSkillBuilderBlock(id, { activeTab: 'preview' })
      await flushPromises()
      expect(A.find('.ssp-title').text()).toBe('新名')
      expect(A.find('.ssp-save-btn').attributes('disabled')).toBeUndefined()
      expect(A.find('.ssp-status-badge').text()).toContain('有未儲存變更')
    } finally {
      vi.useRealTimers()
    }
  })

  it('A 選了「積木」方式但還沒填內容，B hydrate 同一份快照 -> B 不應該被判定成有未儲存變更', async () => {
    const store = useAiviewerStore()
    const id = store.addSkillBuilderBlock()
    const block = store.aiViewerBlocks.find((b: any) => b.id === id)

    const A = mountOn(id, block) // 空白建立，只選方式，還沒有任何內容
    await A.findAll('.smc-card')[1].trigger('click')
    await flushPromises()
    expect(block.data.data.snapshot.draft.method).toBe('blocks')

    const B = mountOn(id, block) // 另一個實例掛載，hydrate 同一份快照
    await flushPromises()

    // 切到「積木組成」子步驟才看得到積木庫；A 在積木庫加入一個章節 -> B（hydrate 同一份快照）
    // 的積木面板應該同步看到相同的 sectionIds
    await A.findAll('.sbc-step-tab')[1].trigger('click')
    await A.find('.sbc-add-btn').trigger('click')
    await flushPromises()
    expect(block.data.data.snapshot.draft.sectionIds.length).toBe(1)
    await B.findAll('.sbc-step-tab')[1].trigger('click')
    expect(B.find('.sbc-list .sbc-item-name').text()).toBe(A.find('.sbc-list .sbc-item-name').text())

    store.updateSkillBuilderBlock(id, { activeTab: 'preview' })
    await flushPromises()
    expect(B.find('.ssp-status-badge').text()).toContain('未儲存草稿')
    expect(B.find('.ssp-status-badge').text()).not.toContain('有未儲存變更')
  })
})
