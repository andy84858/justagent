<template>
  <div class="SkillEditor views-page">
    <div class="views-page-content-box">

      <div class="page-banner">
        <div>
          <AppBreadcrumb />
          <div class="banner-title">{{ isEditMode ? '編輯技能' : '建立技能' }}</div>
        </div>
      </div>

      <div v-if="hasNameConflict" class="name-conflict-banner">
        <i class="material-symbols-outlined">info</i>
        你已經有一份來自「{{ conflictSourceName }}」的技能了，建議修改顯示名稱以便區分。
      </div>

      <!-- 步驟指示器 -->
      <div class="se-stepper">
        <button
          type="button"
          v-for="(label, i) in STEPS"
          :key="i"
          :class="['se-step', { 'is-active': currentStep === i, 'is-done': currentStep > i }]"
          :disabled="currentStep <= i || isStepLocked(i)"
          :aria-current="currentStep === i ? 'step' : undefined"
          @click="currentStep > i && !isStepLocked(i) ? (currentStep = i) : undefined"
        >
          <span class="se-step-bubble">
            <i v-if="currentStep > i" class="material-symbols-outlined">check</i>
            <span v-else>{{ i + 1 }}</span>
          </span>
          <span class="se-step-label">{{ label }}</span>
        </button>
        <div class="se-step-track">
          <div class="se-step-fill" :style="{ width: fillWidth }" />
        </div>
      </div>

      <!-- 步驟內容 -->
      <div class="se-body">

        <!-- Step 0：基本資訊 -->
        <template v-if="currentStep === 0">
          <div class="se-section">
            <label class="se-label">技能名稱 <span class="se-required">*</span></label>
            <input
              v-model="form.name"
              class="custom-input"
              placeholder="例：ERP 庫存查詢"
              maxlength="40"
              autofocus
            />
            <p class="se-hint">簡短精確，讓 Agent 在選用時能快速識別。</p>
          </div>
          <div class="se-section">
            <div class="se-label-row">
              <label class="se-label">技能描述</label>
              <span class="se-ai-badge">
                <i class="material-symbols-outlined">auto_awesome</i>AI 自動生成
              </span>
            </div>
            <div class="se-ai-desc">
              <template v-if="existingSkill?.description">{{ existingSkill.description }}</template>
              <span v-else class="se-ai-desc-hint">AI 將根據技能指令自動識別並填入描述</span>
            </div>
          </div>
        </template>

        <!-- Step 1：技能指令 -->
        <template v-else-if="currentStep === 1">
          <div class="se-primary-section">
            <label class="se-label">技能指令（Instructions）</label>
            <p class="se-hint">
              定義此技能的角色、行為規則與限制。Agent 執行此技能時依照這份指令運作。
              可使用 Markdown，支援條列式規則與範例。
            </p>
            <div class="se-editor-wrap">
              <textarea
                v-model="form.instructions"
                class="custom-input se-textarea-lg se-mono"
                :placeholder="instructionsPlaceholder"
              />
              <div class="se-char-count">{{ form.instructions.length }} 字元</div>
            </div>
          </div>

          <div class="se-section">
            <div class="se-secondary-section">
              <label class="se-label">觸發時機（選填）</label>
              <p class="se-hint">描述 Agent 在什麼情境下應優先選用此技能，幫助路由判斷更準確。</p>
              <textarea
                v-model="form.triggerHint"
                class="custom-input se-textarea-sm"
                placeholder="例：當用戶詢問庫存數量、倉庫存量、缺貨狀態等相關問題時使用"
                rows="3"
                maxlength="300"
              />
            </div>
          </div>

          <div class="se-section">
            <label class="se-label">覆蓋能力（選填）</label>
            <p class="se-hint">拆解這個技能具體涵蓋哪些能力，例如「問題分類」「情緒分析」，方便之後在技能詳情快速掌握技能範圍。</p>
            <SkillCapabilityEditor v-model="form.capabilities" />
          </div>

          <div class="se-section">
            <label class="se-label">指派 Agent <span class="se-required">*</span></label>
            <p class="se-hint">選擇哪些 Agent 可以調用此技能，至少指派一位。</p>
            <AgentAssignGrid v-model="form.assignedAgents" />
          </div>
        </template>

        <!-- Step 2：確認 -->
        <template v-else-if="currentStep === 2">
          <h3 class="se-confirm-title">{{ form.name }}</h3>

          <div class="se-confirm-grid lively-stagger">
            <div class="se-confirm-group lively-card">
              <div class="se-confirm-group-hd">
                <i class="material-symbols-outlined lively-icon">description</i>內容摘要
              </div>
              <div class="se-confirm-row">
                <span class="se-confirm-key">指令</span>
                <span class="se-confirm-val">
                  <span v-if="form.instructions">{{ form.instructions.length }} 字元</span>
                  <span v-else class="se-empty">（未填寫）</span>
                </span>
              </div>
              <div v-if="form.triggerHint" class="se-confirm-row">
                <span class="se-confirm-key">觸發時機</span>
                <span class="se-confirm-val">{{ form.triggerHint }}</span>
              </div>
              <div class="se-confirm-row">
                <span class="se-confirm-key">覆蓋能力</span>
                <span class="se-confirm-val">
                  <span v-if="form.capabilities.length">{{ form.capabilities.length }} 項能力</span>
                  <span v-else class="se-empty">（未填寫）</span>
                </span>
              </div>
            </div>

            <div class="se-confirm-group lively-card">
              <div class="se-confirm-group-hd">
                <i class="material-symbols-outlined lively-icon">tune</i>設定
              </div>
              <div class="se-confirm-row">
                <span class="se-confirm-key">指派 Agent</span>
                <span class="se-confirm-val">
                  <span v-if="form.assignedAgents.length">{{ form.assignedAgents.join('、') }}</span>
                  <span v-else class="se-empty">（未指派）</span>
                </span>
              </div>
              <div v-if="isEditMode" class="se-confirm-row se-confirm-row--toggle">
                <span class="se-confirm-key">啟用狀態</span>
                <label class="se-toggle">
                  <input type="checkbox" v-model="form.isEnabled" />
                  <span class="se-toggle-track"></span>
                </label>
              </div>
            </div>
          </div>

          <p class="se-confirm-note">
            <i class="material-symbols-outlined">info</i>
            {{ isEditMode ? '儲存後變更立即生效。' : '下一步會先建立這顆技能（預設未啟用），再進「AI 快速測試」驗證。' }}
          </p>
        </template>

        <!-- Step 3（僅全新建立）：測試 -->
        <template v-if="isTestStep">
          <div class="se-section">
            <p class="se-hint">技能已建立（未啟用）。AI 會自動產生測試情境，通過後就能啟用；也可以先略過，之後再回來測試。</p>
          </div>
          <SkillTestAI :skill-id="createdSkillId!" />
        </template>

      </div>

      <!-- 底部導覽 -->
      <div class="se-footer">
        <button v-if="canGoBack" class="custom-btn" @click="currentStep--">
          <i class="material-symbols-outlined">arrow_back</i>上一步
        </button>
        <span v-else />
        <div class="se-footer-right">
          <!-- 編輯模式：這份 form 只是從既有技能複製出來改的，沒按「儲存變更」
               就離開不會動到原本的技能，所以文字講「放棄修改」而不是泛用的「取消」。
               測試步驟代表技能已經建立了，不是能回頭的「取消」狀態，不顯示這顆鍵 -->
          <button v-if="!isTestStep" class="custom-btn" @click="router.push('/view/Skills')">{{ isEditMode ? '放棄修改' : '取消' }}</button>
          <button
            v-if="currentStep < STEPS.length - 1"
            class="custom-btn custom-main-btn"
            :disabled="(currentStep === 0 && !form.name.trim()) || (isNewCreate && currentStep === STEPS.length - 2 && !canSubmit)"
            @click="handleNext"
          >
            下一步<i class="material-symbols-outlined">arrow_forward</i>
          </button>
          <button
            v-else-if="isTestStep"
            class="custom-btn custom-main-btn"
            @click="router.push('/view/Skills')"
          >
            <i class="material-symbols-outlined">check</i>完成
          </button>
          <button
            v-else
            class="custom-btn custom-main-btn"
            :disabled="!canSubmit"
            @click="handleSubmit"
          >
            <i class="material-symbols-outlined">check</i>
            {{ isEditMode ? '儲存變更' : '建立技能' }}
          </button>
        </div>
      </div>
      <p v-if="!isTestStep && !canSubmit && (currentStep === STEPS.length - 1 || (isNewCreate && currentStep === STEPS.length - 2))" class="se-confirm-note se-submit-missing-hint">
        <i class="material-symbols-outlined">info</i>請先填寫：{{ missingRequiredFields.join('、') }}
      </p>

      <SkillEnableFlow ref="enableFlowRef" />

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import SkillCapabilityEditor from '@/components/Skill/SkillCapabilityEditor.vue'
import AgentAssignGrid from '@/components/Skill/AgentAssignGrid.vue'
import SkillEnableFlow from '@/components/Skill/SkillEnableFlow.vue'
import SkillTestAI from '@/components/Skill/SkillTestAI.vue'
import { useSkillStore } from '@/stores/skillStore'
import type { DraftSkill, SkillFile, SkillCapability } from '@/stores/skillStore'

