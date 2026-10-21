h2. [AI副作平台 / Skill管控後台] S10 ｜ AI 賦能技能建立與編輯（技能管理抽屜整合）

|| 欄位 || 內容 ||
| 所屬模組 | 技能管理（Skill Management） |
| 進入頁面 | /view/Skills |
| 前置 Story | S1 後台框架與路由、S2 Skills Repository 列表頁、S3 Skill 新增/編輯 Modal |
| 狀態 | 已完成開發（本 Story 為回溯補登） |

----

h4. As a
企業內想快速建立/調整技能的一般使用者，我希望不用自己寫技能指令，能透過跟 AI 對話描述需求，由 AI 幫我把技能設定擬出來，並且這個流程直接嵌在技能管理頁面裡，不用跳到另一個獨立頁面。

h4. 功能說明
* 技能管理頁的「建立技能」改成三選一：用對話建立、用行銷積木組裝（見 S11）、手動建立。前兩者都會開啟同一個「AI 賦能」抽屜（SkillStudioDrawer），差別只在於進入抽屜時預先指定的建立方式（method=chat / method=blocks），不用再讓使用者在抽屜裡被問一次「要用哪種方式建立」。
* AI 賦能抽屜不是獨立路由頁面，而是掛在 /view/Skills 上，用 query string（skillId / method / from / tab）控制開關與內容，關閉時清空 query。原本的 /view/SkillStudio 獨立頁面已下線，保留一條 redirect 規則把舊書籤導回技能管理頁並保留原本的 query，避免舊連結壞掉。
* 對話模式：使用者用自然語言描述需求，AI（mock 規則式回覆）逐步引導收集技能名稱、指令、觸發時機、覆蓋能力等內容，右側即時預覽草稿，使用者可隨時按「儲存」；有未儲存變更時，切換技能／關閉抽屜／離開頁面都會先跳確認對話框。
* 編輯既有個人技能時，抽屜同時支援「跟 Agent 對話修改」；若該技能是用積木組裝建立的（見 S11），編輯入口只會提供「用積木面板編輯」，不會出現「直接編輯」（避免在自由文字編輯器裡把內容跟已選章節積木脫勾）。
* 「AI 建議建立的技能」佇列（技能管理頁我的技能分頁）可以一鍵把某筆建議帶入抽屜、預填草稿內容並顯示相對應開場白，使用者確認後直接送出建立。

h4. 元件清單
|| 檔案路徑 || 說明 ||
| src/views/SkillManagement.vue | 技能管理主頁，負責「建立技能」選擇框、開關抽屜的 query 控制、離開/切換前的未儲存確認 |
| src/components/Skill/SkillStudioDrawer.vue | 抽屜外殼（Teleport + Transition），對外暴露 isDirty / applyQuery |
| src/components/Skill/SkillStudioModeHeader.vue | 抽屜標題／目前模式 chip |
| src/components/Skill/SkillStudioWorkspace.vue | 抽屜主體，串接 useSkillStudioConversation，決定顯示方式選擇畫面／對話面板／積木面板／預覽 |
| src/components/Skill/SkillMethodChooser.vue | 「用對話建立」／「用行銷積木組裝」二選一畫面（有帶 method query 時會跳過） |
| src/components/Skill/SkillStudioChat.vue | 對話模式的訊息串與輸入框 |
| src/components/Skill/SkillStudioPreview.vue | 右側草稿預覽／測試分頁 |
| src/composables/useSkillStudioConversation.ts | 對話狀態機、草稿模型（SkillDraft）、儲存/載入邏輯 |
| src/composables/useSkillHandoff.ts | 「AI 建議建立的技能」→ 抽屜的一次性交接資料 |
| src/router/index.ts | /view/SkillStudio → /view/Skills 的相容 redirect |

h4. 資料介面
{code:type=typescript}
interface SkillDraft {
  name: string
  description: string
  instructions: string
  triggerHint: string
  capabilities: SkillCapability[]
  files: SkillFile[]
  method: 'chat' | 'blocks' | null   // null = 尚未選擇建立方式
  sectionIds: string[]               // 積木方式使用，見 S11
}

interface SkillCapability {
  name: string
  description: string
}

