<template>
  <div class="SkillTestAI">

    <!-- ① Idle / Generating -->
    <div v-if="store.aiTestIsGenerating" class="ai-idle">
      <div class="ai-idle-spinner">
        <span></span><span></span><span></span>
      </div>
      <!-- 敘事文字講「正在做什麼」（查可調用 Agent、比對搶觸發的相似技能），不是一句
           固定不變的罐頭字——每次生成／重新生成都會照當下掃描結果重算。對話建立的技能
           有真正的對話串可以講這句話（見 SkillStudioWorkspace.vue 的
           conv.notifyTestGenerating），這裡用 hideGenerationNarration 隱藏掉自己這份，
           避免同一段話左右兩欄同時出現 -->
      <div v-if="!props.hideGenerationNarration" class="ai-generation-narration">
        <div class="ai-generation-narration-label">AI Agent</div>
        <p v-for="(line, i) in store.aiTestGenerationNarration" :key="i">{{ line }}</p>
      </div>
    </div>

    <!-- 生成前先選答題 Agent：候選是可以調用這顆技能的 Agent（見 store.getAITestCallableAgents）。
         「重新生成」也回到這裡，讓使用者可以換一個 Agent 再測 -->
    <div v-else-if="!store.aiTestScenarios.length || pickingAgent" class="ai-idle">
      <i class="material-symbols-outlined ai-idle-icon">auto_awesome</i>
      <p class="ai-idle-hint">AI 依技能描述產生測試情境，由你選的 Agent 逐題判斷該不該觸發，你再標註正確答案</p>
      <div class="ai-agent-picker">
        <p class="ai-agent-picker-label">選擇答題 Agent</p>
        <p v-if="callable.source === 'inferred'" class="ai-agent-picker-note">
          這顆技能還沒有指派 Agent，先列出相似技能「{{ callable.inferredFrom }}」可調用的 Agent
        </p>
        <p v-else-if="callable.source === 'all'" class="ai-agent-picker-note">
          這顆技能還沒有指派 Agent，可以從所有 Agent 中挑一個來答題
        </p>
        <div class="se-agent-grid ai-agent-options">
          <button
            v-for="agent in callable.agents"
            :key="agent"
            type="button"
            :class="['se-agent-chip', 'ai-agent-option', { 'is-selected': selectedAgent === agent }]"
            @click="selectedAgent = agent"
          >
            <i class="material-symbols-outlined">smart_toy</i>
            {{ agent }}
            <i v-if="selectedAgent === agent" class="material-symbols-outlined se-chip-check">check</i>
          </button>
        </div>
      </div>
      <div class="ai-idle-actions">
        <button v-if="pickingAgent" type="button" class="custom-btn ai-cancel-pick-btn" @click="pickingAgent = false">
          取消
        </button>
        <button
          type="button"
          class="custom-btn custom-main-btn ai-generate-btn"
          :disabled="!selectedAgent"
          @click="regenerate"
        >
          <i class="material-symbols-outlined">play_circle</i>
          生成測試情境
        </button>
      </div>
    </div>

    <!-- ② Scenarios：AI 出題、答題 Agent 作答，使用者標註每一題的正確答案 -->
    <template v-else>
      <div class="ai-toolbar">
        <div class="ai-toolbar-left">
          <span class="ai-answering-agent">
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
        <button class="custom-btn ai-regenerate-btn" @click="startPickAgent">
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

          <!-- 題目是一句使用者會講的話，Agent 的作答接在下面，讀起來像「使用者說 → Agent 判斷」 -->
          <div class="scenario-input">
            <span class="scenario-input-label">使用者輸入</span>
            {{ sc.input }}
          </div>
          <div :class="['scenario-agent-answer', `is-${sc.status}`]">
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
          <button
            v-if="isFullPass && !props.embedded"
            type="button"
            class="custom-btn custom-main-btn ai-enable-btn"
            @click="handleEnableClick"
          >
            <i class="material-symbols-outlined">check_circle</i>啟用技能
          </button>
          <button
            v-else-if="showSaveAndEnable && !props.embedded"
            type="button"
            class="custom-btn custom-main-btn ai-save-enable-btn"
            :disabled="!props.canSave"
            @click="handleSaveAndEnable"
          >
            <i class="material-symbols-outlined">save</i>儲存並啟用
          </button>
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
// canSave：還沒存檔時，「儲存並啟用」按鈕要知道草稿目前能不能存（名稱／指令等
// 必填欄位有沒有填），不能存的時候要讓按鈕反灰，不能讓使用者點了卻靜默失敗。
// requestSaveDraft：還沒存檔的草稿想「存檔並啟用」一次做完，但這個元件本身不知道怎麼
// 存草稿（那是 conv.save() 的事）——用一個同步的 callback prop 直接拿到新技能 id，
// 不用靠 emit 再等 props.skillId 反應更新那種跨好幾層元件的非同步 prop 傳遞，
// 省掉一輪 nextTick 等待、也比較好測試
// embedded：嵌在 SkillEnableFlow 的「還不能啟用」對話框裡就地測試時，啟用由對話框
// 自己接手，這裡不顯示啟用按鈕、也不再掛一層 SkillEnableFlow
const props = defineProps<{
  embedded?: boolean
  skillId: string
  draftContext?: TriggerEdgeSource
  canSave?: boolean
  requestSaveDraft?: () => string | null
  // 呼叫端（SkillStudioPreview）有真正的對話串可以顯示生成中的敘事文字時傳 true，
  // 隱藏掉這裡自己的敘事泡泡，避免同一段話左右兩欄同時出現
  hideGenerationNarration?: boolean
}>()
const store = useSkillStore()
const enableFlowRef = ref<InstanceType<typeof SkillEnableFlow> | null>(null)

