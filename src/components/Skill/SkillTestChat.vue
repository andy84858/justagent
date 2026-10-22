<template>
  <div class="SkillTestChat">
    <div class="chat-messages" ref="messagesEl">
      <div v-if="!store.testConversationHistory.length" class="chat-empty">
        <i class="material-symbols-outlined">forum</i>
        <p>輸入訊息開始測試技能</p>
      </div>

      <template v-for="msg in store.testConversationHistory" :key="msg.id">
        <div :class="['chat-bubble', msg.role === 'user' ? 'bubble--user' : 'bubble--agent']">
          <div v-if="msg.role === 'agent'" class="bubble-label">AI Agent</div>
          <div class="bubble-content">{{ msg.content }}</div>
          <div v-if="msg.toolTrace?.length" class="tool-trace">
            <div class="trace-row" v-for="t in msg.toolTrace" :key="t.name">
              <i class="material-symbols-outlined">settings</i>
              {{ t.name }}
              <span class="trace-ms">{{ t.latencyMs }}ms</span>
            </div>
          </div>
        </div>
      </template>

      <div v-if="store.testIsRunning" class="chat-bubble bubble--agent">
        <div class="bubble-label">AI Agent</div>
        <div class="bubble-typing">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- 預設測試案例 -->
    <div v-if="testCases.length" class="test-cases-bar">
      <span class="test-cases-label">測試案例</span>
      <div class="test-cases-list">
        <button
          v-for="(tc, i) in testCases"
          :key="tc.name"
          class="test-case-chip"
          :disabled="store.testIsRunning"
          @click="selectTestCase(i)"
        >
          {{ tc.name }}
        </button>
      </div>
    </div>

    <div class="chat-input-row">
      <input
        v-model="inputText"
        class="custom-input"
        placeholder="輸入測試訊息，模擬用戶發話..."
        :disabled="store.testIsRunning"
        @keydown.enter.prevent="handleSend"
        @input="pendingAutoRun = []"
      />
      <button
        class="custom-btn"
        :disabled="!inputText.trim() || store.testIsRunning"
        @click="handleSend"
      >
        <i class="material-symbols-outlined">send</i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useSkillStore } from '@/stores/skillStore'
import type { SkillTestCase } from '@/stores/skillStore'

const props = defineProps<{ skillId: string }>()
const store = useSkillStore()
const inputText = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const pendingAutoRun = ref<SkillTestCase[]>([])

const testCases = computed(() => store.findSkill(props.skillId)?.testCases ?? [])

function selectTestCase(index: number) {
  const tc = testCases.value[index]
  if (!tc) return
  inputText.value = tc.input
  pendingAutoRun.value = testCases.value.slice(index + 1)
}

function resetAll() {
  store.resetConversation()
  pendingAutoRun.value = []
  inputText.value = ''
}

// 重置按鈕在 SkillTest 的面板標題列，透過 ref 呼叫
defineExpose({ resetAll })

async function handleSend() {
  const msg = inputText.value.trim()
  if (!msg || store.testIsRunning) return
  inputText.value = ''
  await store.sendChatMessage(props.skillId, msg)

  if (pendingAutoRun.value.length > 0) {
    const next = pendingAutoRun.value[0]
    pendingAutoRun.value = pendingAutoRun.value.slice(1)
    await new Promise(r => setTimeout(r, 500))
    inputText.value = next.input
    await handleSend()
  }
}

watch(
  () => store.testConversationHistory.length,
  async () => {
    await nextTick()
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  }
)
</script>
