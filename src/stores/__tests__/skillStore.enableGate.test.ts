import { describe, it, expect } from 'vitest'
import { canEnableSkill, describeAiTestGateReason, isSkillTested } from '@/stores/skillStore'
import type { Skill } from '@/stores/skillStore'

function baseSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'x', name: 'x', description: '', type: 'extension', origin: 'manually_created',
    version: '初始版本', isEnabled: false, usageCount: 0, testPassRate: 0, avgLatencyMs: 0,
    zone: 'personal',
    ...overrides,
  }
}

// 啟用只看「這一版測過沒有」，不要求全對（ADR 0014）
describe('canEnableSkill', () => {
  it('從沒測過（aiTestPassRate 是 undefined 或 null）：不能啟用', () => {
    expect(canEnableSkill(baseSkill())).toBe(false)
    expect(canEnableSkill(baseSkill({ aiTestPassRate: null }))).toBe(false)
  })

  it('測過且全對：可以啟用', () => {
    expect(canEnableSkill(baseSkill({ aiTestPassRate: 1 }))).toBe(true)
  })

  it('測過但有題目不一致（沒全對，甚至 0 分）：照樣可以啟用', () => {
    expect(canEnableSkill(baseSkill({ aiTestPassRate: 0.5 }))).toBe(true)
    expect(canEnableSkill(baseSkill({ aiTestPassRate: 0 }))).toBe(true)
  })

  it('後端技能：看後端記的「測過」記號，不看 aiTestPassRate', () => {
    expect(canEnableSkill(baseSkill({ backendVersion: { version: 2, tested: true } }))).toBe(true)
    expect(canEnableSkill(baseSkill({ backendVersion: { version: 2, tested: false }, aiTestPassRate: 1 }))).toBe(false)
    expect(isSkillTested(baseSkill({ backendVersion: { version: 1, tested: false } }))).toBe(false)
  })

  it('非個人技能（zone 不是 personal）：一律視為可以啟用，不受這條規則限制', () => {
    expect(canEnableSkill(baseSkill({ zone: 'library', aiTestPassRate: null }))).toBe(true)
    expect(canEnableSkill(baseSkill({ zone: undefined, aiTestPassRate: null }))).toBe(true)
  })
})

describe('describeAiTestGateReason', () => {
  it('沒測過：說清楚要先測試，交卷就算、不用全對', () => {
    const reason = describeAiTestGateReason(baseSkill())
    expect(reason).toContain('還沒測過')
    expect(reason).toContain('不用全部答對')
  })
})
