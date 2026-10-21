import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSkillStore } from '@/stores/skillStore'
import type { SkillSuggestionEntry } from '@/stores/skillStore'

const ENTRY: SkillSuggestionEntry = {
  id: 'conv4-sales-report',
  name: '產品銷售報告整理',
  description: '查詢指定月份產品銷售數據，並依三諾產品部輸出報告規範自動產出報告',
  steps: ['查詢指定月份產品銷售數據', '套用三諾產品部輸出報告規範自動產出報告'],
  reason: '查詢銷售資料＋套用部門報告規範',
  conversationId: 'conv4',
}

describe('skillStore 建議建立的技能佇列', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 預設佇列裡有幾筆示範假資料（見 skillStore.ts 的 MOCK_SUGGESTIONS），
    // 這裡測的是 addSuggestion/dismissSuggestion 本身的行為，先清掉才有乾淨的起點
    const store = useSkillStore()
    store.pendingSuggestions.map(s => s.id).forEach(id => store.dismissSuggestion(id))
  })

  it('addSuggestion 後會出現在 pendingSuggestions', () => {
    const store = useSkillStore()
    expect(store.pendingSuggestions).toEqual([])
    store.addSuggestion(ENTRY)
    expect(store.pendingSuggestions).toEqual([ENTRY])
  })

  it('同一個 id 重複 addSuggestion 不會產生重複項目', () => {
    const store = useSkillStore()
    store.addSuggestion(ENTRY)
    store.addSuggestion(ENTRY)
    expect(store.pendingSuggestions).toHaveLength(1)
  })

  it('dismissSuggestion 依 id 移除', () => {
    const store = useSkillStore()
    store.addSuggestion(ENTRY)
    store.dismissSuggestion(ENTRY.id)
    expect(store.pendingSuggestions).toEqual([])
  })
})
