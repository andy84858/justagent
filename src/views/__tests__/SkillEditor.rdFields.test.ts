import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillEditor from '@/views/SkillEditor.vue'
import { useSkillStore } from '@/stores/skillStore'

// RD 技能定義的步驟／例外／固定輸出格式／適用範圍：精靈只有一個技能內文輸入框，
// 存檔時依標題拆成四項；步驟必填、其餘選填
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

  it('步驟必填：技能內文拆不出步驟時不能送出，提示「步驟」', async () => {
    const { wrapper, editor } = await mountEditor()
    const vm = editor.vm as any
    vm.form.name = '新技能'
    vm.form.capabilities = ['能力A']
    vm.form.assignedAgents = ['通用助理']
    vm.form.content = '## 固定輸出格式\n表格'
    vm.currentStep = 2
    await wrapper.vm.$nextTick()
    expect(vm.canSubmit).toBe(false)
    expect(wrapper.find('.se-submit-missing-hint').text()).toContain('步驟')

    vm.form.content = '## 步驟\n1. 查詢資料'
    await wrapper.vm.$nextTick()
    expect(vm.canSubmit).toBe(true)
  })

  it('建立技能：技能內文原文存成 instructions，依標題拆出的四項一起寫進技能', async () => {
    const store = useSkillStore()
    const { wrapper, editor } = await mountEditor()
    const vm = editor.vm as any
    vm.form.name = '查庫存'
    vm.form.capabilities = ['庫存查詢']
    vm.form.assignedAgents = ['通用助理']
    vm.form.content = '## 步驟\n1. 確認 SKU\n2. 查詢庫存\n\n## 例外或特殊情況\n- 查無 SKU 時請使用者確認\n\n## 固定輸出格式\n表格\n\n## 適用範圍\n所有倉庫'
    vm.currentStep = 2
    await wrapper.vm.$nextTick()
    await wrapper.findAll('.se-footer button.custom-main-btn').find(b => b.text().includes('下一步'))!.trigger('click')
    await flushPromises()

    const created = store.findSkill(vm.createdSkillId)!
    expect(created.steps).toEqual(['確認 SKU', '查詢庫存'])
    expect(created.exceptions).toEqual(['查無 SKU 時請使用者確認'])
    expect(created.outputFormat).toBe('表格')
    expect(created.applicableScope).toBe('所有倉庫')
    // 技能描述不給使用者填，由 Agent 依內容生成
    expect(created.description).toBe('針對所有倉庫，確認 SKU、查詢庫存，並以「表格」輸出結果')
    expect(created.instructions).toBe(vm.form.content)
  })

  it('新建：確認頁顯示 AI 生成的技能描述並掛「AI 建立」tag；編輯既有技能沿用原本的描述、不掛 tag', async () => {
    const store = useSkillStore()
    const { wrapper, editor } = await mountEditor()
    const vm = editor.vm as any
    vm.form.name = '查庫存'
    vm.form.content = '## 步驟\n1. 查詢庫存'
    vm.currentStep = 2
    await wrapper.vm.$nextTick()
    expect(vm.finalDescription).toBe('查詢庫存')
    const descRow = wrapper.findAll('.se-confirm-row').find(r => r.text().includes('技能描述'))!
    expect(descRow.text()).toContain('查詢庫存')
    expect(descRow.find('.se-generated-tag').text()).toContain('AI 建立')
    wrapper.unmount()

    const id = store.createPersonalSkill({ name: '既有', description: '原本的描述', instructions: 'x', assignedAgents: [], steps: ['改過的步驟'] })
    const edit = await mountEditor({ skillId: id })
    const editVm = edit.editor.vm as any
    expect(editVm.finalDescription).toBe('原本的描述')
    editVm.currentStep = 2
    await edit.wrapper.vm.$nextTick()
    const editRow = edit.wrapper.findAll('.se-confirm-row').find(r => r.text().includes('技能描述'))!
    expect(editRow.text()).toContain('原本的描述')
    expect(editRow.find('.se-generated-tag').exists()).toBe(false)
  })

  it('編輯既有技能：有 RD 四項就組回標題格式帶進技能內文，拆得回原本的四項', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({
      name: '既有', instructions: 'x', assignedAgents: [], capabilities: ['a'],
      steps: ['一', '二'], exceptions: ['例外'], outputFormat: '條列', applicableScope: '內部',
    })
    const { editor } = await mountEditor({ skillId: id })
    const vm = editor.vm as any
    expect(vm.form.content).toContain('## 步驟')
    expect(vm.parsedContent).toEqual({ steps: ['一', '二'], exceptions: ['例外'], outputFormat: '條列', applicableScope: '內部' })
  })
})
