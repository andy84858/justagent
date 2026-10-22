<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="skill" class="SkillDetailDrawer">
        <div class="drawer-mask" @click="emit('close')" />
        <div class="drawer-panel">

          <!-- ── Header ─────────────────────────────── -->
          <div class="drawer-head">
            <div class="dh-skill">
              <div :class="['dh-icon', iconScopeClass]">
                <i class="material-symbols-outlined">{{ iconName }}</i>
              </div>
              <div class="dh-title">
                <div class="dh-name">{{ skill.name }}</div>
                <div class="dh-badges">
                  <span v-if="!isPersonal" class="skill-tag tag--version">
                    {{ activeVersion?.versionName ?? skill.version }}
                  </span>
                  <!-- 個人技能的狀態（草稿/審核中/可使用）跟啟用/停用一樣都是
                       「目前狀態」，放在同一排徽章，不用另外佔一個區塊 -->
                  <span
                    v-if="isPersonal && personalStatusLabel"
                    :class="['skill-tag', personalStatusClass]"
                  >
                    {{ personalStatusLabel }}
                  </span>
                  <!-- 從 Library 技能庫瀏覽進來是唯讀情境，啟用／停用是各團隊自己
                       導入後的狀態，不是這顆 Library 技能本身的屬性，不該顯示 -->
                  <span
                    v-if="!libraryView"
                    :class="['dh-status', skill.isEnabled ? 'dh-status--on' : 'dh-status--off']"
                  >
                    <span class="dh-status-dot"></span>
                    {{ statusText }}
                  </span>
                </div>
              </div>
            </div>
            <div class="dh-actions">
              <template v-if="!isPersonal">
                <button v-if="manageable" class="custom-btn dh-btn" @click="emit('edit', skill!)">
                  <i class="material-symbols-outlined">edit</i>編輯
                </button>
                <button class="custom-btn dh-btn" @click="emit('test', skill!)">
                  <i class="material-symbols-outlined">science</i>測試
                </button>
              </template>
              <template v-else-if="isBackend">
                <button class="custom-btn dh-btn" @click="emit('test', skill!)">
                  <i class="material-symbols-outlined">science</i>測試
                </button>
                <button class="custom-btn dh-btn" @click="emit('edit', skill!)">
                  <i class="material-symbols-outlined">edit</i>編輯
                </button>
              </template>
              <template v-else>
                <button class="custom-btn dh-btn" @click="emit('test', skill!)">
                  <i class="material-symbols-outlined">science</i>測試
                </button>
                <button
                  v-if="skill.personalStatus !== 'reviewing'"
                  class="custom-btn dh-btn"
                  @click="emit('edit', skill!)"
                >
                  <i class="material-symbols-outlined">edit</i>編輯
                </button>
              </template>
              <button v-if="!isBackend" class="custom-btn dh-btn" @click="emit('duplicate', skill!)">
                <i class="material-symbols-outlined">content_copy</i>複製
              </button>
              <button
                v-if="isPersonal && !isBackend && skill.personalStatus !== 'reviewing'"
                class="custom-btn dh-btn dh-btn--submit"
                @click="emit('submit', skill!)"
              >
                <i class="material-symbols-outlined">send</i>送審
              </button>
              <button class="custom-btn dh-btn" @click="showMarkdown = true">
                <i class="material-symbols-outlined">description</i>skill.md
              </button>
              <button class="drawer-close-btn" @click="emit('close')">
                <i class="material-symbols-outlined">close</i>
              </button>
            </div>
          </div>

          <!-- 有版本待審核：原本只有捲到版本歷史才看得到，容易被忽略，
               放在統計數據上方、一打開就看得到。從 Library 技能庫瀏覽進來時
               是唯讀情境，不需要看到審核流程相關資訊。審核中的版本不會出現
               在版本歷史清單裡（見 sortedVersions），這裡是唯一能發現／
               開始審核的地方，團隊技能範本管理（condensed）也要顯示 -->
          <div v-if="!isPersonal && !libraryView && reviewingVersion" class="pending-review-banner">
            <div class="pending-review-text">
              <i class="material-symbols-outlined">pending_actions</i>
              新版本
              <template v-if="reviewingVersion.versionName">「<strong>{{ reviewingVersion.versionName }}</strong>」</template>
              正在等待審核
            </div>
            <button
              v-if="manageable"
              class="custom-btn"
              @click="emit('review', skill!.id, reviewingVersion.id)"
            >
              <i class="material-symbols-outlined">rate_review</i>開始審核
            </button>
          </div>

          <!-- ── Metrics bar ────────────────────────── -->
          <!-- 只顯示本月使用次數，不放測試通過率/平均延遲。只有一格時
               不套用「多格平分寬度」的排版，改成靠左的緊湊區塊＋
               justify-content:space-between 把停用按鈕推到最右，
               不會像之前那樣留下一大塊空白。團隊技能範本管理
               （condensed）不顯示使用次數這類純資訊，只留下啟用／停用
               這個實際操作，靠右對齊 -->
          <div :class="['drawer-metrics', { 'drawer-metrics--action-only': condensed }]">
            <div v-if="!condensed" class="dm-cell">
              <i class="material-symbols-outlined dm-icon dm-icon--bolt">bolt</i>
              <div class="dm-num">{{ formatCount(skill.usageCount) }}</div>
              <div class="dm-lbl">本月使用</div>
            </div>
            <!-- 個人技能審核中不能切換啟用/停用，避免動到正在被審核的內容 -->
            <div v-if="(!isBackend || !skill.isEnabled) && ((isPersonal && skill.personalStatus !== 'reviewing') || manageable)" class="dm-toggle">
              <button
                class="custom-btn dm-toggle-btn btn--danger-ghost"
                @click="emit('toggle', skill!)"
              >
                {{ skill.isEnabled ? '停用' : '啟用技能' }}
              </button>
            </div>
          </div>

          <!-- ── Body：雙欄——左邊是「這個技能在做什麼」的主要內容，
               右邊是常駐的中繼資料側欄（來源/Agent/趨勢/版本），概念上
               跟 GitHub PR 頁面「說明在左、標籤在右」是同一種分法 ──── -->
          <div class="drawer-body">

            <div class="drawer-body-main">

              <!-- 版本歷史：固定區塊，但只有 Library 技能才有版本概念，個人
                   技能沒有這個區塊（不是資料剛好是空的，是本來就不該顯示）。
                   放在主欄最前面、不是側欄小空間——這裡有實際能操作的按鈕
                   （設為使用中／開始審核／與目前版本比較），需要比純資訊的區塊
                   更顯眼、更有空間。從 Library 技能庫瀏覽進來時是唯讀情境，
                   不顯示版本歷史／審核相關操作 -->
              <div v-if="!isPersonal && !libraryView" class="drawer-section">
                <div class="section-label">版本歷史</div>
                <div v-if="skill.versions?.length" class="vt-list">
                  <div v-for="ver in sortedVersions" :key="ver.id" class="vt-item">
                    <div :class="['vt-dot', `vt-dot--${ver.status}`]"></div>
                    <div class="vt-body">
                      <div class="vt-header">
                        <!-- 版本不用版號區隔，一律顯示版本名稱，所有狀態
                             （含審核中）都一樣，跟待審核提示條、審核視窗的
                             顯示方式保持一致 -->
                        <span class="vt-version-name">{{ ver.versionName }}</span>
                        <span :class="['vt-status-badge', `vt-status--${ver.status}`]">
                          {{ versionStatusLabel(ver.status) }}
                        </span>
                        <span class="vt-date">{{ formatDate(ver.createdAt) }}</span>
                        <!-- 版本會隨時間越積越多，讓管理者能清掉不需要的舊版本；
                             生效中的版本不能刪，要刪之前得先切換到別的版本 -->
                        <button
                          v-if="props.manageable && !isPersonal && ver.status !== 'active'"
                          type="button"
                          class="icon-btn vt-delete-btn"
                          aria-label="刪除版本"
                          @click="versionPendingDelete = ver"
                        >
                          <i class="material-symbols-outlined">delete</i>
                        </button>
                      </div>
                      <div v-if="ver.updateNote" class="vt-note">{{ ver.updateNote }}</div>
                      <div class="vt-actions">
                        <!-- 「待啟用」（剛審核通過，還沒上線）或「歷史」（曾經生效、
                             後來被取代）才能設為使用中；審核中的版本不會出現在這份
                             清單裡（見 sortedVersions），不用另外判斷 -->
                        <button
                          v-if="props.manageable && !isPersonal && (ver.status === 'approved' || ver.status === 'history')"
                          class="custom-btn vt-activate-btn"
                          @click="skillStore.setLibraryActiveVersion(skill!.id, ver.id)"
                        >
                          <i class="material-symbols-outlined">check_circle</i>{{ condensed ? '切換版本' : '設為使用中' }}
                        </button>
                        <!-- 固定跟目前生效版本比較，不是跟清單中緊接著的前一筆比；
                             生效版本自己這一列不用跟自己比 -->
                        <button
                          v-if="activeVersion && ver.id !== activeVersion.id"
                          class="custom-btn"
                          @click="openCompareWithActive(ver)"
                        >
                          <i class="material-symbols-outlined">difference</i>與目前版本比較
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <p v-else class="section-empty-hint">尚無版本歷史</p>
              </div>

              <!-- 後端技能的版本：每版標示有沒有測過，可從任一版進修改（存回去是新版本） -->
              <div v-if="isBackend" class="drawer-section">
                <div class="section-label">版本歷史</div>
                <BackendSkillVersions :skill-id="skill.id" @modify="v => emit('editVersion', skill!, v)" />
              </div>

              <!-- 個人技能的送審脈絡：可能包含審核退回原因，屬於需要立刻
                   看到的內容，不放進側欄。狀態標籤本身移到標頭跟啟用/停用
                   放一起，這裡只在真的有內容（建立方式/預計發布範圍/來源
                   更新提示/送審說明/退回原因）時才顯示，不是固定佔位的
                   獨立區塊 -->
              <div v-if="isPersonal && hasPersonalStatusDetails" class="psv-details">
                <div v-if="skill.submitMode || (skill.personalStatus === 'reviewing' && skill.targetScope)" class="psv-head">
                  <span v-if="skill.submitMode" class="psv-mode">
                    {{ skill.submitMode === 'version_update' ? '更新版本' : '建立新技能' }}
                  </span>
                  <span
                    v-if="skill.personalStatus === 'reviewing' && skill.targetScope"
                    class="skill-tag psv-scope-tag"
                    :class="skill.targetScope === 'team' ? 'tag--team' : 'tag--enterprise'"
                  >
                    <i class="material-symbols-outlined">{{ skill.targetScope === 'team' ? 'group' : 'corporate_fare' }}</i>
                    預計發布：{{ skill.targetScope === 'team' ? `團隊技能（${skill.targetTeamName ?? '未指定團隊'}）` : '企業技能' }}
                  </span>
                </div>

                <div v-if="skill.submitNote" class="psv-note">
                  <i class="material-symbols-outlined">sticky_note_2</i>{{ skill.submitNote }}
                </div>
                <div v-if="skill.reviewFeedback" class="psv-reject-feedback">
                  <i class="material-symbols-outlined">feedback</i>
                  <div>
                    <div class="psv-reject-feedback-label">審核退回原因</div>
                    <div>{{ skill.reviewFeedback }}</div>
                  </div>
                </div>
              </div>

              <!-- 團隊技能範本管理（condensed）：這裡的重點是切換版本，不是閱讀
                   技能內容，把技能定義收進一個預設收合的區塊，避免版本歷史
                   被大量說明文字往下擠 -->
              <button
                v-if="condensed"
                type="button"
                class="custom-btn drawer-more-info-toggle"
                @click="showMoreSkillInfo = !showMoreSkillInfo"
              >
                <i class="material-symbols-outlined">{{ showMoreSkillInfo ? 'expand_less' : 'expand_more' }}</i>
                {{ showMoreSkillInfo ? '收合技能資訊' : '顯示更多技能資訊' }}
              </button>

              <!-- 技能定義：技能指令／覆蓋能力／實際使用情境本來就是同一份
                   skill.md 依序組出來的內容（見 buildSkillDefinitionMarkdown），
                   直接 render 成 markdown——沒有的段落（例如沒有覆蓋能力）
                   就不會出現，不會有空區塊卡在那邊 -->
              <div v-if="!condensed || showMoreSkillInfo" class="drawer-section">
                <div class="section-label">技能定義</div>
                <div v-if="skillDefinitionHtml" class="markdown-body" v-html="skillDefinitionHtml"></div>
                <p v-else class="section-empty-hint">尚未撰寫技能定義</p>
              </div>

              <!-- 危險操作：審核中不能刪除，避免刪掉一個正在被審核的內容（後端技能沒有送審流程，不受這條限制） -->
              <div v-if="isPersonal && (isBackend || skill.personalStatus !== 'reviewing')" class="drawer-danger-zone">
                <div class="danger-zone-label">危險操作</div>
                <button
                  class="custom-btn btn--danger-ghost drawer-delete-btn"
                  @click="showConfirm = true"
                >
                  <i class="material-symbols-outlined">delete</i>刪除此技能
                </button>
              </div>
            </div>

            <div class="drawer-body-side">

              <!-- 來源關係：企業技能是全公司唯一一份的正式發佈技能，沒有「延伸自
                   誰／自建」這種個人層級的血緣關係可看，顯示反而是雜訊 -->
              <div v-if="skill.scope !== 'enterprise'" class="drawer-section">
                <div class="section-label">來源關係</div>
                <div class="lineage-row">
                  <template v-if="lineageSourceName">
                    <span class="lineage-text">
                      <i class="material-symbols-outlined lineage-icon">call_split</i>
                      延伸自「{{ lineageSourceName }}」
                    </span>
                    <span v-if="lineageSourceVersion" class="skill-tag tag--version">{{ lineageSourceVersion }}</span>
                    <span v-if="lineageSourceScopeLabel" :class="['skill-tag', lineageSourceScopeClass]">{{ lineageSourceScopeLabel }}</span>
                  </template>
                  <span v-else class="lineage-text">
                    <i class="material-symbols-outlined lineage-icon">edit</i>
                    自建
                  </span>
                </div>
              </div>

              <!-- 可調用此技能的 Agent -->
              <div class="drawer-section">
                <div class="section-label">可調用此技能的 Agent</div>
                <div v-if="skill.assignedAgents?.length" class="agent-tag-list">
                  <span v-for="agent in skill.assignedAgents" :key="agent" class="agent-tag">
                    <i class="material-symbols-outlined">smart_toy</i>
                    {{ agent }}
                  </span>
                </div>
                <div v-else class="agent-empty">尚未指派給任何 Agent</div>
              </div>

              <!-- 近 7 天使用趨勢 -->
              <div class="drawer-section">
                <div class="section-label chart-section-label">
                  <span>近 7 天使用趨勢</span>
                </div>
                <div class="chart-wrap">
                  <svg viewBox="0 0 400 100" preserveAspectRatio="none" class="trend-svg">
                    <defs>
                      <linearGradient :id="`grad-${skill.id}`" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#059669" stop-opacity="0.18" />
                        <stop offset="100%" stop-color="#059669" stop-opacity="0" />
                      </linearGradient>
                    </defs>
                    <path :d="chartData.area" :fill="`url(#grad-${skill.id})`" />
                    <path :d="chartData.line" fill="none" stroke="#059669" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round" />
                    <circle
                      v-for="(p, i) in chartData.pts"
                      :key="i"
                      :cx="p.x" :cy="p.y" r="2.5"
                      fill="#059669"
                    />
                  </svg>
                  <div class="chart-x-labels">
                    <span v-for="l in CHART_LABELS" :key="l">{{ l }}</span>
                  </div>
                </div>
              </div>

              <!-- 操作記錄 -->
              <div v-if="auditLog.length" class="drawer-section">
                <div class="section-label">操作記錄</div>
                <div class="audit-timeline">
                  <div v-for="(rec, i) in auditLog" :key="i" class="audit-item">
                    <div :class="['audit-dot', `audit-dot--${rec.action.toLowerCase()}`]"></div>
                    <div class="audit-body">
                      <span class="audit-action">{{ auditActionLabel(rec.action) }}{{ rec.detail ? `：${rec.detail}` : '' }}</span>
                      <span class="audit-meta">· {{ rec.by }} · {{ formatAuditDate(rec.time) }}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 版本比較 modal -->
    <SkillVersionCompareModal
      v-if="skill && compareV1Id && compareV2Id"
      v-model="showCompare"
      :skill-id="skill.id"
      :v1-id="compareV1Id"
      :v2-id="compareV2Id"
    />

    <!-- skill.md 內容 -->
    <SkillMarkdownModal v-model="showMarkdown" :skill="skill" />

    <!-- 刪除確認 -->
    <Transition name="confirm-fade">
      <div v-if="showConfirm && skill" class="drawer-confirm-overlay" @click.self="showConfirm = false">
        <div class="drawer-confirm-dialog">
          <div class="confirm-icon"><i class="material-symbols-outlined">warning</i></div>
          <h4>確定要刪除「{{ skill.name }}」？</h4>
          <p v-if="isBackend">這個技能的所有版本都會一併刪除，刪了就回不來。</p>
          <p v-else>刪除後此技能將無法繼續使用。</p>
          <div class="confirm-actions">
            <button class="custom-btn" @click="showConfirm = false">取消</button>
            <button class="custom-btn btn--danger-ghost" @click="confirmDelete">確定刪除</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 刪除版本確認 -->
    <Transition name="confirm-fade">
      <div
        v-if="versionPendingDelete && skill"
        class="drawer-confirm-overlay"
        @click.self="versionPendingDelete = null"
      >
        <div class="drawer-confirm-dialog">
          <div class="confirm-icon"><i class="material-symbols-outlined">warning</i></div>
          <h4>確定要刪除版本「{{ versionPendingDelete.versionName }}」？</h4>
          <p>刪除後這筆版本歷史將無法復原。</p>
          <div class="confirm-actions">
            <button class="custom-btn" @click="versionPendingDelete = null">取消</button>
            <button class="custom-btn btn--danger-ghost" @click="confirmDeleteVersion">確定刪除</button>
          </div>
        </div>
      </div>
    </Transition>

  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import MarkdownIt from 'markdown-it'
