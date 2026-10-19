<template>
  <div class="SkillTestAI">

    <!-- ① Idle / Generating -->
    <div v-if="store.aiTestIsGenerating" class="ai-idle">
      <div class="ai-idle-spinner">
        <span></span><span></span><span></span>
      </div>
      <p>AI 正在分析技能描述並生成測試情境...</p>
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
          <span class="ai-progress-text">已作答 {{ answeredCount }} / {{ store.aiTestScenarios.length }}</span>
        </div>
        <button class="custom-btn" @click="regenerate">
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
            <button class="custom-btn custom-btn--sm" @click="answer(sc.id, true)">該觸發</button>
            <button class="custom-btn custom-btn--sm" @click="answer(sc.id, false)">不該觸發</button>
          </div>

          <div v-else :class="['result-judgment', sc.status === 'correct' ? 'judgment--pass' : 'judgment--fail']">
            <i class="material-symbols-outlined">
              {{ sc.status === 'correct' ? 'check_circle' : 'cancel' }}
            </i>
            <strong>{{ sc.status === 'correct' ? '答對了' : '答錯了' }}</strong>
            <span>正確答案是「{{ sc.expectedTrigger ? '該觸發' : '不該觸發' }}」。{{ sc.expectedBehavior }}</span>
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
              v-for="(label, tag) in TAG_LABELS"
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
            v-if="isFullPass"
            type="button"
            class="custom-btn custom-main-btn ai-enable-btn"
            @click="handleEnableClick"
          >
            <i class="material-symbols-outlined">check_circle</i>啟用技能
          </button>
          <button
            v-else-if="showSaveAndEnable"
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

    <SkillEnableFlow ref="enableFlowRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSkillStore } from '@/stores/skillStore'
import type { AITestTag, TriggerEdgeSource } from '@/stores/skillStore'
import SkillEnableFlow from '@/components/Skill/SkillEnableFlow.vue'

// draftContext：抽屜裡測試還沒存檔的草稿時，store 裡找不到這顆技能（或技能存在
// 但草稿已經改過還沒存），用這個當作組題關鍵字的來源。獨立測試沙盒（一定是已存檔
// 的技能）不用傳這個，退回讀 store 裡的技能資料
// canSave：還沒存檔時，「儲存並啟用」按鈕要知道草稿目前能不能存（名稱／指令等
// 必填欄位有沒有填），不能存的時候要讓按鈕反灰，不能讓使用者點了卻靜默失敗。
// requestSaveDraft：還沒存檔的草稿想「存檔並啟用」一次做完，但這個元件本身不知道怎麼
// 存草稿（那是 conv.save() 的事）——用一個同步的 callback prop 直接拿到新技能 id，
// 不用靠 emit 再等 props.skillId 反應更新那種跨好幾層元件的非同步 prop 傳遞，
// 省掉一輪 nextTick 等待、也比較好測試
const props = defineProps<{
  skillId: string
  draftContext?: TriggerEdgeSource
  canSave?: boolean
  requestSaveDraft?: () => string | null
}>()
const store = useSkillStore()
const enableFlowRef = ref<InstanceType<typeof SkillEnableFlow> | null>(null)
const router = useRouter()

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
  if (outcome.type === 'revise') {
    router.push({ path: '/view/Skills', query: { skillId: skill.id } })
    return
  }
  // 這顆按鈕只在 100% 全對時出現，isFullPass 已經保證 canEnableSkill() 為
  // true，理論上不會走到閘門對話框、更不會拿到 goToTest——但呼叫端仍要處理
  // 完整的 EnableFlowOutcome，不能假設只會 resolve confirmed
  if (outcome.type === 'goToTest') return
  store.setAssignedAgents(skill.id, outcome.agents)
  store.toggleSkill(skill.id)
}

// 還沒存檔、但已經有一份測試紀錄（不限 100%——沒全對的話存檔後會先看到
// 「還不能啟用」閘門對話框，使用者可以當場選視為通過／去修改／取消，
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
  if (outcome.type === 'revise') {
    router.push({ path: '/view/Skills', query: { skillId: skill.id } })
    return
  }
  // 使用者在閘門對話框選「前往測試」：已經就在測試頁面了，不用額外導頁
  if (outcome.type === 'goToTest') return
  store.setAssignedAgents(skill.id, outcome.agents)
  store.toggleSkill(skill.id)
}

const TAG_LABELS: Record<AITestTag, string> = {
  normal: '正常流程',
  boundary: '邊界情況',
  trigger_edge: '觸發邊緣',
}

function tagLabel(tag: AITestTag): string {
  return TAG_LABELS[tag]
}

const answeredCount = computed(() =>
  store.aiTestScenarios.filter(s => s.status !== 'pending').length
)

const ratePercent = computed(() => {
  if (!store.aiTestReport || !store.aiTestReport.total) return 0
  return Math.round((store.aiTestReport.correct / store.aiTestReport.total) * 100)
})

function regenerate() {
  store.generateAITestScenarios(props.skillId, props.draftContext)
}

function answer(scenarioId: string, userAnswer: boolean) {
  store.answerAITestScenario(props.skillId, scenarioId, userAnswer)
}
</script>
