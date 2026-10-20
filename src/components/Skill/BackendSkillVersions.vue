<template>
  <div class="BackendSkillVersions">
    <p v-if="store.errorHint" class="bsv-error">
      <i class="material-symbols-outlined">error</i>{{ store.errorHint }}
    </p>
    <div class="vt-list">
      <div v-for="v in versions" :key="v.version" class="vt-item">
        <div :class="['vt-dot', v.tested ? 'vt-dot--active' : 'vt-dot--history']"></div>
        <div class="vt-body">
          <div class="vt-header">
            <span class="vt-version-name">第 {{ v.version }} 版</span>
            <span :class="['vt-status-badge', v.tested ? 'vt-status--active' : 'vt-status--history']">
              {{ v.tested ? '測過' : '沒測過' }}
            </span>
            <span class="vt-date">{{ formatDate(v.created_at) }}</span>
          </div>
          <div class="vt-actions">
            <button type="button" class="custom-btn" @click="emit('modify', v.version)">
              <i class="material-symbols-outlined">edit</i>從這一版修改
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useBackendSkillStore } from '@/stores/backendSkillStore'

// 某個後端技能的版本列表，沿用技能詳情抽屜「版本歷史」的樣式，每版標示有沒有測過。
// 「修改」只發出事件，由外殼決定怎麼開修改對話
const props = defineProps<{ skillId: string }>()
const emit = defineEmits<{ modify: [version: number] }>()

const store = useBackendSkillStore()
const versions = computed(() => [...(store.versionsBySkill[props.skillId] ?? [])].reverse())

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

watch(() => props.skillId, id => store.loadVersions(id), { immediate: true })
</script>