const router = useRouter()
const route = useRoute()
const store = useSkillStore()

const editSkillId = route.query.skillId as string | undefined
const draftId = route.query.draftId as string | undefined
const isEditMode = !!editSkillId
const isDraftMode = !!draftId
// 只有全新建立（不是編輯既有技能、也不是繼續編輯草稿）才多「測試」這一步——
// 編輯模式已經有 SkillEnableFlow 的啟用測試閘門了，不用在精靈裡重做一次
const isNewCreate = !isEditMode && !isDraftMode

const STEPS = isNewCreate
  ? (['基本資訊', '技能指令', '確認', '測試'] as const)
  : (['基本資訊', '技能指令', '確認'] as const)
const currentStep = ref(0)
// 離開「確認」步驟那一刻才真的呼叫 createPersonalSkill()，拿到 id 才能把
// SkillTestAI 綁到這顆剛建立的技能上
const createdSkillId = ref<string | null>(null)
const isTestStep = computed(() => isNewCreate && currentStep.value === STEPS.length - 1)
// 技能建立後，「基本資訊」「技能指令」的欄位內容已經跟已建立的技能脫勾——
// 不讓使用者點回去改，避免改了欄位卻忘記其實沒有寫回技能，測試結果跟畫面對不起來。
// 「確認」「測試」都是唯讀畫面，兩者之間可以互看
function isStepLocked(i: number) {
  return createdSkillId.value !== null && i < 2
}
const canGoBack = computed(() => currentStep.value > 0 && !isStepLocked(currentStep.value - 1))

