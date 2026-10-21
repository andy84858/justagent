import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SkillVersionCompareModal from '@/components/Skill/SkillVersionCompareModal.vue'

// 審核中的版本 v-cs-return-1.1 比目前生效的 1.0 多了三項例外：比較視窗要逐項標出新增
describe('SkillVersionCompareModal：RD 欄位比對', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('例外逐項標新增；步驟相同不標', () => {
    const w = mount(SkillVersionCompareModal, {
      props: { modelValue: true, skillId: 'ext-cs-return-001', v1Id: 'v-cs-return-1.0', v2Id: 'v-cs-return-1.1' },
      global: { stubs: { Teleport: true, Transition: false } },
    })
    const added = w.findAll('.svc-item--added').map(li => li.text())
    expect(added).toEqual([
      '超過退貨期限但有正當理由時，提供「主管特批申請」流程',
      '商品瑕疵不受期限限制，隨時可申請',
      'VIP 客戶享有 45 天退貨優惠期',
    ])
    expect(w.findAll('.svc-item--removed')).toHaveLength(0)
    expect(w.text()).toContain('步驟')
    expect(w.text()).toContain('適用範圍')
  })
})