import 'github-markdown-css/github-markdown.css'
import type { Skill, SkillVersion, SkillVersionStatus, OperationRecord } from '@/stores/skillStore'
import { useSkillStore } from '@/stores/skillStore'
import SkillVersionCompareModal from '@/components/Skill/SkillVersionCompareModal.vue'
import SkillMarkdownModal from '@/components/Skill/SkillMarkdownModal.vue'
import BackendSkillVersions from '@/components/Skill/BackendSkillVersions.vue'
import { buildSkillDefinitionMarkdown } from '@/utils/skillMarkdown'

const CHART_LABELS = ['6天前', '5天前', '4天前', '3天前', '2天前', '昨天', '今天']

const props = defineProps<{
  skill: Skill | null
  upstreamVersion?: string
  manageable?: boolean
  // 從 Library 技能庫瀏覽進來（唯讀情境）：不顯示版本歷史、待審核提示區塊
  libraryView?: boolean
  // 從團隊技能範本管理進來：重點是切換版本，收合技能內容說明區塊
  condensed?: boolean
}>()
const emit = defineEmits<{
  close: []
  test: [skill: Skill]
  toggle: [skill: Skill]
  edit: [skill: Skill]
  delete: [skill: Skill]
  duplicate: [skill: Skill]
  review: [skillId: string, versionId: string]
  openUpstreamUpdate: [skill: Skill]
  submit: [skill: Skill]
  editVersion: [skill: Skill, version: number]
}>()