const existingSkill = editSkillId ? store.findSkill(editSkillId) : null
const existingDraft = draftId ? (store.myDrafts as DraftSkill[]).find(d => d.id === draftId) ?? null : null

const enableFlowRef = ref<InstanceType<typeof SkillEnableFlow> | null>(null)

const hasNameConflict = computed(() => {
  if (!existingSkill || existingSkill.zone !== 'personal' || !existingSkill.derivedFrom) return false
  return store.hasSkillNameConflict(existingSkill.id)
})

const conflictSourceName = computed(() => {
  if (!existingSkill?.derivedFrom) return ''
  return store.findSkill(existingSkill.derivedFrom)?.name ?? existingSkill.derivedFrom
})

const form = reactive({
  name: existingSkill?.name ?? existingDraft?.name ?? '',
  instructions: existingSkill?.instructions ?? existingDraft?.instructions ?? '',
  triggerHint: existingSkill?.triggerHint ?? existingDraft?.triggerHint ?? '',
  assignedAgents: existingSkill?.assignedAgents
    ? [...existingSkill.assignedAgents]
    : existingDraft?.assignedAgents
      ? [...existingDraft.assignedAgents]
      : [] as string[],
  isEnabled: existingSkill?.isEnabled ?? true,
  files: existingSkill?.files ?? existingDraft?.files ?? [] as SkillFile[],
  capabilities: existingSkill?.capabilities ?? [] as SkillCapability[],
})

const fillWidth = computed(() => `${(currentStep.value / (STEPS.length - 1)) * 100}%`)

