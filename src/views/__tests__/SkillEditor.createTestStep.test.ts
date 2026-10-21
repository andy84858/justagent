import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillEditor from '@/views/SkillEditor.vue'
import SkillTestAI from '@/components/Skill/SkillTestAI.vue'
import { useSkillStore } from '@/stores/skillStore'

let currentWrapper: VueWrapper | null = null

function mountRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/view/SkillEditor', name: 'SkillEditor', component: SkillEditor },
      { path: '/view/Skills', name: 'SkillManagement', component: { template: '<div/>' } },
    ],
  })
}

async function mountCreate() {
  const router = mountRouter()
  await router.push('/view/SkillEditor')
  await router.isReady()
  const wrapper = mount({ template: '<router-view />' }, {
    global: { plugins: [router], stubs: { SkillTestAI: true } },
  })
  currentWrapper = wrapper
  await flushPromises()
  return { wrapper, router }
}

async function mountEditFor(skillId: string) {
  const router = mountRouter()
  await router.push({ path: '/view/SkillEditor', query: { skillId } })
  await router.isReady()
  const wrapper = mount({ template: '<router-view />' }, {
    global: { plugins: [router], stubs: { SkillTestAI: true } },
  })
  currentWrapper = wrapper
  await flushPromises()
  return { wrapper, router }
}

