<template>
  <div :class="['skillBuilderViewBox', { 'is-full': props.isFullView }]">
    <div class="skb-toolbar">
      <div class="skb-tabs" v-if="method">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          :class="['skb-tab-btn', { 'is-active': activeTab === t.id }]"
          :disabled="t.id === 'test' && conv.testLocked.value"
          :title="t.id === 'test' && conv.testLocked.value ? '有未儲存的修改，先儲存再測試' : undefined"
          @click="setTab(t.id)"
        >
          <i class="material-symbols-outlined">{{ t.icon }}</i>{{ t.label }}
        </button>
      </div>
      <div v-else class="skb-tabs-placeholder">技能建立</div>
      <!-- 同一顆技能要做長時間調整就到 AI 賦能頁；沒儲存前沒有 skillId 可帶。
           tooltip 掛在外層 span：disabled 的 button 不會觸發 hover 事件，「先儲存技能」的提示就出不來 -->
      <span class="skb-open-studio-wrap" v-tooltip="conv.savedSkillId.value ? '在 AI 賦能開啟' : '先儲存技能'">
        <button
          type="button"
          class="custom-btn skb-open-studio"
          :disabled="!conv.savedSkillId.value"
          @click="openStudio"
        >
          <i class="material-symbols-outlined">open_in_new</i>在 AI 賦能開啟
        </button>
      </span>
    </div>

    <div v-if="props.source.data.origin && activeTab === 'chat'" class="skb-origin-bar">
      <i class="material-symbols-outlined">history</i>來自本對話的「{{ props.source.data.origin.reason }}」流程
    </div>
    <div v-if="missingSkill" class="skb-missing-bar">
      <i class="material-symbols-outlined">warning</i>這顆技能已不存在，儲存會建立新的個人技能
    </div>
    <div v-if="showRunReport" class="skb-after-save-bar">
      <span>技能已儲存。要不要現在用這顆技能產一份報告？</span>
      <button type="button" class="custom-btn custom-main-btn skb-run-report-btn" @click="runReport">
        <i class="material-symbols-outlined">play_arrow</i>產一份報告
      </button>
    </div>

    <div class="skb-body">
      <SkillMethodChooser v-if="!method" @choose="onChooseMethod" />
      <SkillStudioChat
        v-else-if="activeTab === 'chat'"
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
      <div v-else-if="activeTab === 'blocks'" class="skb-blocks-col">
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
          compact
          :section-ids="conv.draft.value.sectionIds"
          @update:section-ids="ids => conv.updateBlocks({ sectionIds: ids })"
        />
      </div>
      <SkillStudioPreview
        v-else
        hide-tabs
        :active-tab="previewTab"
        :draft="conv.draft.value"
        :mode="conv.mode.value"
        :saved-skill-id="conv.savedSkillId.value"
        :test-skill-id="conv.testSkillId.value"
        :is-dirty="conv.isDirty.value"
        :test-locked="conv.testLocked.value"
        :can-save="conv.canSave.value"
        :name-conflict="nameConflict"
        @save="onSave"
        @update:files="conv.updateFiles"
        @update:active-tab="setTab"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// 技能建立 Block：把 AI 賦能的三個零件放進畫布 block。狀態來源是 block data 裡的
// StudioSnapshot——掛載時 hydrate，變動時 toSnapshot 寫回 store，所以拖曳、放大縮小、
// 畫布重繪都不會丟狀態；全螢幕與畫布上的兩個實例也透過同一份快照同步。
import { ref, computed, watch, nextTick } from 'vue'
import type { PropType } from 'vue'
import { useRouter } from 'vue-router'
import { useAiviewerStore } from '@/stores/AiViewerStore'
import { useSkillStore } from '@/stores/skillStore'
import { useSkillStudioConversation } from '@/composables/useSkillStudioConversation'
import type { StudioSnapshot, StudioMethod } from '@/composables/useSkillStudioConversation'
import type { SkillBuilderBlockData } from '@/types/AiViewer'
import SkillMethodChooser from '@/components/Skill/SkillMethodChooser.vue'
import SkillBlockComposer from '@/components/Skill/SkillBlockComposer.vue'
import SkillBlockBasicsForm from '@/components/Skill/SkillBlockBasicsForm.vue'
import SkillStudioChat from '@/components/Skill/SkillStudioChat.vue'
import SkillStudioPreview from '@/components/Skill/SkillStudioPreview.vue'
import popDialog from '@/services/popDialog'

type BlockTab = SkillBuilderBlockData['activeTab']

const props = defineProps({
  id: { type: String, required: true },
  source: { type: Object as PropType<{ blockType: 'SKILL'; data: SkillBuilderBlockData }>, required: true },
  isFullView: { type: Boolean, default: false },
})

const REPORT_FILE = '/justagent/hurricane_trailsetter_campaign_performance.html'

const aiviewerStore = useAiviewerStore()
const skillStore = useSkillStore()
const router = useRouter()
const conv = useSkillStudioConversation()

const activeTab = computed<BlockTab>(() => props.source.data.activeTab)
// SkillStudioPreview 的 activeTab 只收 'preview' | 'test'，這裡窄化掉 block 的 'chat'／'blocks'
const previewTab = computed<'preview' | 'test'>(() => (activeTab.value === 'test' ? 'test' : 'preview'))
const missingSkill = ref(false)
let applyingExternal = false
const blockStep = ref<'basics' | 'compose'>('basics')

