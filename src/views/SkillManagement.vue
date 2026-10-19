<template>
  <div class="SkillManagement views-page">
    <div class="views-page-content-box">

      <!-- Page Banner -->
      <div class="page-banner">
        <div>
          <AppBreadcrumb />
          <div class="banner-title">{{ activeTab === 'review' ? '團隊技能管理' : '技能管理' }}</div>
        </div>
        <div class="page-banner-actions">
          <button v-if="isManager && activeTab === 'my'" class="custom-btn custom-main-btn" @click="activeTab = 'review'">
            <i class="material-symbols-outlined">admin_panel_settings</i>團隊技能管理
          </button>
        </div>
      </div>

      <!-- 統計列：跟 TeamAccessManagement 的角色統計同一套「色點 + 文字」語彙，
           不用四個顏色各異的邊框卡片堆砌成一整排，避免看起來太像後台儀表板。
           只跟「我的技能」有關，團隊技能管理頁不顯示。待審核提醒併進同一列的
           最前面，但用實心 pill 徽章（不是安靜的色點），需要行動的提醒
           要比純資訊的三個數字更搶眼，不能跟它們長得一樣低調 -->
      <div v-if="activeTab === 'my'" class="skill-stats-row">
        <button
          v-if="isManager && store.pendingReviewSkills.length > 0"
          class="skill-stat skill-stat--pending"
          @click="activeTab = 'review'; reviewSubTab = 'pending'"
        >
          <i class="material-symbols-outlined">rate_review</i><b>{{ store.pendingReviewSkills.length }}</b>個技能等待審核
        </button>
        <button
          v-if="store.pendingSuggestions.length > 0"
          class="skill-stat skill-stat--suggestion"
          @click="scrollToSuggestions"
        >
          <i class="material-symbols-outlined">auto_awesome</i><b>{{ store.pendingSuggestions.length }}</b>個 AI 建議技能待處理
        </button>
        <div class="skill-stat skill-stat--enabled">
          <i class="stat-dot"></i><b>{{ store.enabledCount }}</b>啟用中技能
        </div>
        <div class="skill-stat skill-stat--ext">
          <i class="stat-dot"></i><b>{{ store.enterpriseExtensionCount }}</b>企業擴充
        </div>
        <div class="skill-stat skill-stat--team">
          <i class="stat-dot"></i><b>{{ store.teamExtensionCount }}</b>團隊擴充
        </div>
        <div class="skill-stat skill-stat--usage">
          <i class="stat-dot"></i><b>{{ store.totalUsageCount.toLocaleString() }}</b>本月自動觸發次數
        </div>
      </div>

      <!-- ── Sections ──────────────────────────────── -->
      <div class="skill-sections">

        <!-- 管理區：待審核送審 + Library 現有技能管理（限企業擁有者 / 企業管理者）
             兩塊內容都不小，不再直接上下堆疊成一個超長頁面，改成子分頁各自獨立。
             跟「我的技能」是完全分開的兩個頁面，不共用 tab bar 樣式，靠這顆按鈕互相切換 -->
        <div v-if="isManager" v-show="activeTab === 'review'" class="skill-tab-panel">
          <button class="custom-btn skill-back-btn" @click="activeTab = 'my'">
            <i class="material-symbols-outlined">arrow_back</i>返回技能管理
          </button>

          <div class="review-subtabs">
            <button
              :class="['review-subtab', { 'is-active': reviewSubTab === 'pending' }]"
              @click="reviewSubTab = 'pending'"
            >
              待審核
              <span class="skill-tab-count">{{ store.pendingReviewSkills.length }}</span>
            </button>
            <button
              :class="['review-subtab', { 'is-active': reviewSubTab === 'library' }]"
              @click="reviewSubTab = 'library'"
            >
              團隊技能範本管理
              <span class="skill-tab-count">{{ store.enterpriseExtensionCount + store.teamExtensionCount }}</span>
            </button>
          </div>

          <div v-show="reviewSubTab === 'pending'" class="skill-review-block">
            <p class="skill-tab-panel-desc">等待審核的技能送審申請，通過後將發佈至 Library</p>
            <SkillReviewQueue
              v-if="store.pendingReviewSkills.length"
              :skills="store.pendingReviewSkills"
              @view="detailFromLibrary = false; detailFromTemplateManage = false; detailSkillId = $event.id"
              @approve="handleApprove"
              @reject="handleReject"
            />
            <div v-else class="skill-section-empty">目前沒有待審核的技能</div>
          </div>

          <!-- 團隊技能範本管理（原「Library 現有技能管理」） -->
          <div v-show="reviewSubTab === 'library'" class="skill-manage-block">
            <div class="skill-manage-block-header">
              <span class="skill-manage-block-title">
                <i class="material-symbols-outlined">inventory_2</i>團隊技能範本管理
              </span>
              <div class="skill-search">
                <i class="material-symbols-outlined">search</i>
                <input v-model="libraryManageQuery" class="skill-search-input" placeholder="搜尋技能名稱或描述" />
              </div>
            </div>
            <div v-if="filteredLibrarySkills.length" class="lsr-sections">
              <!-- 企業技能 -->
              <div v-if="filteredEnterpriseSkills.length" class="lsr-section-block lsr-section-block--enterprise">
                <div class="lsr-section-header">
                  <i class="material-symbols-outlined">corporate_fare</i>
                  <span class="lsr-section-title">企業技能</span>
                  <span class="lsr-section-count">{{ filteredEnterpriseSkills.length }}</span>
                </div>
                <div class="lsr-section-list">
                  <SkillTile
                    v-for="skill in filteredEnterpriseSkills"
                    :key="skill.id"
                    :skill="skill"
                    @click="detailFromLibrary = false; detailFromTemplateManage = true; detailSkillId = skill.id"
                    @test="handleTest"
                    @duplicate="handleDuplicate"
                  />
                </div>
              </div>
              <!-- 團隊技能（依團隊分組，每團隊一張卡片） -->
              <div v-if="groupedTeamSkills.length" class="lsr-section-block lsr-section-block--team">
                <div class="lsr-section-header">
                  <i class="material-symbols-outlined">group</i>
                  <span class="lsr-section-title">團隊技能</span>
                  <span class="lsr-section-count">{{ groupedTeamSkills.reduce((s, g) => s + g.skills.length, 0) }}</span>
                </div>
                <div class="lsr-team-grid lively-stagger">
                  <div
                    v-for="(group, gi) in groupedTeamSkills"
                    :key="group.teamName"
                    :class="['lsr-team-card', 'lively-card', gi % 2 === 0 ? 'lively-corner-a' : 'lively-corner-b']"
                  >
                    <div class="lsr-team-label">
                      <i class="material-symbols-outlined">apartment</i>{{ group.teamName }}
                      <span class="lsr-section-count">{{ group.skills.length }}</span>
                    </div>
                    <div class="lsr-section-list lsr-section-list--in-card">
                      <SkillTile
                        v-for="skill in group.skills"
                        :key="skill.id"
                        :skill="skill"
                        @click="detailFromLibrary = false; detailFromTemplateManage = true; detailSkillId = skill.id"
                        @test="handleTest"
                        @duplicate="handleDuplicate"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="skill-section-empty">找不到符合條件的技能</div>
          </div>
        </div>

        <!-- 我的技能 -->
        <div v-show="activeTab === 'my'" class="skill-tab-panel">
          <div class="my-skills-actions">
            <button class="custom-btn" @click="showLibraryModal = true">
              <i class="material-symbols-outlined">library_books</i>瀏覽 Library
            </button>
            <button class="custom-btn custom-main-btn" @click="showCreateChoice = true">
              <i class="material-symbols-outlined">add</i>建立技能
            </button>
          </div>
          <!-- AI 建議建立的技能：agent 完成任務後放進佇列，決策（建立／不用了）在這裡處理，
               不再是 AiViewer 對話河道裡的即時卡片，見 useSkillSuggestion。預設收合成一行
               摘要——展開後的完整清單才是喧賓奪主的來源，筆數不管多寡，收合狀態下這塊
               區域永遠只佔一行高度 -->
          <div v-if="store.pendingSuggestions.length" ref="suggestionQueueRef" class="skill-suggestion-queue">
            <button
              type="button"
              class="ssq-header ssq-summary-btn"
              :aria-expanded="suggestionsExpanded"
              @click="suggestionsExpanded = !suggestionsExpanded"
            >
              <i class="material-symbols-outlined">auto_awesome</i>
              <span class="ssq-title">{{ store.pendingSuggestions.length }} 個 AI 建議建立的技能</span>
              <i class="material-symbols-outlined ssq-caret">{{ suggestionsExpanded ? 'expand_less' : 'expand_more' }}</i>
            </button>
            <div v-if="suggestionsExpanded" class="ssq-list">
              <div v-for="s in store.pendingSuggestions" :key="s.id" class="ssq-item">
                <div class="ssq-item-body">
                  <div class="ssq-item-name">{{ s.name }}</div>
                  <div class="ssq-item-reason">來自「{{ s.reason }}」流程</div>
                </div>
                <div class="ssq-item-actions">
                  <button class="custom-btn" data-action="dismiss" @click="dismissSuggestion(s.id)">不用了</button>
                  <button class="custom-btn custom-main-btn" data-action="build" @click="buildSuggestion(s)">建立</button>
                </div>
              </div>
            </div>
          </div>

          <p v-if="backendSkills && backendStore.errorHint" class="my-skills-error">
            <i class="material-symbols-outlined">error</i>{{ backendStore.errorHint }}
          </p>
          <div v-if="displaySkills.length" class="my-skills-list">
            <PersonalSkillGroup
              v-for="skill in pagedSkills"
              :key="skill.id"
              :skill="skill"
              @manage="onManageSkill"
            />
            <!-- 分頁 -->
            <div v-if="totalPages > 1" class="my-skills-pagination">
              <button
                class="custom-btn pag-btn"
                :disabled="currentPage === 1"
                @click="currentPage--"
              >
                <i class="material-symbols-outlined">chevron_left</i>
              </button>
              <span class="pag-info">{{ currentPage }} / {{ totalPages }}</span>
              <button
                class="custom-btn pag-btn"
                :disabled="currentPage === totalPages"
                @click="currentPage++"
              >
                <i class="material-symbols-outlined">chevron_right</i>
              </button>
            </div>
          </div>
          <div v-else class="my-skills-empty">
            <i class="material-symbols-outlined">person_search</i>
            <span>透過對話生成技能，或手動建立 skill 檔案後，技能會出現在這裡</span>
          </div>
        </div>

      </div>
    </div>

    <!-- Library 瀏覽 Modal -->
    <LibraryBrowseModal
      v-model="showLibraryModal"
      @open-detail="(s) => { showLibraryModal = false; detailFromLibrary = true; detailFromTemplateManage = false; detailSkillId = s.id }"
      @test="handleTest"
      @duplicate="handleDuplicate"
    />

    <!-- Drawers -->
    <SkillDetailDrawer
      :skill="detailSkill"
      :upstream-version="upstreamVersionForDetail"
      @close="detailSkillId = null"
      @test="handleTest"
      :manageable="isManager && activeTab === 'review'"
      :library-view="detailFromLibrary"
      :condensed="detailFromTemplateManage"
      @toggle="handleToggle"
      @edit="handleEdit"
      @edit-version="openBackendModify"
      @delete="handlePersonalDelete"
      @duplicate="handleDuplicate"
      @submit="handlePersonalSubmit"
      @review="(skillId, versionId) => { detailSkillId = null; openReview(skillId, versionId) }"
      @open-upstream-update="openUpstreamUpdate"
    />

    <UpstreamUpdateDrawer
      :skill="upstreamSkill"
      :upstream-version="upstreamSkill ? (store.getUpstreamVersion(upstreamSkill.id) ?? '') : ''"
      @close="upstreamSkill = null"
      @merge="handleMerge"
      @ignore="(s) => { store.ignoreUpstreamUpdate(s.id); upstreamSkill = null }"
      @detach="handleDetach"
    />

    <SkillReviewDrawer
      v-model="showReviewDrawer"
      :skill-id="reviewingSkillId"
      @approved="showReviewDrawer = false"
      @rejected="showReviewDrawer = false"
    />

    <BatchUpdateModal
      v-model="showBatchUpdate"
      @merged="showBatchUpdate = false"
    />

    <SkillStudioDrawer
      ref="drawerRef"
      :open="drawerOpen"
      :query="drawerQuery"
      @close="closeDrawer"
    />

    <!-- 複製第一步：確認顯示名稱（確認後才真正建立副本，出現在「我的技能」列表） -->
    <Teleport to="body">
      <Transition name="confirm-fade">
        <div
          v-if="pendingDuplicateSource"
          class="drawer-confirm-overlay"
          @click.self="cancelPendingDuplicate"
        >
          <div class="drawer-confirm-dialog">
            <div class="confirm-icon confirm-icon--update">
              <i class="material-symbols-outlined">content_copy</i>
            </div>
            <h4>建立副本</h4>
            <div v-if="pendingDuplicateConflict" class="confirm-warning-banner">
              <i class="material-symbols-outlined">info</i>
              你已經有一份來自「{{ pendingDuplicateSource.name }}」的技能了，建議修改顯示名稱以便區分。
            </div>
            <label class="dsd-note-label pdd-name-label">顯示名稱</label>
            <input
              v-model="pendingDuplicateName"
              class="custom-input pdd-name-input"
              placeholder="輸入顯示名稱"
              @keydown.enter="confirmPendingDuplicate"
            />
            <div class="confirm-actions">
              <button
                class="custom-btn custom-main-btn"
                :disabled="!pendingDuplicateName.trim()"
                @click="confirmPendingDuplicate"
              >
                <i class="material-symbols-outlined">check_circle</i>確認
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 選擇建立方式：點「我的技能」頁的「建立技能」 -->
    <Teleport to="body">
      <Transition name="confirm-fade">
        <div
          v-if="showCreateChoice"
          class="drawer-confirm-overlay"
          @click.self="showCreateChoice = false"
        >
          <div class="drawer-confirm-dialog">
            <div class="confirm-icon confirm-icon--update">
              <i class="material-symbols-outlined">add_circle</i>
            </div>
            <h4>建立技能</h4>
            <p>要用哪種方式建立這顆技能？</p>
            <div class="confirm-actions confirm-actions--column">
              <button class="custom-btn custom-main-btn" @click="handleCreateWithChat">
                <i class="material-symbols-outlined">forum</i>用對話建立
              </button>
              <button class="custom-btn" @click="handleCreateWithBlocks">
                <i class="material-symbols-outlined">dashboard_customize</i>用行銷積木組裝
              </button>
              <button class="custom-btn" @click="handleCreateManually">
                <i class="material-symbols-outlined">edit</i>手動建立
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 選擇修改方式：複製完成後，或點個人技能的「編輯」 -->
    <Teleport to="body">
      <Transition name="confirm-fade">
        <div
          v-if="editChoiceSkill"
          class="drawer-confirm-overlay"
          @click.self="editChoiceSkill = null"
        >
          <div class="drawer-confirm-dialog">
            <div class="confirm-icon confirm-icon--update">
              <i class="material-symbols-outlined">content_copy</i>
            </div>
            <h4>{{ editChoiceIsFreshDuplicate ? '已建立複本' : '編輯技能' }}</h4>
            <div v-if="editChoiceSkill.personalStatus === 'draft'" class="confirm-warning-banner">
              <i class="material-symbols-outlined">info</i>
              這份複本內容目前與原技能完全相同。內容一模一樣的技能會讓後續維運難以區分，也可能造成 Agent 判斷失準，建議修改後再使用。
            </div>
            <p>
              {{ editChoiceIsFreshDuplicate ? '接下來想怎麼修改這份複本？' : `接下來想怎麼修改「${editChoiceSkill.name}」？` }}
            </p>
            <div class="confirm-actions confirm-actions--column">
              <!-- 用行銷積木組裝出來的技能沒有「直接編輯」路徑：SkillEditor 是純文字
                   三步驟精靈，不認得 composition，在那裡手改指令會讓文字跟已選章節
                   悄悄脫勾（下次在積木面板加/減章節，推導出的內容會整段蓋掉手改的
                   結果）。這類技能只給積木面板一個入口 -->
              <template v-if="editChoiceSkill.composition">
                <button class="custom-btn custom-main-btn" @click="handleChatEdit">
                  <i class="material-symbols-outlined">dashboard_customize</i>用積木面板編輯
                </button>
              </template>
              <template v-else>
                <button class="custom-btn" @click="handleChatEdit">
                  <i class="material-symbols-outlined">forum</i>跟 Agent 對話修改
                </button>
                <button class="custom-btn custom-main-btn" @click="handleDirectEdit">
                  <i class="material-symbols-outlined">edit</i>直接編輯
                </button>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <SkillEnableFlow ref="enableFlowRef" />

    <!-- 送審 dialog -->
    <Teleport to="body">
      <Transition name="confirm-fade">
        <div
          v-if="submitConfirmSkill"
          class="draft-submit-overlay"
          @click.self="submitConfirmSkill = null"
        >
          <div class="draft-submit-dialog">
            <div class="dsd-header">
              <span class="dsd-title">送審至 Library</span>
              <button class="drawer-close-btn" @click="submitConfirmSkill = null">
                <i class="material-symbols-outlined">close</i>
              </button>
            </div>

            <div class="dsd-info">
              <div class="dsd-info-row">
                <span class="dsd-info-label">技能名稱</span>
                <span class="dsd-info-val">{{ submitConfirmSkill.name }}</span>
              </div>
              <div class="dsd-info-row">
                <span class="dsd-info-label">來源</span>
                <span class="dsd-info-val">{{ submitConfirmSkill.derivedFrom ? '對話延伸' : '手寫建立' }}</span>
              </div>
              <div v-if="submitConfirmSkill.derivedFrom" class="dsd-info-row">
                <span class="dsd-info-label">來源技能</span>
                <span class="dsd-info-val">{{ getDerivedFromName(submitConfirmSkill.derivedFrom) }}</span>
              </div>
            </div>

            <div class="dsd-options">
              <button
                :class="['dsd-option', submitMode === 'version_update' && 'is-selected']"
                :disabled="!submitConfirmSkill.derivedFrom"
                @click="submitMode = 'version_update'"
              >
                <i class="material-symbols-outlined">update</i>
                <div class="dsd-option-body">
                  <div class="dsd-option-title">更新版本</div>
                  <div class="dsd-option-desc">
                    提交為原技能的新版本，審核通過後更新現有技能
                    <span v-if="!submitConfirmSkill.derivedFrom">（此技能無來源技能）</span>
                  </div>
                </div>
                <i v-if="submitMode === 'version_update'" class="material-symbols-outlined dsd-check">check_circle</i>
              </button>

              <button
                :class="['dsd-option', submitMode === 'new_skill' && 'is-selected']"
                @click="submitMode = 'new_skill'"
              >
                <i class="material-symbols-outlined">add_circle</i>
                <div class="dsd-option-body">
                  <div class="dsd-option-title">建立新技能</div>
                  <div class="dsd-option-desc">作為獨立技能加入 Library，不影響原有技能</div>
                </div>
                <i v-if="submitMode === 'new_skill'" class="material-symbols-outlined dsd-check">check_circle</i>
              </button>
            </div>

            <div class="dsd-scope">
              <label class="dsd-note-label">預計發布層級</label>
              <div class="dsd-scope-options">
                <button
                  :class="['dsd-scope-option', submitScope === 'enterprise' && 'is-selected']"
                  @click="submitScope = 'enterprise'"
                >
                  <i class="material-symbols-outlined">corporate_fare</i>企業技能
                </button>
                <button
                  :class="['dsd-scope-option', submitScope === 'team' && 'is-selected']"
                  :disabled="submitTeamLocked"
                  @click="!submitTeamLocked && (submitScope = 'team')"
                >
                  <i class="material-symbols-outlined">group</i>團隊技能
                </button>
              </div>
              <p v-if="submitTeamLocked" class="dsd-scope-hint">
                此技能已有團隊版本的 Library 版，本次只能送審企業層級
              </p>
              <div v-if="submitScope === 'team'" class="dsd-team">
                <label class="dsd-note-label">發布團隊</label>
                <select v-model="submitTeamName" class="dsd-team-select">
                  <option v-for="t in knownTeamNames" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
            </div>

            <div class="dsd-note">
              <label class="dsd-note-label">版本名稱</label>
              <div class="dsd-version-name-row">
                <input
                  v-model="submitVersionName"
                  class="custom-input"
                  maxlength="40"
                  placeholder="簡短描述這個版本，例如「VIP 退貨優惠更新」"
                  @keydown.enter="submitVersionName.trim() && confirmSubmitSkill()"
                />
                <button
                  type="button"
                  class="custom-btn dsd-ai-suggest-btn"
                  :disabled="suggestingVersionName"
                  title="AI 建議命名（會參考你填的說明，可自行修改）"
                  @click="suggestVersionNameNow"
                >
                  <i class="material-symbols-outlined">{{ suggestingVersionName ? 'progress_activity' : 'auto_awesome' }}</i>
                  AI 建議
                </button>
              </div>
            </div>

            <div class="dsd-note">
              <label class="dsd-note-label">說明（選填）</label>
              <textarea
                v-model="submitNote"
                class="dsd-note-input"
                rows="3"
                :placeholder="submitMode === 'version_update'
                  ? '說明此版本的改動重點...'
                  : '描述適用情境、與現有技能的差異...'"
              ></textarea>
            </div>

            <div class="dsd-footer">
              <button class="custom-btn" @click="submitConfirmSkill = null">取消</button>
              <button
                class="custom-btn custom-main-btn"
                :disabled="!submitVersionName.trim()"
                @click="confirmSubmitSkill"
              >
                <i class="material-symbols-outlined">send</i>送出審核
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import SkillTile from '@/components/Skill/SkillTile.vue'
import PersonalSkillGroup from '@/components/Skill/PersonalSkillGroup.vue'
import SkillReviewQueue from '@/components/Skill/SkillReviewQueue.vue'
import LibraryBrowseModal from '@/components/Skill/LibraryBrowseModal.vue'
import SkillDetailDrawer from '@/components/Skill/SkillDetailDrawer.vue'
import SkillReviewDrawer from '@/components/Skill/SkillReviewDrawer.vue'
import UpstreamUpdateDrawer from '@/components/Skill/UpstreamUpdateDrawer.vue'
import BatchUpdateModal from '@/components/Skill/BatchUpdateModal.vue'
import { useSkillStore } from '@/stores/skillStore'
import { useBackendSkillStore } from '@/stores/backendSkillStore'
import type { BackendSkillVersion } from '@/services/skillConversationApi'
import type { Skill, ConflictResolution, SkillSuggestionEntry } from '@/stores/skillStore'
import { suggestionToPrefill, suggestionOpeningMessage } from '@/composables/useSkillSuggestion'
import { setSkillHandoff } from '@/composables/useSkillHandoff'
import SkillStudioDrawer from '@/components/Skill/SkillStudioDrawer.vue'
import SkillEnableFlow from '@/components/Skill/SkillEnableFlow.vue'
import popDialog from '@/services/popDialog'

