<template>
  <div :class="['SkillStudioChat', { 'is-compact': props.compact }]">
    <div class="ssc-head">
      <span :class="['ssc-mode-chip', `ssc-mode-chip--${props.mode}`]">
        <i class="material-symbols-outlined">{{ props.mode === 'create' ? 'auto_fix_high' : 'person' }}</i>
        {{ props.mode === 'create' ? '建立新技能' : `修改：${props.skillName}` }}
      </span>
      <!-- 建立對話前可選，送出第一句後鎖住、只標示目前模式（ADR 0015） -->
      <div v-if="props.showAdviceMode" class="ssc-advice-mode" role="group" aria-label="判斷模式">
        <template v-if="!props.adviceModeLocked">
          <button
            v-for="opt in ADVICE_MODE_OPTIONS"
            :key="opt.value"
            type="button"
            :class="['ssc-advice-btn', { 'is-active': props.adviceMode === opt.value }]"
            :aria-pressed="props.adviceMode === opt.value"
            @click="emit('change-advice-mode', opt.value)"
          >{{ opt.label }}</button>
        </template>
        <span v-else class="ssc-advice-badge" title="對話開始後不能切換模式，想換請開新對話">
          <i class="material-symbols-outlined">lock</i>{{ adviceModeLabel }}（對話中不能切換）
        </span>
      </div>
      <div class="ssc-head-actions" v-if="!props.compact">
        <select
          class="custom-input ssc-skill-select"
          :value="props.savedSkillId ?? ''"
          @change="onSwitch"
        >
          <option value="" disabled>切換技能</option>
          <option v-for="s in props.personalSkills" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <button type="button" class="custom-btn ssc-new-btn" @click="emit('new-skill')">
          <i class="material-symbols-outlined">add</i>建立新技能
        </button>
      </div>
    </div>

    <div ref="messagesEl" class="ssc-messages">
      <template v-for="msg in props.messages" :key="msg.id">
        <div :class="['chat-bubble', msg.role === 'user' ? 'bubble--user' : 'bubble--agent']">
          <div v-if="msg.role === 'agent'" class="bubble-label">AI Agent</div>
          <div class="bubble-content">{{ msg.content }}</div>
          <div v-if="msg.actions?.length" class="ssc-actions">
            <button
              v-for="a in msg.actions"
              :key="a.id"
              type="button"
              class="ssc-action-chip"
              :disabled="props.isRunning"
              @click="emit('send', a.label)"
            >{{ a.label }}</button>
          </div>
        </div>
      </template>

      <div v-if="props.isRunning" class="chat-bubble bubble--agent">
        <div class="bubble-label">AI Agent</div>
        <div class="bubble-typing"><span></span><span></span><span></span></div>
      </div>

      <!-- 還沒送出任何訊息前給幾個起手式；點擊只帶入輸入框、不自動送出 -->
      <div v-if="showSuggestions" class="ssc-suggestions">
        <button
          v-for="chip in props.suggestionChips"
          :key="chip.label"
          type="button"
          class="ssc-chip"
          @click="applySuggestion(chip)"
        >
          <i class="material-symbols-outlined">{{ chip.icon }}</i>{{ chip.label }}
        </button>
      </div>
    </div>

    <div class="ssc-input-row">
      <input
        ref="inputEl"
        v-model="inputText"
        class="custom-input"
        :placeholder="props.mode === 'create' ? '描述你想讓 Agent 幫你做什麼...' : '描述你想怎麼修改這份技能...'"
        :disabled="props.isRunning"
        @keydown.enter.prevent="handleSend"
      />
      <button
        type="button"
        class="custom-btn ssc-send-btn"
        :disabled="!inputText.trim() || props.isRunning"
        @click="handleSend"
      >
        <i class="material-symbols-outlined">send</i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { Skill } from '@/stores/skillStore'
import type { AdviceMode } from '@/services/skillConversationApi'
import type { StudioMode, StudioMessage, StudioSuggestion } from '@/composables/useSkillStudioConversation'

const props = defineProps<{
  mode: StudioMode
  skillName: string
  savedSkillId: string | null
  messages: StudioMessage[]
  isRunning: boolean
  suggestionChips: StudioSuggestion[]
  personalSkills: Skill[]
  compact?: boolean
  showAdviceMode?: boolean
  adviceMode?: AdviceMode
  adviceModeLocked?: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
  'switch-skill': [skillId: string]
  'new-skill': []
  'change-advice-mode': [mode: AdviceMode]
}>()

const ADVICE_MODE_OPTIONS: { value: AdviceMode; label: string }[] = [
  { value: 'jev', label: 'Jev＋LLM' },
  { value: 'llm', label: '純 LLM' },
]
const adviceModeLabel = computed(
  () => ADVICE_MODE_OPTIONS.find(o => o.value === (props.adviceMode ?? 'jev'))?.label ?? '',
)

const inputText = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const messagesEl = ref<HTMLElement | null>(null)

const showSuggestions = computed(() => !props.messages.some(m => m.role === 'user'))

function applySuggestion(chip: StudioSuggestion) {
  inputText.value = chip.prefill
  nextTick(() => inputEl.value?.focus())
}

function handleSend() {
  const t = inputText.value.trim()
  if (!t || props.isRunning) return
  inputText.value = ''
  emit('send', t)
}

function onSwitch(e: Event) {
  const id = (e.target as HTMLSelectElement).value
  if (id) emit('switch-skill', id)
  ;(e.target as HTMLSelectElement).value = props.savedSkillId ?? ''
}

watch(() => props.messages.length, async () => {
  await nextTick()
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
})
</script>

<style scoped lang="scss">
.ssc-advice-mode {
  display: flex;
  gap: 4px;
  align-items: center;
}
.ssc-advice-btn {
  padding: 2px 10px;
  border: 1px solid #c9c9c9;
  border-radius: 12px;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  &.is-active {
    border-color: #4a6cf7;
    background: #eef1ff;
    color: #4a6cf7;
  }
}
.ssc-advice-badge {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: 12px;
  color: #666;
  .material-symbols-outlined { font-size: 14px; }
}
</style>
