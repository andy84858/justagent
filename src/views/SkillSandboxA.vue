<template>
  <div class="SkillSandbox SkillSandbox--a views-page">
    <div class="views-page-content-box">

      <div class="page-banner">
        <div>
          <AppBreadcrumb />
          <div class="banner-title">技能測試沙盒</div>
        </div>
        <div class="banner-right">
          <SkillTestVersionSwitch />
          <span class="sb-env">
            <i class="material-symbols-outlined">hub</i>
            測試環境：{{ agentCount }} 個 Agent・{{ liveSkillCount }} 顆已啟用技能<template v-if="includeDrafts">＋{{ draftCount }} 顆草稿</template>
          </span>
        </div>
      </div>

      <div class="sb-layout-a">

        <!-- 左：對話 -->
        <div class="sb-chat">
          <div class="sb-chat-head">
            <div class="sb-chat-title">全系統對話測試</div>
            <div class="sb-chat-head-actions">
            <label class="sb-draft-toggle" :class="{ 'is-on': includeDrafts }">
              <input type="checkbox" v-model="includeDrafts" />
              <span class="sb-toggle-track"></span>
              包含草稿<span class="sb-draft-count">{{ draftCount }}</span>
            </label>
            <button class="custom-btn sb-reset-btn" :disabled="!messages.length" @click="reset">
              <i class="material-symbols-outlined">refresh</i>重置對話
            </button>
            </div>
          </div>

          <div class="sb-messages" ref="messagesEl">
            <div v-if="!messages.length" class="sb-empty">
              <i class="material-symbols-outlined">forum</i>
              <p>像一般使用者一樣發話，觀察系統會派哪個 Agent、觸發哪顆技能</p>
            </div>

            <template v-for="msg in messages" :key="msg.id">
              <div v-if="msg.role === 'user'" class="sb-bubble sb-bubble--user">{{ msg.content }}</div>
              <div
                v-else
                :class="['sb-bubble', 'sb-bubble--agent', { 'is-selected': selectedId === msg.id }]"
                @click="selectedId = msg.id"
              >
                <div class="sb-agent-name">{{ msg.trace?.agent }}</div>
                <div class="sb-bubble-content">{{ msg.content }}</div>
                <div class="sb-bubble-foot">
                  <span v-if="msg.trace?.triggered" :class="['sb-skill-pill', { 'is-draft': msg.trace.triggered.isDraft }]">
                    <i class="material-symbols-outlined">bolt</i>{{ msg.trace.triggered.name }}
                    <span class="sb-pill-version">{{ msg.trace.triggered.versionName }}</span>
                  </span>
                  <span v-else class="sb-skill-pill is-none">
                    <i class="material-symbols-outlined">block</i>未觸發技能
                  </span>
                  <span class="sb-trace-link">追蹤 <i class="material-symbols-outlined">chevron_right</i></span>
                </div>
              </div>
            </template>

            <div v-if="isRunning" class="sb-bubble sb-bubble--agent">
              <div class="sb-agent-name">路由中…</div>
              <div class="sb-typing"><span></span><span></span><span></span></div>
            </div>
          </div>

          <div class="sb-composer">
            <div class="sb-composer-tools">
              <div class="sb-prompt-chips">
                <button
                  v-for="p in suggestedPrompts"
                  :key="p"
                  class="sb-prompt-chip"
                  :disabled="isRunning"
                  @click="send(p)"
                >{{ p }}</button>
              </div>
            </div>
            <div class="sb-input-row">
              <input
                v-model="inputText"
                class="custom-input"
                placeholder="輸入訊息，模擬使用者發話…"
                :disabled="isRunning"
                @keydown.enter.prevent="handleSend"
              />
              <button class="custom-btn" :disabled="!inputText.trim() || isRunning" @click="handleSend">
                <i class="material-symbols-outlined">send</i>
              </button>
            </div>
          </div>
        </div>

        <!-- 右：觸發追蹤 -->
        <aside class="sb-trace">
          <div class="sb-trace-head">
            <i class="material-symbols-outlined">route</i>觸發追蹤
          </div>

          <div v-if="!selectedTrace" class="sb-trace-empty">
            <p>送出訊息後，這裡會顯示每則回覆的路由細節：哪個 Agent 接手、觸發哪顆技能、為什麼，以及沒被選上的候選。</p>
          </div>

          <div v-else class="sb-trace-body">
            <div class="sb-trace-question">「{{ selectedQuestion }}」</div>

            <dl class="sb-trace-facts">
              <dt>接手 Agent</dt>
              <dd>{{ selectedTrace.agent }}</dd>
              <dt>觸發技能</dt>
              <dd>
                <template v-if="selectedTrace.triggered">
                  {{ selectedTrace.triggered.name }}
                  <span class="sb-pill-version">{{ selectedTrace.triggered.versionName }}</span>
                  <span v-if="selectedTrace.triggered.isDraft" class="sb-draft-tag">草稿</span>
                </template>
                <span v-else class="sb-muted">無</span>
              </dd>
            </dl>

            <div class="sb-trace-section">
              <div class="sb-section-title">判斷原因</div>
              <p class="sb-reason">{{ selectedTrace.reason }}</p>
            </div>

            <div class="sb-trace-section">
              <div class="sb-section-title">候選但未觸發</div>
              <ul v-if="selectedTrace.runnersUp.length" class="sb-candidates">
                <li v-for="c in selectedTrace.runnersUp" :key="c.skillId">
                  <div class="sb-cand-top">
                    <span class="sb-cand-name">{{ c.name }}</span>
                    <span v-if="c.isDraft" class="sb-draft-tag">草稿</span>
                    <span class="sb-cand-score">{{ c.score }}</span>
                  </div>
                  <div class="sb-cand-bar"><span :style="{ width: barWidth(c.score) }" /></div>
                  <div class="sb-cand-agent">{{ c.agent }}</div>
                </li>
              </ul>
              <p v-else class="sb-muted">沒有其他相關技能</p>
            </div>

            <div class="sb-trace-section">
              <div class="sb-section-title">工具呼叫</div>
              <div v-for="t in selectedTrace.tools" :key="t.name" class="sb-tool-row">
                <i class="material-symbols-outlined">settings</i>{{ t.name }}
                <span class="sb-tool-ms">{{ t.latencyMs }}ms</span>
              </div>
            </div>
          </div>

          <div v-if="triggerTally.length" class="sb-tally">
            <div class="sb-section-title">本次對話觸發紀錄</div>
            <div v-for="row in triggerTally" :key="row.name" class="sb-tally-row">
              <span :class="{ 'sb-muted': row.name === '未觸發' }">{{ row.name }}</span>
              <span class="sb-tally-count">{{ row.count }}</span>
            </div>
          </div>
        </aside>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import SkillTestVersionSwitch from '@/components/Skill/SkillTestVersionSwitch.vue'
