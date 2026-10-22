<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="SkillVersionCompare" @click.self="emit('update:modelValue', false)">
        <div class="svc-dialog">
          <div class="svc-head">
            <h3>版本差異比較</h3>
            <button class="drawer-close-btn" @click="emit('update:modelValue', false)">
              <i class="material-symbols-outlined">close</i>
            </button>
          </div>

          <!-- Version selectors -->
          <div class="svc-selectors">
            <select v-model="localV1Id" class="custom-select svc-select">
              <option v-for="v in versions" :key="v.id" :value="v.id">
                {{ versionOptionLabel(v) }}（{{ versionStatusLabel(v.status) }}）
              </option>
            </select>
            <i class="material-symbols-outlined svc-arrow">arrow_forward</i>
            <select v-model="localV2Id" class="custom-select svc-select">
              <option v-for="v in versions" :key="v.id" :value="v.id">
                {{ versionOptionLabel(v) }}（{{ versionStatusLabel(v.status) }}）
              </option>
            </select>
          </div>

          <!-- Legend -->
          <div class="svc-legend-row">
            <span class="svc-legend svc-legend--added">新增</span>
            <span class="svc-legend svc-legend--removed">刪除</span>
          </div>

          <!-- Diff grid -->
          <div v-if="v1 && v2" class="svc-diff-grid">
            <!-- Old version column -->
            <div class="svc-col">
              <div class="svc-col-head">{{ versionOptionLabel(v1) }}
                <span :class="['svc-status', `svc-status--${v1.status}`]">{{ versionStatusLabel(v1.status) }}</span>
              </div>
              <div class="svc-col-body">

                <div class="svc-field">
                  <div class="svc-field-label">名稱</div>
                  <div :class="['svc-field-val', fieldClass(v1.name, v2.name, 'old')]">{{ v1.name }}</div>
                </div>

                <div class="svc-field">
                  <div class="svc-field-label">說明</div>
                  <div :class="['svc-field-val', fieldClass(v1.description, v2.description, 'old')]">{{ v1.description }}</div>
                </div>

                <div class="svc-field">
                  <div class="svc-field-label">步驟</div>
                  <ol v-if="v1.steps?.length" class="svc-list">
                    <li v-for="(step, i) in v1.steps" :key="i" :class="listClass(step, 'steps', 'old')">{{ step }}</li>
                  </ol>
                  <span v-else class="svc-empty">（無）</span>
                </div>

                <div class="svc-field">
                  <div class="svc-field-label">例外或特殊情況</div>
                  <ul v-if="v1.exceptions?.length" class="svc-list">
                    <li v-for="(ex, i) in v1.exceptions" :key="i" :class="listClass(ex, 'exceptions', 'old')">{{ ex }}</li>
                  </ul>
                  <span v-else class="svc-empty">（無）</span>
                </div>

                <div class="svc-field">
                  <div class="svc-field-label">固定輸出格式</div>
                  <div v-if="v1.outputFormat" :class="['svc-field-val', fieldClass(v1.outputFormat ?? '', v2.outputFormat ?? '', 'old')]">{{ v1.outputFormat }}</div>
                  <span v-else class="svc-empty">（無）</span>
                </div>

                <div class="svc-field">
                  <div class="svc-field-label">適用範圍</div>
                  <div v-if="v1.applicableScope" :class="['svc-field-val', fieldClass(v1.applicableScope ?? '', v2.applicableScope ?? '', 'old')]">{{ v1.applicableScope }}</div>
                  <span v-else class="svc-empty">（無）</span>
                </div>

                <div class="svc-field">
                  <div class="svc-field-label">覆蓋能力</div>
                  <div class="svc-caps">
                    <span
                      v-for="cap in v1.capabilities ?? []"
                      :key="cap"
                      :class="['svc-cap', capClass(cap, 'old')]"
                    >#{{ cap }}</span>
                    <span v-if="!v1.capabilities?.length" class="svc-empty">（無）</span>
                  </div>
                </div>

                <div class="svc-field svc-field--instructions">
                  <div class="svc-field-label">技能指令 (Instructions)</div>
                  <div class="svc-instructions-box">
                    <template v-if="instructionsDiff">
                      <div
                        v-for="(line, i) in instructionsDiff.old"
                        :key="i"
                        :class="['svc-line', line.cls]"
                      >{{ line.text }}&nbsp;</div>
                    </template>
                    <template v-else>
                      <div class="svc-line">{{ v1.instructions || '（未設定）' }}</div>
                    </template>
                  </div>
                </div>

              </div>
            </div>

            <!-- New version column -->
            <div class="svc-col">
              <div class="svc-col-head">{{ versionOptionLabel(v2) }}
                <span :class="['svc-status', `svc-status--${v2.status}`]">{{ versionStatusLabel(v2.status) }}</span>
              </div>
              <div class="svc-col-body">

                <div class="svc-field">
                  <div class="svc-field-label">名稱</div>
                  <div :class="['svc-field-val', fieldClass(v1.name, v2.name, 'new')]">{{ v2.name }}</div>
                </div>

                <div class="svc-field">
                  <div class="svc-field-label">說明</div>
                  <div :class="['svc-field-val', fieldClass(v1.description, v2.description, 'new')]">{{ v2.description }}</div>
                </div>

                <div class="svc-field">
                  <div class="svc-field-label">步驟</div>
                  <ol v-if="v2.steps?.length" class="svc-list">
                    <li v-for="(step, i) in v2.steps" :key="i" :class="listClass(step, 'steps', 'new')">{{ step }}</li>
                  </ol>
                  <span v-else class="svc-empty">（無）</span>
                </div>

                <div class="svc-field">
                  <div class="svc-field-label">例外或特殊情況</div>
                  <ul v-if="v2.exceptions?.length" class="svc-list">
                    <li v-for="(ex, i) in v2.exceptions" :key="i" :class="listClass(ex, 'exceptions', 'new')">{{ ex }}</li>
                  </ul>
                  <span v-else class="svc-empty">（無）</span>
                </div>

                <div class="svc-field">
                  <div class="svc-field-label">固定輸出格式</div>
                  <div v-if="v2.outputFormat" :class="['svc-field-val', fieldClass(v1.outputFormat ?? '', v2.outputFormat ?? '', 'new')]">{{ v2.outputFormat }}</div>
                  <span v-else class="svc-empty">（無）</span>
                </div>

                <div class="svc-field">
                  <div class="svc-field-label">適用範圍</div>
                  <div v-if="v2.applicableScope" :class="['svc-field-val', fieldClass(v1.applicableScope ?? '', v2.applicableScope ?? '', 'new')]">{{ v2.applicableScope }}</div>
                  <span v-else class="svc-empty">（無）</span>
                </div>

                <div class="svc-field">
                  <div class="svc-field-label">覆蓋能力</div>
                  <div class="svc-caps">
                    <span
                      v-for="cap in v2.capabilities ?? []"
                      :key="cap"
                      :class="['svc-cap', capClass(cap, 'new')]"
                    >#{{ cap }}</span>
                    <span v-if="!v2.capabilities?.length" class="svc-empty">（無）</span>
                  </div>
                </div>

                <div class="svc-field svc-field--instructions">
                  <div class="svc-field-label">技能指令 (Instructions)</div>
                  <div class="svc-instructions-box">
                    <template v-if="instructionsDiff">
                      <div
                        v-for="(line, i) in instructionsDiff.new"
                        :key="i"
                        :class="['svc-line', line.cls]"
                      >{{ line.text }}&nbsp;</div>
                    </template>
                    <template v-else>
                      <div class="svc-line">{{ v2.instructions || '（未設定）' }}</div>
                    </template>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div v-else class="svc-empty-state">請選擇兩個不同版本進行比較</div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSkillStore } from '@/stores/skillStore'
