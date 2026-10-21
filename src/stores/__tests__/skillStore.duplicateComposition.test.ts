import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSkillStore } from '@/stores/skillStore'

// duplicateAsPersonalSkill 複製一顆用行銷積木組裝的技能時，composition 要一併帶過去
// （深拷貝），否則複本重開時會被 draftFromSkill() 誤判成對話建立的技能。
describe('duplicateAsPersonalSkill 保留 composition', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('來源有 composition：複本也有，且是深拷貝（改複本不影響來源）', () => {
    const store = useSkillStore()
    const sourceId = store.createPersonalSkill({
      name: '渠道週報',
      instructions: '依序產出以下章節：\n1. 渠道核心 KPI：各渠道工作階段數、轉換率、收益、每工作階段收益。',
      description: 't',
      isEnabled: true,
      assignedAgents: [],
      composition: { sectionIds: ['ch_kpi', 'ch_traffic'] },
      creationMethod: 'manual',
    })
    const copy = store.duplicateAsPersonalSkill(sourceId)
    expect(copy.composition).toEqual({ sectionIds: ['ch_kpi', 'ch_traffic'] })

    copy.composition!.sectionIds.push('promo_kpi')
    expect(store.findSkill(sourceId)!.composition!.sectionIds).toEqual(['ch_kpi', 'ch_traffic'])
  })

  it('來源沒有 composition（對話建立）：複本也沒有', () => {
    const store = useSkillStore()
    const sourceId = store.createPersonalSkill({
      name: '查 ERP 庫存',
      instructions: '1. 查詢庫存',
      description: 't',
      isEnabled: true,
      assignedAgents: [],
    })
    const copy = store.duplicateAsPersonalSkill(sourceId)
    expect(copy.composition).toBeUndefined()
  })
})
