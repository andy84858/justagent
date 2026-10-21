import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SkillEditor from '../SkillEditor.vue'

describe('SkillEditor 第 2 步版面', () => {
  it('技能內文在 se-primary-section，說明欄位與所需檔案區塊已移除', async () => {
    setActivePinia(createPinia())
    const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', component: { template: '<div/>' } }] })
    const wrapper = mount(SkillEditor, {
      global: { plugins: [router], stubs: { AppBreadcrumb: true } },
    })
    // 填寫技能名稱以解鎖下一步，切到第 2 步
    await wrapper.find('input.custom-input').setValue('測試技能')
    const nextBtn = wrapper.findAll('button').find(b => b.text().includes('下一步'))
    await nextBtn!.trigger('click')

    const primary = wrapper.find('.se-primary-section')
    expect(primary.exists()).toBe(true)
    expect(primary.text()).toContain('技能內文')

    expect(wrapper.find('.se-secondary-section').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('說明')
    // 說明不再是必填：送出前的缺漏清單不應該再要求說明
    expect((wrapper.vm as any).missingRequiredFields).not.toContain('說明')
    expect(wrapper.find('.se-secondary-row').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('所需檔案')
    expect(wrapper.find('.SkillFileUpload').exists()).toBe(false)
  })
})
