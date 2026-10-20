import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  describeConversationError,
  startConversationTest,
  submitConversationTest,
} from '@/services/skillConversationApi'
import type { TestAnswer, TestQuestion, TestResultItem } from '@/services/skillConversationApi'

// 後端測試（選擇題）的狀態，以「對話」為單位：每個技能版本各自開一場對話，
// 同時測好幾個技能時各管各的，互不影響。題目、比對、「測過」記號都在後端，前端只負責
// 暫存使用者選的答案——選答案不計分，要按交卷才送出

export type TestPhase = 'idle' | 'generating' | 'answering' | 'submitting' | 'submitted'

export interface TestState {
  phase: TestPhase
  questions: TestQuestion[]
  options: TestAnswer[]
  answers: Record<string, TestAnswer>
  results: TestResultItem[]   // 交卷後逐題一致與否；不含標準答案與出題理由
  tested: boolean             // 後端回報這份草稿已算測過
  errorHint: string           // 最近一次失敗的白話提示
}

function emptyState(): TestState {
  return { phase: 'idle', questions: [], options: [], answers: {}, results: [], tested: false, errorHint: '' }
}

export const useBackendTestStore = defineStore('backendTest', () => {
  const states = ref<Record<string, TestState>>({})

  // 沒開始過的對話回一份空狀態，不寫進 states（讀取不產生副作用）
  function stateOf(conversationId: string): TestState {
    return states.value[conversationId] ?? emptyState()
  }

  function patch(conversationId: string, next: Partial<TestState>): void {
    states.value = { ...states.value, [conversationId]: { ...stateOf(conversationId), ...next } }
  }

  async function start(conversationId: string): Promise<void> {
    patch(conversationId, { ...emptyState(), phase: 'generating' })
    try {
      const started = await startConversationTest(conversationId)
      patch(conversationId, { phase: 'answering', questions: started.questions, options: started.options })
    } catch (error) {
      patch(conversationId, { phase: 'idle', errorHint: describeConversationError(error) })
    }
  }

  // 只記下答案，不計分；交卷後不能再改
  function setAnswer(conversationId: string, questionId: string, answer: TestAnswer): void {
    const current = stateOf(conversationId)
    if (current.phase !== 'answering') return
    patch(conversationId, { answers: { ...current.answers, [questionId]: answer } })
  }

  function canSubmit(conversationId: string): boolean {
    const current = stateOf(conversationId)
    return current.phase === 'answering'
      && current.questions.length > 0
      && current.questions.every(q => current.answers[q.id] !== undefined)
  }

  async function submit(conversationId: string): Promise<void> {
    if (!canSubmit(conversationId)) return
    const current = stateOf(conversationId)
    patch(conversationId, { phase: 'submitting', errorHint: '' })
    try {
      const done = await submitConversationTest(conversationId, current.answers)
      patch(conversationId, { phase: 'submitted', results: done.results, tested: done.tested })
    } catch (error) {
      // 答案留著，使用者可以直接再交一次
      patch(conversationId, { phase: 'answering', errorHint: describeConversationError(error) })
    }
  }

  // 草稿改過、或重開對話：這場對話的測試作廢
  function reset(conversationId: string): void {
    const rest = { ...states.value }
    delete rest[conversationId]
    states.value = rest
  }

  return { states, stateOf, start, setAnswer, canSubmit, submit, reset }
})
