<template>
  <!-- RD 技能定義裡「步驟」「例外或特殊情況」都是一條一條的清單：步驟有順序（編號），
       例外沒有（圓點）。每列一個輸入框，可以新增／刪除；空白列送出前由呼叫端過濾 -->
  <div ref="rootRef" :class="['SkillListEditor', { 'is-ordered': ordered }]">
    <div v-for="(item, i) in modelValue" :key="i" class="sle-row">
      <span class="sle-marker">{{ ordered ? `${i + 1}.` : '•' }}</span>
      <input
        :value="item"
        class="custom-input sle-input"
        :placeholder="placeholder"
        :aria-label="`${itemLabel} ${i + 1}`"
        @input="update(i, ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="addAfter(i)"
      />
      <button
        type="button"
        class="sle-remove"
        :aria-label="`移除${itemLabel} ${i + 1}`"
        @click="remove(i)"
      >
        <i class="material-symbols-outlined">close</i>
      </button>
    </div>
    <button type="button" class="custom-btn sle-add" @click="addAfter(modelValue.length - 1)">
      <i class="material-symbols-outlined">add</i>新增{{ itemLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string[]
  itemLabel: string
  placeholder?: string
  ordered?: boolean
}>(), {
  placeholder: '',
  ordered: false,
})
const emit = defineEmits<{ 'update:modelValue': [items: string[]] }>()
const rootRef = ref<HTMLElement | null>(null)

function update(i: number, value: string) {
  const next = [...props.modelValue]
  next[i] = value
  emit('update:modelValue', next)
}

function remove(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i))
}

// 在第 i 列後面插一列空白並把游標移過去：在輸入框按 Enter 就能連續往下寫
async function addAfter(i: number) {
  const next = [...props.modelValue]
  next.splice(i + 1, 0, '')
  emit('update:modelValue', next)
  await nextTick()
  rootRef.value?.querySelectorAll<HTMLInputElement>('.sle-input')[i + 1]?.focus()
}
</script>
