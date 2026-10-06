<template>
  <div class="SkillStudioPreview">
    <div class="ssp-tabs" v-if="!props.hideTabs">
      <button
        type="button"
        :class="['ssp-tab-btn', { 'is-active': props.activeTab === 'preview' }]"
        @click="emit('update:activeTab', 'preview')"
      >
        <i class="material-symbols-outlined">preview</i>技能預覽
      </button>
      <button
        type="button"
        :class="['ssp-tab-btn', { 'is-active': props.activeTab === 'test' }]"
        @click="emit('update:activeTab', 'test')"
      >
        <i class="material-symbols-outlined">science</i>測試
      </button>
    </div>

    <!-- ── 技能預覽 ── -->
    <template v-if="props.activeTab === 'preview'">
      <div class="ssp-body">
        <div v-if="props.nameConflict" class="name-conflict-banner">
          <i class="material-symbols-outlined">info</i>你已經有一個同名的個人技能，建議修改名稱以便區分。
        </div>
        <div class="ssp-title-row">
          <div :class="['ssp-title', { 'is-empty': !props.draft.name }]">
            {{ props.draft.name || '尚未命名的技能' }}
          </div>
          <span :class="['ssp-status-badge', `ssp-status-badge--${status.tone}`]">{{ status.label }}</span>
        </div>

        <div class="ssp-section">
          <div class="ssp-section-label">說明</div>
          <p v-if="props.draft.description" class="ssp-text">{{ props.draft.description }}</p>
          <p v-else class="ssp-empty">跟 Agent 描述這個技能要做什麼</p>
        </div>

        <div class="ssp-section">
          <div class="ssp-section-label">觸發條件</div>
          <p v-if="props.draft.triggerHint" class="ssp-text">{{ props.draft.triggerHint }}</p>
          <p v-else class="ssp-empty">尚未設定觸發條件</p>
        </div>

        <div class="ssp-section">
          <div class="ssp-section-label">技能指令</div>
          <div v-if="instructionsHtml" class="markdown-body ssp-markdown" v-html="instructionsHtml"></div>
          <p v-else class="ssp-empty">尚未撰寫技能指令</p>
        </div>

        <div class="ssp-section">
          <div class="ssp-section-label">覆蓋能力</div>
          <div v-if="props.draft.capabilities.length" class="ssp-caps">
            <span v-for="(cap, i) in props.draft.capabilities" :key="`${cap}-${i}`" class="ssp-cap-chip">#{{ cap }}</span>
          </div>
          <p v-else class="ssp-empty">尚未拆解覆蓋能力項目</p>
        </div>

        <div v-if="props.draft.method === 'blocks'" class="ssp-section">
          <div class="ssp-section-label">指派 Agent</div>
          <div v-if="props.draft.assignedAgents.length" class="ssp-caps">
            <span v-for="agent in props.draft.assignedAgents" :key="agent" class="ssp-agent-chip">{{ agent }}</span>
          </div>
          <p v-else class="ssp-empty">尚未指派 Agent</p>
        </div>

        <div v-if="!props.hideFiles" class="ssp-section">
          <button type="button" class="ssp-section-label ssp-files-toggle" @click="filesExpanded = !filesExpanded">
            附加檔案<template v-if="props.draft.files.length">（{{ props.draft.files.length }}）</template>
            <i class="material-symbols-outlined">{{ filesExpanded ? 'expand_less' : 'expand_more' }}</i>
          </button>
          <SkillFileUpload
            v-if="filesExpanded"
            :model-value="props.draft.files"
            @update:model-value="emit('update:files', $event)"
          />
        </div>
      </div>

      <div class="ssp-footer">
        <!-- 抽屜把儲存／放棄移到固定不隨 tab 切換的位置（studio-save-footer），
             這裡不重複渲染，避免兩個儲存按鈕同時存在 -->
        <template v-if="!props.hideFooter">
          <button
            type="button"
            class="custom-btn custom-main-btn ssp-save-btn"
            :disabled="!saveEnabled"
            @click="emit('save')"
          >
            <i class="material-symbols-outlined">save</i>
            {{ props.mode === 'create' ? '儲存為個人技能' : '儲存修改' }}
          </button>
          <p v-if="missingFieldsHint" class="ssp-missing-hint">
            <i class="material-symbols-outlined">info</i>{{ missingFieldsHint }}
          </p>
          <!-- 修改既有技能：這份草稿只是複製出來改的，沒按這顆鍵就不會寫回原本的技能——
               按了就把草稿重設回目前已儲存的版本，並請外殼關閉／離開 -->
          <button v-if="props.mode === 'edit' && props.savedSkillId && props.showDiscard" type="button" class="custom-btn" @click="emit('discard')">
            <i class="material-symbols-outlined">undo</i>放棄修改
          </button>
        </template>
        <template v-if="props.mode === 'edit' && props.savedSkillId">
          <template v-if="!props.hideNavLinks">
            <button type="button" class="custom-btn" @click="router.push({ path: '/view/SkillEditor', query: { skillId: props.savedSkillId } })">
              <i class="material-symbols-outlined">edit</i>直接編輯
            </button>
            <button type="button" class="custom-btn" @click="router.push({ path: '/view/Skills' })">
              <i class="material-symbols-outlined">auto_awesome</i>到技能管理
            </button>
          </template>
          <!-- 對話測試、版本比較留在沙盒；這裡只放入口，不把沙盒整套搬進來 -->
          <button type="button" class="custom-btn" @click="goSandbox">
            <i class="material-symbols-outlined">science</i>測試沙盒
          </button>
        </template>
      </div>
    </template>

    <!-- ── 測試：不用先存檔，草稿內容就能先測；題目跟目前草稿內容不一致時
         （改過 name／triggerHint／覆蓋能力）才提示重新生成，跟存不存檔無關 ── -->
    <template v-else>
      <div v-if="effectiveTestId" class="ssp-test-body">
        <div v-if="testContentStale" class="ssp-stale-banner">
          <i class="material-symbols-outlined">info</i>
          內容已變更，建議重新生成測試情境
        </div>
        <SkillTestAI
          :skill-id="effectiveTestId!"
          :draft-context="testDraftContext"
          :can-save="props.canSave"
          :request-save-draft="props.requestSaveDraft"
        />
        <div v-if="props.savedSkillId" class="ssp-test-foot">
          <span class="ssp-test-foot-text">想手動模擬使用者對話，或比較不同版本？</span>
          <button type="button" class="custom-btn ssp-sandbox-btn" @click="goSandbox">
            <i class="material-symbols-outlined">science</i>到技能測試沙盒
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import MarkdownIt from 'markdown-it'
import 'github-markdown-css/github-markdown.css'
import { useSkillStore } from '@/stores/skillStore'
import type { SkillFile, TriggerEdgeSource } from '@/stores/skillStore'
import type { SkillDraft, StudioMode } from '@/composables/useSkillStudioConversation'
import SkillTestAI from '@/components/Skill/SkillTestAI.vue'
import SkillFileUpload from '@/components/Skill/SkillFileUpload.vue'

