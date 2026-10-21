<template>
  <div class="SkillBlockBasicsForm">
    <label class="sbc-field">
      <span class="sbc-label">技能名稱</span>
      <input class="custom-input sbbf-name-input" :value="props.name" placeholder="例：行銷週報" @input="emit('update:name', ($event.target as HTMLInputElement).value)" />
    </label>
    <div v-if="props.nameConflict" class="name-conflict-banner">
      <i class="material-symbols-outlined">info</i>你已經有一個同名的個人技能，建議修改名稱以便區分。
    </div>

    <div class="sbbf-field">
      <span class="sbc-label">關鍵字 <span class="se-required">*</span></span>
      <p class="se-hint">輸入會觸發這顆技能的關鍵字，至少新增一個。</p>
      <SkillKeywordsEditor :model-value="props.keywords" @update:model-value="emit('update:keywords', $event)" />
    </div>

    <div class="sbbf-field">
      <div class="sbbf-label-row">
        <span class="sbc-label">說明 <span class="se-required">*</span></span>
        <button
          type="button"
          class="custom-btn sbbf-ai-btn"
          :disabled="!props.sectionIds.length"
          @click="generateDescriptionSuggestions"
        >
          <i class="material-symbols-outlined">auto_awesome</i>AI 建議
        </button>
      </div>
      <p v-if="!props.sectionIds.length" class="se-hint">請先在「積木組成」選擇章節，才能產生建議</p>
      <textarea
        class="custom-input sbbf-textarea"
        :value="props.description"
        placeholder="例：當使用者要求產出本月行銷週報時，彙整會員輪廓與活動成效"
        rows="3"
        @input="emit('update:description', ($event.target as HTMLTextAreaElement).value)"
      />
      <div v-if="descriptionCandidates.length" class="sbbf-suggestions">
        <div class="sbbf-suggestions-head">
          <span class="se-hint">選一句套用：</span>
          <button type="button" class="sbbf-suggestions-close" aria-label="關閉建議" @click="descriptionCandidates = []">
            <i class="material-symbols-outlined">close</i>
          </button>
        </div>
        <button
          v-for="(candidate, i) in descriptionCandidates"
          :key="i"
          type="button"
          class="sbbf-suggestion-chip"
          @click="pickDescription(candidate)"
        >{{ candidate }}</button>
      </div>
    </div>

    <div class="sbbf-field">
      <div class="sbbf-label-row">
        <span class="sbc-label">覆蓋能力 <span class="se-required">*</span></span>
        <button
          type="button"
          class="custom-btn sbbf-ai-btn"
          :disabled="!props.sectionIds.length"
          @click="applyCapabilitiesSuggestion"
        >
          <i class="material-symbols-outlined">auto_awesome</i>AI 建議
        </button>
      </div>
      <SkillCapabilityEditor :model-value="props.capabilities" @update:model-value="emit('update:capabilities', $event)" />
    </div>

    <!-- RD 技能定義的選填三段；步驟由「積木組成」選的章節依序帶出，不在這裡填 -->
    <div class="sbbf-field">
      <span class="sbc-label">例外或特殊情況</span>
      <p class="se-hint">遇到哪些狀況要換一種處理方式，例如某渠道沒有數據時。</p>
      <SkillListEditor
        :model-value="props.exceptions"
        item-label="例外"
        placeholder="例：某渠道無數據時，從圖表中排除並註記"
        @update:model-value="emit('update:exceptions', $event)"
      />
    </div>

    <label class="sbbf-field">
      <span class="sbc-label">固定輸出格式</span>
      <input
        class="custom-input"
        :value="props.outputFormat"
        placeholder="例：三大章節，每章節附圖表"
        @input="emit('update:outputFormat', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="sbbf-field">
      <span class="sbc-label">適用範圍</span>
      <input
        class="custom-input"
        :value="props.applicableScope"
        placeholder="例：行銷部每週成效檢視"
        @input="emit('update:applicableScope', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <div class="sbbf-field">
      <span class="sbc-label">指派 Agent <span class="se-required">*</span></span>
      <p class="se-hint">選擇哪些 Agent 可以調用這顆技能，至少指派一位。</p>
      <AgentAssignGrid :model-value="props.assignedAgents" @update:model-value="emit('update:assignedAgents', $event)" />
    </div>
  </div>
</template>

<script setup lang="ts">
// 積木流程「基本設定」步驟：技能名稱／說明／關鍵字／覆蓋能力／指派 Agent
// 都是使用者手動輸入的必填欄位，不再隨「積木組成」步驟選的章節自動覆蓋——
// 說明按「AI 建議」會生成 3 句不同措辭的候選，使用者挑一句直接套用
// （挑選本身就是確認，不用再跳一層「要覆蓋嗎」的對話框）；覆蓋能力的「AI 建議」
// 維持原本單一建議＋覆蓋確認的流程，不在這次調整範圍內
import { ref, watch } from 'vue'
import type { SkillCapability } from '@/stores/skillStore'
import { deriveFromSections, suggestDescriptionVariants } from '@/composables/useSkillStudioConversation'
import SkillCapabilityEditor from '@/components/Skill/SkillCapabilityEditor.vue'
import SkillKeywordsEditor from '@/components/Skill/SkillKeywordsEditor.vue'
import SkillListEditor from '@/components/Skill/SkillListEditor.vue'
import AgentAssignGrid from '@/components/Skill/AgentAssignGrid.vue'
import popDialog from '@/services/popDialog'

const props = defineProps<{
  name: string
  description: string
  keywords: string[]
  capabilities: SkillCapability[]
  assignedAgents: string[]
  sectionIds: string[]
  nameConflict?: boolean
  exceptions: string[]
  outputFormat: string
  applicableScope: string
}>()

const emit = defineEmits<{
  'update:name': [value: string]
  'update:description': [value: string]
  'update:keywords': [value: string[]]
  'update:capabilities': [value: SkillCapability[]]
  'update:assignedAgents': [value: string[]]
  'update:exceptions': [value: string[]]
  'update:outputFormat': [value: string]
  'update:applicableScope': [value: string]
}>()

const descriptionCandidates = ref<string[]>([])

// 選的章節變了，先前那批候選是依舊章節算出來的，不該繼續留著讓人誤選
watch(() => props.sectionIds, () => {
  descriptionCandidates.value = []
})

function generateDescriptionSuggestions() {
  if (!props.sectionIds.length) return
  if (!props.keywords.length) { popDialog.toast('請先填寫關鍵字，才能產生 AI 建議'); return }
  descriptionCandidates.value = suggestDescriptionVariants(props.sectionIds)
}

function pickDescription(candidate: string) {
  emit('update:description', candidate)
  descriptionCandidates.value = []
}

function applyCapabilitiesSuggestion() {
  if (!props.sectionIds.length) return
  if (!props.keywords.length) { popDialog.toast('請先填寫關鍵字，才能產生 AI 建議'); return }
  const suggestion = deriveFromSections(props.sectionIds).capabilities
  if (!suggestion.length) return
  if (!props.capabilities.length) {
    emit('update:capabilities', suggestion)
    return
  }
  popDialog.confirm(
    `套用 AI 建議的覆蓋能力？將取代目前的 ${props.capabilities.length} 項標籤`,
    '套用建議',
    '保留原內容',
    () => emit('update:capabilities', suggestion),
  )
}
</script>