const router = useRouter()
const route = useRoute()
const drawerRef = ref<InstanceType<typeof SkillStudioDrawer> | null>(null)

// 抽屜開關與內容完全由這三個既有 query 參數決定，不新增額外旗標——
// 跟 SkillStudioWorkspace.applyQuery() 判斷式用的是同一組參數
const drawerOpen = computed(() => !!(route.query.skillId || route.query.method || route.query.from || route.query.backendSkillId))
const drawerQuery = computed(() => ({
  skillId: route.query.skillId,
  backendSkillId: route.query.backendSkillId,
  version: route.query.version,
  method: route.query.method,
  from: route.query.from,
  tab: route.query.tab,
  intent: route.query.intent,
}))

function closeDrawer() {
  router.push({ path: '/view/Skills' })
}

// 抽屜開著且有未儲存變更時，換編輯目標／關閉抽屜都要先確認——
// 邏輯跟 SkillStudio.vue（頁面殼）的 onBeforeRouteUpdate 一模一樣，只是搬到這裡，
// 因為抽屜開關本身就是同一個 /view/Skills 路由上的 query 變化
onBeforeRouteUpdate((to, _from, next) => {
  if (!drawerRef.value?.isDirty) {
    drawerRef.value?.applyQuery({ skillId: to.query.skillId, backendSkillId: to.query.backendSkillId, version: to.query.version, method: to.query.method, from: to.query.from, tab: to.query.tab, intent: to.query.intent })
    return next()
  }
  popDialog.confirm('有未儲存的變更，確定要放棄嗎？', '放棄變更', '留下', () => {
    drawerRef.value?.applyQuery({ skillId: to.query.skillId, backendSkillId: to.query.backendSkillId, version: to.query.version, method: to.query.method, from: to.query.from, tab: to.query.tab, intent: to.query.intent })
    next()
  }, () => next(false))
})