// 「原本停用、這次要切成啟用」會走下面 handleSubmit 裡的 SkillEnableFlow 共用流程，
// 那個流程自己就有一關「確認可調用 Agent」，會把指派結果寫回 form.assignedAgents
// 再送出——這裡不能同時也要求 assignedAgents 必填，不然使用者永遠按不下去這顆鍵，
// 進不了那個本來就是設計來補齊 Agent 指派的流程
const willGoThroughEnableFlow = computed(() =>
  isEditMode && !!existingSkill && form.isEnabled && !existingSkill.isEnabled
)

// 唯一的必填限制（名稱）只卡在能不能往下一步走；指派 Agent 必填只卡在真正送出
// （建立技能／儲存變更）那一刻，中途步驟之間可以留白
const missingRequiredFields = computed(() => {
  const missing: string[] = []
  if (!form.name.trim()) missing.push('技能名稱')
  if (!willGoThroughEnableFlow.value && !form.assignedAgents.length) missing.push('指派 Agent')
  return missing
})
const canSubmit = computed(() => missingRequiredFields.value.length === 0)

const instructionsPlaceholder = `你是一個專門處理 ERP 庫存查詢的助理。

## 行為規則
- 收到庫存查詢請求時，先確認產品 ID 格式正確（格式：SKU-XXXXX）
- 查詢範圍涵蓋所有倉庫，預設返回總庫存量
- 若庫存低於安全存量（50 件），主動提示補貨建議

## 輸出格式
以條列式呈現各倉庫庫存，最後附上總計。`

function buildPayload() {
  return {
    name: form.name.trim(),
    instructions: form.instructions.trim(),
    triggerHint: form.triggerHint.trim(),
    assignedAgents: [...form.assignedAgents],
    isEnabled: form.isEnabled,
    files: [...form.files],
    // 過濾掉空字串（理論上不會發生，SkillCapabilityEditor 不會送出空白標籤，
    // 這裡只是防呆)
    capabilities: form.capabilities.map(c => c.trim()).filter(Boolean),
  }
}

async function handleSubmit() {
  if (!canSubmit.value) return

  // 編輯模式下，如果是「原本停用、這次要切成啟用」而且還沒過測試關卡，
  // 先跑「檢查閘門 → 確認 Agent」共用流程，通過才繼續送出
  if (isEditMode && editSkillId && existingSkill && form.isEnabled && !existingSkill.isEnabled) {
    const outcome = await enableFlowRef.value!.requestEnable(existingSkill, form.assignedAgents)
    if (outcome.type === 'cancelled') return
    if (outcome.type === 'revise') {
      router.push({ name: 'SkillManagement', query: { skillId: editSkillId } })
      return
    }
    if (outcome.type === 'goToTest') {
      router.push({ name: 'SkillManagement', query: { skillId: editSkillId, tab: 'test' } })
      return
    }
    form.assignedAgents = outcome.agents
    store.updateSkill(editSkillId, { ...buildPayload(), isEnabled: true })
    router.push('/view/Skills')
    return
  }

  const payload = buildPayload()
  if (isDraftMode && draftId) {
    store.updateDraft(draftId, payload)
  } else if (isEditMode && editSkillId) {
    store.updateSkill(editSkillId, payload)
  }
  // 全新建立不會走到這裡：那個分支現在由 handleNext() 在離開「確認」步驟時
  // 處理，建立完技能後進「測試」步驟，不是在這裡直接送出離開頁面
  router.push('/view/Skills')
}

function handleNext() {
  // 全新建立：離開「確認」步驟那一刻才真的建立技能，進「測試」步驟。
  // 技能一律先進個人技能區、以未啟用落地——createPersonalSkill() 本來就無條件
  // 寫死 isEnabled: false，完全不讀這裡 payload.isEnabled 的值，不需要、也不應該
  // 接 SkillEnableFlow。用 createdSkillId 擋重複呼叫，避免使用者在確認／測試
  // 步驟間來回切換時建出好幾顆同名技能
  if (isNewCreate && currentStep.value === STEPS.length - 2) {
    if (!createdSkillId.value) {
      createdSkillId.value = store.createPersonalSkill(buildPayload())
    }
    currentStep.value++
    return
  }
  currentStep.value++
}
</script>
