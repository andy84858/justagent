import { describe, it, expect } from 'vitest'
import { generateSkillDescription } from '../skillDescription'

describe('generateSkillDescription', () => {
  it('適用範圍＋步驟＋輸出格式串成一句', () => {
    expect(generateSkillDescription({
      name: '查庫存', steps: ['確認產品 ID', '查詢庫存'], applicableScope: '所有倉庫', outputFormat: '表格',
    })).toBe('針對所有倉庫，確認產品 ID、查詢庫存，並以「表格」輸出結果')
  })

  it('步驟超過三個只列前三個加「等」；空白步驟略過；沒有範圍與格式就不加前後綴', () => {
    expect(generateSkillDescription({ name: 'x', steps: ['a', ' ', 'b', 'c', 'd'] })).toBe('a、b、c等')
  })

  it('沒有步驟：退回技能名稱', () => {
    expect(generateSkillDescription({ name: ' 查庫存 ', steps: [] })).toBe('查庫存')
  })
})
