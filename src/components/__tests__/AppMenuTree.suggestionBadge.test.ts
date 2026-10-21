import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import AppMenuTree from '../AppMenuTree.vue'
import { useSkillStore } from '@/stores/skillStore'

// 「技能管理」旁的 AI 建議數量徽章：AiViewer 產生建議後只會顯示在技能管理頁面
// 本身，這裡加一個數字提醒，避免使用者沒點進去就完全不知道有新建議。
describe('AppMenuTree「技能管理」旁的 AI 建議徽章', () => {
  async function mountTree() {
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: '/', component: { template: '<div/>' } }],
    })
    return mount(AppMenuTree, { global: { plugins: [router] } })
  }

  it('沒有待處理建議時，桌機版不顯示徽章', async () => {
    setActivePinia(createPinia())
    // 預設佇列裡有幾筆示範假資料（見 skillStore.ts 的 MOCK_SUGGESTIONS），
    // 這裡測的是真的清空之後的樣子，先清掉才有乾淨的起點
    const store = useSkillStore()
    store.pendingSuggestions.map(s => s.id).forEach(id => store.dismissSuggestion(id))
    const wrapper = await mountTree()
    const skillLink = wrapper.findAll('.side-panel-sub a').find(a => a.text().includes('技能管理'))!
    expect(skillLink.find('.nav-suggestion-badge').exists()).toBe(false)
  })

  it('有 2 個待處理建議時，桌機版顯示數字 2', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    store.pendingSuggestions.map(s => s.id).forEach(id => store.dismissSuggestion(id))
    store.addSuggestion({
      id: 's1', name: '技能A', description: 'x',
      steps: [], reason: 'r1', conversationId: 'conv4',
    })
    store.addSuggestion({
      id: 's2', name: '技能B', description: 'x',
      steps: [], reason: 'r2', conversationId: 'conv4',
    })
    const wrapper = await mountTree()
    const skillLink = wrapper.findAll('.side-panel-sub a').find(a => a.text().includes('技能管理'))!
    const badge = skillLink.find('.nav-suggestion-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('2')
  })

  it('手機版也同步顯示徽章數字', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    store.pendingSuggestions.map(s => s.id).forEach(id => store.dismissSuggestion(id))
    store.addSuggestion({
      id: 's1', name: '技能A', description: 'x',
      steps: [], reason: 'r1', conversationId: 'conv4',
    })
    const wrapper = await mountTree()
    await wrapper.find('.hamburger-btn').trigger('click')
    const mobileLink = wrapper.findAll('.mobile-sub').find(a => a.text().includes('技能管理'))!
    expect(mobileLink.find('.nav-suggestion-badge').text()).toBe('1')
  })
})
