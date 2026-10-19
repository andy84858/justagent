import { isAxiosError } from 'axios'
import { httpService } from '@/services/http'

// 技能對話後端（skill_creator_poc_5）的呼叫。只管收發與把錯誤換成白話，
// 草稿與階段的狀態都在後端，前端不自己算。

export type AdviceMode = 'jev' | 'llm'

// 後端草稿的形狀（DraftContent）：內文欄位叫 content，前端草稿叫 instructions
export interface BackendDraft {
  name: string          // 技能代號，給 agent 用，小寫英文與連字號
  display_name: string  // 給使用者看的名稱
  description: string
  content: string
}

// 便利貼：agent 目前記下的主題與步驟，儲存前的暫存，只用來顯示
export interface BackendNote {
  topic: string
  steps: string[]
}

export interface ConversationTurn {
  reply: string
  draft: BackendDraft | null
  note: BackendNote
  stage: string
  blocked: string[]
}

export interface OpenedConversation extends ConversationTurn {
  conversation_id: string
  mode: 'create' | 'modify'
  advice_mode: AdviceMode
}

// agent 一輪要呼叫模型，會比 http.ts 預設的 10 秒久
const AGENT_TIMEOUT_MS = 120_000

// 後端錯誤回 { detail: 白話原因 }；連不上、逾時則沒有 response
export function describeConversationError(error: unknown): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string' && detail) return detail
    if (error.response) return `後端回了錯誤（${error.response.status}），請稍後再試。`
    return '連不上技能後端，請確認後端有啟動，再試一次。'
  }
  return '發生未預期的錯誤，請稍後再試。'
}

export async function openConversation(
  adviceMode: AdviceMode = 'jev',
): Promise<OpenedConversation> {
  const res = await httpService.post<OpenedConversation>(
    '/conversations',
    { mode: 'create', advice_mode: adviceMode },
    { timeout: AGENT_TIMEOUT_MS },
  )
  return res.data
}

export async function sendConversationMessage(
  conversationId: string,
  text: string,
): Promise<ConversationTurn> {
  const res = await httpService.post<ConversationTurn>(
    `/conversations/${conversationId}/messages`,
    { text },
    { timeout: AGENT_TIMEOUT_MS },
  )
  return res.data
}
