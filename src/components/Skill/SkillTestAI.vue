<template>
  <div class="SkillTestAI">

    <!-- ① Idle / Generating -->
    <div v-if="store.aiTestIsGenerating" class="ai-idle">
      <div class="ai-idle-spinner">
        <span></span><span></span><span></span>
      </div>
      <!-- 敘事文字講「正在做什麼」（查可調用 Agent、比對搶觸發的相似技能），不是一句
           固定不變的罐頭字——每次生成／重新生成都會照當下掃描結果重算。一律顯示在這裡，
           不推進 SkillStudio 左側的對話河道 -->
      <div class="ai-generation-narration">
        <div class="ai-generation-narration-label">AI Agent</div>
        <p v-for="(line, i) in store.aiTestGenerationNarration" :key="i">{{ line }}</p>
      </div>
    </div>

    <!-- 答題 Agent 不讓使用者選：由 store 自動挑可調用這顆技能的 Agent
         （見 store.generateAITestScenarios 沒帶 answeringAgent 時的預設） -->
    <div v-else-if="!store.aiTestScenarios.length" class="ai-idle">
      <i class="material-symbols-outlined ai-idle-icon">auto_awesome</i>
      <p class="ai-idle-hint">AI 依技能描述產生測試情境，由 Agent 作答；你先標註每題的正確答案，送出後揭曉 Agent 的判斷</p>
      <button
        type="button"
        class="custom-btn custom-main-btn ai-generate-btn"
        @click="regenerate"
      >
        <i class="material-symbols-outlined">play_circle</i>
        生成測試情境
      </button>
    </div>

    <!-- ② Scenarios：AI 出題、答題 Agent 作答，使用者標註每一題的正確答案 -->
    <template v-else>
      <div class="ai-toolbar">
        <div class="ai-toolbar-left">
          <!-- 嵌在啟用對話框裡就地測試時不顯示「答題 Agent」，對話框只專心處理「測完就啟用」 -->
          <span v-if="!props.embedded" class="ai-answering-agent">
            <i class="material-symbols-outlined">smart_toy</i>
            答題 Agent：<strong>{{ store.aiTestAnsweringAgent }}</strong>
          </span>
          <span class="ai-progress-text">已標註 {{ answeredCount }} / {{ store.aiTestScenarios.length }}</span>
          <button
            v-if="!store.aiTestReport"
            class="custom-btn custom-main-btn ai-submit-btn"
            :disabled="!allAnswersSelected"
            @click="submitAnswers"
          >
            送出答案
          </button>
        </div>
        <button class="custom-btn ai-regenerate-btn" @click="regenerate">
          <i class="material-symbols-outlined">refresh</i>
          重新生成
        </button>
      </div>

      <div class="ai-scenarios">
        <div
          v-for="sc in store.aiTestScenarios"
          :key="sc.id"
          :class="['scenario-card', `status--${sc.status}`]"
        >
          <div class="scenario-header">
            <span :class="['scenario-tag', `tag--${sc.tag}`]">{{ tagLabel(sc.tag) }}</span>
            <div class="scenario-actions">
              <span v-if="sc.status === 'correct'" class="status-badge badge--pass">
                <i class="material-symbols-outlined">check_circle</i>Agent 答對了
              </span>
              <span v-else-if="sc.status === 'incorrect'" class="status-badge badge--fail">
                <i class="material-symbols-outlined">cancel</i>Agent 答錯了
              </span>
            </div>
          </div>

          <!-- 題目是一句使用者會講的話。Agent 的作答要等使用者送出答案後才揭曉，
               避免使用者看了 Agent 的判斷才標註、被它影響 -->
          <div class="scenario-input">
            <span class="scenario-input-label">使用者輸入</span>
            {{ sc.input }}
          </div>
          <div v-if="sc.status !== 'pending'" :class="['scenario-agent-answer', `is-${sc.status}`]">
            <div class="scenario-agent-answer-head">
              <i class="material-symbols-outlined">smart_toy</i>
              <span class="scenario-agent-name">{{ store.aiTestAnsweringAgent }}</span>
              <span class="scenario-agent-verdict">的判斷：<strong>{{ sc.agentAnswer ? '觸發' : '不觸發' }}</strong></span>
            </div>
            <p class="scenario-agent-reasoning">{{ sc.agentReasoning }}</p>
          </div>

          <template v-if="sc.status === 'pending'">
            <p class="scenario-question">這句話正確來說，該不該觸發這顆技能？</p>
            <div class="scenario-answer-btns">
              <button
                type="button"
                class="custom-btn custom-btn--sm"
                :class="{ 'is-selected': draftAnswers[sc.id] === true }"
                @click="selectAnswer(sc.id, true)"
              >該觸發</button>
              <button
                type="button"
                class="custom-btn custom-btn--sm"
                :class="{ 'is-selected': draftAnswers[sc.id] === false }"
                @click="selectAnswer(sc.id, false)"
              >不該觸發</button>
            </div>
          </template>

          <div v-else class="result-answer-row">
            <span :class="['result-answer-pill', sc.status === 'correct' ? 'pill--pass' : 'pill--fail']">
              <span class="result-answer-pill-label">Agent 判斷</span>{{ sc.agentAnswer ? '該觸發' : '不該觸發' }}
            </span>
            <span class="result-answer-pill pill--neutral">
              <span class="result-answer-pill-label">正確答案（你標註）</span>{{ sc.userAnswer ? '該觸發' : '不該觸發' }}
            </span>
          </div>
        </div>

        <!-- ③ Report -->
        <div v-if="store.aiTestReport" class="ai-report">
          <div class="report-header">
            <span class="report-title">測試報告</span>
            <span class="report-rate">
              Agent 答對 {{ store.aiTestReport.correct }} / {{ store.aiTestReport.total }}
              <em>（{{ ratePercent }}%）</em>
            </span>
          </div>
          <div class="report-by-tag">
            <div
              v-for="(label, tag) in REPORT_TAG_LABELS"
              :key="tag"
              class="report-tag-row"
            >
              <span :class="['scenario-tag', `tag--${tag}`]">{{ label }}</span>
              <span class="tag-stat">
                {{ store.aiTestReport.byTag[tag as AITestTag].correct }}
                / {{ store.aiTestReport.byTag[tag as AITestTag].total }}
              </span>
              <i
                class="material-symbols-outlined tag-result-icon"
                :class="store.aiTestReport.byTag[tag as AITestTag].correct === store.aiTestReport.byTag[tag as AITestTag].total && store.aiTestReport.byTag[tag as AITestTag].total > 0 ? 'icon--pass' : 'icon--fail'"
              >
                {{ store.aiTestReport.byTag[tag as AITestTag].correct === store.aiTestReport.byTag[tag as AITestTag].total && store.aiTestReport.byTag[tag as AITestTag].total > 0 ? 'check_circle' : 'error' }}
              </i>
            </div>
          </div>
          <p class="report-summary">{{ store.aiTestReport.summary }}</p>
          <!-- 交卷後引導使用者下一步：放在測試 tab 的報告裡，不推進左側對話河道 -->
          <div v-if="nextStep" :class="['report-next', `is-${nextStep.tone}`]">
            <div class="report-next-label">
              <i class="material-symbols-outlined">{{ nextStep.tone === 'pass' ? 'task_alt' : 'lightbulb' }}</i>下一步
            </div>
            <ul class="report-next-list">
              <li v-for="(line, i) in nextStep.lines" :key="i">{{ line }}</li>
            </ul>
            <!-- 儲存歸儲存、啟用歸啟用：不管 Agent 答對答錯，測過就能啟用，「啟用技能」一律在這裡；
                 還沒存檔、或已經啟用中時按鈕反灰，原因寫在上面的引導文字裡 -->
            <div class="report-next-actions">
              <button
                v-if="!props.embedded"
                type="button"
                class="custom-btn custom-main-btn custom-btn--sm ai-enable-btn"
                :disabled="enableState !== 'ready'"
                @click="handleEnableClick"
              >
                <i class="material-symbols-outlined">check_circle</i>啟用技能
              </button>
              <button
                v-if="nextStep.tone === 'fail'"
                type="button"
                class="custom-btn custom-btn--sm report-next-retest"
                @click="regenerate"
              >
                <i class="material-symbols-outlined">refresh</i>重新測試
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <SkillEnableFlow v-if="!props.embedded" ref="enableFlowRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useSkillStore } from '@/stores/skillStore'
import type { AITestTag, TriggerEdgeSource } from '@/stores/skillStore'
import SkillEnableFlow from '@/components/Skill/SkillEnableFlow.vue'
import popDialog from '@/services/popDialog'