// 抽屜開著且有未儲存變更時，從左側導覽離開 /view/Skills 也要先確認
onBeforeRouteLeave((_to, _from, next) => {
  if (!drawerRef.value?.isDirty) return next()
  popDialog.confirm('有未儲存的變更，確定離開？', '離開', '留下', () => next(), () => next(false))
})

const store = useSkillStore()

const showCreateChoice = ref(false)
const detailSkillId = ref<string | null>(null)
// 從 Library 技能庫瀏覽 Modal 點進來的唯讀情境：詳情抽屜不顯示版本歷史／待審核區塊
const detailFromLibrary = ref(false)
// 從團隊技能範本管理點進來：詳情抽屜收合技能內容說明、不顯示技能層級附加檔案，
// 重點是切換版本（跟待審核佇列點進來看的是同一顆抽屜，但目的不同，故分開判斷）
const detailFromTemplateManage = ref(false)
const detailSkill = computed<Skill | null>(() => {
  if (!detailSkillId.value) return null
  return displaySkills.value.find(s => s.id === detailSkillId.value)
    ?? store.flatSkills.find(s => s.id === detailSkillId.value)
    ?? null
})
const showReviewDrawer = ref(false)
const reviewingSkillId = ref('')
const upstreamSkill = ref<Skill | null>(null)
const showBatchUpdate = ref(false)

