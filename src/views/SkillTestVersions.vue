<template>
  <!-- key 綁版本：切版型時整頁重建，各版自己的對話狀態不會互相殘留 -->
  <component :is="views[version]" :key="version" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SkillTest from '@/views/SkillTest.vue'
import SkillSandboxA from '@/views/SkillSandboxA.vue'
import SkillSandboxB from '@/views/SkillSandboxB.vue'
import { resolveSkillTestVersion } from '@/views/skillTestVersionOptions'

const route = useRoute()
const views = { '1': SkillTest, '2': SkillSandboxA, '3': SkillSandboxB }
const version = computed(() => resolveSkillTestVersion(route.query.v))
</script>
