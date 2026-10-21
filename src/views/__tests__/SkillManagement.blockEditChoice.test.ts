import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillManagement from '../SkillManagement.vue'
import { useSkillStore } from '@/stores/skillStore'

// 用行銷積木組裝出來的技能（帶 composition）沒有「直接編輯」路徑可用：
// SkillEditor 是純文字三步驟精靈，不認得 composition，手改指令會讓文字跟
// 已選章節悄悄脫勾。這類技能的編輯選擇框只給一個「用積木面板編輯」入口。
describe('SkillManagement 編輯選擇框：積木組裝的技能只給積木面板入口', () => {
  let currentWrapper: VueWrapper | null = null

  // <Teleport to="body"> 的內容不會隨 wrapper 一起被 Vitest 回收，
  // 不手動 unmount 的話下一個 it() 會在 document.body 裡看到上一輪殘留的按鈕
  afterEach(() => {
    currentWrapper?.unmount()
    currentWrapper = null
  })

  async function mountPage() {
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div/>' } },
        { path: '/view/Skills', name: 'SkillManagement', component: SkillManagement },
        { path: '/view/SkillEditor', name: 'SkillEditor', component: { template: '<div/>' } },
      ],
    })
    await router.push('/view/Skills')
    await router.isReady()
    const wrapper = mount(
      { template: '<router-view />' },
      { global: { plugins: [router], stubs: { AppBreadcrumb: true, LibraryBrowseModal: true, SkillDetailDrawer: true, UpstreamUpdateDrawer: true, SkillReviewDrawer: true, BatchUpdateModal: true } } },
    )
    currentWrapper = wrapper
    return { wrapper: wrapper.findComponent(SkillManagement), router }
  }

  it('composition 技能：只顯示「用積木面板編輯」，沒有「直接編輯」；點擊導向 AI 賦能', async () => {
    setActivePinia(createPinia())
    const { wrapper, router } = await mountPage()
    const store = useSkillStore()
    const push = vi.spyOn(router, 'push')
    const skillId = store.createPersonalSkill({
      name: '行銷週報',
      instructions: '依序產出以下章節：\n1. 促銷核心 KPI：完成訂單數、GMV、折扣總額、折扣佔比、規則數。',
      description: '當使用者要求產出行銷報告，或提到「行銷活動成效」相關分析時',
      isEnabled: true,
      assignedAgents: [],
      composition: { sectionIds: ['promo_kpi'] },
      creationMethod: 'manual',
    })
    const skill = store.findSkill(skillId)!
    ;(wrapper.vm as any).editChoiceSkill = skill
    await wrapper.vm.$nextTick()

    const buttons = new DOMWrapper(document.body).findAll('.drawer-confirm-dialog button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].text()).toContain('用積木面板編輯')
    expect(buttons.some(b => b.text().includes('直接編輯'))).toBe(false)

    await buttons[0].trigger('click')
    expect(push).toHaveBeenCalledWith({ query: { skillId } })
    expect((wrapper.vm as any).editChoiceSkill).toBeNull()
  })

  it('沒有 composition 的技能：維持原本兩個選項（跟 Agent 對話修改／直接編輯）', async () => {
    setActivePinia(createPinia())
    const { wrapper } = await mountPage()
    const store = useSkillStore()
    const skill = store.myPersonalSkills.find(s => !s.composition)!
    expect(skill).toBeDefined()
    ;(wrapper.vm as any).editChoiceSkill = skill
    await wrapper.vm.$nextTick()

    const buttons = new DOMWrapper(document.body).findAll('.drawer-confirm-dialog button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].text()).toContain('跟 Agent 對話修改')
    expect(buttons[1].text()).toContain('直接編輯')
  })

  it('複製 composition 技能後的複本，編輯選擇框同樣只給積木面板入口', async () => {
    setActivePinia(createPinia())
    const { wrapper } = await mountPage()
    const store = useSkillStore()
    const sourceId = store.createPersonalSkill({
      name: '渠道週報',
      instructions: '依序產出以下章節：\n1. 渠道核心 KPI：各渠道工作階段數、轉換率、收益、每工作階段收益。',
      description: 't',
      isEnabled: true,
      assignedAgents: [],
      composition: { sectionIds: ['ch_kpi'] },
      creationMethod: 'manual',
    })
    const copy = store.duplicateAsPersonalSkill(sourceId)
    expect(copy.composition).toEqual({ sectionIds: ['ch_kpi'] })

    ;(wrapper.vm as any).editChoiceSkill = copy
    ;(wrapper.vm as any).editChoiceIsFreshDuplicate = true
    await wrapper.vm.$nextTick()

    const buttons = new DOMWrapper(document.body).findAll('.drawer-confirm-dialog button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].text()).toContain('用積木面板編輯')
  })
})