const showLibraryModal = ref(false)
const editChoiceSkill = ref<Skill | null>(null)
const editChoiceIsFreshDuplicate = ref(false)
const enableFlowRef = ref<InstanceType<typeof SkillEnableFlow> | null>(null)

// 建立副本第一步：先確認顯示名稱，確認後才真正建立副本（此時才會出現在「我的技能」列表）
const pendingDuplicateSource = ref<Skill | null>(null)
const pendingDuplicateName = ref('')
const pendingDuplicateConflict = computed(() =>
  pendingDuplicateSource.value ? store.wouldSkillNameConflict(pendingDuplicateSource.value.id) : false
)

// 角色（mock：企業管理者可見審核區）
const currentUserRole = ref<'user' | 'enterprise_admin' | 'enterprise_owner'>('enterprise_admin')
const isManager = computed(() =>
  currentUserRole.value === 'enterprise_admin' || currentUserRole.value === 'enterprise_owner'
)

// Tab：從 side-menu 進入一律預設「我的技能」
const activeTab = ref<'my' | 'review'>('my')
// 管理區底下再分兩個子分頁：待審核送審／Library 現有技能管理，
// 兩塊內容都不小，不再直接上下堆疊成一個超長頁面
const reviewSubTab = ref<'pending' | 'library'>('pending')

