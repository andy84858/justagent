<template>
  <div class="SkillSandbox SkillSandbox--b views-page">
    <div class="views-page-content-box">

      <div class="page-banner">
        <div>
          <AppBreadcrumb />
          <div class="banner-title">技能測試沙盒</div>
        </div>
        <div class="banner-right">
          <SkillTestVersionSwitch />
        </div>
      </div>

      <div class="sb-layout-b">
        <!-- 頂部環境列：測試範圍＋包含草稿開關＋重置，一眼看出「現在在跟什麼環境對話」 -->
        <div class="sb-env-bar">
          <span class="sb-env">
            <i class="material-symbols-outlined">hub</i>
            {{ agentCount }} 個 Agent・{{ liveSkillCount }} 顆已啟用技能<template v-if="includeDrafts">＋{{ draftCount }} 顆草稿</template>
          </span>
<label class="sb-draft-toggle" :class="{ 'is-on': includeDrafts }">
            <input type="checkbox" v-model="includeDrafts" />
            <span class="sb-toggle-track"></span>
            包含草稿<span class="sb-draft-count">{{ draftCount }}</span>
          </label>
          <button class="custom-btn sb-reset-btn" :disabled="!messages.length" @click="reset">
            <i class="material-symbols-outlined">refresh</i>重置對話
          </button>
        </div>

        <div class="sb-messages" ref="messagesEl">
          <div class="sb-thread">
            <div v-if="!messages.length" class="sb-empty">
              <i class="material-symbols-outlined">forum</i>
              <p>像一般使用者一樣發話，每則回覆都會附上路由細節</p>
              <div class="sb-prompt-chips is-centered">
                <button v-for="p in suggestedPrompts" :key="p" class="sb-prompt-chip" @click="send(p)">{{ p }}</button>
              </div>
            </div>

            <template v-for="msg in messages" :key="msg.id">
              <div v-if="msg.role === 'user'" class="sb-bubble sb-bubble--user">{{ msg.content }}</div>

              <div v-else-if="msg.trace" class="sb-turn">
                <!-- 路由結果放在回覆上方，像一條「交接紀錄」，不用另外開面板 -->
                <div class="sb-route-line">
                  <span class="sb-route-agent">
                    <i class="material-symbols-outlined">smart_toy</i>{{ msg.trace.agent }}
                  </span>
                  <i class="material-symbols-outlined sb-route-arrow">arrow_forward</i>
                  <span v-if="msg.trace.triggered" :class="['sb-skill-pill', { 'is-draft': msg.trace.triggered.isDraft }]">
                    <i class="material-symbols-outlined">bolt</i>{{ msg.trace.triggered.name }}
                    <span class="sb-pill-version">{{ msg.trace.triggered.versionName }}</span>
                  </span>
                  <span v-else class="sb-skill-pill is-none">
                    <i class="material-symbols-outlined">block</i>未觸發技能
                  </span>
                </div>

                <div class="sb-bubble sb-bubble--agent">
                  <div class="sb-bubble-content">{{ msg.content }}</div>
                </div>

                <button class="sb-detail-toggle" @click="toggle(msg.id)">
                  <i class="material-symbols-outlined">{{ isExpanded(msg.id) ? 'expand_less' : 'expand_more' }}</i>
                  {{ isExpanded(msg.id) ? '收合路由細節' : '展開路由細節' }}
                </button>

                <div v-if="isExpanded(msg.id)" class="sb-detail">
                  <p class="sb-reason">{{ msg.trace.reason }}</p>

                  <div class="sb-score-table">
                    <div
                      v-for="c in rankedCandidates(msg.trace)"
                      :key="c.skillId"
                      :class="['sb-score-row', { 'is-winner': c.skillId === msg.trace.triggered?.skillId }]"
                    >
                      <span class="sb-score-name">
                        {{ c.name }}
                        <span v-if="c.isDraft" class="sb-draft-tag">草稿</span>
                      </span>
                      <span class="sb-score-agent">{{ c.agent }}</span>
                      <span class="sb-cand-bar"><span :style="{ width: barWidth(c.score, msg.trace) }" /></span>
                      <span class="sb-score-num">{{ c.score }}</span>
                    </div>
                    <p v-if="!rankedCandidates(msg.trace).length" class="sb-muted">沒有任何相關技能</p>
                  </div>

                  <div class="sb-tools-inline">
                    <span v-for="t in msg.trace.tools" :key="t.name" class="sb-tool-chip">
                      {{ t.name }} <span class="sb-tool-ms">{{ t.latencyMs }}ms</span>
                    </span>
                  </div>
                </div>
              </div>
            </template>

            <div v-if="isRunning" class="sb-turn">
              <div class="sb-route-line"><span class="sb-route-agent is-pending">路由中…</span></div>
              <div class="sb-bubble sb-bubble--agent">
                <div class="sb-typing"><span></span><span></span><span></span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="sb-composer">
          <div class="sb-thread">
            <div v-if="messages.length" class="sb-prompt-chips">
              <button
                v-for="p in suggestedPrompts"
                :key="p"
                class="sb-prompt-chip"
                :disabled="isRunning"
                @click="send(p)"
              >{{ p }}</button>
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
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import SkillTestVersionSwitch from '@/components/Skill/SkillTestVersionSwitch.vue'
import { useSandboxRouting } from '@/composables/useSandboxRouting'
import type { RoutingTrace, RoutingCandidate } from '@/composables/useSandboxRouting'
import { useSkillStore } from '@/stores/skillStore'

const route = useRoute()
const {
  messages, isRunning, includeDrafts, agentCount, liveSkillCount, draftCount,
  suggestedPrompts, send, reset,
} = useSandboxRouting()
const store = useSkillStore()

const inputText = ref('')
const messagesEl = ref<HTMLElement | null>(null)
// 最新一則預設展開，舊的自動收起，避免對話一長全部細節攤開
const expandedIds = ref<Set<string>>(new Set())

function isExpanded(id: string): boolean {
  return expandedIds.value.has(id)
}

function toggle(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

function rankedCandidates(t: RoutingTrace): RoutingCandidate[] {
  return t.triggered ? [t.triggered, ...t.runnersUp] : t.runnersUp
}

function barWidth(score: number, t: RoutingTrace): string {
  const max = Math.max(...rankedCandidates(t).map(c => c.score), 1)
  return `${Math.round((score / max) * 100)}%`
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
    if (last?.role === 'agent') expandedIds.value = new Set([last.id])
    await nextTick()
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
)

// 從技能卡片「測試」進來（?skillId=）時，那顆技能還沒啟用就自動打開「包含草稿」
onMounted(() => {
  const skillId = route.query.skillId as string | undefined
  const skill = skillId ? store.findSkill(skillId) : undefined
  if (skill && !skill.isEnabled) includeDrafts.value = true
})
</script>