const skillStore = useSkillStore()
const showConfirm = ref(false)
const versionPendingDelete = ref<SkillVersion | null>(null)
const showMarkdown = ref(false)
const showMoreSkillInfo = ref(false)
const showCompare = ref(false)
const compareV1Id = ref('')
const compareV2Id = ref('')

const md = new MarkdownIt({ html: false, breaks: true, linkify: false })

const isPersonal = computed(() => props.skill?.zone === 'personal')
// 後端技能：編輯、測試、啟用（只能啟用，後端沒有停用）、版本與刪除可用，複製／送審還沒接後端
const isBackend = computed(() => !!props.skill?.backendVersion)

const statusText = computed(() => {
  const s = props.skill
  if (!s) return ''
  if (s.backendVersion) return `${s.isEnabled ? '啟用中 · ' : ''}第 ${s.backendVersion.version} 版 · ${s.backendVersion.tested ? '測過' : '沒測過'}`
  if (s.isEnabled) return '啟用中'
  return isPersonal.value && s.aiTestPassRate == null ? '尚未測試' : '已停用'
})

// 技能定義直接 render 成 markdown，跟 skill.md 內容共用同一份組法
// （buildSkillDefinitionMarkdown），沒有的段落就不會出現
const skillDefinitionHtml = computed(() => {
  if (!props.skill) return ''
  const source = buildSkillDefinitionMarkdown(props.skill)
  return source ? md.render(source) : ''
})