// 分頁
const PAGE_SIZE = 10
const currentPage = ref(1)
// 後端模式（VITE_SKILL_AGENT_API=true）：卡片資料換成後端技能，版面不變
const backendSkills = import.meta.env.VITE_SKILL_AGENT_API === 'true'
const backendStore = useBackendSkillStore()

// 後端技能對到卡片用的 Skill：名稱、描述、最新版與測過記號；其餘卡片欄位沒有後端資料，用預設值
function toTileSkill(v: BackendSkillVersion): Skill {
  return {
    id: v.skill_id,
    name: v.display_name,
    description: v.description,
    type: 'extension',
    origin: 'manually_created',
    creationMethod: 'ai_assisted',
    version: `第 ${v.version} 版`,
    instructions: v.content,      // 後端的 content 對到前端的 instructions
    triggerHint: v.description,   // 後端的 description（何時用）對到 triggerHint
    isEnabled: backendStore.activatedIds.includes(v.skill_id),
    usageCount: 0,
    testPassRate: 0,
    avgLatencyMs: 0,
    zone: 'personal',
    backendVersion: { version: v.version, tested: v.tested },
  }
}
const displaySkills = computed<Skill[]>(() =>
  backendSkills ? backendStore.skills.map(toTileSkill) : store.myPersonalSkills
)

