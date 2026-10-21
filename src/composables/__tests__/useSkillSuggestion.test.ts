import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSkillSuggestion, suggestionToPrefill, suggestionOpeningMessage } from '@/composables/useSkillSuggestion'
import type { SkillSuggestion } from '@/composables/useSkillSuggestion'
import { useSkillStore } from '@/stores/skillStore'

const SUGGESTION: SkillSuggestion = {
  id: 'conv4-sales-report',
  name: '產品銷售報告整理',
  description: '查詢指定月份產品銷售數據，並依三諾產品部輸出報告規範自動產出報告',
  steps: ['查詢指定月份產品銷售數據', '套用三諾產品部輸出報告規範自動產出報告'],
  reason: '查詢銷售資料＋套用部門報告規範',
}

function makeCtx() {
  const msgs: any[] = []
  const scrolled: boolean[] = []
  return { msgs, ctx: { push: (m: any) => msgs.push(m), scroll: () => scrolled.push(true), conversationId: 'conv4' }, scrolled }
}

describe('suggestionToPrefill / suggestionOpeningMessage', () => {
  it('步驟編號成指令、每步一項能力；開場訊息含 reason', () => {
    const p = suggestionToPrefill(SUGGESTION)
    expect(p.name).toBe('產品銷售報告整理')
    expect(p.description).toBe(SUGGESTION.description)
    expect(p.instructions).toBe('1. 查詢指定月份產品銷售數據\n2. 套用三諾產品部輸出報告規範自動產出報告')
    expect(p.capabilities).toEqual(SUGGESTION.steps)
    expect(suggestionOpeningMessage(SUGGESTION)).toBe('這顆技能來自本對話的「查詢銷售資料＋套用部門報告規範」流程，設定我先填好了。想調整就直接說，確認後按「儲存為個人技能」。')
  })
})

describe('useSkillSuggestion', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 預設佇列裡有幾筆示範假資料（見 skillStore.ts 的 MOCK_SUGGESTIONS），
    // 這裡測的是 offer() 本身放進佇列的行為，先清掉才有乾淨的起點
    const store = useSkillStore()
    store.pendingSuggestions.map(s => s.id).forEach(id => store.dismissSuggestion(id))
  })

  it('offer 把建議放進 skillStore 的待處理佇列', () => {
    const store = useSkillStore()
    const { ctx } = makeCtx()
    useSkillSuggestion().offer(ctx, SUGGESTION)
    expect(store.pendingSuggestions).toEqual([{ ...SUGGESTION, conversationId: 'conv4' }])
  })

  it('offer 只推一則單向通知訊息，不帶任何按鈕', () => {
    const { msgs, ctx, scrolled } = makeCtx()
    useSkillSuggestion().offer(ctx, SUGGESTION)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toMatchObject({ agent: 'brain', finishResponse: true })
    expect(msgs[0].cardType).toBeUndefined()
    expect(msgs[0].msg).toContain(SUGGESTION.reason)
    expect(msgs[0].msg).toContain('技能管理')
    expect(scrolled).toEqual([true])
  })

  it('同一個建議 offer 兩次不會在佇列裡重複、也不會重複推訊息', () => {
    const store = useSkillStore()
    const { msgs, ctx } = makeCtx()
    const s = useSkillSuggestion()
    s.offer(ctx, SUGGESTION)
    s.offer(ctx, SUGGESTION)
    expect(store.pendingSuggestions).toHaveLength(1)
    expect(msgs).toHaveLength(1)
  })
})
