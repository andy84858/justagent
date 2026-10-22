<template>
  <div class="SkillReviewCard">

    <!-- ── Header：icon 跟其他技能卡片一致，用 scope 決定配色；名稱是
         唯一的視覺主角，狀態徽章靠右對齊；「建立新技能/更新版本」跟
         「預計發布範圍」是同一件事的兩個面向，放在名稱下面同一行安靜
         呈現，不再跟名稱、狀態擠在同一行搶版面 ──────────────────── -->
    <div class="src-header">
      <div class="src-icon-row">
        <div :class="['src-icon', targetScope === 'team' ? 'icon--team' : 'icon--enterprise']">
          <i class="material-symbols-outlined">psychology</i>
        </div>
        <div class="src-title-block">
          <div class="src-name-row">
            <span class="src-name">{{ skill.name }}</span>
          </div>
          <div class="src-tag-row">
            <span :class="['src-mode-tag', submitMode === 'version_update' ? 'src-mode-tag--update' : 'src-mode-tag--new']">
              <i class="material-symbols-outlined">{{ submitMode === 'version_update' ? 'update' : 'add_circle' }}</i>
              {{ submitModeLabel }}
            </span>
            <i class="material-symbols-outlined src-tag-arrow">arrow_forward</i>
            <span class="skill-tag src-scope-tag" :class="targetScope === 'team' ? 'tag--team' : 'tag--enterprise'">
              <i class="material-symbols-outlined">{{ targetScope === 'team' ? 'group' : 'corporate_fare' }}</i>
              {{ targetScope === 'team' ? `團隊技能（${targetTeamName ?? '未指定團隊'}）` : '企業技能' }}
            </span>
          </div>
        </div>
      </div>
      <div class="src-meta">
        <span v-if="submittedBy" class="src-meta-item">
          <i class="material-symbols-outlined">person</i>送審人：{{ submittedBy }}
        </span>
        <span v-if="updateTargetName" class="src-meta-item">
          <i class="material-symbols-outlined">update</i>更新對象：{{ updateTargetName }}
        </span>
        <span v-if="derivedFromName" class="src-meta-item">
          <i class="material-symbols-outlined">link</i>來源：{{ derivedFromName }}
        </span>
        <span v-if="skill.submitNote" class="src-meta-item">
          <i class="material-symbols-outlined">sticky_note_2</i>{{ skill.submitNote }}
        </span>
      </div>
    </div>

    <!-- ── 技能定義：RD 六段（技能描述／步驟／例外或特殊情況／固定輸出格式／適用範圍／
         覆蓋能力），審核要看的主體內容，預設展開；跟詳情抽屜、skill.md 同一份組法 ── -->
    <div v-if="definitionHtml" class="src-section">
      <div class="src-section-label" @click="showDefinition = !showDefinition">
        <i class="material-symbols-outlined">description</i>
        技能定義
        <i :class="['material-symbols-outlined', 'src-chevron', { 'is-open': showDefinition }]">expand_more</i>
      </div>
      <div v-show="showDefinition" class="markdown-body src-definition" v-html="definitionHtml"></div>
    </div>

    <!-- ── 技能指令 ────────────────────────────── -->
    <div v-if="skill.instructions" class="src-section">
      <div class="src-section-label" @click="showInstructions = !showInstructions">
        <i class="material-symbols-outlined">code</i>
        技能指令
        <i :class="['material-symbols-outlined', 'src-chevron', { 'is-open': showInstructions }]">expand_more</i>
      </div>
      <div v-show="showInstructions" class="src-instructions">{{ skill.instructions }}</div>
    </div>

    <!-- ── AI 分析 ─────────────────────────────── -->
    <div v-if="skill.aiAnalysis?.length" class="src-section src-section--ai">
      <div class="src-section-label">
        <i class="material-symbols-outlined">auto_awesome</i>
        AI 分析：新版使用情境
      </div>
      <ul class="src-ai-list">
        <li v-for="(item, i) in skill.aiAnalysis" :key="i">{{ item }}</li>
      </ul>
    </div>

    <!-- ── Actions ────────────────────────────── -->
    <div class="src-actions">
      <button class="custom-btn src-btn" @click="emit('view', skill)">
        <i class="material-symbols-outlined">open_in_new</i>查看完整詳情
      </button>
      <button class="custom-btn src-btn" @click="showMarkdown = true">
        <i class="material-symbols-outlined">description</i>skill.md
      </button>
      <div class="src-actions-right">
        <button class="custom-btn src-btn src-btn--reject" @click="showRejectDialog = true">
          <i class="material-symbols-outlined">undo</i>退回
        </button>
        <button class="custom-btn custom-main-btn src-btn" @click="showApproveDialog = true">
          <i class="material-symbols-outlined">check</i>通過審核
        </button>
      </div>
    </div>

    <SkillMarkdownModal v-model="showMarkdown" :skill="skill" />

    <!-- 通過審核確認 -->
    <Teleport to="body">
      <Transition name="confirm-fade">
        <div v-if="showApproveDialog" class="drawer-confirm-overlay" @click.self="showApproveDialog = false">
          <div class="drawer-confirm-dialog">
            <div class="confirm-icon confirm-icon--update"><i class="material-symbols-outlined">check_circle</i></div>
            <h4>確定通過「{{ skill.name }}」的審核？</h4>
            <p>
              通過後會發佈到 Library，層級為
              {{ targetScope === 'team' ? `團隊技能（${targetTeamName ?? '未指定團隊'}）` : '企業技能' }}。
            </p>
            <div class="confirm-actions">
              <button class="custom-btn" @click="showApproveDialog = false">取消</button>
              <button class="custom-btn custom-main-btn" @click="confirmApprove">確定通過</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 退回原因 -->
    <Teleport to="body">
      <Transition name="confirm-fade">
        <div v-if="showRejectDialog" class="drawer-confirm-overlay" @click.self="showRejectDialog = false">
          <div class="drawer-confirm-dialog src-reject-dialog">
            <div class="confirm-icon"><i class="material-symbols-outlined">undo</i></div>
            <h4>退回「{{ skill.name }}」</h4>
            <p>請說明退回原因，送審人會在自己的技能版本上看到這則說明。</p>
            <textarea
              v-model="rejectFeedback"
              class="src-reject-textarea"
              rows="3"
              placeholder="說明需要修改的地方..."
            ></textarea>
            <div class="confirm-actions">
              <button class="custom-btn" @click="showRejectDialog = false">取消</button>
              <button class="custom-btn btn--danger-ghost" @click="confirmReject">確定退回</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Skill } from '@/stores/skillStore'
