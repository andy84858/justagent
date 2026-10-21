import type { SkillDraft } from '@/composables/useSkillStudioConversation'
import { useSkillStore } from '@/stores/skillStore'

// 專案內由 Agent 發起「這個流程要不要建立成個人技能？」的可重用流程。
// offer() 把建議放進 skillStore 的待處理佇列，並在河道推一則單向通知——
// 決策（建立／不用了）改到「技能管理」的「我的技能」分頁處理，不再是河道裡的
// 即時 Y/N 卡片（2026-09-23 產品決議：技能管理列表取代河道即時建議，取代先前
// 「方案三」直接跳轉 AI 賦能的即時卡片）。
// 任何 convN 腳本只要提供自己的 push/scroll/conversationId，就能一行 offer()。

export interface SkillSuggestion {
  id: string          // 一則建議一個 id，佇列以此去重
  name: string
  description: string
  steps: string[]     // 依序編號組成 instructions，同時每步轉成一項覆蓋能力
  reason: string      // 「我留意到「{reason}」這類流程…」
}

export interface SuggestionCtx {
  push: (msg: any) => void
  scroll: () => void
  conversationId: string   // 寫進佇列項目，「技能管理」按「建立」時當作交接資料的 origin
}

export function suggestionToPrefill(s: SkillSuggestion): Partial<SkillDraft> {
  return {
    name: s.name,
    description: s.description,
    instructions: s.steps.map((step, i) => `${i + 1}. ${step}`).join('\n'),
    // hashtag 不支援空白，步驟文字轉成能力標籤時去掉
    capabilities: s.steps.map(step => step.replace(/\s+/g, '')),
  }
}

export function suggestionOpeningMessage(s: SkillSuggestion): string {
  return `這顆技能來自本對話的「${s.reason}」流程，設定我先填好了。想調整就直接說，確認後按「儲存為個人技能」。`
}

export function useSkillSuggestion() {
  function offer(ctx: SuggestionCtx, suggestion: SkillSuggestion): void {
    const store = useSkillStore()
    if (store.pendingSuggestions.some(s => s.id === suggestion.id)) return
    store.addSuggestion({ ...suggestion, conversationId: ctx.conversationId })
    ctx.push({
      agent: 'brain',
      msg: `我留意到「${suggestion.reason}」這類流程你之後可能會重複用到，已經把建議放進「技能管理」，可以之後去那邊決定要不要建立成技能。`,
      finishResponse: true,
    })
    ctx.scroll()
  }

  return { offer }
}