import { useSandboxRouting } from '@/composables/useSandboxRouting'
import { useSkillStore } from '@/stores/skillStore'

const route = useRoute()
const {
  messages, isRunning, includeDrafts, agentCount, liveSkillCount, draftCount,
  suggestedPrompts, send, reset,
} = useSandboxRouting()
const store = useSkillStore()

const inputText = ref('')
const messagesEl = ref<HTMLElement | null>(null)
// 追蹤面板顯示哪一則回覆；有新回覆時自動跳到最新一則
const selectedId = ref<string | null>(null)

const selectedIndex = computed(() => messages.value.findIndex(m => m.id === selectedId.value))
const selectedTrace = computed(() => messages.value[selectedIndex.value]?.trace ?? null)
const selectedQuestion = computed(() => messages.value[selectedIndex.value - 1]?.content ?? '')

const maxScore = computed(() => {
  const t = selectedTrace.value
  if (!t) return 1
  return Math.max(t.triggered?.score ?? 0, ...t.runnersUp.map(c => c.score), 1)
})

const triggerTally = computed(() => {
  const counts = new Map<string, number>()
  for (const m of messages.value) {
    if (!m.trace) continue
    const key = m.trace.triggered?.name ?? '未觸發'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
})

function barWidth(score: number): string {
  return `${Math.round((score / maxScore.value) * 100)}%`
}

async function handleSend() {
  const text = inputText.value
  inputText.value = ''
  await send(text)
}

watch(
  () => messages.value.length,
  async () => {
    const last = messages.value[messages.value.length - 1]
    if (last?.role === 'agent') selectedId.value = last.id
    if (!messages.value.length) selectedId.value = null
    await nextTick()
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
)

// 從技能卡片「測試」進來（?skillId=）時，那顆技能還沒啟用就自動打開「包含草稿」，不然根本測不到它
onMounted(() => {
  const skillId = route.query.skillId as string | undefined
  const skill = skillId ? store.findSkill(skillId) : undefined
  if (skill && !skill.isEnabled) includeDrafts.value = true
})
</script>
