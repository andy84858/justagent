import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillTest from '../SkillTest.vue'
import { useSkillStore } from '@/stores/skillStore'

// 積木組裝的技能（composition 不為空）：對話模擬（SkillTestChat）對它沒有意義，
// 改用跟 SkillStudio 工作區一致的是非題 AI 快速測試（SkillTestAI），取代原本已移除的
// 「一鍵產生範例成果」區塊
describe('SkillTest 測試面板：依建立方式切換元件', () => {
  function mountPage() {
    const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', component: { template: '<div/>' } }] })
    return mount(SkillTest, {
      global: { plugins: [router], stubs: { SkillTestChat: true, SkillTestAI: true } },
    })
  }

  it('積木組裝的技能：顯示 SkillTestAI，不顯示 SkillTestChat', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    const id = store.createPersonalSkill({
      name: '行銷週報', instructions: '依序產出以下章節：\n1. a', triggerHint: '當使用者要求產出行銷報告時', assignedAgents: [],
      composition: { sectionIds: ['promo_kpi'] },
    })
    const wrapper = mountPage()
    store.setSelectedSkill(id)
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent({ name: 'SkillTestAI' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'SkillTestChat' }).exists()).toBe(false)
  })

  it('對話建立的技能（沒有 composition）：顯示 SkillTestChat，不顯示 SkillTestAI', async () => {
    setActivePinia(createPinia())
    const store = useSkillStore()
    const id = store.createPersonalSkill({
      name: '一般技能', instructions: 'x', triggerHint: 'y', assignedAgents: [],
    })
    const wrapper = mountPage()
    store.setSelectedSkill(id)
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent({ name: 'SkillTestChat' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'SkillTestAI' }).exists()).toBe(false)
  })
})
