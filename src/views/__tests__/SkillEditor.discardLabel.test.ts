import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillEditor from '@/views/SkillEditor.vue'
import { useSkillStore } from '@/stores/skillStore'

// 編輯模式的 form 只是從既有技能複製出來改的，沒按「儲存變更」就離開不會動到
// 原本的技能——左下角這顆鍵用「放棄修改」取代泛用的「取消」，講清楚點了會發生
// 什麼事；建立模式沒有「原本版本」可以放棄回去，維持「取消」
let currentWrapper: VueWrapper | null = null

async function mountEditorFor(query: Record<string, string>) {
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
  const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
  currentWrapper = wrapper
  await flushPromises()
  return { wrapper, router }
}

describe('SkillEditor 放棄/取消按鈕文字', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    currentWrapper?.unmount()
    currentWrapper = null
  })

  it('建立模式：按鈕顯示「取消」', async () => {
    const { wrapper } = await mountEditorFor({})
    const btn = wrapper.find('.se-footer-right button')
    expect(btn.text()).toBe('取消')
  })

  it('編輯模式：按鈕顯示「放棄修改」，點擊導向技能管理頁、不寫回任何變更', async () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '原本名稱', instructions: 'x', description: 'y', assignedAgents: [] })
    const { wrapper, router } = await mountEditorFor({ skillId: id })
    const nameInput = wrapper.find('input.custom-input')
    await nameInput.setValue('亂改的名字')

    const btn = wrapper.find('.se-footer-right button')
    expect(btn.text()).toBe('放棄修改')
    await btn.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/view/Skills')
    expect(store.findSkill(id)!.name).toBe('原本名稱')
  })
})
