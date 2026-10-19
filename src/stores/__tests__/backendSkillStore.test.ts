import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBackendSkillStore } from '@/stores/backendSkillStore'
import * as api from '@/services/skillConversationApi'

vi.mock('@/services/skillConversationApi', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/skillConversationApi')>()),
  listBackendSkills: vi.fn(),
  listBackendSkillVersions: vi.fn(),
}))

const v = (skill_id: string, version: number, tested = false): api.BackendSkillVersion => ({
  skill_id, version, name: 'weekly', display_name: '週報', description: 'd', content: 'c', tested, created_at: '2026-10-19T00:00:00Z',
})

describe('backendSkillStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('loadSkills：清單用後端回傳的', async () => {
    vi.mocked(api.listBackendSkills).mockResolvedValue([v('s1', 2, true)])
    const store = useBackendSkillStore()
    await store.loadSkills()
    expect(store.skills).toEqual([v('s1', 2, true)])
    expect(store.errorHint).toBe('')
  })

  it('loadSkills 失敗：白話提示，不清掉舊清單', async () => {
    vi.mocked(api.listBackendSkills).mockResolvedValueOnce([v('s1', 1)])
    const store = useBackendSkillStore()
    await store.loadSkills()
    vi.mocked(api.listBackendSkills).mockRejectedValueOnce(Object.assign(new Error('x'), { isAxiosError: true }))
    await store.loadSkills()
    expect(store.errorHint).toContain('連不上技能後端')
    expect(store.skills).toHaveLength(1)
    expect(store.loading).toBe(false)
  })

  it('loadVersions：依技能存版本列表，含測過記號', async () => {
    vi.mocked(api.listBackendSkillVersions).mockResolvedValue([v('s1', 1, true), v('s1', 2, false)])
    const store = useBackendSkillStore()
    await store.loadVersions('s1')
    expect(store.versionsBySkill.s1.map(x => x.tested)).toEqual([true, false])
  })

  it('refreshAfterSave：清單與該技能版本都重讀', async () => {
    vi.mocked(api.listBackendSkills).mockResolvedValue([v('s1', 2)])
    vi.mocked(api.listBackendSkillVersions).mockResolvedValue([v('s1', 1), v('s1', 2)])
    const store = useBackendSkillStore()
    await store.refreshAfterSave('s1')
    expect(store.skills[0].version).toBe(2)
    expect(store.versionsBySkill.s1).toHaveLength(2)
  })
})
