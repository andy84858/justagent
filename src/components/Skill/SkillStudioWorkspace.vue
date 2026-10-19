<template>
  <div class="skill-studio-layout">
    <div class="studio-chat-col">
      <!-- 方案三：從 conv4 交接過來的草稿，帶一條回原對話的路，並說明這顆草稿從哪來 -->
      <template v-if="handoffOrigin">
        <button type="button" class="custom-btn studio-back-link" @click="onBackToOrigin">
          <i class="material-symbols-outlined">arrow_back</i>返回原本的對話
        </button>
        <div class="studio-origin-bar">
          <i class="material-symbols-outlined">history</i>來自本對話的「{{ handoffOrigin.reason }}」流程
        </div>
      </template>
      <SkillMethodChooser v-if="!conv.draft.value.method" @choose="conv.chooseMethod" />
      <SkillStudioChat
        v-else-if="conv.draft.value.method === 'chat'"
        compact
        :mode="conv.mode.value"
        :skill-name="conv.draft.value.name"
        :saved-skill-id="conv.savedSkillId.value"
        :messages="conv.messages.value"
        :is-running="conv.isRunning.value"
        :suggestion-chips="conv.suggestionChips.value"
        :personal-skills="[]"
        @send="conv.send"
      />
      <div v-else class="studio-composer-col">
        <div class="studio-composer-head">
          <span :class="['ssc-mode-chip', `ssc-mode-chip--${conv.mode.value}`]">
            <i class="material-symbols-outlined">dashboard_customize</i>{{ conv.mode.value === 'create' ? '用行銷積木組裝' : `修改：${conv.draft.value.name}` }}
          </span>
        </div>
        <!-- 原本所有欄位擠在同一頁，內容一多看起來很雜——拆成兩步驟：先定義這顆技能
             本身（基本設定），再決定報告要包含哪些章節（積木組成）。兩個 tab 可以自由
             切換、不是鎖死的精靈，因為「基本設定」的 AI 建議要吃「積木組成」選的章節 -->
        <div class="sbc-step-tabs">
          <button type="button" :class="['sbc-step-tab', { 'is-active': blockStep === 'basics' }]" @click="blockStep = 'basics'">
            <i class="material-symbols-outlined">tune</i>基本設定
          </button>
          <button type="button" :class="['sbc-step-tab', { 'is-active': blockStep === 'compose' }]" @click="blockStep = 'compose'">
            <i class="material-symbols-outlined">dashboard_customize</i>積木組成
          </button>
        </div>
        <SkillBlockBasicsForm
          v-if="blockStep === 'basics'"
          :name="conv.draft.value.name"
          :description="conv.draft.value.description"
          :trigger-hint="conv.draft.value.triggerHint"
          :keywords="conv.draft.value.keywords"
          :capabilities="conv.draft.value.capabilities"
          :assigned-agents="conv.draft.value.assignedAgents"
          :section-ids="conv.draft.value.sectionIds"
          :name-conflict="nameConflict"
          @update:name="v => conv.updateBlocks({ name: v })"
          @update:description="conv.updateBlockDescription"
          @update:trigger-hint="conv.updateBlockTriggerHint"
          @update:keywords="conv.updateBlockKeywords"
          @update:capabilities="conv.updateBlockCapabilities"
          @update:assigned-agents="conv.updateBlockAssignedAgents"
        />
        <SkillBlockComposer
          v-else
          :section-ids="conv.draft.value.sectionIds"
          @update:section-ids="ids => conv.updateBlocks({ sectionIds: ids })"
        />
      </div>

      <!-- 儲存／放棄固定在這裡，不隨右欄「技能預覽／測試」tab 切換而消失或跑到
           看不到的地方——見 SkillStudioPreview.vue 的 hideFooter。
           有測試紀錄時（不限 100%、不管技能原本有沒有啟用、存不存過檔）這顆鍵
           升級成「儲存並啟用」：存檔之後順便走一次啟用確認流程；沒有測試紀錄
           就是單純存檔，不碰啟用——見 handleSaveClick -->
      <div class="studio-save-footer">
        <button
          type="button"
          class="custom-btn custom-main-btn studio-save-btn"
          :disabled="!saveClickEnabled"
          @click="handleSaveClick"
        >
          <i class="material-symbols-outlined">save</i>
          {{ saveButtonLabel }}
        </button>
        <p v-if="conv.missingFieldsHint.value" class="studio-missing-hint">
          <i class="material-symbols-outlined">info</i>{{ conv.missingFieldsHint.value }}
        </p>
        <button v-if="conv.mode.value === 'edit' && conv.savedSkillId.value" type="button" class="custom-btn" @click="onDiscard">
          <i class="material-symbols-outlined">undo</i>放棄修改
        </button>
      </div>
      <SkillEnableFlow ref="enableFlowRef" />
    </div>
    <div class="studio-side-col">
      <SkillStudioPreview
        v-model:active-tab="activeTab"
        hide-files
        hide-nav-links
        hide-footer
        :draft="conv.draft.value"
        :note="conv.note.value"
        :mode="conv.mode.value"
        :saved-skill-id="conv.savedSkillId.value"
        :test-skill-id="conv.testSkillId.value"
        :is-dirty="conv.isDirty.value"
        :can-save="conv.canSave.value"
        :name-conflict="nameConflict"
        :request-save-draft="conv.save"
        @save="onSave"
        @discard="onDiscard"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { LocationQuery } from 'vue-router'