// draftContext：抽屜裡測試還沒存檔的草稿時，store 裡找不到這顆技能（或技能存在
// 但草稿已經改過還沒存），用這個當作組題關鍵字的來源。獨立測試沙盒（一定是已存檔
// 的技能）不用傳這個，退回讀 store 裡的技能資料
// embedded：嵌在 SkillEnableFlow 的「還不能啟用」對話框裡就地測試時，啟用由對話框
// 自己接手，這裡不顯示啟用按鈕、也不再掛一層 SkillEnableFlow
const props = defineProps<{
  embedded?: boolean
  skillId: string
  draftContext?: TriggerEdgeSource
  // 測試沒全對時，引導使用者去哪裡改技能內容——依呼叫端的畫面而定（對話方式在左側對話、
  // 積木方式在基本設定…），沒傳就用通用說法
  editHint?: string
}>()
const store = useSkillStore()
const enableFlowRef = ref<InstanceType<typeof SkillEnableFlow> | null>(null)

onMounted(() => store.ensureAITestStateForSkill(props.skillId))
watch(() => props.skillId, (id) => store.ensureAITestStateForSkill(id))

// 「啟用技能」能不能按：草稿還沒存成技能（store 找不到）不能啟用；已經啟用中也不用再啟用。
// 不看答對比例——測過就能啟用、不用全對（見 skillStore 的 canEnableSkill）
const enableState = computed<'unsaved' | 'enabled' | 'ready'>(() => {
  const skill = store.findSkill(props.skillId)
  if (!skill) return 'unsaved'
  return skill.isEnabled ? 'enabled' : 'ready'
})