// has_library（已核准並發布至 Library）不特別顯示標籤，退回「可使用」——
// 這只是後台狀態，畫面上不用標出來，personalStatus 本身跟送審層級鎖定
// 邏輯不受影響
const personalStatusLabel = computed(() => {
  const s = props.skill
  if (!s) return null
  if (s.personalStatus === 'draft') return '草稿'
  if (s.personalStatus === 'reviewing') return '審核中'
  return '可使用'
})

const personalStatusClass = computed(() => {
  const s = props.skill?.personalStatus
  if (s === 'draft') return 'tag--draft'
  if (s === 'reviewing') return 'tag--reviewing'
  return 'tag--available'
})

// 狀態標籤本身已經移到標頭，這裡只要判斷「除了狀態以外還有沒有別的
// 送審脈絡可以顯示」，沒有的話（多數「可使用」的個人技能）整塊都不顯示
const hasPersonalStatusDetails = computed(() => {
  const s = props.skill
  if (!s) return false
  return !!(
    s.submitMode ||
    (s.personalStatus === 'reviewing' && s.targetScope) ||
    s.submitNote ||
    s.reviewFeedback
  )
})

// 圖示跟卡片式目錄（SkillTile／PersonalSkillGroup）統一：用 scope 決定顏色、
// 個人技能用 person 圖示，其餘一律 psychology，不再依 type（system/extension）
// 另外分一套配色，避免同一顆技能在列表卡片跟詳情抽屜長得不一樣
const iconName = computed(() => (isPersonal.value ? 'person' : 'psychology'))

