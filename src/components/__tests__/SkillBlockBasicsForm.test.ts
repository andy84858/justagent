import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SkillBlockBasicsForm from '../Skill/SkillBlockBasicsForm.vue'
import popDialog from '@/services/popDialog'

vi.mock('@/services/popDialog', () => ({
  default: { toast: vi.fn(), confirm: vi.fn(), alert: vi.fn() },
}))

function mountForm(over: Partial<Record<string, unknown>> = {}) {
  return mount(SkillBlockBasicsForm, {
    props: {
      name: '',
      description: '',
      keywords: ['預設關鍵字'],
      capabilities: [],
      assignedAgents: [],
      sectionIds: ['promo_kpi'],
      exceptions: [],
      outputFormat: '',
      applicableScope: '',
      ...over,
    },
  })
}

describe('SkillBlockBasicsForm', () => {
  it('沒有選任何章節：「AI 建議」按鈕反灰，按下也不會跳出候選', async () => {
    const wrapper = mountForm({ sectionIds: [] })
    const aiBtns = wrapper.findAll('.sbbf-ai-btn')
    expect(aiBtns[0].attributes('disabled')).toBeDefined()
    await aiBtns[0].trigger('click')
    expect(wrapper.find('.sbbf-suggestions').exists()).toBe(false)
  })

  it('說明「AI 建議」：生成 3 句不同候選；點其中一句直接套用並關閉候選清單，不跳確認對話框', async () => {
    const wrapper = mountForm()
    const aiBtns = wrapper.findAll('.sbbf-ai-btn')
    await aiBtns[0].trigger('click') // 說明
    const chips = wrapper.findAll('.sbbf-suggestion-chip')
    expect(chips).toHaveLength(3)
    const texts = chips.map(c => c.text())
    expect(new Set(texts).size).toBe(3)

    await chips[1].trigger('click')
    expect(wrapper.emitted('update:description')![0]).toEqual([texts[1]])
    expect(wrapper.find('.sbbf-suggestions').exists()).toBe(false)
  })

  it('說明欄位已有內容：按「AI 建議」一樣直接開三選一，不是跳覆蓋確認框', async () => {
    const wrapper = mountForm({ description: '已經寫好的說明' })
    await wrapper.findAll('.sbbf-ai-btn')[0].trigger('click')
    expect(wrapper.findAll('.sbbf-suggestion-chip')).toHaveLength(3)
  })

  it('觸發情境欄位已併進說明：表單只剩說明一個文字欄位', () => {
    const wrapper = mountForm()
    expect(wrapper.text()).not.toContain('觸發情境')
    expect(wrapper.findAll('.sbbf-textarea')).toHaveLength(1)
    expect(wrapper.findAll('.sbbf-ai-btn')).toHaveLength(2) // 說明／覆蓋能力
  })

  it('點候選清單的關閉鍵：清單收起，不套用任何內容', async () => {
    const wrapper = mountForm()
    await wrapper.findAll('.sbbf-ai-btn')[0].trigger('click')
    expect(wrapper.find('.sbbf-suggestions').exists()).toBe(true)
    await wrapper.find('.sbbf-suggestions-close').trigger('click')
    expect(wrapper.find('.sbbf-suggestions').exists()).toBe(false)
    expect(wrapper.emitted('update:description')).toBeUndefined()
  })

  it('章節選擇變動：先前開著的候選清單清空，不留著舊章節算出的建議', async () => {
    const wrapper = mountForm()
    await wrapper.findAll('.sbbf-ai-btn')[0].trigger('click')
    expect(wrapper.find('.sbbf-suggestions').exists()).toBe(true)
    await wrapper.setProps({ sectionIds: ['ch_kpi'] })
    expect(wrapper.find('.sbbf-suggestions').exists()).toBe(false)
  })

  it('關鍵字欄位：渲染 SkillKeywordsEditor，輸入並按 Enter 會 emit update:keywords', async () => {
    const wrapper = mountForm({ keywords: ['既有關鍵字'] })
    expect(wrapper.text()).toContain('#既有關鍵字')
    const input = wrapper.find('.sce-tag-input')
    await input.setValue('新關鍵字')
    await input.trigger('keydown.enter')
    expect(wrapper.emitted('update:keywords')![0]).toEqual([['既有關鍵字', '新關鍵字']])
  })

  it('覆蓋能力「AI 建議」維持原本單一建議行為：欄位是空的直接套用，不開三選一', async () => {
    const wrapper = mountForm()
    await wrapper.findAll('.sbbf-ai-btn')[1].trigger('click') // 覆蓋能力
    expect(wrapper.emitted('update:capabilities')).toBeTruthy()
    expect(wrapper.find('.sbbf-suggestions').exists()).toBe(false)
  })

  it('已選章節但還沒填關鍵字：按任一個「AI 建議」跳提示，不產生候選也不套用', async () => {
    const wrapper = mountForm({ keywords: [] })
    const aiBtns = wrapper.findAll('.sbbf-ai-btn')

    await aiBtns[0].trigger('click') // 說明
    expect(popDialog.toast).toHaveBeenCalledWith('請先填寫關鍵字，才能產生 AI 建議')
    expect(wrapper.find('.sbbf-suggestions').exists()).toBe(false)

    await aiBtns[1].trigger('click') // 覆蓋能力
    expect(wrapper.emitted('update:capabilities')).toBeFalsy()

    expect(popDialog.toast).toHaveBeenCalledTimes(2)
  })
})
