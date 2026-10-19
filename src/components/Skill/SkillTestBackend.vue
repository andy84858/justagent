<template>
  <div class="SkillTestAI SkillTestBackend">

    <div v-if="!props.conversationId" class="ai-idle">
      <i class="material-symbols-outlined ai-idle-icon">chat</i>
      <p class="ai-idle-hint">先跟助理聊出一份草稿，才能測試。</p>
    </div>

    <div v-else-if="state.phase === 'generating'" class="ai-idle">
      <div class="ai-idle-spinner"><span></span><span></span><span></span></div>
      <p>AI 正在依目前草稿出題...</p>
    </div>

    <div v-else-if="state.phase === 'idle'" class="ai-idle">
      <i class="material-symbols-outlined ai-idle-icon">auto_awesome</i>
      <p class="ai-idle-hint">AI 會依目前草稿出幾題，你判斷每句話該不該用這個技能</p>
      <p v-if="state.errorHint" class="tb-error"><i class="material-symbols-outlined">error</i>{{ state.errorHint }}</p>
      <button class="custom-btn custom-main-btn" @click="start">
        <i class="material-symbols-outlined">play_circle</i>
        生成測試情境
      </button>
    </div>

    <template v-else>
      <div class="ai-toolbar">
        <div class="ai-toolbar-left">
          <span class="ai-progress-text">已作答 {{ answeredCount }} / {{ state.questions.length }}</span>
        </div>
        <button class="custom-btn" :disabled="state.phase === 'submitting'" @click="start">
          <i class="material-symbols-outlined">refresh</i>
          重新生成
        </button>
      </div>

      <div class="ai-scenarios">
        <div
          v-for="q in state.questions"
          :key="q.id"
          :class="['scenario-card', `status--${cardStatus(q.id)}`]"
        >
          <div class="scenario-input">{{ q.text }}</div>
          <p class="scenario-question">這句話該不該用這個技能？</p>

          <div v-if="submitted" class="result-judgment">
            <template v-if="resultOf(q.id)?.failed">
              <i class="material-symbols-outlined">help</i>
              <strong>這題沒比對成功</strong>
              <span>你選了「{{ state.answers[q.id] }}」，這題後端沒有給出結果。</span>
            </template>
            <template v-else>
              <i class="material-symbols-outlined">{{ resultOf(q.id)?.consistent ? 'check_circle' : 'cancel' }}</i>
              <strong>{{ resultOf(q.id)?.consistent ? '一致' : '不一致' }}</strong>
              <span>你選了「{{ state.answers[q.id] }}」。</span>
            </template>
          </div>
          <div v-else class="scenario-answer-btns">
            <button
              v-for="opt in state.options"
              :key="opt"
              type="button"
              :class="['custom-btn custom-btn--sm', { 'custom-main-btn': state.answers[q.id] === opt }]"
              :aria-pressed="state.answers[q.id] === opt"
              :disabled="state.phase === 'submitting'"
              @click="testStore.setAnswer(props.conversationId, q.id, opt)"
            >{{ opt }}</button>
          </div>
        </div>

        <p v-if="state.errorHint" class="tb-error"><i class="material-symbols-outlined">error</i>{{ state.errorHint }}</p>

        <div v-if="!submitted" class="ai-report">
          <button
            type="button"
            class="custom-btn custom-main-btn"
            :disabled="!testStore.canSubmit(props.conversationId)"
            @click="testStore.submit(props.conversationId)"
          >
            <i class="material-symbols-outlined">send</i>{{ state.phase === 'submitting' ? '交卷中...' : '交卷' }}
          </button>
          <p v-if="!testStore.canSubmit(props.conversationId) && state.phase === 'answering'" class="tb-hint">每題都選好才能交卷。</p>
        </div>

        <!-- 交卷後：只說一致與否，不給標準答案與出題理由 -->
        <div v-else class="ai-report">
          <div class="report-header">
            <span class="report-title">測試結果</span>
            <span class="report-rate">{{ consistentCount }} / {{ state.results.length }} 題與你的判斷一致</span>
          </div>
          <p v-if="state.tested" class="report-summary">
            這份草稿已算測過。{{ props.testedNote }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBackendTestStore } from '@/stores/backendTestStore'

// 後端測試畫面：題目、比對都來自後端（以對話為單位，各技能版本的測試互不影響）。
// 選答案不計分，要按「交卷」才送出；交卷後只顯示每題一致或不一致
const props = defineProps<{
  conversationId: string | null
  // 測過之後怎麼把記號記下來（儲存成新版本，或直接記在這一版）；已經記下就是空字串
  testedNote?: string
}>()

const testStore = useBackendTestStore()
const state = computed(() => testStore.stateOf(props.conversationId ?? ''))
const submitted = computed(() => state.value.phase === 'submitted')

const answeredCount = computed(() => Object.keys(state.value.answers).length)
const consistentCount = computed(() => state.value.results.filter(r => r.consistent).length)
const resultOf = (id: string) => state.value.results.find(r => r.id === id)

function cardStatus(id: string): string {
  if (!submitted.value) return 'pending'
  return resultOf(id)?.consistent ? 'correct' : 'incorrect'
}

function start() {
  if (props.conversationId) testStore.start(props.conversationId)
}
</script>

<style scoped lang="scss">
.tb-error { display: flex; gap: 6px; align-items: center; font-size: 13px; color: #b3261e; }
.tb-hint { font-size: 12px; color: #666; margin-top: 6px; }
</style>
