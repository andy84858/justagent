import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSkillStore } from '@/stores/skillStore'

describe('skillStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('版本管理', () => {
    it('getSkillVersions 返回指定技能的版本列表', () => {
      const store = useSkillStore()
      const versions = store.getSkillVersions('ext-cs-return-001')
      expect(versions.length).toBeGreaterThan(0)
    })

    it('approveSkillVersion 將版本設為 approved（待啟用），不會自動變成 active', () => {
      const store = useSkillStore()
      const reviewing = store.getSkillVersions('ext-cs-return-001').find(v => v.status === 'reviewing')
      expect(reviewing).toBeDefined()
      const otherStatusesBefore = store.getSkillVersions('ext-cs-return-001')
        .filter(v => v.id !== reviewing!.id)
        .map(v => v.status)
      const activeCountBefore = otherStatusesBefore.filter(s => s === 'active').length

      store.approveSkillVersion('ext-cs-return-001', reviewing!.id)

      const versions = store.getSkillVersions('ext-cs-return-001')
      expect(versions.find(v => v.id === reviewing!.id)!.status).toBe('approved')
      // 核准新版號不會多出一個 active，也不會把既有生效版本動掉
      expect(versions.filter(v => v.status === 'active').length).toBe(activeCountBefore)
      // 其他版本的狀態不受影響（審核通過不會去動任何現有生效版本）
      const otherStatusesAfter = versions.filter(v => v.id !== reviewing!.id).map(v => v.status)
      expect(otherStatusesAfter).toEqual(otherStatusesBefore)
    })

    it('setLibraryActiveVersion 才會真的切換生效版本、同步技能內容，並把前一個 active 設為 history', () => {
      const store = useSkillStore()
      // team-marketing-001：v1.0.0 history、v1.1.0 active
      const before = store.getSkillVersions('team-marketing-001')
      const target = before.find(v => v.status === 'history')!
      const previousActive = before.find(v => v.status === 'active')!
      expect(target).toBeDefined()
      expect(previousActive).toBeDefined()

      store.setLibraryActiveVersion('team-marketing-001', target.id)

      const after = store.getSkillVersions('team-marketing-001')
      expect(after.find(v => v.id === target.id)!.status).toBe('active')
      expect(after.find(v => v.id === previousActive.id)!.status).toBe('history')

      const skill = store.findSkill('team-marketing-001')!
      expect(skill.version).toBe(target.versionName)
      expect(skill.description).toBe(target.description)
    })

    it('deleteSkillVersion 刪除非生效中的版本', () => {
      const store = useSkillStore()
      // team-marketing-001：v1.0.0 history、v1.1.0 active
      const before = store.getSkillVersions('team-marketing-001')
      const target = before.find(v => v.status === 'history')!
      expect(target).toBeDefined()

      store.deleteSkillVersion('team-marketing-001', target.id)

      const after = store.getSkillVersions('team-marketing-001')
      expect(after.length).toBe(before.length - 1)
      expect(after.find(v => v.id === target.id)).toBeUndefined()
    })

    it('deleteSkillVersion 不能刪除生效中的版本', () => {
      const store = useSkillStore()
      const before = store.getSkillVersions('team-marketing-001')
      const active = before.find(v => v.status === 'active')!
      expect(active).toBeDefined()

      store.deleteSkillVersion('team-marketing-001', active.id)

      const after = store.getSkillVersions('team-marketing-001')
      expect(after.length).toBe(before.length)
      expect(after.find(v => v.id === active.id)).toBeDefined()
    })

    it('rejectSkillVersion 將版本設為 rejected', () => {
      const store = useSkillStore()
      const reviewing = store.getSkillVersions('ext-cs-return-001').find(v => v.status === 'reviewing')
      expect(reviewing).toBeDefined()
      store.rejectSkillVersion('ext-cs-return-001', reviewing!.id, '需修改語氣')
      expect(store.getSkillVersions('ext-cs-return-001').find(v => v.id === reviewing!.id)!.status).toBe('rejected')
    })
  })

  describe('Draft CRUD', () => {
    it('createDraft 新增一筆草稿', () => {
      const store = useSkillStore()
      const before = store.drafts.length
      store.createDraft()
      expect(store.drafts.length).toBe(before + 1)
    })

    it('updateDraft 更新草稿欄位', () => {
      const store = useSkillStore()
      const draft = store.drafts[0]
      store.updateDraft(draft.id, { name: '測試草稿' })
      expect(store.drafts.find(d => d.id === draft.id)!.name).toBe('測試草稿')
    })

    it('deleteDraft 移除草稿', () => {
      const store = useSkillStore()
      const before = store.drafts.length
      const draft = store.drafts[0]
      store.deleteDraft(draft.id)
      expect(store.drafts.length).toBe(before - 1)
    })

    it('submitDraft 移除草稿並在 flatSkills 中新增技能', () => {
      const store = useSkillStore()
      store.updateDraft(store.drafts[0].id, { name: '訂單追蹤助理', instructions: '測試指令' })
      const draftName = store.drafts[0].name
      const before = store.drafts.length
      store.submitDraft(store.drafts[0].id, 'new_skill')
      expect(store.drafts.length).toBe(before - 1)
      expect(store.flatSkills.some(s => s.name === draftName)).toBe(true)
    })
  })

  describe('批量更新', () => {
    it('pendingUpdateCount 大於 0', () => {
      const store = useSkillStore()
      expect(store.pendingUpdateCount).toBeGreaterThan(0)
    })

    it('pendingUpdateSkills 包含正確的技能', () => {
      const store = useSkillStore()
      expect(store.pendingUpdateSkills.length).toBeGreaterThan(0)
      store.pendingUpdateSkills.forEach(s => {
        expect(store.upstreamUpdateSkillIds.has(s.id)).toBe(true)
      })
    })

    it('batchMergeUpstreamUpdates 跳過有衝突的技能', () => {
      const store = useSkillStore()
      const allIds = store.pendingUpdateSkills.map(s => s.id)
      store.batchMergeUpstreamUpdates(allIds)
      // Skills with upstreamConflicts should NOT have been merged
      // ext-cs-return-001 has upstreamConflicts set in mock data
      const conflictSkill = store.findSkill('ext-cs-return-001')
      expect(conflictSkill?.upstreamConflicts?.length).toBeGreaterThan(0)
      // It should still have the same forkSourceVersion (not updated)
      expect(conflictSkill?.forkSourceVersion).toBe('初始客服版')
    })
  })

  describe('稽核記錄', () => {
    it('toggleSkill 寫入 auditLog', () => {
      const store = useSkillStore()
      const skill = store.flatSkills[0]
      store.toggleSkill(skill.id)
      expect(store.findSkill(skill.id)!.auditLog!.length).toBeGreaterThan(0)
    })

    it('mergeUpstreamUpdate（無衝突技能）寫入 UPSTREAM_MERGED', () => {
      const store = useSkillStore()
      // ext-meeting-eng-001 has update available and no conflicts
      const target = store.findSkill('ext-meeting-eng-001')
      expect(target).toBeDefined()
      store.mergeUpstreamUpdate(target!.id)
      expect(store.findSkill(target!.id)!.auditLog?.some(r => r.action === 'UPSTREAM_MERGED')).toBe(true)
    })

    it('ignoreUpstreamUpdate 寫入 UPSTREAM_IGNORED', () => {
      const store = useSkillStore()
      const target = store.findSkill('ext-meeting-eng-001')
      expect(target).toBeDefined()
      store.ignoreUpstreamUpdate(target!.id)
      expect(store.findSkill(target!.id)!.auditLog?.some(r => r.action === 'UPSTREAM_IGNORED')).toBe(true)
      expect(store.findSkill(target!.id)!.upstreamUpdateStatus).toBe('ignored')
    })

    it('detachFromUpstream 寫入 UPSTREAM_DETACHED', () => {
      const store = useSkillStore()
      const target = store.findSkill('ext-cs-return-001')
      expect(target).toBeDefined()
      store.detachFromUpstream(target!.id)
      expect(store.findSkill(target!.id)!.auditLog?.some(r => r.action === 'UPSTREAM_DETACHED')).toBe(true)
    })

    it('setLibraryActiveVersion 寫入 VERSION_ACTIVATED，並記錄切到的版本名稱', () => {
      const store = useSkillStore()
      // team-marketing-001：v1.0.0 history、v1.1.0 active
      const target = store.getSkillVersions('team-marketing-001').find(v => v.status === 'history')!
      store.setLibraryActiveVersion('team-marketing-001', target.id)
      const rec = store.findSkill('team-marketing-001')!.auditLog?.find(r => r.action === 'VERSION_ACTIVATED')
      expect(rec).toBeDefined()
      expect(rec!.detail).toBe(target.versionName)
    })
  })

  describe('測試歷史', () => {
    it('saveTestRun 儲存記錄', () => {
      const store = useSkillStore()
      store.saveTestRun('sys-cs-001', { total: 7, passed: 5 })
      expect(store.getTestRunHistory('sys-cs-001').length).toBeGreaterThan(0)
    })

    it('超過 10 筆時不超過上限', () => {
      const store = useSkillStore()
      for (let i = 0; i < 12; i++) {
        store.saveTestRun('sys-cs-001', { total: 7, passed: i % 7 })
      }
      expect(store.getTestRunHistory('sys-cs-001').length).toBeLessThanOrEqual(10)
    })

    it('saveTestRun 計算 passRate 正確', () => {
      const store = useSkillStore()
      store.saveTestRun('sys-cs-001', { total: 10, passed: 7 })
      const history = store.getTestRunHistory('sys-cs-001')
      const last = history[history.length - 1]
      expect(last.passRate).toBeCloseTo(0.7)
    })
  })

  describe('PersonalSkill', () => {
    it('myPersonalSkills 初始有 8 筆且都是 zone:personal', () => {
      const store = useSkillStore()
      expect(store.myPersonalSkills.length).toBe(8)
      store.myPersonalSkills.forEach(s => expect(s.zone).toBe('personal'))
    })

    it('submitPersonalSkill 將 personalStatus 設為 reviewing 並記錄 note 和 mode', () => {
      const store = useSkillStore()
      const skill = store.myPersonalSkills[0]
      expect(skill.personalStatus).toBe('available')
      store.submitPersonalSkill(skill.id, 'new_skill', '測試說明', '測試版本')
      expect(store.myPersonalSkills[0].personalStatus).toBe('reviewing')
      expect(store.myPersonalSkills[0].submitNote).toBe('測試說明')
      expect(store.myPersonalSkills[0].submitMode).toBe('new_skill')
    })

    it('submitPersonalSkill 對不存在 id 不報錯', () => {
      const store = useSkillStore()
      expect(() => store.submitPersonalSkill('nonexistent', 'new_skill', '', '測試版本')).not.toThrow()
    })

    it('submitPersonalSkill 在 version_update 模式下，會在來源 Library 技能新增一筆 reviewing 版本，帶著使用者命名的版本名稱', () => {
      const store = useSkillStore()
      const skill = store.myPersonalSkills.find(s => s.derivedFrom)
      expect(skill).toBeDefined()
      const before = store.getSkillVersions(skill!.derivedFrom!).length

      store.submitPersonalSkill(skill!.id, 'version_update', '改動說明', 'VIP 退貨優惠更新')

      const versions = store.getSkillVersions(skill!.derivedFrom!)
      expect(versions.length).toBe(before + 1)
      const newVersion = versions.find(v => v.status === 'reviewing' && v.versionName === 'VIP 退貨優惠更新')
      expect(newVersion).toBeDefined()
    })

    it('submitPersonalSkill 在 version_update 模式下指定 updateTargetId，版本掛到使用者選的技能而不是來源技能', () => {
      const store = useSkillStore()
      const skill = store.myPersonalSkills.find(s => s.derivedFrom)!
      const other = store.flatSkills.find(s => s.id !== skill.derivedFrom)!
      const sourceBefore = store.getSkillVersions(skill.derivedFrom!).length
      const otherBefore = store.getSkillVersions(other.id).length

      store.submitPersonalSkill(skill.id, 'version_update', '', '改掛別的技能', 'enterprise', undefined, other.id)

      expect(store.myPersonalSkills.find(s => s.id === skill.id)!.updateTargetId).toBe(other.id)
      expect(store.getSkillVersions(other.id).length).toBe(otherBefore + 1)
      expect(store.getSkillVersions(skill.derivedFrom!).length).toBe(sourceBefore)
    })

    it('submitPersonalSkill 在 new_skill 模式下不記錄 updateTargetId', () => {
      const store = useSkillStore()
      const skill = store.myPersonalSkills.find(s => s.derivedFrom)!
      store.submitPersonalSkill(skill.id, 'new_skill', '', '新技能', 'enterprise', undefined, 'whatever')
      expect(store.myPersonalSkills.find(s => s.id === skill.id)!.updateTargetId).toBeUndefined()
    })

    it('suggestVersionName 有說明文字時，摘要成短標題（優先參考使用者已填的內容）', async () => {
      const store = useSkillStore()
      const skill = store.myPersonalSkills[0]
      const name = await store.suggestVersionName(skill.id, '新增超保固期彈性處理，VIP 客戶延長退貨期', 'version_update')
      expect(name.length).toBeGreaterThan(0)
      expect(name.length).toBeLessThanOrEqual(17) // 16 字 + 省略號
    })

    it('suggestVersionName 沒有說明文字時，退回用技能名稱＋送審模式給泛用建議', async () => {
      const store = useSkillStore()
      const skill = store.myPersonalSkills[0]
      const nameUpdate = await store.suggestVersionName(skill.id, '', 'version_update')
      expect(nameUpdate).toContain('功能更新')
      const nameNew = await store.suggestVersionName(skill.id, '   ', 'new_skill')
      expect(nameNew).toContain('首次發布')
    })

    it('deletePersonalSkill 從列表中移除', () => {
      const store = useSkillStore()
      const before = store.myPersonalSkills.length
      store.deletePersonalSkill(store.myPersonalSkills[0].id)
      expect(store.myPersonalSkills.length).toBe(before - 1)
    })

    it('findSkill 可找到個人技能', () => {
      const store = useSkillStore()
      const result = store.findSkill('personal-001')
      expect(result).toBeDefined()
      expect(result?.zone).toBe('personal')
    })
  })

  describe('手寫建立個人技能（createPersonalSkill）', () => {
    it('建立的技能出現在 myPersonalSkills，zone 為 personal', () => {
      const store = useSkillStore()
      store.createPersonalSkill({
        name: '我的新技能',
        instructions: '測試指令',
        description: '',
        isEnabled: true,
        assignedAgents: [],
      })
      const created = store.myPersonalSkills.find(s => s.name === '我的新技能')
      expect(created).toBeDefined()
      expect(created?.zone).toBe('personal')
    })

    it('建立的技能 personalStatus 為 available（不需要送審就能用）', () => {
      const store = useSkillStore()
      store.createPersonalSkill({
        name: '我的新技能2',
        instructions: '測試指令',
        description: '',
        isEnabled: true,
        assignedAgents: [],
      })
      const created = store.myPersonalSkills.find(s => s.name === '我的新技能2')
      expect(created?.personalStatus).toBe('available')
    })

    it('不會把技能寫進 Library（store.skills 不受影響）', () => {
      const store = useSkillStore()
      const before = store.skills.length
      store.createPersonalSkill({
        name: '我的新技能3',
        instructions: '測試指令',
        description: '',
        isEnabled: true,
        assignedAgents: [],
      })
      expect(store.skills.length).toBe(before)
      expect(store.skills.find(s => s.name === '我的新技能3')).toBeUndefined()
    })

    it('skillName 沿用使用者輸入的技能名稱（供之後的名稱衝突檢查使用）', () => {
      const store = useSkillStore()
      store.createPersonalSkill({
        name: '我的新技能4',
        instructions: '測試指令',
        description: '',
        isEnabled: true,
        assignedAgents: [],
      })
      const created = store.myPersonalSkills.find(s => s.name === '我的新技能4')
      expect(created?.skillName).toBe('我的新技能4')
    })
  })

  describe('Library skill 欄位', () => {
    it('Library skill 有 isEnabled 欄位但 zone 不為 personal', () => {
      const store = useSkillStore()
      const libSkill = store.flatSkills[0]
      expect(libSkill.zone).not.toBe('personal')
      expect(typeof libSkill.isEnabled).toBe('boolean')
    })
  })

  describe('SkillManagement 頁面整合', () => {
    it('myPersonalSkills 與 flatSkills 無 id 交集', () => {
      const store = useSkillStore()
      const libraryIds = new Set(store.flatSkills.map(s => s.id))
      store.myPersonalSkills.forEach(s => {
        expect(libraryIds.has(s.id)).toBe(false)
      })
    })
  })

  describe('版本測試選擇（SkillTest 沙盒）', () => {
    it('getVersionOptions 對個人技能一律回傳單一項目（不做版控）', () => {
      const store = useSkillStore()
      expect(store.getVersionOptions('personal-001')).toEqual([{ versionName: '1.1.0', isActive: true }])
      expect(store.getVersionOptions('personal-002')).toEqual([{ versionName: '1.0.0', isActive: true }])
    })

    it('getVersionOptions 對多版本 Library 技能依 status 判斷使用中版本，版本不用版號區隔一律有名稱可選', () => {
      const store = useSkillStore()
      const options = store.getVersionOptions('sys-cs-001')
      expect(options).toContainEqual({ versionName: '初始客服版', isActive: true })
      // 審核中版本也用名稱識別，一樣會出現在可測試的版本選項裡
      expect(options).toContainEqual({ versionName: '語氣優化與情緒分析', isActive: false })
    })

    it('getVersionOptions 對不存在的技能回傳空陣列', () => {
      const store = useSkillStore()
      expect(store.getVersionOptions('nonexistent')).toEqual([])
    })

    it('setSelectedSkill 未指定版本名稱時預設使用技能目前版本', () => {
      const store = useSkillStore()
      store.setSelectedSkill('personal-001')
      expect(store.selectedVersionName).toBe('1.1.0')
    })
  })

  describe('複製為個人技能與名稱衝突', () => {
    it('duplicateAsPersonalSkill 從 Library 技能建立新的個人技能，skillName 沿用來源名稱', () => {
      const store = useSkillStore()
      const before = store.myPersonalSkills.length
      const copy = store.duplicateAsPersonalSkill('sys-cs-001')
      expect(store.myPersonalSkills.length).toBe(before + 1)
      expect(copy.zone).toBe('personal')
      expect(copy.skillName).toBe('通用客服機器人')
      expect(copy.name).toBe('通用客服機器人')
      expect(copy.derivedFrom).toBe('sys-cs-001')
    })

    it('duplicateAsPersonalSkill 建立的副本 personalStatus 為 draft（尚未修改，內容與原技能相同）', () => {
      const store = useSkillStore()
      const copy = store.duplicateAsPersonalSkill('sys-cs-001')
      expect(copy.personalStatus).toBe('draft')
    })

    it('duplicateAsPersonalSkill 從個人技能複製時，skillName 沿用來源的 skillName（不是來源的 name）', () => {
      const store = useSkillStore()
      const copy = store.duplicateAsPersonalSkill('personal-001')
      expect(copy.skillName).toBe('會議摘要')
      expect(copy.derivedFrom).toBe('personal-001')
    })

    it('hasSkillNameConflict 偵測到相同 skillName 的其他個人技能', () => {
      const store = useSkillStore()
      // personal-001 與 personal-005 的 skillName 都是「會議摘要」（mock 資料刻意設計）
      expect(store.hasSkillNameConflict('personal-001')).toBe(true)
      expect(store.hasSkillNameConflict('personal-005')).toBe(true)
    })

    it('hasSkillNameConflict 對沒有同名技能的個人技能回傳 false', () => {
      const store = useSkillStore()
      expect(store.hasSkillNameConflict('personal-004')).toBe(false)
    })

    it('myPersonalSkills 動態計算 hasLibraryUpdate：來源版本不同才為 true', () => {
      const store = useSkillStore()
      const p002 = store.myPersonalSkills.find(s => s.id === 'personal-002')!
      const p001 = store.myPersonalSkills.find(s => s.id === 'personal-001')!
      expect(p002.hasLibraryUpdate).toBe(true) // derivedFromVersion 2.3.0 != sys-cs-001 目前 2.4.0
      expect(p001.hasLibraryUpdate).toBe(false) // derivedFromVersion 2.2.0 == sys-meeting-001 目前 2.2.0
    })

    it('duplicateAsPersonalSkill 複製「個人技能」時，derivedFrom 指向另一個個人技能不會被誤判為 Library 有更新', () => {
      // personal-001 是個人技能（不在 flatSkills / Library 範圍內）。
      // 複製後的新技能 derivedFrom 會指向 personal-001，flatSkills.find(...) 必然找不到，
      // 因此 hasLibraryUpdate 必須為 false，否則會出現無法作用的「來源有新版本」提示。
      const store = useSkillStore()
      const copy = store.duplicateAsPersonalSkill('personal-001')
      const found = store.myPersonalSkills.find(s => s.id === copy.id)!
      expect(found.hasLibraryUpdate).toBe(false)
    })

    it('duplicateAsPersonalSkill 傳入 nameOverride 時，副本的顯示名稱採用使用者確認後的名稱，skillName 仍沿用來源', () => {
      const store = useSkillStore()
      const copy = store.duplicateAsPersonalSkill('sys-cs-001', '客服機器人（我的版本）')
      expect(copy.name).toBe('客服機器人（我的版本）')
      expect(copy.skillName).toBe('通用客服機器人')
    })

    it('duplicateAsPersonalSkill 傳入空白 nameOverride 時，退回使用來源名稱', () => {
      const store = useSkillStore()
      const copy = store.duplicateAsPersonalSkill('sys-cs-001', '   ')
      expect(copy.name).toBe('通用客服機器人')
    })

    it('wouldSkillNameConflict 在建立副本之前，就能依來源預判是否會撞名', () => {
      const store = useSkillStore()
      // sys-cs-001（通用客服機器人）已經是 personal-002 的來源，複製前就該偵測到衝突
      expect(store.wouldSkillNameConflict('sys-cs-001')).toBe(true)
      // ERP 庫存查詢目前沒有任何個人技能衍生自它
      expect(store.wouldSkillNameConflict('ext-erp-001')).toBe(false)
    })

    it('wouldSkillNameConflict 對沒有同名副本的個人技能來源不會自我誤判為撞名', () => {
      const store = useSkillStore()
      // personal-004（合約審核摘要）的 skillName 在個人技能清單中沒有其他同名者，
      // 修正前 .some() 沒有排除自己，會把來源自己算進去而永遠回傳 true。
      expect(store.wouldSkillNameConflict('personal-004')).toBe(false)
    })

    // myPersonalSkills 是用 .map() 動態算出 hasLibraryUpdate 的 computed，一旦底層
    // myPersonalSkillsRef 有任何變動（哪怕改的是另一筆技能），整個 computed 都會重新
    // map、產生全新的物件陣列——連沒被動到的項目也會拿到新的物件參照。
    // 這是刻意的設計，但代表任何 consumer 都不可以快取單一個 myPersonalSkills 項目後長期持有，
    // 必須每次都重新從 store 取得，否則會拿到過期的快照（先前這個 refactor 就因此出過 bug：
    // 元件持有了舊的物件參照，畫面沒有跟著 store 的變動更新）。
    it('myPersonalSkillsRef 變動後，myPersonalSkills 中未被直接修改的項目也會是全新的物件參照', () => {
      const store = useSkillStore()
      const before = store.myPersonalSkills.find(s => s.id === 'personal-001')!
      // 觸發的是 personal-002 的變動，personal-001 本身資料沒有變動
      store.toggleSkill('personal-002')
      const after = store.myPersonalSkills.find(s => s.id === 'personal-001')!
      expect(before).not.toBe(after)
      expect(before).toEqual(after)
    })

    it('updateSkill 更新草稿狀態的個人技能後，personalStatus 轉為 available', () => {
      const store = useSkillStore()
      const copy = store.duplicateAsPersonalSkill('sys-cs-001')
      expect(copy.personalStatus).toBe('draft')
      store.updateSkill(copy.id, {
        name: copy.name!,
        instructions: '已修改過的指令內容',
        description: copy.description ?? '',
        isEnabled: false,
        assignedAgents: [],
      })
      const updated = store.findSkill(copy.id)
      expect(updated?.personalStatus).toBe('available')
      expect(updated?.instructions).toBe('已修改過的指令內容')
    })

    it('updateSkill 儲存內容未變動的草稿時，personalStatus 保持 draft（不因為單純按下儲存就清除）', () => {
      const store = useSkillStore()
      const copy = store.duplicateAsPersonalSkill('sys-cs-001')
      const source = store.flatSkills.find(s => s.id === 'sys-cs-001')!
      expect(copy.personalStatus).toBe('draft')
      store.updateSkill(copy.id, {
        name: copy.name!,
        instructions: source.instructions!, // 跟來源完全相同，代表使用者沒有真的修改內容
        description: copy.description ?? '',
        isEnabled: false,
        assignedAgents: [],
      })
      expect(store.findSkill(copy.id)?.personalStatus).toBe('draft')
    })

    it('updateSkill 對非草稿狀態的個人技能不會意外改動 personalStatus', () => {
      const store = useSkillStore()
      const skill = store.myPersonalSkills.find(s => s.personalStatus === 'available')!
      store.updateSkill(skill.id, {
        name: skill.name!,
        instructions: '再次修改',
        description: skill.description ?? '',
        isEnabled: skill.isEnabled ?? false,
        assignedAgents: [],
      })
      expect(store.findSkill(skill.id)?.personalStatus).toBe('available')
    })

    it('updateSkill 對 reviewing 狀態的個人技能不會意外改動 personalStatus', () => {
      const store = useSkillStore()
      const skill = store.myPersonalSkills[0]
      store.submitPersonalSkill(skill.id, 'new_skill', '測試說明', '測試版本')
      expect(store.findSkill(skill.id)?.personalStatus).toBe('reviewing')
      store.updateSkill(skill.id, {
        name: skill.name!,
        instructions: '再次修改',
        description: skill.description ?? '',
        isEnabled: skill.isEnabled ?? false,
        assignedAgents: [],
      })
      expect(store.findSkill(skill.id)?.personalStatus).toBe('reviewing')
    })

    it('updateSkill 對 has_library 狀態的個人技能不會意外改動 personalStatus', () => {
      const store = useSkillStore()
      const skill = store.myPersonalSkills.find(s => s.personalStatus === 'has_library')
      expect(skill).toBeDefined()
      store.updateSkill(skill!.id, {
        name: skill!.name!,
        instructions: '再次修改',
        description: skill!.description ?? '',
        isEnabled: skill!.isEnabled ?? false,
        assignedAgents: [],
      })
      expect(store.findSkill(skill!.id)?.personalStatus).toBe('has_library')
    })
  })

  describe('AI 賦能：createPersonalSkill 回傳 id 與 applyStudioPatch', () => {
    it('createPersonalSkill 回傳新技能 id，且可用 findSkill 找到、creationMethod 依 payload 寫入', () => {
      const store = useSkillStore()
      const id = store.createPersonalSkill({
        name: 'ERP 庫存查詢',
        description: '查詢 ERP 即時庫存',
        instructions: '1. 釐清品項\n2. 查詢庫存',
        isEnabled: true,
        assignedAgents: [],
        creationMethod: 'ai_assisted',
      })
      expect(typeof id).toBe('string')
      const skill = store.findSkill(id)
      expect(skill).toBeDefined()
      expect(skill!.zone).toBe('personal')
      expect(skill!.creationMethod).toBe('ai_assisted')
      expect(store.myPersonalSkills[0].id).toBe(id)
    })

    it('createPersonalSkill 未帶 creationMethod 時預設 manual；連續建立兩顆 id 不重複', () => {
      const store = useSkillStore()
      const base = { instructions: 'x', description: 'y', isEnabled: true, assignedAgents: [] as string[] }
      const a = store.createPersonalSkill({ name: 'A', ...base })
      const b = store.createPersonalSkill({ name: 'B', ...base })
      expect(a).not.toBe(b)
      expect(store.findSkill(a)!.creationMethod).toBe('manual')
    })

    it('applyStudioPatch 合併欄位、同步 skillName，並回傳 true', () => {
      const store = useSkillStore()
      const id = store.createPersonalSkill({ name: '舊名', instructions: '舊指令', description: '舊說明', isEnabled: true, assignedAgents: [] })
      const ok = store.applyStudioPatch(id, {
        name: '新名',
        instructions: '新指令',
        capabilities: ['能力一'],
      })
      expect(ok).toBe(true)
      const s = store.findSkill(id)!
      expect(s.name).toBe('新名')
      expect(s.skillName).toBe('新名')
      expect(s.instructions).toBe('新指令')
      expect(s.description).toBe('舊說明') // 未帶的欄位不動
      expect(s.capabilities).toEqual(['能力一'])
    })

    it('applyStudioPatch 對 draft 狀態的複本改了 instructions 後 personalStatus 轉 available', () => {
      const store = useSkillStore()
      const copy = store.duplicateAsPersonalSkill('sys-cs-001')
      expect(copy.personalStatus).toBe('draft')
      store.applyStudioPatch(copy.id, { instructions: `${copy.instructions ?? ''}\n4. 新步驟`.trim() })
      expect(store.findSkill(copy.id)!.personalStatus).toBe('available')
    })

    it('applyStudioPatch 對 Library 技能或不存在的 id 不作用並回傳 false', () => {
      const store = useSkillStore()
      const lib = store.findSkill('sys-cs-001')!
      const before = lib.name
      expect(store.applyStudioPatch('sys-cs-001', { name: '亂改' })).toBe(false)
      expect(store.findSkill('sys-cs-001')!.name).toBe(before)
      expect(store.applyStudioPatch('nope-000', { name: 'x' })).toBe(false)
    })

    it('createPersonalSkill 與 applyStudioPatch 都能寫入 composition（深拷貝）', () => {
      const store = useSkillStore()
      const ids = ['promo_kpi', 'ta_gender']
      const id = store.createPersonalSkill({
        name: '行銷週報', instructions: '依序產出以下章節：\n1. 促銷核心 KPI', description: 't',
        isEnabled: true, assignedAgents: [], composition: { sectionIds: ids }, creationMethod: 'manual',
      })
      const s = store.findSkill(id)!
      expect(s.composition).toEqual({ sectionIds: ['promo_kpi', 'ta_gender'] })
      ids.push('ch_kpi')
      expect(s.composition!.sectionIds).toHaveLength(2)
      expect(store.applyStudioPatch(id, { composition: { sectionIds: ['ch_kpi'] } })).toBe(true)
      expect(store.findSkill(id)!.composition).toEqual({ sectionIds: ['ch_kpi'] })
    })
  })

  describe('覆蓋能力 capabilities', () => {
    it('createSkill 帶入 capabilities 會存到新技能上', () => {
      const store = useSkillStore()
      const cap = '問題分類'
      store.createSkill({
        name: '測試技能',
        instructions: '',
        description: '',
        isEnabled: true,
        assignedAgents: [],
        capabilities: [cap],
      })
      const created = store.flatSkills.find(s => s.name === '測試技能')
      expect(created?.capabilities).toEqual([cap])
    })

    it('createSkill 未帶 capabilities 時，新技能的 capabilities 是空陣列', () => {
      const store = useSkillStore()
      store.createSkill({
        name: '無能力技能',
        instructions: '',
        description: '',
        isEnabled: true,
        assignedAgents: [],
      })
      const created = store.flatSkills.find(s => s.name === '無能力技能')
      expect(created?.capabilities).toEqual([])
    })

    it('createPersonalSkill 帶入 capabilities 會存到新的個人技能上', () => {
      const store = useSkillStore()
      const cap = 'FAQ查詢'
      store.createPersonalSkill({
        name: '測試個人技能',
        instructions: '',
        description: '',
        isEnabled: true,
        assignedAgents: [],
        capabilities: [cap],
      })
      const created = store.myPersonalSkills.find(s => s.name === '測試個人技能')
      expect(created?.capabilities).toEqual([cap])
    })

    it('updateSkill 帶入 capabilities 會覆蓋技能的 capabilities', () => {
      const store = useSkillStore()
      const cap = '情緒分析'
      store.updateSkill('ext-cs-return-001', {
        name: '客服機器人 (退貨版)',
        instructions: '測試指令',
        description: '',
        isEnabled: true,
        assignedAgents: [],
        capabilities: [cap],
      })
      expect(store.findSkill('ext-cs-return-001')?.capabilities).toEqual([cap])
    })

    it('updateSkill 未帶 capabilities 時，技能的 capabilities 被清空為空陣列', () => {
      const store = useSkillStore()
      store.updateSkill('ext-cs-return-001', {
        name: '客服機器人 (退貨版)',
        instructions: '測試指令',
        description: '',
        isEnabled: true,
        assignedAgents: [],
      })
      expect(store.findSkill('ext-cs-return-001')?.capabilities).toEqual([])
    })
  })

  describe('附加檔案 files', () => {
    it('createSkill 帶入 files 會存到新技能上', () => {
      const store = useSkillStore()
      const file = { id: 'sf-1', fileName: 'rules.pdf', fileSize: 1024, fileType: 'PDF' as const, uploadedAt: '2026-08-07T00:00:00Z' }
      store.createSkill({
        name: '測試技能',
        instructions: '',
        description: '',
        isEnabled: true,
        assignedAgents: [],
        files: [file],
      })
      const created = store.flatSkills.find(s => s.name === '測試技能')
      expect(created?.files).toEqual([file])
    })

    it('createSkill 未帶 files 時，新技能的 files 是空陣列', () => {
      const store = useSkillStore()
      store.createSkill({
        name: '無附檔技能',
        instructions: '',
        description: '',
        isEnabled: true,
        assignedAgents: [],
      })
      const created = store.flatSkills.find(s => s.name === '無附檔技能')
      expect(created?.files).toEqual([])
    })

    it('updateSkill 帶入 files 會覆蓋技能的 files', () => {
      const store = useSkillStore()
      const file = { id: 'sf-2', fileName: 'faq.md', fileSize: 512, fileType: 'MD' as const, uploadedAt: '2026-08-07T00:00:00Z' }
      store.updateSkill('ext-cs-return-001', {
        name: '客服機器人 (退貨版)',
        instructions: '測試指令',
        description: '',
        isEnabled: true,
        assignedAgents: [],
        files: [file],
      })
      expect(store.findSkill('ext-cs-return-001')?.files).toEqual([file])
    })

    it('updateSkill 未帶 files 時，技能的 files 被清空為空陣列', () => {
      const store = useSkillStore()
      store.updateSkill('ext-cs-return-001', {
        name: '客服機器人 (退貨版)',
        instructions: '測試指令',
        description: '',
        isEnabled: true,
        assignedAgents: [],
      })
      expect(store.findSkill('ext-cs-return-001')?.files).toEqual([])
    })

    it('updateSkillFiles 覆蓋技能的 files', () => {
      const store = useSkillStore()
      const file = { id: 'sf-3', fileName: 'sop.pdf', fileSize: 2048, fileType: 'PDF' as const, uploadedAt: '2026-08-19T00:00:00Z' }
      store.updateSkillFiles('ext-cs-return-001', [file])
      expect(store.findSkill('ext-cs-return-001')?.files).toEqual([file])
    })

    it('updateSkillFiles 傳入空陣列會清空技能的 files', () => {
      const store = useSkillStore()
      const file = { id: 'sf-4', fileName: 'sop.pdf', fileSize: 2048, fileType: 'PDF' as const, uploadedAt: '2026-08-19T00:00:00Z' }
      store.updateSkillFiles('ext-cs-return-001', [file])
      store.updateSkillFiles('ext-cs-return-001', [])
      expect(store.findSkill('ext-cs-return-001')?.files).toEqual([])
    })

    it('updateSkillFiles 對草稿狀態的個人技能新增檔案後，personalStatus 轉為 available', () => {
      const store = useSkillStore()
      const copy = store.duplicateAsPersonalSkill('sys-cs-001')
      expect(copy.personalStatus).toBe('draft')
      const file = { id: 'sf-5', fileName: 'rules.md', fileSize: 256, fileType: 'MD' as const, uploadedAt: '2026-08-19T00:00:00Z' }
      store.updateSkillFiles(copy.id, [file])
      expect(store.findSkill(copy.id)?.personalStatus).toBe('available')
    })

    it('updateSkillFiles 對草稿狀態的個人技能傳入跟來源一樣的空陣列時，personalStatus 保持 draft', () => {
      const store = useSkillStore()
      const copy = store.duplicateAsPersonalSkill('sys-cs-001')
      expect(copy.personalStatus).toBe('draft')
      store.updateSkillFiles(copy.id, [])
      expect(store.findSkill(copy.id)?.personalStatus).toBe('draft')
    })

    it('updateSkillFiles 對非草稿狀態的個人技能不會意外改動 personalStatus', () => {
      const store = useSkillStore()
      const skill = store.myPersonalSkills.find(s => s.personalStatus === 'available')!
      const file = { id: 'sf-6', fileName: 'faq.txt', fileSize: 128, fileType: 'TXT' as const, uploadedAt: '2026-08-19T00:00:00Z' }
      store.updateSkillFiles(skill.id, [file])
      expect(store.findSkill(skill.id)?.personalStatus).toBe('available')
    })

    it('updateSkillFiles 對複製自「有附加檔案的來源」的草稿，儲存未變動的內容時 personalStatus 保持 draft（不會因為草稿一開始就跟來源的檔案不同就被誤判為已修改）', () => {
      const store = useSkillStore()
      const copy = store.duplicateAsPersonalSkill('personal-001')
      expect(copy.personalStatus).toBe('draft')
      expect(copy.files ?? []).toEqual([]) // 複製不帶 files，這份草稿從一開始就跟有檔案的來源不同
      store.updateSkillFiles(copy.id, copy.files ?? [])
      expect(store.findSkill(copy.id)?.personalStatus).toBe('draft')
    })

    it('updateSkillFiles 對複製自「有附加檔案的來源」的草稿，實際新增檔案後 personalStatus 轉為 available', () => {
      const store = useSkillStore()
      const copy = store.duplicateAsPersonalSkill('personal-001')
      const file = { id: 'sf-7', fileName: 'notes.txt', fileSize: 64, fileType: 'TXT' as const, uploadedAt: '2026-08-19T00:00:00Z' }
      store.updateSkillFiles(copy.id, [file])
      expect(store.findSkill(copy.id)?.personalStatus).toBe('available')
    })
  })
})