describe('SkillEditor 全新建立多一個「測試」步驟', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    currentWrapper?.unmount()
    currentWrapper = null
  })

  it('建立模式的步驟指示器有 4 格，最後一格是「測試」', async () => {
    const { wrapper } = await mountCreate()
    const labels = wrapper.findAll('.se-step-label').map(l => l.text())
    expect(labels).toEqual(['基本資訊', '技能內文', '確認', '測試'])
  })

  it('編輯既有技能：步驟指示器維持 3 格，沒有「測試」', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '既有技能', instructions: 'x', description: 'y', assignedAgents: [] })
    const { wrapper } = await mountEditFor(id)
    const labels = wrapper.findAll('.se-step-label').map(l => l.text())
    expect(labels).toEqual(['基本資訊', '技能內文', '確認'])
  })

  it('確認步驟按「下一步」：立即建立技能（未啟用）、留在編輯頁、切到測試步驟並渲染對應 skillId 的 SkillTestAI', async () => {
    const store = useSkillStore()
    const { wrapper, router } = await mountCreate()
    const editor = wrapper.findComponent(SkillEditor)
    ;(editor.vm as any).form.name = '全新技能A'
    ;(editor.vm as any).form.description = '當使用者需要這個技能時'
    ;(editor.vm as any).form.capabilities = ['能力A']
    ;(editor.vm as any).form.assignedAgents = ['通用助理']
    ;(editor.vm as any).currentStep = 2
    await wrapper.vm.$nextTick()

    const nextBtn = wrapper.findAll('.se-footer button.custom-main-btn').find(b => b.text().includes('下一步'))
    expect(nextBtn).toBeTruthy()
    await nextBtn!.trigger('click')
    await flushPromises()

    const created = store.myPersonalSkills.find(s => s.name === '全新技能A')
    expect(created).toBeDefined()
    expect(created!.isEnabled).toBe(false)

    expect(router.currentRoute.value.path).toBe('/view/SkillEditor') // 還沒離開編輯頁
    const testAi = wrapper.findComponent(SkillTestAI)
    expect(testAi.exists()).toBe(true)
    expect(testAi.props('skillId')).toBe(created!.id)
  })

  it('測試步驟按「完成」才導回技能管理頁，且不會顯示「取消」按鈕', async () => {
    const { wrapper, router } = await mountCreate()
    const editor = wrapper.findComponent(SkillEditor)
    ;(editor.vm as any).form.name = '全新技能B'
    ;(editor.vm as any).form.description = '當使用者需要這個技能時'
    ;(editor.vm as any).form.capabilities = ['能力A']
    ;(editor.vm as any).form.assignedAgents = ['通用助理']
    ;(editor.vm as any).currentStep = 2
    await wrapper.vm.$nextTick()
    await wrapper.findAll('.se-footer button.custom-main-btn').find(b => b.text().includes('下一步'))!.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.se-footer-right button').some(b => b.text() === '取消')).toBe(false)

    const doneBtn = wrapper.findAll('.se-footer button.custom-main-btn').find(b => b.text().includes('完成'))
    expect(doneBtn).toBeTruthy()
    await doneBtn!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/view/Skills')
  })

  it('技能建立後，「基本資訊」「技能內文」步驟鎖定不能再點回去，「確認」仍可切回', async () => {
    const { wrapper } = await mountCreate()
    const editor = wrapper.findComponent(SkillEditor)
    ;(editor.vm as any).form.name = '全新技能C'
    ;(editor.vm as any).form.description = '當使用者需要這個技能時'
    ;(editor.vm as any).form.capabilities = ['能力A']
    ;(editor.vm as any).form.assignedAgents = ['通用助理']
    ;(editor.vm as any).currentStep = 2
    await wrapper.vm.$nextTick()
    await wrapper.findAll('.se-footer button.custom-main-btn').find(b => b.text().includes('下一步'))!.trigger('click')
    await flushPromises()

    const steps = wrapper.findAll('.se-step')
    expect(steps[0].attributes('disabled')).toBeDefined() // 基本資訊：鎖定
    expect(steps[1].attributes('disabled')).toBeDefined() // 技能內文：鎖定
    expect(steps[2].attributes('disabled')).toBeUndefined() // 確認：仍可切回查看

    await steps[2].trigger('click')
    expect((editor.vm as any).currentStep).toBe(2)
    // 回到確認步驟後，不應該再顯示「上一步」（會通往被鎖定的技能內文步驟）
    expect(wrapper.findAll('.se-footer button').some(b => b.text().includes('上一步'))).toBe(false)
  })

  it('從測試步驟按「上一步」回到確認步驟是允許的（唯讀畫面）', async () => {
    const { wrapper } = await mountCreate()
    const editor = wrapper.findComponent(SkillEditor)
    ;(editor.vm as any).form.name = '全新技能D'
    ;(editor.vm as any).form.description = '當使用者需要這個技能時'
    ;(editor.vm as any).form.capabilities = ['能力A']
    ;(editor.vm as any).form.assignedAgents = ['通用助理']
    ;(editor.vm as any).currentStep = 2
    await wrapper.vm.$nextTick()
    await wrapper.findAll('.se-footer button.custom-main-btn').find(b => b.text().includes('下一步'))!.trigger('click')
    await flushPromises()

    const backBtn = wrapper.findAll('.se-footer button').find(b => b.text().includes('上一步'))
    expect(backBtn).toBeTruthy()
    await backBtn!.trigger('click')
    expect((editor.vm as any).currentStep).toBe(2)
  })

  it('反覆在確認／測試步驟之間切換不會重複建立技能', async () => {
    const store = useSkillStore()
    const { wrapper } = await mountCreate()
    const editor = wrapper.findComponent(SkillEditor)
    ;(editor.vm as any).form.name = '全新技能E'
    ;(editor.vm as any).form.description = '當使用者需要這個技能時'
    ;(editor.vm as any).form.capabilities = ['能力A']
    ;(editor.vm as any).form.assignedAgents = ['通用助理']
    ;(editor.vm as any).currentStep = 2
    await wrapper.vm.$nextTick()
    await wrapper.findAll('.se-footer button.custom-main-btn').find(b => b.text().includes('下一步'))!.trigger('click')
    await flushPromises()

    ;(editor.vm as any).currentStep = 2
    await wrapper.vm.$nextTick()
    await wrapper.findAll('.se-footer button.custom-main-btn').find(b => b.text().includes('下一步'))!.trigger('click')
    await flushPromises()

    expect(store.myPersonalSkills.filter(s => s.name === '全新技能E').length).toBe(1)
  })
})
