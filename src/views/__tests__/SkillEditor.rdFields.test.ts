import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillEditor from '@/views/SkillEditor.vue'
import { useSkillStore } from '@/stores/skillStore'

// RD 技能定義的步驟／例外／固定輸出格式／適用範圍：步驟必填、其餘選填，存檔時整組寫進技能
let currentWrapper: VueWrapper | null = null

async function mountEditor(query: Record<string, string> = {}) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/view/SkillEditor', name: 'SkillEditor', component: SkillEditor },
      { path: '/view/Skills', name: 'SkillManagement', component: { template: '<div/>' } },
    ],
  })
  await router.push({ path: '/view/SkillEditor', query })
  await router.isReady()
  const wrapper = mount({ template: '<router-view />' }, {
    global: { plugins: [router], stubs: { SkillTestAI: true } },
  })
  currentWrapper = wrapper
  await flushPromises()
  return { wrapper, editor: wrapper.findComponent(SkillEditor) }
}

describe('SkillEditor：RD 技能定義欄位', () => {
  beforeEach(() => { setActivePinia(createPinia()) })
  afterEach(() => { currentWrapper?.unmount(); currentWrapper = null })

  it('步驟必填：只有空白列時不能送出，提示「步驟」', async () => {
    const { wrapper, editor } = await mountEditor()
    const vm = editor.vm as any
    vm.form.name = '新技能'
    vm.form.capabilities = ['能力A']
    vm.form.assignedAgents = ['通用助理']
    vm.form.steps = ['  ']
    vm.currentStep = 2
    await wrapper.vm.$nextTick()
    expect(vm.canSubmit).toBe(false)
    expect(wrapper.find('.se-submit-missing-hint').text()).toContain('步驟')

    vm.form.steps = ['查詢資料']
    await wrapper.vm.$nextTick()
    expect(vm.canSubmit).toBe(true)
  })

  it('建立技能：步驟／例外濾掉空白列，四欄一起寫進技能', async () => {
    const store = useSkillStore()
    const { wrapper, editor } = await mountEditor()
    const vm = editor.vm as any
    vm.form.name = '查庫存'
    vm.form.capabilities = ['庫存查詢']
    vm.form.assignedAgents = ['通用助理']
    vm.form.steps = ['確認 SKU', '', '查詢庫存']
    vm.form.exceptions = ['查無 SKU 時請使用者確認', ' ']
    vm.form.outputFormat = ' 表格 '
    vm.form.applicableScope = '所有倉庫'
    vm.currentStep = 2
    await wrapper.vm.$nextTick()
    await wrapper.findAll('.se-footer button.custom-main-btn').find(b => b.text().includes('下一步'))!.trigger('click')
    await flushPromises()

    const created = store.findSkill(vm.createdSkillId)!
    expect(created.steps).toEqual(['確認 SKU', '查詢庫存'])
    expect(created.exceptions).toEqual(['查無 SKU 時請使用者確認'])
    expect(created.outputFormat).toBe('表格')
    expect(created.applicableScope).toBe('所有倉庫')
  })

  it('編輯既有技能：表單帶入原本的四欄內容', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({
      name: '既有', instructions: 'x', assignedAgents: [], capabilities: ['a'],
      steps: ['一', '二'], exceptions: ['例外'], outputFormat: '條列', applicableScope: '內部',
    })
    const { editor } = await mountEditor({ skillId: id })
    const vm = editor.vm as any
    expect(vm.form.steps).toEqual(['一', '二'])
    expect(vm.form.exceptions).toEqual(['例外'])
    expect(vm.form.outputFormat).toBe('條列')
    expect(vm.form.applicableScope).toBe('內部')
  })
})