// AI 賦能對話修改時，只允許更動這幾個內容欄位，不動狀態／版本／來源關係
type StudioPatch = Partial<Pick<Skill,
  'name' | 'description' | 'instructions' | 'triggerHint' | 'capabilities' | 'composition'
>>
{code}

h4. Acceptance Criteria

*AC1：建立技能改成三選一，不再進去才問*
- [ ] 「建立技能」跳出選擇框，選項為「用對話建立」「用行銷積木組裝」「手動建立」三個
- [ ] 選「用對話建立」／「用行銷積木組裝」直接開啟抽屜並進入對應模式，不會再看到一次方式選擇畫面
- [ ] 選「手動建立」導向既有的 /view/SkillEditor 三步驟精靈（不受本次影響）

*AC2：抽屜跟頁面路由的整合*
- [ ] 抽屜開關完全由 /view/Skills 的 query（skillId / method / from）決定，沒有獨立路由
- [ ] 舊的 /view/SkillStudio?... 連結會被導回 /view/Skills 並保留原本 query
- [ ] 抽屜有未儲存變更時，關閉抽屜、切換到別的技能、離開技能管理頁都會先跳出確認對話框

*AC3：對話式建立/編輯*
- [ ] 使用者可以用文字描述需求，逐步收集出技能名稱／指令／觸發時機／覆蓋能力，並即時反映在右側預覽
- [ ] 「AI 建議建立的技能」項目點擊「建立」後，抽屜開啟並帶入預填草稿與對應開場白訊息
- [ ] 個人技能若是用積木組裝建立（composition 有值），編輯入口只顯示「用積木面板編輯」，沒有「直接編輯」選項

h4. Out of Scope
* 行銷積木組裝的章節選擇/排序 UI 與 composition 資料結構，見 S11
* AI 快速測試未達標準時的補救引導對話，見 S12
* 手動建立三步驟精靈（SkillEditor.vue）本身不在本次改動範圍

---

h2. [AI副作平台 / Skill管控後台] S11 ｜ 行銷積木組裝建立技能（Block Composer）

|| 欄位 || 內容 ||
| 所屬模組 | 技能管理（Skill Management）／ AI 賦能抽屜 |
| 前置 Story | S10 AI 賦能技能建立與編輯 |
| 狀態 | 已完成開發（本 Story 為回溯補登） |

----

h4. As a
需要定期產出行銷報告的使用者，我希望不用自己寫技能指令，而是用勾選＋排序的方式，從既有的報告章節目錄裡組出一份可重複使用的「行銷週報生成」技能。

h4. 功能說明
* 在「建立技能」選擇框選「用行銷積木組裝」，或編輯一顆已經用積木組裝建立的技能，會進入積木組裝面板（取代對話模式）。
* 面板提供依分類（TA 用戶畫像／行銷活動成效／渠道績效）分組的章節積木庫，使用者可以把章節加入已選清單、用拖曳調整順序、移除，並填寫技能名稱／說明。
* 已選章節清單每次變動，系統會自動依章節內容重新推導出技能指令（依序列出各章節說明）、觸發時機（提及所涵蓋的分類）、覆蓋能力（每個章節各自對應一項能力），使用者不用手動同步這三個欄位。
* 儲存後，技能資料會多一個 composition 欄位記錄選了哪些章節（依序），供之後編輯時還原勾選狀態，也是判斷「這顆技能是用積木組裝的」的依據。
* 「用行銷積木組裝」建立的技能，之後編輯只能透過積木面板進行（見 S10 AC3），不提供自由文字編輯，避免手動修改指令內容跟已選章節悄悄脫勾。

h4. 元件清單
|| 檔案路徑 || 說明 ||
| src/components/Skill/SkillBlockComposer.vue | 積木組裝面板：章節庫、已選清單（拖曳排序）、名稱/說明輸入 |
| src/constants/reportSections.ts | 報告章節目錄（分類、章節清單），積木組裝的唯一資料來源 |
| src/composables/useSkillStudioConversation.ts | deriveFromSections()：依已選章節推導 instructions／triggerHint／capabilities；updateBlocks() 寫入草稿 |
| src/stores/skillStore.ts | Skill.composition 欄位定義；duplicateAsPersonalSkill() 複製時保留 composition |