import type { SkillVersion, SkillVersionStatus } from '@/stores/skillStore'

const props = defineProps<{
  modelValue: boolean
  skillId: string
  v1Id: string
  v2Id: string
}>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const store = useSkillStore()
const localV1Id = ref(props.v1Id)
const localV2Id = ref(props.v2Id)

watch(() => props.v1Id, v => { localV1Id.value = v })
watch(() => props.v2Id, v => { localV2Id.value = v })

const versions = computed(() => store.getSkillVersions(props.skillId))
const v1 = computed(() => versions.value.find(v => v.id === localV1Id.value))
const v2 = computed(() => versions.value.find(v => v.id === localV2Id.value))

function versionOptionLabel(ver: SkillVersion): string {
  return ver.versionName || '（未命名版本）'
}

function versionStatusLabel(status: SkillVersionStatus): string {
  const map: Record<SkillVersionStatus, string> = {
    draft: '草稿', reviewing: '審核中', approved: '待啟用', active: '生效中', history: '歷史', rejected: '已退回',
  }
  return map[status] ?? status
}

function fieldClass(oldVal: string | undefined, newVal: string | undefined, side: 'old' | 'new'): string {
  if (oldVal === newVal) return ''
  return side === 'old' ? 'is-removed' : 'is-added'
}

const capNames = computed(() => ({
  oldSet: new Set(v1.value?.capabilities ?? []),
  newSet: new Set(v2.value?.capabilities ?? []),
}))

function capClass(name: string, side: 'old' | 'new'): string {
  const { oldSet, newSet } = capNames.value
  if (side === 'old') return newSet.has(name) ? '' : 'cap--removed'
  return oldSet.has(name) ? '' : 'cap--added'
}

// RD 的步驟／例外：逐項比對，另一個版本沒有這一項就標成新增／刪除（跟覆蓋能力同一種比法）
function listClass(item: string, key: 'steps' | 'exceptions', side: 'old' | 'new'): string {
  const other = side === 'old' ? v2.value?.[key] : v1.value?.[key]
  if (other?.includes(item)) return ''
  return side === 'old' ? 'svc-item--removed' : 'svc-item--added'
}

const instructionsDiff = computed(() => {
  const oldText = v1.value?.instructions ?? ''
  const newText = v2.value?.instructions ?? ''
  if (oldText === newText) return null

  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const oldSet = new Set(oldLines)
  const newSet = new Set(newLines)

  return {
    old: oldLines.map(l => ({ text: l, cls: newSet.has(l) ? '' : 'is-removed' })),
    new: newLines.map(l => ({ text: l, cls: oldSet.has(l) ? '' : 'is-added' })),
  }
})
</script>
