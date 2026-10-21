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
        :show-advice-mode="conv.showAdviceModeSwitch.value"
        :advice-mode="conv.adviceMode.value"
        :advice-mode-locked="conv.adviceModeLocked.value"
        @send="conv.send"
        @change-advice-mode="conv.setAdviceMode"
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
          :keywords="conv.draft.value.keywords"
          :capabilities="conv.draft.value.capabilities"
          :assigned-agents="conv.draft.value.assignedAgents"
          :section-ids="conv.draft.value.sectionIds"
          :name-conflict="nameConflict"
          :exceptions="conv.draft.value.exceptions"
          :output-format="conv.draft.value.outputFormat"
          :applicable-scope="conv.draft.value.applicableScope"
          @update:name="v => conv.updateBlocks({ name: v })"
          @update:description="conv.updateBlockDescription"
          @update:keywords="conv.updateBlockKeywords"
          @update:capabilities="conv.updateBlockCapabilities"
          @update:assigned-agents="conv.updateBlockAssignedAgents"
          @update:exceptions="v => conv.updateBlockOptional({ exceptions: v })"
          @update:output-format="v => conv.updateBlockOptional({ outputFormat: v })"
          @update:applicable-scope="v => conv.updateBlockOptional({ applicableScope: v })"
        />
        <SkillBlockComposer
          v-else
          :section-ids="conv.draft.value.sectionIds"
          @update:section-ids="ids => conv.updateBlocks({ sectionIds: ids })"
        />
      </div>

      <!-- 儲存／放棄固定在這裡，不隨右欄「技能預覽／測試」tab 切換而消失或跑到
           看不到的地方——見 SkillStudioPreview.vue 的 hideFooter。
           儲存歸儲存、啟用歸啟用：這顆鍵只存檔，啟用一律在測試報告的「下一步」按「啟用技能」 -->
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
        <p v-if="backendSave && conv.savedVersion.value" class="studio-saved-hint">
          <i class="material-symbols-outlined">check_circle</i>
          {{ conv.lastSaveKind.value === 'marked' ? '已記下' : '已存成' }}第 {{ conv.savedVersion.value.version }} 版，{{ conv.savedVersion.value.tested ? '這一版測過' : '這一版還沒測過' }}
        </p>
        <p v-if="backendSave && conv.testedNote.value" class="studio-saved-hint">
          <i class="material-symbols-outlined">check_circle</i>這份草稿已測過。{{ conv.testedNote.value }}
        </p>
        <p v-if="backendSave && conv.backendSaveAction.value.hint" class="studio-missing-hint">
          <i class="material-symbols-outlined">info</i>{{ conv.backendSaveAction.value.hint }}
        </p>
        <p v-if="backendSave && conv.errorHint.value" class="studio-missing-hint">
          <i class="material-symbols-outlined">error</i>{{ conv.errorHint.value }}
        </p>
        <p v-if="conv.missingFieldsHint.value" class="studio-missing-hint">
          <i class="material-symbols-outlined">info</i>{{ conv.missingFieldsHint.value }}
        </p>
        <button v-if="conv.mode.value === 'edit' && conv.savedSkillId.value" type="button" class="custom-btn" @click="onDiscard">
          <i class="material-symbols-outlined">undo</i>放棄修改
        </button>
      </div>
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
        :backend-test="backendSave"
        :conversation-id="conv.conversationId.value"
        :tested-note="conv.testedNote.value"
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

// 後端模式的對話：儲存、版本都以後端為準，不碰 skillStore 的假資料
const backendSave = computed(() => conv.usesBackend())

const nameConflict = computed(() => {
  if (backendSave.value) return false
  const n = conv.draft.value.name.trim()
  return !!n && store.myPersonalSkills.some(s => s.id !== conv.savedSkillId.value && s.name === n)
})

const saveButtonLabel = computed(() => {
  if (backendSave.value) return conv.backendSaveAction.value.label
  return conv.mode.value === 'create' ? '儲存為個人技能' : '儲存修改'
})

const saveClickEnabled = computed(() => {
  if (backendSave.value) return conv.backendSaveAction.value.enabled
  return conv.saveEnabled.value
})

// 測試相關的提示文字（生成中的敘事、生成完成、測試結果）一律留在右側測試 tab 裡
// （敘事泡泡／toast／測試報告），不推進左側對話河道——河道只留建立／修改技能本身的對話

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
  // ?backendSkillId=&version= 是從後端技能清單進修改：用那一版開後端對話
  const backendSkillId = typeof query.backendSkillId === 'string' ? query.backendSkillId : ''
  const backendVersion = Number(query.version)
  if (backendSkillId && Number.isInteger(backendVersion) && backendVersion >= 1) {
    conv.loadBackendSkill(backendSkillId, backendVersion).then(ok => {
      if (!ok) popDialog.toast(conv.errorHint.value || '載入技能失敗')
    })
    return
  }
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

async function onBackendSave() {
  const wasCreate = !conv.backendSkillId.value
  const saved = await conv.saveToBackend()
  if (!saved) {
    popDialog.toast(conv.errorHint.value || '儲存失敗，請稍後再試')
    return
  }
  if (conv.lastSaveKind.value === 'marked') {
    popDialog.toast(`已記下第 ${saved.version} 版測過，沒有新增版本`)
    return
  }
  popDialog.toast(wasCreate ? `已儲存為個人技能（第 ${saved.version} 版）` : `已存成新版本（第 ${saved.version} 版），舊版本沒有動`)
}

function onSave() {
  if (backendSave.value) {
    onBackendSave()
    return
  }
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

function handleSaveClick() {
  // 新建的對話技能還沒確認過可調用 Agent：先在對話裡問，回答完由 conv 自己存檔
  if (conv.confirmAgentsBeforeSave()) return
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
