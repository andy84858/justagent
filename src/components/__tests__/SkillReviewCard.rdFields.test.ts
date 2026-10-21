import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SkillReviewCard from '@/components/Skill/SkillReviewCard.vue'
import { useSkillStore } from '@/stores/skillStore'

// 待審核區：審核卡片直接顯示 RD 技能定義（預設展開），不用點進詳情才看得到
describe('SkillReviewCard：技能定義', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('待審核的技能都帶 RD 步驟，卡片預設展開技能定義六段', () => {
    const store = useSkillStore()
    expect(store.pendingReviewSkills.length).toBeGreaterThan(0)
    for (const skill of store.pendingReviewSkills) {
      expect(skill.steps?.length).toBeGreaterThan(0)
      const w = mount(SkillReviewCard, { props: { skill }, global: { stubs: { Teleport: true } } })
      const def = w.find('.src-definition')
      expect(def.isVisible()).toBe(true)
      for (const heading of ['技能描述', '步驟', '例外或特殊情況', '固定輸出格式', '適用範圍']) {
        expect(def.text()).toContain(heading)
      }
      w.unmount()
    }
  })
})
