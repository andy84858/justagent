<template>
  <div
    :class="[
      'SkillCard',
      { 'is-extension': isExtension },
      { 'is-standalone': isExtension && !skill.forkSourceId },
      { 'is-disabled': !skill.isEnabled },
    ]"
    @click="emit('click', skill)"
  >
    <div :class="['skill-card-icon', scopeIconClass]">
      <i class="material-symbols-outlined">{{ skillIconName }}</i>
    </div>

    <div class="skill-card-body">
      <div class="skill-card-name">
        {{ skill.name }}
        <span class="skill-tag tag--version">v{{ skill.version }}</span>
      </div>
      <div v-if="cardDesc" class="skill-card-desc">{{ cardDesc }}</div>
      <div class="skill-card-stats">
        <span class="sk-stat">
          <i class="material-symbols-outlined">bolt</i>{{ formatCount(skill.usageCount) }} 次觸發
        </span>
      </div>
    </div>

    <div class="skill-card-right">
      <div class="skill-card-meta">
        <span :class="['status-dot', skill.isEnabled ? 'dot--on' : 'dot--off']"></span>
        <span class="status-text">{{ skill.isEnabled ? '啟用中' : (skill.zone === 'personal' && skill.aiTestPassRate == null ? '尚未測試' : '已停用') }}</span>
      </div>
      <div class="skill-card-actions" @click.stop>
        <button
          class="custom-btn skill-action-btn skill-action-btn--icon"
          title="複製至草稿"
          @click="emit('duplicate', skill)"
        >
          <i class="material-symbols-outlined">content_copy</i>
        </button>
        <button class="custom-btn skill-action-btn" @click="emit('test', skill)">測試</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Skill } from '@/stores/skillStore'

const props = withDefaults(defineProps<{
  skill: Skill
  isExtension?: boolean
}>(), {
  isExtension: false,
})

const emit = defineEmits<{
  click: [skill: Skill]
  test: [skill: Skill]
  duplicate: [skill: Skill]
}>()

// 圖示配色改為跟著技能的分類（系統／企業／團隊）走，跟 Library 技能庫的分類標籤配色一致，
// 不再只是依 isExtension 分兩色。
const scopeIconClass = computed(() => {
  if (props.skill.scope === 'enterprise') return 'icon--enterprise'
  if (props.skill.scope === 'team') return 'icon--team'
  return 'icon--system'
})

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

// 用「AI 賦能」建立的技能，圖示換成建立方式本身（跟 SkillMethodChooser 選卡同一組
// icon：對話 forum／積木 dashboard_customize），一眼看出這顆技能怎麼來的；
// 真的自建（沒有 forkSourceId／derivedFrom 血緣）換成筆，跟 SkillDetailDrawer「來源關係」
// 的自建圖示一致；有血緣的技能（複製副本、衍生自既有技能）維持原本依 isExtension 分的圖示
const skillIconName = computed(() => {
  if (props.skill.composition) return 'dashboard_customize'
  if (props.skill.creationMethod === 'ai_assisted') return 'forum'
  if (!props.skill.forkSourceId && !props.skill.derivedFrom) return 'edit'
  return props.isExtension ? 'extension' : 'psychology'
})

// 用第一筆使用情境的標題取代原本的技能描述，讓卡片一眼看出「什麼時候會用到」
// 而不是技能本身的功能說明；沒有使用情境的技能（例如剛手動建立的）才退回顯示描述
const cardDesc = computed(() => props.skill.usageScenarios?.[0]?.title || props.skill.description)
</script>