function onManageSkill(skill: Skill) {
  detailFromLibrary.value = false
  detailFromTemplateManage.value = false
  detailSkillId.value = skill.id
}

// 從後端某一版進修改：用那一版開修改對話（存回去是新版本）
function openBackendModify(skill: Skill, version: number) {
  detailSkillId.value = null
  router.push({ query: { backendSkillId: skill.id, version: String(version) } })
}

onMounted(() => {
  if (backendSkills) backendStore.loadSkills()
})

const pagedSkills = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return displaySkills.value.slice(start, start + PAGE_SIZE)
})
const totalPages = computed(() => Math.max(1, Math.ceil(displaySkills.value.length / PAGE_SIZE)))
watch(totalPages, (tp) => {
  if (currentPage.value > tp) currentPage.value = tp
})

// Library 現有技能管理（審核區內，限管理者）
const libraryManageQuery = ref('')
const filteredLibrarySkills = computed(() => {
  const q = libraryManageQuery.value.toLowerCase().trim()
  if (!q) return store.flatSkills
  return store.flatSkills.filter(s =>
    s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
  )
})
const filteredEnterpriseSkills = computed(() =>
  filteredLibrarySkills.value.filter(s => s.scope === 'enterprise')
)
const groupedTeamSkills = computed(() => {
  const teamSkills = filteredLibrarySkills.value.filter(s => s.scope === 'team')
  const map = new Map<string, Skill[]>()
  for (const s of teamSkills) {
    const key = s.teamName ?? '其他團隊'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  }
  return Array.from(map.entries()).map(([teamName, skills]) => ({ teamName, skills }))
})

