import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillManagement from '../SkillManagement.vue'
import popDialog from '@/services/popDialog'
import { useSkillStore } from '@/stores/skillStore'

vi.mock('@/services/popDialog', () => ({
  default: { toast: vi.fn(), confirm: vi.fn(), alert: vi.fn() },
}))

// SkillStudioDrawer 透過 <Teleport to="body"> 掛到 document.body，不在 wrapper
// 的元素樹底下，wrapper.find() 找不到；比照 SkillStudioDrawer.test.ts 的作法改用
// DOMWrapper 查 document.body。
const body = () => new DOMWrapper(document.body)

describe('SkillManagement 抽屜：技能管理頁內建立/編輯不離開列表', () => {
  let currentWrapper: VueWrapper | null = null

  afterEach(() => {
    currentWrapper?.unmount()
    currentWrapper = null
    vi.clearAllMocks()
  })

  async function mountAt(query: Record<string, string> = {}) {
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div/>' } },
        { path: '/view/Skills', name: 'SkillManagement', component: SkillManagement },
        { path: '/view/SkillEditor', name: 'SkillEditor', component: { template: '<div/>' } },
        { path: '/view/AiViewer', name: 'AiViewer', component: { template: '<div/>' } },
      ],
    })
    await router.push({ path: '/view/Skills', query })
    await router.isReady()
    const wrapper = mount(
      { template: '<router-view />' },
      { global: { plugins: [router], stubs: { AppBreadcrumb: true, LibraryBrowseModal: true, SkillDetailDrawer: true, UpstreamUpdateDrawer: true, SkillReviewDrawer: true, BatchUpdateModal: true } } },
    )
    currentWrapper = wrapper
    await flushPromises()
    return { wrapper, router }
  }

  it('無 query：抽屜不顯示', async () => {
    setActivePinia(createPinia())
    await mountAt()
    expect(body().find('.ssd-panel').exists()).toBe(false)
  })

  it('帶 ?method=chat 掛載：抽屜自動打開，直接進對話模式', async () => {
    setActivePinia(createPinia())
    await mountAt({ method: 'chat' })
    expect(body().find('.ssd-panel').exists()).toBe(true)
    expect(body().find('.SkillStudioChat').exists()).toBe(true)
  })

  it('帶 ?skillId= 掛載（重新整理／分享連結情境）：抽屜打開在修改模式，內容正確', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '週報自動生成', instructions: '1. 產出週報', description: 't', assignedAgents: [] })
    await mountAt({ skillId: id })
    expect(body().find('.ssd-panel').exists()).toBe(true)
    expect(body().find('.banner-title').text()).toBe('修改技能')
    expect(body().find('.ssp-title').text()).toBe('週報自動生成')
  })

  it('點 X 關閉：無未儲存變更時直接關閉，query 清空', async () => {
    setActivePinia(createPinia())
    const { router } = await mountAt({ method: 'chat' })
    await body().find('.ssd-close-btn').trigger('click')
    await flushPromises()
    expect(popDialog.confirm).not.toHaveBeenCalled()
    expect(body().find('.ssd-panel').exists()).toBe(false)
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('點背景遮罩關閉：有未儲存變更時跳確認，取消則抽屜不關閉', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '週報自動生成', instructions: '1. 產出週報', description: 't', assignedAgents: [] })
    await mountAt({ skillId: id })
    // loadSkill() 之後 gateStage 已經是 'active'（修改模式不用再走一輪意圖分流），
    // 送一句改名訊息會直接命中 interpretStudioMessage 的改名規則，讓 draft 變 dirty，
    // 不用像建立模式那樣先走過整輪 gathering
    const input = body().find('.SkillStudioChat input.custom-input')
    await input.setValue('名稱改成「暫存中的修改」')
    await input.trigger('keydown.enter')
    await new Promise(r => setTimeout(r, 850))
    await flushPromises()

    await body().find('.ssd-mask').trigger('click')
    // router.push() 觸發的 onBeforeRouteUpdate 守衛（popDialog.confirm 在裡面呼叫）
    // 是非同步解析的；trigger('click') 只等到 Vue nextTick，還不夠讓守衛內的
    // promise chain 跑完，所以這裡多等一輪 flushPromises() 才能看到 confirm 被呼叫
    await flushPromises()
    expect(popDialog.confirm).toHaveBeenCalledWith('有未儲存的變更，確定要放棄嗎？', '放棄變更', '留下', expect.any(Function), expect.any(Function))
    expect(body().find('.ssd-panel').exists()).toBe(true)

    const [, , , onConfirm] = vi.mocked(popDialog.confirm).mock.calls[0]
    ;(onConfirm as () => void)()
    await flushPromises()
    expect(body().find('.ssd-panel').exists()).toBe(false)
  })

  it('抽屜開著時點另一顆技能的「編輯」：先跳確認，確認後換成新的編輯目標', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    const idA = store.createPersonalSkill({ name: '技能A', instructions: '1. A', description: 't', assignedAgents: [] })
    const idB = store.createPersonalSkill({ name: '技能B', instructions: '1. B', description: 't', assignedAgents: [] })
    const { router } = await mountAt({ skillId: idA })
    expect(body().find('.banner-title-row .ssc-mode-chip').text()).toContain('修改：技能A')

    // 直接改路由 query 模擬「在列表上點另一顆技能的編輯」（真正點擊路徑已由
    // createChoice/blockEditChoice 測試覆蓋，這裡只驗證抽屜開著時 query 變化的守衛行為）
    await router.push({ query: { skillId: idB } })
    await flushPromises()
    expect(popDialog.confirm).not.toHaveBeenCalled() // 技能A 沒有未儲存變更
    expect(body().find('.banner-title-row .ssc-mode-chip').text()).toContain('修改：技能B')
  })
})
