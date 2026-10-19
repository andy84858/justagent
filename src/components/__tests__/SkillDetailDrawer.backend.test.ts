import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SkillDetailDrawer from '@/components/Skill/SkillDetailDrawer.vue'
import type { Skill } from '@/stores/skillStore'
import * as api from '@/services/skillConversationApi'

vi.mock('@/services/skillConversationApi', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/skillConversationApi')>()),
  listBackendSkillVersions: vi.fn(),
}))

const backendSkill: Skill = {
  id: 's1', name: '週報整理', description: '每週五整理', instructions: '# 步驟', type: 'extension', origin: 'manually_created',
  version: '第 2 版', isEnabled: false, usageCount: 0, testPassRate: 0, avgLatencyMs: 0, zone: 'personal',
  backendVersion: { version: 2, tested: false },
}

function mountDrawer(skill: Skill) {
  return mount(SkillDetailDrawer, { props: { skill }, global: { stubs: { Teleport: true } } })
}

describe('SkillDetailDrawer：後端技能', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    vi.mocked(api.listBackendSkillVersions).mockResolvedValue([])
  })

  it('用原本的詳情抽屜：顯示技能定義與最新版測過與否', async () => {
    const w = mountDrawer(backendSkill)
    await flushPromises()
    expect(w.find('.dh-name').text()).toBe('週報整理')
    expect(w.find('.dh-status').text()).toContain('第 2 版 · 沒測過')
    expect(w.find('.markdown-body').text()).toContain('步驟')
  })

  it('還沒接後端的操作不顯示：測試、複製、送審、啟用、刪除', async () => {
    const w = mountDrawer(backendSkill)
    await flushPromises()
    const text = w.text()
    for (const label of ['測試', '複製', '送審', '啟用技能', '刪除此技能']) {
      expect(text).not.toContain(label)
    }
    expect(text).toContain('編輯')
  })

  it('版本歷史來自後端，從某一版修改會發出事件', async () => {
    vi.mocked(api.listBackendSkillVersions).mockResolvedValue([
      { skill_id: 's1', version: 1, name: 'w', display_name: '週報整理', description: 'd', content: 'c', tested: true, created_at: '2026-10-19T00:00:00Z' },
    ])
    const w = mountDrawer(backendSkill)
    await flushPromises()
    await w.find('.vt-item button').trigger('click')
    expect(w.emitted('editVersion')![0]).toEqual([backendSkill, 1])
  })
})