const iconScopeClass = computed(() => {
  if (isPersonal.value) return 'icon--personal'
  if (props.skill?.scope === 'enterprise') return 'icon--enterprise'
  if (props.skill?.scope === 'team') return 'icon--team'
  return 'icon--system'
})

// 審核中的版本還沒有定論（可能通過也可能被退回），不算「歷史」的一部分，
// 不收進版本歷史清單——要看／處理審核中版本走 pending-review-banner 或
// 待審核佇列，不是這裡
const sortedVersions = computed(() => {
  if (!props.skill?.versions) return []
  return [...props.skill.versions].filter(v => v.status !== 'reviewing').reverse()
})

// 目前生效版本：「與目前版本比較」固定跟它比，不是跟清單中緊接著的前一筆比
const activeVersion = computed(() => props.skill?.versions?.find(v => v.status === 'active'))

// 有沒有一個「審核中」的新版本（Library 技能既有版本之外又送了新版本審核，
// 跟個人技能自己送審 Library 是兩回事，個人技能不會有這個狀態）
const reviewingVersion = computed(() =>
  props.skill?.versions?.find(v => v.status === 'reviewing')
)

const lineageSource = computed(() => {
  const s = props.skill
  if (!s) return null
  const sourceId = s.forkSourceId ?? s.derivedFrom
  if (!sourceId) return null
  return skillStore.findSkill(sourceId) ?? null
})

