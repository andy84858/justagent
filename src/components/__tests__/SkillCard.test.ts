import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SkillCard from '@/components/Skill/SkillCard.vue'
import type { Skill } from '@/stores/skillStore'

function baseSkill(over: Partial<Skill> = {}): Skill {
  return {
    id: 's1',
    name: '測試技能',
    description: '',
    type: 'extension',
    origin: 'manually_created',
    version: '1.0.0',
    isEnabled: true,
    usageCount: 0,
    testPassRate: 0,
    avgLatencyMs: 0,
    ...over,
  }
}

function mountCard(skill: Skill, isExtension = false) {
  return mount(SkillCard, { props: { skill, isExtension } })
}

describe('SkillCard：skillIconName（怎麼來的一眼圖示）', () => {
  it('積木組成（composition）：dashboard_customize', () => {
    const w = mountCard(baseSkill({ composition: { sectionIds: ['x'] } } as Partial<Skill>))
    expect(w.find('.skill-card-icon .material-symbols-outlined').text()).toBe('dashboard_customize')
  })

  it('AI 賦能對話建立（ai_assisted）：forum', () => {
    const w = mountCard(baseSkill({ creationMethod: 'ai_assisted' }))
    expect(w.find('.skill-card-icon .material-symbols-outlined').text()).toBe('forum')
  })

  it('真的自建（沒有 forkSourceId／derivedFrom）：edit（跟 SkillDetailDrawer「自建」一致）', () => {
    const w = mountCard(baseSkill())
    expect(w.find('.skill-card-icon .material-symbols-outlined').text()).toBe('edit')
  })

  it('有血緣（forkSourceId 或 derivedFrom）：依 isExtension 維持原本的 extension／psychology，不誤判成自建', () => {
    const forked = mountCard(baseSkill({ forkSourceId: 'sys-001' }), true)
    expect(forked.find('.skill-card-icon .material-symbols-outlined').text()).toBe('extension')

    const derived = mountCard(baseSkill({ derivedFrom: 'sys-002' }), false)
    expect(derived.find('.skill-card-icon .material-symbols-outlined').text()).toBe('psychology')
  })
})

describe('SkillCard：沒有「視為通過」警示', () => {
  it('啟用中的技能不再顯示強制啟用的警示圖示（視為通過已移除）', () => {
    const w = mountCard(baseSkill({ isEnabled: true, aiTestPassRate: 0.5 }))
    expect(w.find('.status-override-icon').exists()).toBe(false)
  })
})
