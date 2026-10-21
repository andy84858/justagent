import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SkillDetailDrawer from '@/components/Skill/SkillDetailDrawer.vue'
import type { Skill } from '@/stores/skillStore'

// 草稿不另外貼標籤（草稿就是「尚未測試／停用中」），跟我的技能卡片一致
function personal(over: Partial<Skill>): Skill {
  return {
    id: 'p-draft', name: '複製的技能', description: '', type: 'extension', origin: 'custom_version',
    version: '1.0.0', isEnabled: false, usageCount: 0, testPassRate: 0, avgLatencyMs: 0,
    zone: 'personal', aiTestPassRate: null, ...over,
  }
}

describe('SkillDetailDrawer：個人技能狀態標籤', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('草稿顯示「可使用」，不出現「草稿」', () => {
    const w = mount(SkillDetailDrawer, { props: { skill: personal({ personalStatus: 'draft' }) }, global: { stubs: { Teleport: true } } })
    const tag = w.find('.tag--available')
    expect(tag.exists()).toBe(true)
    expect(tag.text()).toBe('可使用')
    expect(w.find('.tag--draft').exists()).toBe(false)
  })

  it('審核中仍顯示「審核中」', () => {
    const w = mount(SkillDetailDrawer, { props: { skill: personal({ personalStatus: 'reviewing' }) }, global: { stubs: { Teleport: true } } })
    expect(w.find('.tag--reviewing').text()).toBe('審核中')
  })
})