const lineageSourceName = computed(() => {
  const s = props.skill
  if (!s) return ''
  const sourceId = s.forkSourceId ?? s.derivedFrom
  if (!sourceId) return ''
  return lineageSource.value?.name ?? sourceId
})

const lineageSourceVersion = computed(() => {
  const s = props.skill
  if (!s) return ''
  return s.forkSourceVersion ?? s.derivedFromVersion ?? ''
})

const lineageSourceScopeLabel = computed(() => {
  const src = lineageSource.value
  if (!src) return ''
  if (src.zone === 'personal') return '個人技能'
  if (src.scope === 'team') return `團隊技能${src.teamName ? `・${src.teamName}` : ''}`
  if (src.scope === 'enterprise') return '企業技能'
  if (src.scope === 'system') return '系統技能'
  return ''
})

const lineageSourceScopeClass = computed(() => {
  const src = lineageSource.value
  if (!src) return ''
  if (src.zone === 'personal') return 'tag--personal'
  if (src.scope === 'team') return 'tag--team'
  if (src.scope === 'enterprise') return 'tag--enterprise'
  if (src.scope === 'system') return 'tag--sys'
  return ''
})

const auditLog = computed(() => (props.skill?.auditLog ?? []).slice(0, 5))

function auditActionLabel(action: OperationRecord['action']): string {
  const map: Record<OperationRecord['action'], string> = {
    ENABLED: '啟用此技能',
    DISABLED: '停用此技能',
    UPSTREAM_MERGED: '合併上游更新',
    UPSTREAM_IGNORED: '忽略上游更新',
    UPSTREAM_DETACHED: '永久分離上游',
    VERSION_ACTIVATED: '切換生效版本',
  }
  return map[action]
}

function formatAuditDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function versionStatusLabel(status: SkillVersionStatus): string {
  const map: Record<SkillVersionStatus, string> = {
    draft: '草稿', reviewing: '審核中', approved: '待啟用', active: '生效中', history: '歷史', rejected: '已退回',
  }
  return map[status] ?? status
}

function openCompare(v1Id: string, v2Id: string) {
  compareV1Id.value = v1Id
  compareV2Id.value = v2Id
  showCompare.value = true
}

// v1 永遠是比較舊的那個版本、v2 是比較新的（SkillVersionCompareModal 用這個
// 順序決定左邊「舊」欄、右邊「新」欄），所以要依實際時間先後排，不能固定
// activeVersion 放 v1——如果 ver 是還沒上線的待啟用/審核中版本，它比目前生效版新
function openCompareWithActive(ver: SkillVersion) {
  const active = activeVersion.value
  if (!active) return
  if (ver.createdAt < active.createdAt) openCompare(ver.id, active.id)
  else openCompare(active.id, ver.id)
}

function mockWeeklyData(skill: Skill): number[] {
  const seed = skill.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const base = Math.max(skill.usageCount, 5)
  return Array.from({ length: 7 }, (_, i) =>
    Math.round(base * 0.12 * (0.4 + Math.abs(Math.sin(seed * 0.07 + i * 1.1))))
  )
}

const chartData = computed(() => {
  const skill = props.skill
  if (!skill) return { pts: [], line: '', area: '' }

  const values = mockWeeklyData(skill)
  const W = 400, H = 100
  const px = 8, pt = 8, pb = 12
  const maxVal = Math.max(...values, 1)

  const pts = values.map((v, i) => ({
    x: px + (i / (values.length - 1)) * (W - px * 2),
    y: pt + (1 - v / maxVal) * (H - pt - pb),
  }))

  let line = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1].x + pts[i].x) / 2
    line += ` C ${cpx} ${pts[i - 1].y} ${cpx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`
  }

  const bottomY = H - pb
  const area = `${line} L ${pts[pts.length - 1].x} ${bottomY} L ${pts[0].x} ${bottomY} Z`
  return { pts, line, area }
})

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function confirmDelete() {
  showConfirm.value = false
  emit('delete', props.skill!)
}

function confirmDeleteVersion() {
  if (!props.skill || !versionPendingDelete.value) return
  skillStore.deleteSkillVersion(props.skill.id, versionPendingDelete.value.id)
  versionPendingDelete.value = null
}
</script>
