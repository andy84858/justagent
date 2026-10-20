import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  activateBackendSkill,
  describeConversationError,
  listBackendSkills,
  listBackendSkillVersions,
} from '@/services/skillConversationApi'
import type { BackendSkillVersion } from '@/services/skillConversationApi'

// 後端技能（skill_creator_poc_5）的清單與版本。跟 skillStore 的假資料各管各的：
// 只有 VITE_SKILL_AGENT_API=true 時才會用到，資料全以後端為準，前端不自己改

export const useBackendSkillStore = defineStore('backendSkills', () => {
  const skills = ref<BackendSkillVersion[]>([])                       // 每個技能的最新版
  const versionsBySkill = ref<Record<string, BackendSkillVersion[]>>({})
  const loading = ref(false)
  // 啟用中的技能代號。後端的啟用只做「測過」檢查、不記啟用狀態，所以這裡只在這次開啟期間有效
  const activatedIds = ref<string[]>([])
  const errorHint = ref('')                                           // 最近一次讀取失敗的白話提示

  async function loadSkills(): Promise<void> {
    loading.value = true
    try {
      skills.value = await listBackendSkills()
      errorHint.value = ''
    } catch (error) {
      errorHint.value = describeConversationError(error)
    } finally {
      loading.value = false
    }
  }

  async function loadVersions(skillId: string): Promise<void> {
    try {
      versionsBySkill.value = { ...versionsBySkill.value, [skillId]: await listBackendSkillVersions(skillId) }
      errorHint.value = ''
    } catch (error) {
      errorHint.value = describeConversationError(error)
    }
  }

  // 存完一版：清單和該技能的版本列表都重讀，畫面才看得到新版本
  async function refreshAfterSave(skillId: string): Promise<void> {
    await Promise.all([loadSkills(), loadVersions(skillId)])
  }

  // 啟用：交給後端檢查最新一版測過沒有（不要求全對）；沒測過就把後端的白話原因帶回給畫面
  async function activate(skillId: string): Promise<{ ok: boolean; message: string }> {
    try {
      const done = await activateBackendSkill(skillId)
      if (!activatedIds.value.includes(skillId)) activatedIds.value = [...activatedIds.value, skillId]
      return { ok: true, message: `已啟用（第 ${done.version} 版）` }
    } catch (error) {
      return { ok: false, message: describeConversationError(error) }
    }
  }

  return { skills, versionsBySkill, loading, errorHint, activatedIds, loadSkills, loadVersions, refreshAfterSave, activate }
})
