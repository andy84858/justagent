import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SkillStudioChat from '@/components/Skill/SkillStudioChat.vue'
import type { StudioMessage, StudioSuggestion } from '@/composables/useSkillStudioConversation'

const chips: StudioSuggestion[] = [
  { icon: 'inventory_2', label: '查庫存', prefill: '幫我建立一個能查庫存的技能' },
]

function mountChat(over: Partial<Record<string, unknown>> = {}) {
  return mount(SkillStudioChat, {
    props: {
      mode: 'create',
      skillName: '',
      savedSkillId: null,
      messages: [{ id: 'm1', role: 'agent', content: '你好' }] as StudioMessage[],
      isRunning: false,
      suggestionChips: chips,
      personalSkills: [
        { id: 'p1', name: '週報' } as any,
        { id: 'p2', name: '會議摘要' } as any,
      ],
      ...over,
    },
  })
}

describe('SkillStudioChat', () => {
  it('建立模式顯示「建立新技能」chip；修改模式顯示「修改：{name}」', () => {
    expect(mountChat().find('.ssc-mode-chip').text()).toContain('建立新技能')
    expect(mountChat({ mode: 'edit', skillName: '週報' }).find('.ssc-mode-chip').text()).toContain('修改：週報')
  })

  it('只有 Agent 開場訊息時顯示建議 chip；點擊帶入輸入框而不送出', async () => {
    const w = mountChat()
    const chip = w.find('.ssc-chip')
    expect(chip.exists()).toBe(true)
    await chip.trigger('click')
    expect((w.find('input.custom-input').element as HTMLInputElement).value).toBe('幫我建立一個能查庫存的技能')
    expect(w.emitted('send')).toBeUndefined()
  })

  it('有使用者訊息後不再顯示建議 chip', () => {
    const w = mountChat({
      messages: [
        { id: 'm1', role: 'agent', content: '你好' },
        { id: 'm2', role: 'user', content: '嗨' },
      ] as StudioMessage[],
    })
    expect(w.find('.ssc-chip').exists()).toBe(false)
  })

  it('開場白之後又被動推進第二則 agent 訊息（例如測試生成中的敘事文字）時，也不再顯示建議 chip', () => {
    const w = mountChat({
      messages: [
        { id: 'm1', role: 'agent', content: '你好，我們來調整這顆技能。' },
        { id: 'm2', role: 'agent', content: '目前還沒有指派 Agent，先用技能本身的內容出題。' },
      ] as StudioMessage[],
    })
    expect(w.find('.ssc-chip').exists()).toBe(false)
  })

  it('輸入後按 Enter 或送出鈕會 emit send 並清空輸入框', async () => {
    const w = mountChat()
    const input = w.find('input.custom-input')
    await input.setValue('  幫我做一個技能  ')
    await input.trigger('keydown.enter')
    expect(w.emitted('send')?.[0]).toEqual(['幫我做一個技能'])
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('Agent 訊息帶 actions 時渲染動作 chip，點擊 emit send(label)', async () => {
    const w = mountChat({
      messages: [{ id: 'm1', role: 'agent', content: '擬好了', actions: [{ id: 'confirm', label: '看起來沒問題，儲存' }] }] as StudioMessage[],
    })
    const btn = w.find('.ssc-action-chip')
    expect(btn.text()).toBe('看起來沒問題，儲存')
    await btn.trigger('click')
    expect(w.emitted('send')?.[0]).toEqual(['看起來沒問題，儲存'])
  })

  it('isRunning 時顯示 typing 氣泡且輸入框 disabled', () => {
    const w = mountChat({ isRunning: true })
    expect(w.find('.bubble-typing').exists()).toBe(true)
    expect(w.find('input.custom-input').attributes('disabled')).toBeDefined()
  })

  it('切換技能下拉列出個人技能；選擇後 emit switch-skill；「建立新技能」按鈕 emit new-skill', async () => {
    const w = mountChat()
    const options = w.findAll('.ssc-skill-select option')
    expect(options.map(o => o.text())).toEqual(['切換技能', '週報', '會議摘要'])
    await w.find('.ssc-skill-select').setValue('p2')
    expect(w.emitted('switch-skill')?.[0]).toEqual(['p2'])
    await w.find('.ssc-new-btn').trigger('click')
    expect(w.emitted('new-skill')).toHaveLength(1)
  })

  it('compact：隱藏切換技能與建立新技能，根元素帶 is-compact；預設不隱藏', () => {
    const normal = mountChat()
    expect(normal.find('.ssc-head-actions').exists()).toBe(true)
    expect(normal.classes()).not.toContain('is-compact')
    const w = mountChat({ compact: true })
    expect(w.find('.ssc-head-actions').exists()).toBe(false)
    expect(w.find('.ssc-mode-chip').exists()).toBe(true)
    expect(w.classes()).toContain('is-compact')
  })
})