import { useSkillStore } from '@/stores/skillStore'
import SkillMarkdownModal from '@/components/Skill/SkillMarkdownModal.vue'
import MarkdownIt from 'markdown-it'
import { buildSkillDefinitionMarkdown } from '@/utils/skillMarkdown'

const props = defineProps<{ skill: Skill }>()
const emit = defineEmits<{
  view: [skill: Skill]
  approve: [skill: Skill]
  reject: [skill: Skill, feedback: string]
}>()

const store = useSkillStore()
const showInstructions = ref(false)
const showDefinition = ref(true)
const showMarkdown = ref(false)
const showRejectDialog = ref(false)
const rejectFeedback = ref('')
const showApproveDialog = ref(false)

function confirmReject() {
  emit('reject', props.skill, rejectFeedback.value.trim())
  showRejectDialog.value = false
  rejectFeedback.value = ''
}

function confirmApprove() {
  emit('approve', props.skill)
  showApproveDialog.value = false
}

const md = new MarkdownIt({ html: false, breaks: true, linkify: false })
const definitionHtml = computed(() => {
  const source = buildSkillDefinitionMarkdown(props.skill)
  return source ? md.render(source) : ''
})

const submitMode = computed(() => props.skill.submitMode ?? 'new_skill')
const submitModeLabel = computed(() =>
  submitMode.value === 'version_update' ? '更新版本' : '建立新技能'
)
const targetScope = computed(() => props.skill.targetScope ?? 'enterprise')
const targetTeamName = computed(() => props.skill.targetTeamName)
const submittedBy = computed(() => props.skill.submittedBy)

const updateTargetName = computed(() => {
  if (submitMode.value !== 'version_update') return null
  const targetId = props.skill.updateTargetId ?? props.skill.derivedFrom
  if (!targetId) return null
  return store.flatSkills.find(s => s.id === targetId)?.name ?? null
})

const derivedFromName = computed(() => {
  if (!props.skill.derivedFrom) return null
  return store.flatSkills.find(s => s.id === props.skill.derivedFrom)?.name ?? null
})
</script>
