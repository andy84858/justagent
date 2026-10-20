<template>
  <!-- Library 技能庫改成卡片式目錄（多欄格狀），這張是格狀用的直式磚塊，
       跟 SkillCard（橫向長條，「我的技能」清單用）不是同一種版面，
       所以獨立一個元件，不硬掛在 SkillCard 上疊加修飾字 -->
  <div :class="['SkillTile', { 'is-disabled': !skill.isEnabled }]" @click="emit('click', skill)">
    <div :class="['tile-icon', scopeIconClass]">
      <i class="material-symbols-outlined">psychology</i>
    </div>

    <div class="tile-name">
      {{ skill.name }}
    </div>
    <div class="tile-scope">{{ scopeLabel }}</div>
    <div v-if="tileDesc" class="tile-desc">{{ tileDesc }}</div>
    <div v-if="skill.assignedAgents?.length" class="tile-agents" :title="`可調用 Agent：${skill.assignedAgents.join('、')}`">
      <i class="material-symbols-outlined">smart_toy</i>
      <span class="tile-agents-text">{{ skill.assignedAgents.join('、') }}</span>
    </div>

    <div class="tile-foot">
      <div class="tile-actions" @click.stop>
        <button
          class="custom-btn skill-action-btn skill-action-btn--icon"
          title="複製至草稿"
          @click="emit('duplicate', skill)"
        >
          <i class="material-symbols-outlined">content_copy</i>
        </button>
        <button
          class="custom-btn skill-action-btn skill-action-btn--icon"
          title="測試"
          @click="emit('test', skill)"
        >
          <i class="material-symbols-outlined">science</i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Skill } from '@/stores/skillStore'

const props = defineProps<{ skill: Skill }>()
const emit = defineEmits<{
  click: [skill: Skill]
  test: [skill: Skill]
  duplicate: [skill: Skill]
}>()

const scopeIconClass = computed(() => {
  if (props.skill.scope === 'enterprise') return 'icon--enterprise'
  if (props.skill.scope === 'team') return 'icon--team'
  return 'icon--system'
})

const scopeLabel = computed(() => {
  if (props.skill.scope === 'enterprise') return '企業技能'
  if (props.skill.scope === 'team') return `團隊技能${props.skill.teamName ? '（' + props.skill.teamName + '）' : ''}`
  return '系統技能'
})

// 用第一筆使用情境的標題取代原本的技能描述，讓卡片一眼看出「什麼時候會用到」
// 而不是技能本身的功能說明；沒有使用情境的技能（例如剛手動建立的）才退回顯示描述
const tileDesc = computed(() => props.skill.usageScenarios?.[0]?.title || props.skill.description)
</script>