const method = computed(() => conv.draft.value.method)
const tabs = computed<{ id: BlockTab; icon: string; label: string }[]>(() => [
  method.value === 'blocks'
    ? { id: 'blocks', icon: 'dashboard_customize', label: '積木' }
    : { id: 'chat', icon: 'forum', label: '對話' },
  { id: 'preview', icon: 'preview', label: '預覽' },
  { id: 'test', icon: 'science', label: '測試' },
])

// 停在「測試」tab 時又改了內容：測試 tab 會反灰，跳回預覽
watch(() => conv.testLocked.value, locked => {
  if (locked && activeTab.value === 'test') setTab('preview')
})

// 儲存後只提示一次「產一份報告」；再存一次會再出現
const showRunReport = ref(false)

function onChooseMethod(m: StudioMethod) {
  conv.chooseMethod(m)
  setTab(m === 'blocks' ? 'blocks' : 'chat')
}

function runReport() {
  const name = conv.draft.value.name.trim() || '行銷報告'
  aiviewerStore.addReportBlock(REPORT_FILE, `${name}.html`)
  popDialog.toast('已把報告放到畫布上')
  showRunReport.value = false
}

function setTab(tab: BlockTab) {
  aiviewerStore.updateSkillBuilderBlock(props.id, { activeTab: tab })
}

const nameConflict = computed(() => {
  const n = conv.draft.value.name.trim()
  return !!n && skillStore.myPersonalSkills.some(s => s.id !== conv.savedSkillId.value && s.name === n)
})

// 套用一份快照；若它指到的技能已被刪除（例如在技能管理刪掉），退回建立模式並提示
function applySnapshot(snap: StudioSnapshot) {
  applyingExternal = true
  conv.hydrate(snap)
  if (snap.savedSkillId && !skillStore.findSkill(snap.savedSkillId)) {
    missingSkill.value = true
    conv.detachSavedSkill()
    // detach 後的狀態要寫回 block data，不然「已退回建立模式」只存在這個實例的記憶體裡，
    // 其他實例、或這個 block 之後重新掛載時看到的仍是指向已刪除技能的舊快照
    aiviewerStore.updateSkillBuilderBlock(props.id, { snapshot: conv.toSnapshot() })
  } else {
    missingSkill.value = false
  }
  // hydrate 到的快照若方式是積木、但 block data 的 activeTab 還停在舊的 'chat'（例如較早版本的
  // 快照），落到 SkillStudioPreview 會跟 tabs 顯示的「積木」錯位，這裡校正回 blocks
  if (conv.draft.value.method === 'blocks' && props.source.data.activeTab === 'chat') {
    setTab('blocks')
  }
  nextTick(() => { applyingExternal = false })
}

// 同步套用（而非 onMounted）：讓初次渲染就反映 hydrate 結果，不用等一次 microtask flush
applySnapshot(props.source.data.snapshot)

// 自己的變動 → 寫回 block data
watch(
  [conv.draft, conv.messages, conv.mode, conv.savedSkillId],
  () => {
    if (applyingExternal) return
    aiviewerStore.updateSkillBuilderBlock(props.id, { snapshot: conv.toSnapshot() })
  },
  { deep: true }
)

// 別的實例（全螢幕／畫布）寫回的快照 → 只要內容跟自己現在的不一樣就套用（last-write-wins）。
// 舊版用「!isDirty || 對方訊息更多」擋，但 isDirty 的基準是「上次 hydrate」，不是「已存的技能」，
// 會導致自己這邊還有未儲存變更時，永遠看不到對方剛儲存／改名的結果——JSON 相等比對已經
// 足夠避免把自己剛寫出去的快照當成外部變動再套用一次（見下方 applyingExternal 視窗）
watch(
  () => props.source.data.snapshot,
  (snap) => {
    if (JSON.stringify(snap) === JSON.stringify(conv.toSnapshot())) return
    applySnapshot(snap)
  },
  { deep: true }
)

function onSave() {
  // 新建的對話技能還沒確認過可調用 Agent：先在對話裡問，回答完由 conv 自己存檔。
  // 對話跟預覽在畫布上是不同分頁，切到對話分頁使用者才看得到這個問題
  if (conv.confirmAgentsBeforeSave()) {
    setTab('chat')
    return
  }
  const wasCreate = conv.mode.value === 'create'
  const id = conv.save()
  if (!id) return
  showRunReport.value = conv.draft.value.method === 'blocks'
  missingSkill.value = false
  if (wasCreate) {
    popDialog.toast('已儲存為個人技能，可到「測試」tab 驗證')
    setTab('test')
  } else {
    // 修改存檔後技能轉成停用中：直接帶到「測試」，啟用按鈕在那裡
    popDialog.toast('已儲存修改，技能目前停用中，到「測試」重新測試後再啟用')
    setTab('test')
  }
}

function openStudio() {
  if (!conv.savedSkillId.value) return
  router.push({ name: 'SkillManagement', query: { skillId: conv.savedSkillId.value } })
}
</script>