const submitConfirmSkill = ref<Skill | null>(null)
const submitMode = ref<'new_skill' | 'version_update'>('new_skill')
const submitScope = ref<'enterprise' | 'team'>('enterprise')
// 若送審的版本已經是團隊 Library 版，團隊層級已經有了，只能往上送企業層級
const submitTeamLocked = ref(false)
const submitTeamName = ref('')
const submitNote = ref('')
const submitVersionName = ref('')
const suggestingVersionName = ref(false)

// 送審 dialog 的團隊選單：彙整目前 Library 團隊技能與其他個人技能已填寫過的團隊名稱
const knownTeamNames = computed(() => {
  const names = new Set<string>()
  store.flatSkills.forEach(s => { if (s.teamName) names.add(s.teamName) })
  store.myPersonalSkills.forEach(s => { if (s.targetTeamName) names.add(s.targetTeamName) })
  return Array.from(names)
})

const upstreamVersionForDetail = computed(() => {
  if (!detailSkill.value) return undefined
  return store.getUpstreamVersion(detailSkill.value.id)
})


function handleTest(skill: Skill) {
  // 後端技能：用最新版開對話並直接進測試 tab（題目、交卷都走後端）
  if (skill.backendVersion) {
    detailSkillId.value = null
    router.push({ query: { backendSkillId: skill.id, version: String(skill.backendVersion.version), tab: 'test' } })
    return
  }
  router.push({ path: '/view/SkillTest', query: { skillId: skill.id } })
}

function dismissSuggestion(id: string) {
  store.dismissSuggestion(id)
}

// 建議佇列預設收合成一行摘要，筆數再多也不會佔滿版面；點統計列的入口
// 或摘要列本身都會展開
const suggestionsExpanded = ref(false)