const store = useSkillStore()

const props = defineProps<{
  draft: SkillDraft
  mode: StudioMode
  savedSkillId: string | null
  // 測試要掛在哪個 id 底下：已存檔用真正的技能 id，還沒存檔的話呼叫端可以傳一個
  // 草稿佔位 id（見 useSkillStudioConversation.ts 的 testSkillId）讓測試提早可用；
  // 沒傳就退回 savedSkillId，維持舊行為（例如獨立測試沙盒一定是已存檔的技能）
  testSkillId?: string | null
  isDirty: boolean
  canSave: boolean
  activeTab: 'preview' | 'test'
  nameConflict?: boolean
  hideTabs?: boolean
  hideFiles?: boolean
  hideNavLinks?: boolean
  showDiscard?: boolean
  // 外殼（例如抽屜）把儲存／放棄移到固定不隨 tab 切換的位置時，這裡不用重複渲染
  // 自己的版本——見 SkillStudioWorkspace.vue 的 studio-save-footer
  hideFooter?: boolean
  // 轉傳給 SkillTestAI 的「儲存並啟用」用：同步存草稿、回傳新技能 id（見
  // useSkillStudioConversation.ts 的 save()）。這裡純轉手，不自己呼叫
  requestSaveDraft?: () => string | null
}>()