onMounted(() => store.ensureAITestStateForSkill(props.skillId))
watch(() => props.skillId, (id) => store.ensureAITestStateForSkill(id))

// 全域的 aiTestReport 必須確實屬於這顆技能（不是另一顆技能留下的舊報告），
// 而且這顆技能還沒啟用才顯示按鈕——已啟用的技能不該被「啟用」按鈕再切回停用
const isFullPass = computed(() => {
  if (store.aiTestScenariosSkillId !== props.skillId) return false
  const report = store.aiTestReport
  if (!report || report.total === 0 || report.correct !== report.total) return false
  const skill = store.findSkill(props.skillId)
  return !!skill && !skill.isEnabled
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

// 還沒存檔、但已經有一份測試紀錄（不限 100%——沒全對的話存檔後會先看到
// 「還不能啟用」閘門對話框，使用者可以當場選立即測試／視為通過／取消，
// 不用先存檔再回來找另一顆按鈕重新走一次）
const showSaveAndEnable = computed(() => {
  if (store.findSkill(props.skillId)) return false
  if (store.aiTestScenariosSkillId !== props.skillId) return false
  return !!store.aiTestReport && store.aiTestReport.total > 0
})

async function handleSaveAndEnable() {
  const newId = props.requestSaveDraft?.()
  if (!newId) return  // canSave 是 false，存檔沒有真的發生
  const skill = store.findSkill(newId)
  if (!skill) return
  const outcome = await enableFlowRef.value!.requestEnable(skill, skill.assignedAgents ?? [])
  if (outcome.type === 'cancelled') return
  store.setAssignedAgents(skill.id, outcome.agents)
  store.toggleSkill(skill.id)
}

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

// 答題 Agent 候選：可以調用這顆技能的 Agent。只有一個候選就直接幫忙選好，
// 有好幾個時要使用者自己挑（預設沿用上一次答題的 Agent——包含對話裡點「重新測試」
// 直接由 store 沿用的那個——只要它仍在候選裡）
const callable = computed(() => store.getAITestCallableAgents(props.skillId, props.draftContext))
const selectedAgent = ref<string | null>(null)
watch([callable, () => store.aiTestAnsweringAgent], ([{ agents }, last]) => {
  if (last && agents.includes(last)) selectedAgent.value = last
  else if (selectedAgent.value && agents.includes(selectedAgent.value)) return
  else selectedAgent.value = agents.length === 1 ? agents[0] : null
}, { immediate: true })

// 「重新生成」先回到選答題 Agent 的畫面（可以換一個 Agent 再測），題目留著，按取消就回去
const pickingAgent = ref(false)
function startPickAgent() {
  pickingAgent.value = true
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

// 題目生成完成要讓使用者知道，不是生成中的敘事文字講完就沒下文。對話建立的技能
// 有真正的對話串，由 SkillStudioWorkspace.vue 的 watcher 呼叫 conv.notifyTestGenerated()
// 在裡面講這句話（見 hideGenerationNarration 同一組判斷）；這裡沒有對話串可用的
// 其他畫面（自行建立精靈／積木方式／就地測試／獨立沙盒）用 toast 簡單提示一下
async function regenerate() {
  if (!selectedAgent.value) return
  draftAnswers.value = {}
  pickingAgent.value = false
  await store.generateAITestScenarios(props.skillId, props.draftContext, selectedAgent.value)
  if (!props.hideGenerationNarration) {
    popDialog.toast('測試情境生成完成，Agent 已作答，請標註正確答案！')
  }
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