h4. 資料介面
{code:type=typescript}
interface ReportCategory {
  id: string
  label: string
  color: string
}

interface ReportSection {
  id: string
  categoryId: string
  name: string
  description: string
}

// 技能資料上，標記這顆技能是用積木組裝建立、記錄選了哪些章節（依序）
interface Skill {
  // ...既有欄位
  composition?: { sectionIds: string[] }
}

function deriveFromSections(sectionIds: string[]): Pick<SkillDraft,
  'instructions' | 'triggerHint' | 'capabilities'
>
{code}

h4. Acceptance Criteria

*AC1：章節庫與已選清單*
- [ ] 章節依分類（TA 用戶畫像／行銷活動成效／渠道績效）分組顯示
- [ ] 可以把章節加入已選清單，清單內可拖曳調整順序、可移除
- [ ] 技能名稱／說明由使用者直接輸入（不是推導出來的）

*AC2：內容自動推導*
- [ ] 已選章節有變動時，技能指令會依序列出各章節的名稱與說明
- [ ] 觸發時機會提及已選章節涵蓋到的分類名稱
- [ ] 覆蓋能力會依已選章節各自產生一筆對應項目

*AC3：資料持久化與編輯限制*
- [ ] 儲存後的技能帶有 composition.sectionIds，記錄已選章節與順序
- [ ] 重新開啟編輯時，積木面板會依 composition 還原已選章節的勾選與順序
- [ ] 複製這類技能為個人技能副本時，composition 會一併保留
- [ ] 這類技能的編輯入口只提供「用積木面板編輯」，沒有自由文字編輯選項

h4. Out of Scope
* 章節目錄本身的內容維護／新增章節（目前是前端寫死的假資料，等後端章節 API 就緒後再串接）
* 積木面板以外的技能建立方式，見 S10

---

h2. [AI副作平台 / Skill管控後台] S12 ｜ AI 快速測試未達標準時的引導修正

|| 欄位 || 內容 ||
| 所屬模組 | 技能管理（Skill Management）／ AI 賦能抽屜 |
| 前置 Story | S10 AI 賦能技能建立與編輯、S8 Skill 測試中心（AI 快速測試邏輯沿用既有機制） |
| 狀態 | 已完成開發（本 Story 為回溯補登） |

----

h4. As a
用 AI 賦能建立技能的使用者，我希望如果剛剛的快速測試沒有全部通過，AI 能主動提醒我並引導我補齊或修正技能內容，而不是要我自己回頭去對照哪裡有問題。

h4. 功能說明
* AI 賦能抽屜的「測試」分頁執行既有的 AI 快速測試（沿用 S8 的機制與資料）後，若測試結果不是全部通過，左側對話面板會自動插入一則 AI 訊息，告知答對題數與正確率，並詢問使用者要不要說明需要調整的地方。
* 這則訊息會把對話狀態切回「補充說明」階段，使用者接下來輸入的內容會被視為要用來修正/補齊技能內容，沿用既有的多輪對話收集邏輯，不需要另外設計新的對話狀態。
* 若測試結果是全部通過（100%），不會有任何額外提示，維持原本的測試結果呈現。

h4. 元件清單
|| 檔案路徑 || 說明 ||
| src/composables/useSkillStudioConversation.ts | notifyTestResult()：依測試結果決定是否插入引導訊息、切換對話階段 |
| src/components/Skill/SkillStudioWorkspace.vue | 監看 store.aiTestReport 變化，呼叫 notifyTestResult() |
| src/components/Skill/SkillTestAI.vue | AI 快速測試執行與結果呈現（既有元件，沿用不變） |

h4. 資料介面
{code:type=typescript}
interface AITestReport {
  total: number
  correct: number
  // ...既有欄位
}

function notifyTestResult(report: AITestReport): void
{code}

h4. Acceptance Criteria

*AC1：未達標準時的引導*
- [ ] 快速測試答對題數少於總題數時，對話面板自動插入一則訊息，內容包含答對題數與正確率
- [ ] 訊息內容邀請使用者說明需要調整的地方
- [ ] 插入訊息後，對話狀態進入可以接續收集調整內容的階段，使用者接下來的輸入會被當成修正內容處理