import SkillStudioChat from '@/components/Skill/SkillStudioChat.vue'
import SkillStudioPreview from '@/components/Skill/SkillStudioPreview.vue'
import SkillMethodChooser from '@/components/Skill/SkillMethodChooser.vue'
import SkillBlockComposer from '@/components/Skill/SkillBlockComposer.vue'
import SkillBlockBasicsForm from '@/components/Skill/SkillBlockBasicsForm.vue'
import SkillEnableFlow from '@/components/Skill/SkillEnableFlow.vue'
import { useSkillStore } from '@/stores/skillStore'
import { useAiviewerStore } from '@/stores/AiViewerStore'
import { useSkillStudioConversation } from '@/composables/useSkillStudioConversation'
import { consumeSkillHandoff } from '@/composables/useSkillHandoff'
import type { SkillHandoffOrigin } from '@/composables/useSkillHandoff'
import popDialog from '@/services/popDialog'

// 外殼（頁面／抽屜）只認得「query 長什麼樣子」，不用知道 conv 內部狀態——
// 初次掛載讀 initialQuery；之後外殼自己的路由守衛通過後，用 defineExpose 出去的
// applyQuery() 重新套用，跟現在 SkillStudio.vue 的 applyQuery() 呼叫時機一致
const props = defineProps<{ initialQuery?: LocationQuery }>()
// 放棄修改：草稿重設回目前已儲存的版本後，請外殼（抽屜）關閉
const emit = defineEmits<{ discard: [] }>()

const router = useRouter()
const store = useSkillStore()
const aiviewerStore = useAiviewerStore()
const conv = useSkillStudioConversation()
const activeTab = ref<'preview' | 'test'>('preview')
// 積木流程「基本設定／積木組成」兩個 tab 可以自由切換，不是鎖死的精靈——
// 預設停在「基本設定」，跟使用者確認過的步驟順序一致
const blockStep = ref<'basics' | 'compose'>('basics')
// 方案三：conv4 的建議卡按「是」交接過來的來源；只在真的套用了交接草稿時設，
// 換去別的技能／重新開一顆新技能後清空——「返回原對話」連結才不會誤導
const handoffOrigin = ref<SkillHandoffOrigin | null>(null)
const enableFlowRef = ref<InstanceType<typeof SkillEnableFlow> | null>(null)

const nameConflict = computed(() => {
  const n = conv.draft.value.name.trim()
  return !!n && store.myPersonalSkills.some(s => s.id !== conv.savedSkillId.value && s.name === n)
})

// 有沒有一份屬於目前這份草稿（不管存不存過檔）的測試紀錄——不限 100%，
// 也不管技能原本是不是已經啟用中，只要測過就算
const hasTestRecord = computed(() =>
  store.aiTestScenariosSkillId === conv.testSkillId.value && !!store.aiTestReport
)

const saveButtonLabel = computed(() => {
  if (hasTestRecord.value) return '儲存並啟用'
  return conv.mode.value === 'create' ? '儲存為個人技能' : '儲存修改'
})

// 「儲存並啟用」只要草稿本身是完整、可存的狀態（canSave）就能點，不用額外要求
// isDirty——使用者可能只是重新測了一次、內容其實沒改，但仍然想走一次啟用確認
// 流程（例如重新確認 Agent 指派）。沒有測試紀錄的一般存檔維持原本 saveEnabled
// 的規則（要有改動才能按）
const saveClickEnabled = computed(() => hasTestRecord.value ? conv.canSave.value : conv.saveEnabled.value)

// AI 快速測試完成（store.aiTestReport 從 null 變成一份報告，一輪測驗只會發生一次
// 這樣的轉換——見 _computeAITestReport 在所有題目答完前都是 no-op）：交給 conv 判斷
// 要不要在左側對話主動引導使用者調整內容
watch(() => store.aiTestReport, report => {
  if (report) conv.notifyTestResult(report)
})

// 使用者在引導訊息點「重新測試」：conv 自己呼叫得到 store.generateAITestScenarios，
// 但切不了這裡才有的 activeTab——讀到這個單次訊號就切到測試 tab，讀完歸零
watch(() => conv.requestTestTab.value, requested => {
  if (!requested) return
  activeTab.value = 'test'
  conv.requestTestTab.value = false
})

// 修改模式下使用者確認要開始建立新技能：conv 已經把草稿悄悄重設回已儲存版本了，
// 這裡只負責把抽屜導去全新的建立流程——用 router.push 換掉 query，drawer 外殼
// 會依新的 query 重新套用成建立模式
watch(() => conv.requestNewSkillDrawer.value, requested => {
  if (!requested) return
  conv.requestNewSkillDrawer.value = false
  router.push({ query: { method: 'chat' } })
})

