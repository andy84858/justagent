import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSkillStore } from '@/stores/skillStore'

describe('skillStore.setAssignedAgents', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('整份取代 assignedAgents，不是新增', () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '測試技能', instructions: 'x', description: 'y', assignedAgents: ['通用助理'] })
    store.setAssignedAgents(id, ['客服中心助理', '電商小幫手'])
    expect(store.findSkill(id)!.assignedAgents).toEqual(['客服中心助理', '電商小幫手'])
  })

  it('傳空陣列會清空既有指派', () => {
    const store = useSkillStore()
    const id = store.createPersonalSkill({ name: '測試技能2', instructions: 'x', description: 'y', assignedAgents: ['通用助理'] })
    store.setAssignedAgents(id, [])
    expect(store.findSkill(id)!.assignedAgents).toEqual([])
  })

  it('技能不存在時安靜地什麼都不做，不拋錯', () => {
    const store = useSkillStore()
    expect(() => store.setAssignedAgents('nope-999', ['通用助理'])).not.toThrow()
  })
})
