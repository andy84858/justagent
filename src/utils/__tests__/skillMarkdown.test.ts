import { describe, it, expect } from 'vitest'
import { buildSkillDefinitionMarkdown, buildSkillMarkdown } from '../skillMarkdown'
import type { Skill } from '@/stores/skillStore'

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'test-1',
    name: '測試技能',
    description: '測試用',
    type: 'extension',
    origin: 'manually_created',
    version: '1.0.0',
    isEnabled: false,
    usageCount: 0,
    testPassRate: 0,
    avgLatencyMs: 0,
    ...overrides,
  }
}

// 覆蓋能力改成純 hashtag 陣列：技能定義 markdown 的「覆蓋能力」段落從條列
// 「- **名稱**：說明」改成一行 hashtag，沒有能力就整段不出現
describe('buildSkillDefinitionMarkdown', () => {
  it('有覆蓋能力：輸出「## 覆蓋能力」段落，一行 hashtag、空白分隔', () => {
    const md = buildSkillDefinitionMarkdown(makeSkill({ capabilities: ['問題分類', '資料查詢'] }))
    expect(md).toContain('## 覆蓋能力')
    expect(md).toContain('#問題分類 #資料查詢')
  })

  it('沒有覆蓋能力：不出現「## 覆蓋能力」段落', () => {
    const md = buildSkillDefinitionMarkdown(makeSkill({ capabilities: [] }))
    expect(md).not.toContain('覆蓋能力')
  })

  it('依 RD 六段順序組合，段落間空行分隔', () => {
    const md = buildSkillDefinitionMarkdown(makeSkill({
      description: '查詢訂單狀態',
      steps: ['確認訂單編號', '回覆訂單狀態'],
      exceptions: ['查無訂單時請使用者確認編號'],
      outputFormat: '一句話回覆',
      applicableScope: '電商訂單',
      capabilities: ['訂單查詢'],
    }))
    expect(md).toBe(
      '## 技能描述\n\n查詢訂單狀態\n\n## 步驟\n\n1. 確認訂單編號\n2. 回覆訂單狀態\n\n' +
      '## 例外或特殊情況\n\n- 查無訂單時請使用者確認編號\n\n## 固定輸出格式\n\n一句話回覆\n\n' +
      '## 適用範圍\n\n電商訂單\n\n## 覆蓋能力\n\n#訂單查詢'
    )
  })

  it('技能指令、使用情境不在 RD 定義裡，不出現在技能定義', () => {
    const md = buildSkillDefinitionMarkdown(makeSkill({
      instructions: '依序處理訂單查詢',
      usageScenarios: [{ title: '查詢訂單', description: '使用者詢問訂單狀態時自動回覆' }],
    }))
    expect(md).not.toContain('依序處理訂單查詢')
    expect(md).not.toContain('使用情境')
  })
})

describe('buildSkillMarkdown', () => {
  it('完整 skill.md 含 frontmatter 與覆蓋能力 hashtag', () => {
    const md = buildSkillMarkdown(makeSkill({ capabilities: ['問題分類'] }))
    expect(md).toContain('name: 測試技能')
    expect(md).toContain('#問題分類')
  })
})
