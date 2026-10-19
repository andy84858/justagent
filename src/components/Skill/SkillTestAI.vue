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

    <div v-else-if="!store.aiTestScenarios.length" class="ai-idle">
      <i class="material-symbols-outlined ai-idle-icon">auto_awesome</i>
      <p class="ai-idle-hint">AI 將依技能描述自動產生 6–8 個測試案例</p>
      <button class="custom-btn custom-main-btn" @click="regenerate">
        <i class="material-symbols-outlined">play_circle</i>
        生成測試情境
      </button>
    </div>

    <!-- ② Scenarios：選擇題形式，AI 出題、使用者判斷該不該觸發 -->
    <template v-else>
      <div class="ai-toolbar">
        <div class="ai-toolbar-left">
          <span class="ai-progress-text">已選 {{ answeredCount }} / {{ store.aiTestScenarios.length }}</span>
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
                <i class="material-symbols-outlined">check_circle</i>答對了
              </span>
              <span v-else-if="sc.status === 'incorrect'" class="status-badge badge--fail">
                <i class="material-symbols-outlined">cancel</i>答錯了
              </span>
            </div>
          </div>

          <div class="scenario-input">{{ sc.input }}</div>
          <p class="scenario-question">這句話該不該觸發這顆技能？</p>

          <div v-if="sc.status === 'pending'" class="scenario-answer-btns">
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

          <div v-else :class="['result-judgment', sc.status === 'correct' ? 'judgment--pass' : 'judgment--fail']">
            <div class="result-judgment-head">
              <i class="material-symbols-outlined">
                {{ sc.status === 'correct' ? 'check_circle' : 'cancel' }}
              </i>
              <strong>{{ sc.status === 'correct' ? '答對了' : '答錯了' }}</strong>
            </div>
            <div class="result-answer-row">
              <span :class="['result-answer-pill', sc.status === 'correct' ? 'pill--pass' : 'pill--fail']">
                <span class="result-answer-pill-label">你的答案</span>{{ sc.userAnswer ? '該觸發' : '不該觸發' }}
              </span>
              <span class="result-answer-pill pill--neutral">
                <span class="result-answer-pill-label">正確答案</span>{{ sc.expectedTrigger ? '該觸發' : '不該觸發' }}
              </span>
            </div>
            <p class="result-explanation">{{ sc.expectedBehavior }}</p>
          </div>
        </div>

        <!-- ③ Report -->
        <div v-if="store.aiTestReport" class="ai-report">
          <div class="report-header">
            <span class="report-title">測試報告</span>
            <span class="report-rate">
              {{ store.aiTestReport.correct }} / {{ store.aiTestReport.total }} 答對
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
  if (outcome.wasOverridden) store.overrideAndEnableSkill(skill.id)
  else store.toggleSkill(skill.id)
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
  if (outcome.wasOverridden) store.overrideAndEnableSkill(skill.id)
  else store.toggleSkill(skill.id)
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

// 統一送答案：每一題先選答案（draftAnswers，純前端暫存、還沒送出前不計分），
// 全部選完才能按「送出答案」一次送出、一次計分出報告——不是選一題就立刻知道對錯
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
  draftAnswers.value = {}
  await store.generateAITestScenarios(props.skillId, props.draftContext)
  if (!props.hideGenerationNarration) {
    popDialog.toast('測試情境生成完成，開始作答吧！')
  }
}

function selectAnswer(scenarioId: string, userAnswer: boolean) {
  draftAnswers.value = { ...draftAnswers.value, [scenarioId]: userAnswer }
}

function submitAnswers() {
  if (!allAnswersSelected.value) return
  store.submitAITestAnswers(props.skillId, draftAnswers.value)
  draftAnswers.value = {}
}
</script>