// 統計列的「N 個 AI 建議技能待處理」入口：確保停在「我的技能」分頁（佇列只在那裡渲染）、
// 展開摘要，再捲動到佇列本身——它在頁面下方，光切分頁不一定看得到
const suggestionQueueRef = ref<HTMLElement | null>(null)
async function scrollToSuggestions() {
  activeTab.value = 'my'
  suggestionsExpanded.value = true
  await nextTick()
  suggestionQueueRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 沿用方案三的交接機制（setSkillHandoff + ?from=），只是觸發點從對話河道
// 卡片改成這裡的「建立」按鈕
function buildSuggestion(s: SkillSuggestionEntry) {
  setSkillHandoff({
    prefill: suggestionToPrefill(s),
    openingMessage: suggestionOpeningMessage(s),
    origin: { conversationId: s.conversationId, reason: s.reason },
  })
  store.dismissSuggestion(s.id)
  router.push({ query: { from: s.conversationId } })
}

// 「建立技能」選擇框：對話／積木都開技能管理頁的抽屜（SkillStudioDrawer），差別在
// method query 直接指定建立方式，跳過工作區自己那層「選擇建立方式」
// 畫面（不然會被問兩次）；手動則走 SkillEditor 三步驟表單精靈。
// 三者都是空白建立，不帶 skillId
function handleCreateWithChat() {
  showCreateChoice.value = false
  router.push({ query: { method: 'chat' } })
}
function handleCreateWithBlocks() {
  showCreateChoice.value = false
  router.push({ query: { method: 'blocks' } })
}
function handleCreateManually() {
  showCreateChoice.value = false
  router.push('/view/SkillEditor')
}

function handleEdit(skill: Skill) {
  // 後端技能：編輯＝從最新版開修改對話
  if (skill.backendVersion) {
    openBackendModify(skill, skill.backendVersion.version)
    return
  }
  if (skill.zone !== 'personal') {
    router.push({ path: '/view/SkillEditor', query: { skillId: skill.id } })
    return
  }
  detailSkillId.value = null
  showLibraryModal.value = false
  // 用積木組裝出來的技能只有一種修改方式（積木面板），不需要先跳「選擇修改方式」
  // 彈窗讓使用者在只有一個選項的情況下還要多點一次
  if (skill.composition) {
    router.push({ query: { skillId: skill.id } })
    return
  }
  editChoiceSkill.value = skill
  editChoiceIsFreshDuplicate.value = false
}

function openReview(skillId: string, _versionId: string) {
  reviewingSkillId.value = skillId
  showReviewDrawer.value = true
}

function openUpstreamUpdate(skill: Skill) {
  detailSkillId.value = null
  upstreamSkill.value = skill
}

function handleMerge(skill: Skill, resolutions?: ConflictResolution[]) {
  store.mergeUpstreamUpdate(skill.id, resolutions)
  upstreamSkill.value = null
}

function handleDetach(skill: Skill) {
  store.detachFromUpstream(skill.id)
  upstreamSkill.value = null
}

function handleDuplicate(skill: Skill) {
  detailSkillId.value = null
  showLibraryModal.value = false
  pendingDuplicateSource.value = skill
  pendingDuplicateName.value = skill.name
}

function cancelPendingDuplicate() {
  pendingDuplicateSource.value = null
  pendingDuplicateName.value = ''
}

function confirmPendingDuplicate() {
  if (!pendingDuplicateSource.value) return
  const copy = store.duplicateAsPersonalSkill(pendingDuplicateSource.value.id, pendingDuplicateName.value)
  cancelPendingDuplicate()
  editChoiceSkill.value = copy
  editChoiceIsFreshDuplicate.value = true
}

function handleDirectEdit() {
  if (!editChoiceSkill.value) return
  router.push({ path: '/view/SkillEditor', query: { skillId: editChoiceSkill.value.id } })
  editChoiceSkill.value = null
}

// 對話修改開技能管理頁自己的抽屜（SkillStudioDrawer）進行：抽屜近全螢幕，
// 完整保留預覽與測試面板，不是被否決過的那種小型置中 modal
function handleChatEdit() {
  if (!editChoiceSkill.value) return
  const skillId = editChoiceSkill.value.id
  editChoiceSkill.value = null
  router.push({ query: { skillId } })
}

// ── 個人技能 handlers ──────────────────────────────

function handlePersonalSubmit(skill: Skill) {
  const teamAlreadyPublished = skill.personalStatus === 'has_library' && skill.targetScope === 'team'

  submitConfirmSkill.value = skill
  submitMode.value = skill.derivedFrom ? 'version_update' : 'new_skill'
  submitTeamLocked.value = teamAlreadyPublished
  submitScope.value = teamAlreadyPublished ? 'enterprise' : (skill.targetScope ?? 'enterprise')
  submitTeamName.value = skill.targetTeamName ?? knownTeamNames.value[0] ?? ''
  submitNote.value = ''
  submitVersionName.value = ''
  // 開啟 dialog 就先給一個 AI 建議草稿（此時說明通常還沒填，用泛用建議打底），
  // 使用者填完說明後可以再按「AI 建議」重新生成一次更貼近內容的名稱
  suggestVersionNameNow()
}

async function suggestVersionNameNow() {
  if (!submitConfirmSkill.value) return
  suggestingVersionName.value = true
  try {
    submitVersionName.value = await store.suggestVersionName(
      submitConfirmSkill.value.id,
      submitNote.value,
      submitMode.value
    )
  } finally {
    suggestingVersionName.value = false
  }
}

function confirmSubmitSkill() {
  if (!submitConfirmSkill.value || !submitVersionName.value.trim()) return
  store.submitPersonalSkill(
    submitConfirmSkill.value.id,
    submitMode.value,
    submitNote.value,
    submitVersionName.value.trim(),
    submitScope.value,
    submitScope.value === 'team' ? submitTeamName.value : undefined
  )
  submitConfirmSkill.value = null
  submitNote.value = ''
  submitVersionName.value = ''
}

function handlePersonalDelete(skill: Skill) {
  store.deletePersonalSkill(skill.id)
  if (detailSkillId.value === skill.id) detailSkillId.value = null
}

function handleApprove(skill: Skill) {
  store.approvePersonalSkill(skill.id)
}

function handleReject(skill: Skill, feedback: string) {
  store.rejectPersonalSkill(skill.id, feedback)
}

async function handleToggle(skill: Skill) {
  // 後端技能：啟用交給後端檢查「這一版測過沒有」，沒測過就把原因講給使用者聽；後端沒有停用
  if (skill.backendVersion) {
    const result = await backendStore.activate(skill.id)
    popDialog.toast(result.message)
    return
  }
  // 停用方向永遠允許，不用檢查、不用確認 Agent
  if (skill.isEnabled) {
    store.toggleSkill(skill.id)
    return
  }
  const outcome = await enableFlowRef.value!.requestEnable(skill, skill.assignedAgents ?? [])
  if (outcome.type === 'cancelled') return
  if (outcome.type === 'revise') {
    router.push({ query: { skillId: skill.id } })
    return
  }
  if (outcome.type === 'goToTest') {
    router.push({ query: { skillId: skill.id, tab: 'test' } })
    return
  }
  store.setAssignedAgents(skill.id, outcome.agents)
  store.toggleSkill(skill.id)
}

function getDerivedFromName(derivedFrom: string): string {
  return store.findSkill(derivedFrom)?.name ?? derivedFrom
}
</script>