const emit = defineEmits<{
  'update:activeTab': [tab: 'preview' | 'test']
  save: []
  discard: []
  'update:files': [files: SkillFile[]]
}>()

const router = useRouter()
const md = new MarkdownIt({ html: false, breaks: true, linkify: false })
const filesExpanded = ref(false)

// 兩個 tab 共用的沙盒入口：帶著目前這顆技能過去，沙盒側欄會直接選中它
function goSandbox() {
  if (!props.savedSkillId) return
  router.push({ path: '/view/SkillTest', query: { skillId: props.savedSkillId } })
}

const instructionsHtml = computed(() =>
  props.draft.instructions.trim() ? md.render(props.draft.instructions) : ''
)

// 測試要掛在哪個 id 底下：呼叫端沒傳 testSkillId（例如獨立測試沙盒）就退回 savedSkillId，
// 維持「一定要先存檔」的舊行為
const effectiveTestId = computed(() => props.testSkillId ?? props.savedSkillId)

// 草稿還沒存檔、或技能已存在但草稿改過還沒存時，用來補齊組題關鍵字的來源。
// composition 要帶上：積木組裝的草稿測試時，組題要優先用觸發情境而不是覆蓋能力
// （見 generateDynamicTriggerEdgeScenarios），沒有這個欄位會被誤判成對話建立的技能
const testDraftContext = computed<TriggerEdgeSource>(() => ({
  name: props.draft.name,
  triggerHint: props.draft.triggerHint,
  capabilities: props.draft.capabilities,
  composition: props.draft.method === 'blocks' ? { sectionIds: [...props.draft.sectionIds] } : undefined,
}))

// 題目是不是跟不上最新的草稿內容了——不是看存不存檔，是看「產生題目當下的
// name／triggerHint／capabilities」跟「現在的草稿內容」是否還一致
const testContentStale = computed(() => {
  if (!store.aiTestReport) return false
  if (store.aiTestScenariosSkillId !== effectiveTestId.value) return false
  const current = JSON.stringify({
    name: props.draft.name,
    triggerHint: props.draft.triggerHint,
    capabilities: props.draft.capabilities,
  })
  return current !== store.aiTestScenariosSnapshot
})

// 建立模式：有名稱＋指令就能存；修改模式：還要真的有改動
const saveEnabled = computed(() =>
  props.mode === 'create' ? props.canSave : props.canSave && props.isDirty
)

// 積木方式必填欄位比較多（說明／觸發情境／覆蓋能力／指派 Agent），存不了的時候
// 直接列出還缺什麼，不要讓使用者自己猜按鈕為什麼反灰
const missingFieldsHint = computed(() => {
  if (saveEnabled.value || props.draft.method !== 'blocks') return ''
  const missing: string[] = []
  if (!props.draft.name.trim()) missing.push('技能名稱')
  if (!props.draft.instructions.trim()) missing.push('積木組成（至少選一個章節）')
  if (!props.draft.description.trim()) missing.push('說明')
  if (!props.draft.triggerHint.trim()) missing.push('觸發情境')
  if (!props.draft.capabilities.length) missing.push('覆蓋能力')
  if (!props.draft.keywords.length) missing.push('關鍵字')
  if (!props.draft.assignedAgents.length) missing.push('指派 Agent')
  return missing.length ? `還缺：${missing.join('、')}` : ''
})

const status = computed<{ label: string; tone: 'amber' | 'slate' }>(() => {
  if (!props.savedSkillId) return { label: '未儲存草稿', tone: 'amber' }
  if (props.isDirty) return { label: '有未儲存變更', tone: 'amber' }
  return { label: '個人技能 · 可使用', tone: 'slate' }
})
</script>
