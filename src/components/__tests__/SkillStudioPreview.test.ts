import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillStudioPreview from '@/components/Skill/SkillStudioPreview.vue'
import { emptyDraft } from '@/composables/useSkillStudioConversation'
import { useSkillStore } from '@/stores/skillStore'

function mountPreview(over: Partial<Record<string, unknown>> = {}, beforeMount?: () => void) {
  setActivePinia(createPinia())
  beforeMount?.()
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/view/Skills', name: 'SkillManagement', component: { template: '<div/>' } },
      { path: '/view/SkillTest', name: 'SkillTest', component: { template: '<div/>' } },
      { path: '/view/SkillEditor', name: 'SkillEditor', component: { template: '<div/>' } },
    ],
  })
  return mount(SkillStudioPreview, {
    props: {
      draft: emptyDraft(),
      mode: 'create',
      savedSkillId: null,
      isDirty: false,
      canSave: false,
      activeTab: 'preview',
      ...over,
    },
    global: { plugins: [router], stubs: { SkillTestAI: true, SkillFileUpload: true } },
  })
}

describe('SkillStudioPreview', () => {
  it('空白草稿：六個區塊標籤都在，並顯示各自的空狀態文案與「未儲存草稿」badge', () => {
    const w = mountPreview()
    const text = w.text()
    expect(text).toContain('尚未命名的技能')
    expect(text).toContain('跟 Agent 描述這個技能要做什麼')
    expect(text).toContain('尚未設定觸發條件')
    expect(text).toContain('尚未撰寫技能指令')
    expect(text).toContain('尚未拆解覆蓋能力項目')
    expect(w.find('.ssp-status-badge').text()).toBe('未儲存草稿')
    expect(w.findAll('.ssp-section-label').length).toBe(5) // 說明／觸發條件／技能指令／覆蓋能力／附加檔案
  })

  it('hideFiles：不顯示「附加檔案」區塊，只剩四個區塊標籤', () => {
    const w = mountPreview({ hideFiles: true })
    expect(w.text()).not.toContain('附加檔案')
    expect(w.findAll('.ssp-section-label').length).toBe(4)
  })

  it('有內容時渲染名稱、觸發、markdown 指令與能力 chip', () => {
    const w = mountPreview({
      draft: { ...emptyDraft(), name: '查庫存', triggerHint: '提到庫存時', instructions: '1. **釐清**\n2. 查詢', capabilities: ['能力A'] },
    })
    expect(w.find('.ssp-title').text()).toBe('查庫存')
    expect(w.text()).toContain('提到庫存時')
    expect(w.find('.markdown-body strong').text()).toBe('釐清')
    expect(w.findAll('.ssp-cap-chip').map(c => c.text())).toEqual(['#能力A'])
  })

  it('建立模式主按鈕「儲存為個人技能」依 canSave 決定 disabled，點擊 emit save', async () => {
    const w = mountPreview({ canSave: false })
    const btn = w.find('.ssp-save-btn')
    expect(btn.text()).toContain('儲存為個人技能')
    expect(btn.attributes('disabled')).toBeDefined()
    await w.setProps({ canSave: true })
    await w.find('.ssp-save-btn').trigger('click')
    expect(w.emitted('save')).toHaveLength(1)
  })

  it('修改模式：主按鈕「儲存修改」依 isDirty；顯示「直接編輯」「到技能管理」；badge 依 isDirty 切換', async () => {
    const w = mountPreview({ mode: 'edit', savedSkillId: 'p1', canSave: true, isDirty: false })
    expect(w.find('.ssp-save-btn').text()).toContain('儲存修改')
    expect(w.find('.ssp-save-btn').attributes('disabled')).toBeDefined()
    expect(w.find('.ssp-status-badge').text()).toBe('個人技能 · 可使用')
    expect(w.text()).toContain('直接編輯')
    expect(w.text()).toContain('到技能管理')
    await w.setProps({ isDirty: true })
    expect(w.find('.ssp-save-btn').attributes('disabled')).toBeUndefined()
    expect(w.find('.ssp-status-badge').text()).toBe('有未儲存變更')
  })

  it('hideNavLinks：不顯示「直接編輯」「到技能管理」，但「測試沙盒」還在', async () => {
    const w = mountPreview({ mode: 'edit', savedSkillId: 'p1', canSave: true, hideNavLinks: true })
    expect(w.text()).not.toContain('直接編輯')
    expect(w.text()).not.toContain('到技能管理')
    expect(w.text()).toContain('測試沙盒')
  })

  it('showDiscard：預設不顯示「放棄修改」；開啟後顯示，點擊 emit discard', async () => {
    const w = mountPreview({ mode: 'edit', savedSkillId: 'p1', canSave: true })
    expect(w.text()).not.toContain('放棄修改')

    const w2 = mountPreview({ mode: 'edit', savedSkillId: 'p1', canSave: true, showDiscard: true })
    const discardBtn = w2.findAll('.ssp-footer button').find(b => b.text().includes('放棄修改'))
    expect(discardBtn).toBeDefined()
    await discardBtn!.trigger('click')
    expect(w2.emitted('discard')).toHaveLength(1)
  })

  it('showDiscard 在建立模式（尚未儲存過）不顯示：沒有「原本版本」可以放棄回去', async () => {
    const w = mountPreview({ mode: 'create', savedSkillId: null, canSave: true, showDiscard: true })
    expect(w.text()).not.toContain('放棄修改')
  })

  it('已儲存後兩個 tab 都有「技能測試沙盒」入口，點擊導向 /view/SkillTest?skillId=', async () => {
    const w = mountPreview({ mode: 'edit', savedSkillId: 'p1', canSave: true })
    const push = vi.spyOn((w.vm as any).$router, 'push')
    const footBtn = w.findAll('.ssp-footer button').find(b => b.text().includes('測試沙盒'))
    expect(footBtn).toBeDefined()
    await footBtn!.trigger('click')
    expect(push).toHaveBeenCalledWith({ path: '/view/SkillTest', query: { skillId: 'p1' } })

    await w.setProps({ activeTab: 'test' })
    const sandboxBtn = w.find('.ssp-sandbox-btn')
    expect(sandboxBtn.exists()).toBe(true)
    expect(sandboxBtn.text()).toContain('到技能測試沙盒')
    await sandboxBtn.trigger('click')
    expect(push).toHaveBeenCalledTimes(2)
    expect(push).toHaveBeenLastCalledWith({ path: '/view/SkillTest', query: { skillId: 'p1' } })
  })

  it('測試 tab：還沒存檔也能測，帶草稿佔位 testSkillId；存檔後改帶真正的 skillId', async () => {
    const w = mountPreview({ activeTab: 'test', testSkillId: 'draft-xyz' })
    const ai = w.findComponent({ name: 'SkillTestAI' })
    expect(ai.exists()).toBe(true)
    expect(ai.attributes('skillid') ?? ai.props('skillId')).toBe('draft-xyz')
    await w.setProps({ savedSkillId: 'p1', testSkillId: 'p1', mode: 'edit' })
    const ai2 = w.findComponent({ name: 'SkillTestAI' })
    expect(ai2.attributes('skillid') ?? ai2.props('skillId')).toBe('p1')
  })

  it('沒有 testSkillId 也沒有 savedSkillId（理論上不會發生）：不掛載 SkillTestAI', () => {
    const w = mountPreview({ activeTab: 'test' })
    expect(w.findComponent({ name: 'SkillTestAI' }).exists()).toBe(false)
  })

  it('題目跟目前草稿內容不一致時，測試 tab 頂端顯示「內容已變更，建議重新生成測試情境」提示', () => {
    const w = mountPreview(
      { activeTab: 'test', testSkillId: 'draft-xyz', draft: { ...emptyDraft(), name: '新名稱' } },
      () => {
        const store = useSkillStore()
        store.aiTestScenariosSkillId = 'draft-xyz'
        store.aiTestScenariosSnapshot = JSON.stringify({ name: '舊名稱', triggerHint: '', capabilities: [] })
        store.aiTestReport = { total: 3, correct: 3, byTag: { normal: { total: 1, correct: 1 }, boundary: { total: 1, correct: 1 }, trigger_edge: { total: 1, correct: 1 } }, summary: '' }
      }
    )
    expect(w.text()).toContain('內容已變更，建議重新生成測試情境')
  })

  it('題目跟目前草稿內容一致時，不顯示重新生成提示', () => {
    const w = mountPreview(
      { activeTab: 'test', testSkillId: 'draft-xyz', draft: { ...emptyDraft(), name: '同名稱' } },
      () => {
        const store = useSkillStore()
        store.aiTestScenariosSkillId = 'draft-xyz'
        store.aiTestScenariosSnapshot = JSON.stringify({ name: '同名稱', triggerHint: '', capabilities: [] })
        store.aiTestReport = { total: 3, correct: 3, byTag: { normal: { total: 1, correct: 1 }, boundary: { total: 1, correct: 1 }, trigger_edge: { total: 1, correct: 1 } }, summary: '' }
      }
    )
    expect(w.text()).not.toContain('內容已變更')
  })

  it('點 tab 按鈕 emit update:activeTab', async () => {
    const w = mountPreview()
    await w.findAll('.ssp-tab-btn')[1].trigger('click')
    expect(w.emitted('update:activeTab')?.[0]).toEqual(['test'])
  })

  it('nameConflict 為 true 時顯示同名提示 banner，預設不顯示', () => {
    const w1 = mountPreview()
    expect(w1.find('.name-conflict-banner').exists()).toBe(false)
    const w2 = mountPreview({ nameConflict: true })
    expect(w2.find('.name-conflict-banner').exists()).toBe(true)
    expect(w2.text()).toContain('你已經有一個同名的個人技能，建議修改名稱以便區分。')
  })

  it('hideTabs：不渲染 .ssp-tabs，但 activeTab 仍決定內容', () => {
    const w = mountPreview({ hideTabs: true, activeTab: 'test', testSkillId: 'draft-xyz' })
    expect(w.find('.ssp-tabs').exists()).toBe(false)
    expect(w.findComponent({ name: 'SkillTestAI' }).exists()).toBe(true)
    const normal = mountPreview()
    expect(normal.find('.ssp-tabs').exists()).toBe(true)
  })

  it('積木方式：多一個「指派 Agent」區塊；必填欄位沒填齊時顯示還缺什麼', () => {
    const w = mountPreview({
      draft: { ...emptyDraft(), method: 'blocks', name: '行銷週報', instructions: '1. a' },
      canSave: false,
    })
    expect(w.findAll('.ssp-section-label').some(l => l.text() === '指派 Agent')).toBe(true)
    expect(w.text()).toContain('尚未指派 Agent')
    expect(w.text()).toContain('還缺')
    expect(w.text()).toContain('指派 Agent')

    const filled = mountPreview({
      draft: {
        ...emptyDraft(), method: 'blocks', name: '行銷週報', instructions: '1. a',
        description: 'd', triggerHint: 't', capabilities: ['x'], assignedAgents: ['通用助理'],
      },
      canSave: true,
    })
    expect(filled.text()).not.toContain('還缺')
    expect(filled.findAll('.ssp-agent-chip').map(c => c.text())).toContain('通用助理')
  })

  it('測試 tab：積木方式、對話方式都只顯示 SkillTestAI，沒有額外的範例成果區塊', () => {
    const blocks = mountPreview({
      draft: { ...emptyDraft(), method: 'blocks', sectionIds: ['promo_kpi'] },
      activeTab: 'test', savedSkillId: 'p1', mode: 'edit',
    })
    expect(blocks.findComponent({ name: 'SkillTestAI' }).exists()).toBe(true)
    expect(blocks.find('.SkillSampleOutputTest').exists()).toBe(false)

    const chat = mountPreview({
      draft: { ...emptyDraft(), method: 'chat' },
      activeTab: 'test', savedSkillId: 'p1', mode: 'edit',
    })
    expect(chat.findComponent({ name: 'SkillTestAI' }).exists()).toBe(true)
  })
})