async function handleEnableClick() {
  const skill = store.findSkill(props.skillId)
  if (!skill) return
  // 呼叫端要處理完整的 EnableFlowOutcome，不能假設只會 resolve confirmed
  const outcome = await enableFlowRef.value!.requestEnable(skill, skill.assignedAgents ?? [])
  if (outcome.type === 'cancelled') return
  store.setAssignedAgents(skill.id, outcome.agents)
  store.toggleSkill(skill.id)
}

// 交卷後的「下一步」引導：不管 Agent 答對答錯，都會講怎麼啟用（跟下方「啟用技能」按鈕
// 的狀態對齊）；沒全對時另外講怎麼改、怎麼重測
const nextStep = computed<{ tone: 'pass' | 'fail'; lines: string[] } | null>(() => {
  const report = store.aiTestReport
  if (!report || report.total === 0 || store.aiTestScenariosSkillId !== props.skillId) return null
  const agent = store.aiTestAnsweringAgent ? `「${store.aiTestAnsweringAgent}」` : 'Agent'
  const enableLine = props.embedded
    ? '可以繼續啟用。'
    : {
        unsaved: '要啟用的話，先按「儲存」存成技能，再回來按「啟用技能」。',
        enabled: '這顆技能已經是啟用中，不用再啟用。',
        ready: '按「啟用技能」，確認可用的 Agent 後就能上線。',
      }[enableState.value]
  if (report.correct === report.total) {
    return { tone: 'pass', lines: [`${agent}全部判斷正確！${enableLine}`] }
  }
  const wrong = report.total - report.correct
  return {
    tone: 'fail',
    lines: [
      `${agent}判斷錯了 ${wrong} 題，可以這樣處理：`,
      `${props.editHint ?? '修改技能的說明'}，把容易混淆的情境講清楚，讓 Agent 更容易分辨。`,
      '如果是正確答案標錯了，按「重新測試」換一批題目再測一次。',
      `這次先不改也可以，測過就能啟用、不用全對：${enableLine}`,
    ],
  }
})

const TAG_LABELS: Record<AITestTag, string> = {
  normal: '正常流程',
  boundary: '邊界情況',
  trigger_edge: '觸發邊緣',
}

// 測試報告只列「觸發邊緣」的分類統計，「正常流程」「邊界情況」不放進報告
const REPORT_TAG_LABELS: Partial<Record<AITestTag, string>> = {
  trigger_edge: TAG_LABELS.trigger_edge,
}

function tagLabel(tag: AITestTag): string {
  return TAG_LABELS[tag]
}

// 統一送答案：每一題先標註正確答案（draftAnswers，純前端暫存、還沒送出前不計分），
// 全部標完才能按「送出答案」一次送出、一次跟 Agent 的判斷比對出報告
const draftAnswers = ref<Record<string, boolean>>({})

const answeredCount = computed(() =>
  store.aiTestScenarios.filter(s => s.status !== 'pending' || draftAnswers.value[s.id] !== undefined).length
)

const allAnswersSelected = computed(() => {
  const pending = store.aiTestScenarios.filter(s => s.status === 'pending')
  return pending.length > 0 && pending.every(s => draftAnswers.value[s.id] !== undefined)
})

const ratePercent = computed(() => {
  if (!store.aiTestReport || !store.aiTestReport.total) return 0
  return Math.round((store.aiTestReport.correct / store.aiTestReport.total) * 100)
})

// 題目生成完成要讓使用者知道，不是生成中的敘事文字講完就沒下文——用 toast 提示，
// 不推進對話河道
async function regenerate() {
  draftAnswers.value = {}
  await store.generateAITestScenarios(props.skillId, props.draftContext)
  popDialog.toast('測試情境生成完成，請標註正確答案，送出後揭曉 Agent 的判斷！')
}

// userAnswer：使用者標註的正確答案
function selectAnswer(scenarioId: string, userAnswer: boolean) {
  draftAnswers.value = { ...draftAnswers.value, [scenarioId]: userAnswer }
}

function submitAnswers() {
  if (!allAnswersSelected.value) return
  store.submitAITestAnswers(props.skillId, draftAnswers.value)
  draftAnswers.value = {}
}
</script>