// ?skillId= 進修改模式；找不到／不是個人技能都退回建立模式，不拋錯。
// ?intent=ask 是從測試沙盒點「詢問技能助理」進來的——一樣是 loadSkill()，
// 只是開場白換一句不預設「要改」的問句，其餘（gateStage/mode/method）完全相同。
// ?from= 是方案三的 conv4 交接：consumeSkillHandoff() 有值才套用預填草稿並記住
// 返回連結；讀不到（例如重新整理過頁面、交接資料已被用掉）就退回一般建立模式。
function applyQuery(query: LocationQuery) {
  activeTab.value = query.tab === 'test' ? 'test' : 'preview'
  const skillId = typeof query.skillId === 'string' ? query.skillId : ''
  if (skillId) {
    const skill = store.findSkill(skillId)
    if (!skill) {
      popDialog.toast('找不到這個技能')
    } else if (skill.zone !== 'personal') {
      popDialog.toast('Library 技能請先在技能管理複製為個人技能')
    } else if (conv.loadSkill(skillId, query.intent === 'ask' ? 'ask' : 'edit')) {
      return
    }
  } else if (query.from) {
    const handoff = consumeSkillHandoff()
    if (handoff) {
      handoffOrigin.value = handoff.origin
      conv.startCreate(handoff.prefill, handoff.openingMessage)
      activeTab.value = 'preview'
      return
    }
  }
  conv.startCreate()
  // ?method= 是從技能管理「建立技能」選擇框直接指定的方式（對話／積木），
  // 讓使用者不用進來又被 SkillMethodChooser 問一次同樣的問題
  if (query.method === 'chat' || query.method === 'blocks') {
    conv.chooseMethod(query.method)
  }
  activeTab.value = 'preview'
}

// 方案三：真的存過技能才補一句「已建立」——回去晃一圈但沒存，代理人沒東西好回報
function onBackToOrigin() {
  guardDirty(() => {
    if (handoffOrigin.value?.conversationId === 'conv4' && conv.savedSkillId.value) {
      aiviewerStore.pushConv4Message({ agent: 'brain', msg: `✅ 個人技能「${conv.draft.value.name}」已建立完成。` })
    }
    router.push({ name: 'AiViewer' })
  })
}

// 有未儲存變更時，離開（返回原對話）前要確認；沒有變更就直接做
function guardDirty(proceed: () => void) {
  if (!conv.isDirty.value) {
    proceed()
    return
  }
  popDialog.confirm('有未儲存的變更，確定要放棄嗎？', '放棄變更', '留下', proceed)
}

function onSave() {
  const wasCreate = conv.mode.value === 'create'
  const id = conv.save()
  if (!id) return
  if (wasCreate) {
    popDialog.toast('已儲存為個人技能，可到「測試」tab 驗證')
    activeTab.value = 'test'
  } else {
    popDialog.toast('已儲存修改')
  }
}

// 有測試紀錄：存檔之後順便走一次啟用確認流程，不管技能原本有沒有啟用中——
// 已經啟用的話，confirmed 不會再把它 toggle 成停用（見下面 !skill.isEnabled），
// 單純更新 assignedAgents／把這次測試結果透過 override 或正常流程記上去
async function handleSaveAndEnable() {
  const id = conv.save()
  if (!id) return
  const skill = store.findSkill(id)
  if (!skill) return
  const outcome = await enableFlowRef.value!.requestEnable(skill, skill.assignedAgents ?? [])
  // cancelled／goToTest／revise 都是留在原地：這裡本來就是編輯畫面本身，
  // 「去修改技能內容」「前往測試」沒有別的地方好導過去，單純關掉對話框就好
  if (outcome.type !== 'confirmed') return
  store.setAssignedAgents(skill.id, outcome.agents)
  if (outcome.wasOverridden) store.overrideAndEnableSkill(skill.id)
  else if (!skill.isEnabled) store.toggleSkill(skill.id)
}

function handleSaveClick() {
  if (hasTestRecord.value) {
    handleSaveAndEnable()
    return
  }
  onSave()
}

// 放棄修改：草稿只是從已儲存版本複製出來改的，從沒呼叫過 save() 就不會寫回原本的
// 技能——loadSkill 本來就是「從目前儲存版本重新載入草稿」的邏輯，直接複用來重設，
// 再請外殼（抽屜）關閉。不用額外確認：guardDirty 已經會在真的有變更時才跳出確認，
// 沒變更的話按這顆鍵跟直接關閉沒兩樣
function onDiscard() {
  guardDirty(() => {
    if (conv.mode.value === 'edit' && conv.savedSkillId.value) {
      conv.loadSkill(conv.savedSkillId.value)
    }
    emit('discard')
  })
}

onMounted(() => {
  applyQuery(props.initialQuery ?? {})
})

defineExpose({
  isDirty: conv.isDirty,
  mode: conv.mode,
  skillName: computed(() => conv.draft.value.name),
  applyQuery,
})
</script>