*AC2：全部通過時不打擾*
- [ ] 快速測試全部通過時，不會出現額外的引導訊息，維持原本畫面

h4. Out of Scope
* AI 快速測試本身的判題邏輯與資料來源（沿用 S8 既有機制，不在本次改動範圍）
* 使用者忽略引導、不理會直接離開的情況不特別處理（沿用既有的未儲存變更確認機制）

---

h2. [AI副作平台 / Skill管控後台] S13 ｜ 個人技能卡片與建立精靈的細節優化

|| 欄位 || 內容 ||
| 所屬模組 | 技能管理（Skill Management） |
| 前置 Story | S3 Skill 新增/編輯 Modal |
| 狀態 | 已完成開發（本 Story 為回溯補登） |

----

h4. As a
瀏覽「我的技能」列表的使用者，我希望能從卡片上的圖示跟描述文字，快速看出這顆技能是怎麼建立的、實際會在什麼情境下用到；手動建立技能時，我也希望能直接把技能拆解成幾項具體能力，不用全部塞在一段指令文字裡。

h4. 功能說明
* 手動建立技能精靈（SkillEditor）新增「覆蓋能力」區塊，可以新增/編輯/刪除多筆「能力名稱＋說明」，並提供 7 個常見能力預設（問題分類、資料查詢、內容摘要、格式轉換、多語言支援、情緒／風險辨識、資料整合）可以一鍵加入再自行調整文字。
* 「我的技能」列表卡片（PersonalSkillGroup）的圖示改成依建立方式呈現：用行銷積木組裝建立的技能顯示積木圖示，用 AI 對話建立的技能顯示對話圖示，其餘個人技能維持原本的人形圖示。Library／團隊/企業技能圖示不受影響，維持原樣。
* 個人技能卡片的描述文字，優先顯示這顆技能的第一筆「使用情境」標題（比較貼近「什麼時候會用到」），沒有填寫使用情境的技能才退回顯示原本的技能描述。

h4. 元件清單
|| 檔案路徑 || 說明 ||
| src/components/Skill/SkillCapabilityEditor.vue | 覆蓋能力清單編輯元件，含常見能力預設 chip |
| src/views/SkillEditor.vue | 「覆蓋能力」區塊串接位置（Step 1）與確認頁摘要列 |
| src/components/Skill/PersonalSkillGroup.vue | 個人技能卡片：依建立方式決定圖示、使用情境優先於描述 |
| src/stores/skillStore.ts | CreateSkillPayload／UpdateSkillPayload 的 capabilities 欄位持久化 |

h4. 資料介面
{code:type=typescript}
interface SkillCapability {
  name: string
  description: string
}

interface UsageScenario {
  title: string
  description: string
}

// 圖示判斷邏輯（PersonalSkillGroup.vue）
// composition 有值 → 積木圖示；creationMethod === 'ai_assisted' → 對話圖示；其餘 → 預設圖示
{code}

h4. Acceptance Criteria

*AC1：覆蓋能力編輯*
- [ ] 建立/編輯技能時可以新增多筆「能力名稱＋說明」，也可以編輯或刪除既有的
- [ ] 提供至少 7 個常見能力可以一鍵加入，加入後仍可自行修改文字
- [ ] 送出時沒有填名稱的空白列不會被儲存

*AC2：個人技能卡片圖示*
- [ ] composition 有值的個人技能顯示積木圖示
- [ ] creationMethod 為 ai_assisted 的個人技能顯示對話圖示
- [ ] 其餘個人技能維持原本圖示；Library／團隊／企業技能圖示不受影響

*AC3：卡片描述優先序*
- [ ] 有填寫使用情境的技能，卡片描述顯示第一筆使用情境的標題
- [ ] 沒有使用情境的技能，卡片描述顯示原本的技能描述

h4. Out of Scope
* 使用情境（usageScenarios）本身的填寫入口與編輯 UI（目前僅有 mock 資料，尚未提供編輯畫面）
* Library／團隊/企業技能卡片的圖示與描述邏輯調整
