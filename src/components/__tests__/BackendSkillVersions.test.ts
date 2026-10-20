import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BackendSkillVersions from '@/components/Skill/BackendSkillVersions.vue'
import * as api from '@/services/skillConversationApi'

vi.mock('@/services/skillConversationApi', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/skillConversationApi')>()),
  listBackendSkillVersions: vi.fn(),
}))

const v = (version: number, tested: boolean): api.BackendSkillVersion => ({
  skill_id: 's1', version, name: 'weekly', display_name: '週報整理', description: 'd', content: 'c', tested, created_at: '2026-10-19T00:00:00Z',
})

describe('BackendSkillVersions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('列出每個版本的測過與否，並能從指定版本修改', async () => {
    vi.mocked(api.listBackendSkillVersions).mockResolvedValue([v(1, true), v(2, false)])
    const w = mount(BackendSkillVersions, { props: { skillId: 's1' } })
    await flushPromises()
    // 新的在上面，跟版本歷史一樣
    const rows = w.findAll('.vt-item')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('第 2 版')
    expect(rows[0].text()).toContain('沒測過')
    expect(rows[1].text()).toContain('第 1 版')
    expect(rows[1].text()).toContain('測過')
    await rows[1].find('button').trigger('click')
    expect(w.emitted('modify')![0]).toEqual([1])
  })

  it('後端連不上：白話提示', async () => {
    vi.mocked(api.listBackendSkillVersions).mockRejectedValue(Object.assign(new Error('x'), { isAxiosError: true }))
    const w = mount(BackendSkillVersions, { props: { skillId: 's1' } })
    await flushPromises()
    expect(w.text()).toContain('連不上技能後端')
  })
})
