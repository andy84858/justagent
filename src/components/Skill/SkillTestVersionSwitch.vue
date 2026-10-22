<template>
  <!-- 技能測試沙盒的版型切換（1 版＝原本的單一技能測試；2、3 版＝全系統對話測試的兩種版型），
       外觀沿用 compSwitch，但 compSwitch 只支援布林值，這裡三個選項所以自己寫 -->
  <div class="compSwitch SkillTestVersionSwitch" role="tablist" aria-label="沙盒版型切換">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="tab"
      :class="['compSwitch-item', { 'is-active': current === opt.value }]"
      :aria-selected="current === opt.value"
      @click="select(opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SKILL_TEST_VERSIONS, resolveSkillTestVersion } from '@/views/skillTestVersionOptions'

const route = useRoute()
const router = useRouter()

const options = SKILL_TEST_VERSIONS.map(v => ({ value: v, label: `${v}版` }))
const current = computed(() => resolveSkillTestVersion(route.query.v))

function select(v: string) {
  if (v === current.value) return
  router.replace({ query: { ...route.query, v } })
}
</script>
