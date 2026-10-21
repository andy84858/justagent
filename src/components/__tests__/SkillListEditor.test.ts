import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SkillListEditor from '@/components/Skill/SkillListEditor.vue'

describe('SkillListEditor', () => {
  it('有序清單顯示編號、無序顯示圓點', () => {
    const ordered = mount(SkillListEditor, { props: { modelValue: ['a', 'b'], itemLabel: '步驟', ordered: true } })
    expect(ordered.findAll('.sle-marker').map(m => m.text())).toEqual(['1.', '2.'])
    const bullets = mount(SkillListEditor, { props: { modelValue: ['a'], itemLabel: '例外' } })
    expect(bullets.find('.sle-marker').text()).toBe('•')
  })

  it('輸入、刪除、新增都 emit 整份新清單', async () => {
    const w = mount(SkillListEditor, { props: { modelValue: ['a', 'b'], itemLabel: '步驟' } })
    await w.findAll('.sle-input')[1].setValue('改過')
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([['a', '改過']])
    await w.findAll('.sle-remove')[0].trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([['b']])
    await w.find('.sle-add').trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([['a', 'b', '']])
    expect(w.find('.sle-add').text()).toContain('新增步驟')
  })

  it('在第 i 列按 Enter：在它後面插入一列空白', async () => {
    const w = mount(SkillListEditor, { props: { modelValue: ['a', 'b'], itemLabel: '步驟' } })
    await w.findAll('.sle-input')[0].trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([['a', '', 'b']])
  })
})
