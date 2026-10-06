<template>
  <div class="SkillTest views-page">
    <div class="views-page-content-box">

      <div class="page-banner">
        <div>
          <AppBreadcrumb />
          <div class="banner-title">技能測試沙盒</div>
        </div>
      </div>

      <div class="skill-test-layout">

        <!-- 左側：技能選擇 -->
        <div class="test-sidebar">
          <div class="sidebar-head">測試的技能</div>
          <div class="sidebar-list lively-stagger">

            <template v-if="personalSkills.length">
              <div class="section-badge-row">
                <span class="section-badge section-badge--mine">我的技能</span>
              </div>
              <div
                v-for="skill in personalSkills"
                :key="skill.id"
                :class="['sidebar-item', { 'is-active': store.selectedSkillId === skill.id }]"
                @click="store.setSelectedSkill(skill.id)"
              >
                <span class="si-name">{{ skill.name }}</span>
                <SkillVersionPicker
                  :versions="store.getVersionOptions(skill.id)"
                  :model-value="displayVersionName(skill)"
                  @update:model-value="v => store.setSelectedSkill(skill.id, v)"
                />
              </div>
            </template>

            <template v-if="librarySubgroups.some(g => g.skills.length)">
              <div class="section-badge-row">
                <span class="section-badge section-badge--library">Library 技能</span>
              </div>

              <template v-for="group in librarySubgroups" :key="group.key">
                <template v-if="group.skills.length">
                  <div :class="['subgroup-label', `subgroup-label--${group.key}`]">{{ group.label }}</div>
                  <div
                    v-for="skill in group.skills"
                    :key="skill.id"
                    :class="['sidebar-item', { 'is-active': store.selectedSkillId === skill.id }]"
                    @click="store.setSelectedSkill(skill.id)"
                  >
                    <span :class="['skill-dot', `dot--${group.key}`]"></span>
                    <span class="si-name">{{ skill.name }}</span>
                    <span v-if="skill.scope === 'system'" class="version-inline">{{ displayVersionName(skill) }}</span>
                    <SkillVersionPicker
                      v-else
                      :versions="store.getVersionOptions(skill.id)"
                      :model-value="displayVersionName(skill)"
                      @update:model-value="v => store.setSelectedSkill(skill.id, v)"
                    />
                  </div>
                </template>
              </template>
            </template>

          </div>
        </div>

        <!-- 右側：測試面板 -->
        <div class="test-panel">
          <template v-if="selectedSkill">
            <div class="test-panel-head">
              <div class="panel-title">
                {{ selectedSkill.name }}
                <span class="skill-tag tag--version">{{ displayVersionName(selectedSkill) }}</span>
              </div>
              <div class="test-panel-head-actions">
                <button
                  v-if="selectedSkill.zone === 'personal'"
                  class="custom-btn ask-studio-btn"
                  @click="askAboutSkill(selectedSkill.id)"
                >
                  <i class="material-symbols-outlined">auto_awesome</i>詢問技能助理
                </button>
                <button class="custom-btn info-toggle-btn" @click="isContextOpen = true">
                  <i class="material-symbols-outlined">info</i>技能資訊
                </button>
              </div>
            </div>

            <!-- 積木組裝的技能：對話模擬在這裡沒有意義（見 SkillTestChat 的既有行為），
                 改用跟 SkillStudio 工作區一致的是非題 AI 快速測試 -->
            <SkillTestAI v-if="selectedSkill.composition" :skill-id="selectedSkill.id" />
            <SkillTestChat v-else :skill-id="selectedSkill.id" />
          </template>

          <div v-else class="panel-empty">
            <i class="material-symbols-outlined">science</i>
            <p>請從左側選擇要測試的技能</p>
          </div>
        </div>

      </div>

    </div>

    <!-- 技能資訊抽屜：點「技能資訊」才彈出，平常不佔畫面欄位 -->
    <Teleport to="body">
      <Transition name="st-drawer-fade">
        <div v-if="isContextOpen && selectedSkill" class="st-context-drawer">
          <div class="st-drawer-mask" @click="isContextOpen = false" />
          <div class="st-drawer-panel">
            <div class="st-drawer-head">
              <h3>{{ selectedSkill.name }} · 技能資訊</h3>
              <button class="st-drawer-close-btn" @click="isContextOpen = false">
                <i class="material-symbols-outlined">close</i>
              </button>
            </div>
            <div class="st-drawer-body">
              <div v-if="selectedSkill.instructions" class="context-card">
                <div class="context-card-title">技能指令</div>
                <p class="context-instructions">{{ selectedSkill.instructions }}</p>
              </div>

              <div v-if="selectedSkill.triggerHint" class="context-card">
                <div class="context-card-title">觸發時機</div>
                <p class="context-instructions">{{ selectedSkill.triggerHint }}</p>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import SkillTestChat from '@/components/Skill/SkillTestChat.vue'
import SkillTestAI from '@/components/Skill/SkillTestAI.vue'
import SkillVersionPicker from '@/components/Skill/SkillVersionPicker.vue'
import { useSkillStore } from '@/stores/skillStore'
import type { Skill } from '@/stores/skillStore'

const route = useRoute()
const router = useRouter()
const store = useSkillStore()
const isContextOpen = ref(false)

const selectedSkill = computed(() =>
  store.selectedSkillId ? store.findSkill(store.selectedSkillId) ?? null : null
)

const personalSkills = computed(() => store.myPersonalSkills)
const enabledLibrarySkills = computed(() => store.flatSkills.filter(s => s.isEnabled))

const librarySubgroups = computed(() => [
  { key: 'system', label: '系統技能', skills: enabledLibrarySkills.value.filter(s => s.scope === 'system') },
  { key: 'enterprise', label: '企業擴充', skills: enabledLibrarySkills.value.filter(s => s.scope === 'enterprise') },
  { key: 'team', label: '團隊擴充', skills: enabledLibrarySkills.value.filter(s => s.scope === 'team') },
])

// 帶著 intent=ask 開技能管理頁的抽屜——一樣是編輯模式（loadSkill），只是開場白
// 換一句不預設「要改」的問句，見 useSkillStudioConversation.ts 的 loadSkill(id, 'ask')
function askAboutSkill(skillId: string) {
  router.push({ path: '/view/Skills', query: { skillId, intent: 'ask' } })
}

function displayVersionName(skill: Skill): string {
  if (store.selectedSkillId === skill.id && store.selectedVersionName) {
    return store.selectedVersionName
  }
  return store.getDefaultVersionName(skill.id) ?? ''
}

onMounted(() => {
  const skillId = route.query.skillId as string | undefined
  if (skillId && store.findSkill(skillId)) {
    store.setSelectedSkill(skillId)
  } else if (personalSkills.value.length) {
    store.setSelectedSkill(personalSkills.value[0].id)
  } else if (enabledLibrarySkills.value.length) {
    store.setSelectedSkill(enabledLibrarySkills.value[0].id)
  }
})
</script>
