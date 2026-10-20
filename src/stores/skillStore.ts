import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { FileType } from '@/utils/file'

// 覆蓋能力：純 hashtag 字串（不含 #，顯示時才加），不支援空白、不限字數，
// 可以有多個。原本的 { name, description } 結構拿掉——資料面只能有一種表示法，
// 說明文字需要的地方（例如技能定義 markdown）改用 tag 本身，不再帶額外說明
export type SkillCapability = string

export interface SkillTestCase {
  name: string
  input: string
}

export interface UsageScenario {
  title: string
  description: string
}

export type SkillVersionStatus = 'draft' | 'reviewing' | 'approved' | 'active' | 'history' | 'rejected'

export interface SkillReviewRecord {
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'
  by: string
  time: string
  note?: string
}

export interface SkillVersion {
  id: string
  // 版本之間不用版號區隔，一律用使用者送審時自己命名的版本名稱識別，
  // 所有狀態（含審核中／已退回）都要有
  versionName: string
  status: SkillVersionStatus
  name: string
  description: string
  instructions?: string
  triggerHint?: string
  capabilities?: SkillCapability[]
  createdAt: string
  createdBy?: string
  updateNote?: string
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: string
  reviewFeedback?: string
  reviewHistory?: SkillReviewRecord[]
}

export interface OperationRecord {
  action: 'ENABLED' | 'DISABLED' | 'UPSTREAM_MERGED' | 'UPSTREAM_IGNORED' | 'UPSTREAM_DETACHED' | 'VERSION_ACTIVATED'
  by: string
  time: string
  // 切換生效版本時記錄切到哪個版本名稱，操作記錄才看得出換成了什麼
  detail?: string
}

export interface ConflictItem {
  field: string
  label: string
  mine: string
  upstream: string
}

export interface ConflictResolution {
  field: string
  choice: 'mine' | 'upstream'
}

export interface TestRun {
  id: string
  skillId: string
  date: string
  total: number
  passed: number
  passRate: number
}

export type SkillFunctionType = '文字生成' | '資料查詢' | '流程自動化' | '分析報表' | '溝通協作'

// Agent 完成任務後主動建議「建立成個人技能」的佇列項目（見 useSkillSuggestion）。
// 決策介面在「技能管理」的「我的技能」分頁，不再是對話河道裡的即時卡片
// （2026-09-23 產品決議：技能管理列表取代河道即時建議）。
export interface SkillSuggestionEntry {
  id: string
  name: string
  description: string
  triggerHint: string
  steps: string[]
  reason: string
  conversationId: string
}

// 這是 Skill.assignedAgents 的唯一正式詞彙表，`SkillEditor.vue`（指派 chip 選擇器）與
// `AssignSkillToAgentModal.vue`（探索頁「加入我的技能」流程）都只認這份清單。
// 刻意跟 `exploreStore.ts` 的 Agent 目錄（探索頁「Agent 探索」分頁瀏覽的 10 筆 Agent
// 卡片，有自己的 id/icon/colorKey）完全脫鉤——兩者剛好都叫「Agent」但是不同概念，
// 絕對不要把兩份清單混用或互相替換（先前已經在這個分支上修正過一次這種混淆）。
export const AVAILABLE_AGENTS = [
  '通用助理', '客服中心助理', '電商小幫手',
  '知識管理助理', '會議記錄助理', '工程助理',
  '業務分析助理', '倉儲管理助理',
] as const

export interface Skill {
  id: string
  name: string
  description: string
  type: 'system' | 'extension'
  origin: 'platform_created' | 'custom_version' | 'manually_created'
  creationMethod?: 'ai_assisted' | 'manual'
  scope?: 'system' | 'enterprise' | 'team'
  teamName?: string
  version: string
  isEnabled: boolean
  usageCount: number
  testPassRate: number
  aiTestPassRate?: number | null   // AI 快速測試（選擇題）最近一次的答對比例；null／未定義＝從沒測過
  avgLatencyMs: number
  forkSourceId?: string
  forkSourceVersion?: string
  instructions?: string
  triggerHint?: string
  capabilities?: SkillCapability[]
  keywords?: string[]          // 只有積木組裝必填；對話方式不會有這個欄位
  functionType?: SkillFunctionType   // 探索頁分類/篩選用，選填不影響既有消費者
  usageScenarios?: UsageScenario[]
  assignedAgents?: string[]
  testCases?: SkillTestCase[]
  versions?: SkillVersion[]
  deletedAt?: string
  children?: Skill[]
  upstreamUpdateStatus?: 'up_to_date' | 'update_available' | 'ignored'
  auditLog?: OperationRecord[]
  upstreamConflicts?: ConflictItem[]
  zone?: 'personal' | 'library'
  backendVersion?: { version: number; tested: boolean }   // 後端技能的最新版與「測過」記號；只有後端模式的卡片會有
  personalStatus?: 'draft' | 'available' | 'reviewing' | 'has_library'
  derivedFrom?: string
  hasLibraryUpdate?: boolean
  submitNote?: string
  submitMode?: 'version_update' | 'new_skill'
  targetScope?: 'enterprise' | 'team'
  targetTeamName?: string
  submittedBy?: string
  skillName?: string
  derivedFromVersion?: string
  reviewedBy?: string
  reviewedAt?: string
  reviewFeedback?: string
  aiAnalysis?: string[]
  files?: SkillFile[]
  composition?: { sectionIds: string[] }  // 由行銷積木組裝建立的技能；有這欄位就走積木方式
}

export interface SkillFile {
  id: string
  fileName: string
  fileSize: number
  fileType: FileType
  uploadedAt: string
}

export interface CreateSkillPayload {
  name: string
  description?: string
  instructions: string
  triggerHint: string
  // 選填：createPersonalSkill() 不讀這個欄位（個人技能一律以停用落地，見該函式註解）；
  // createSkill()（Library／企業技能發佈用）才會用到，沒帶時預設 true。
  isEnabled?: boolean
  assignedAgents: string[]
  scope?: 'enterprise' | 'team'
  files?: SkillFile[]
  capabilities?: SkillCapability[]
  keywords?: string[]
  creationMethod?: 'ai_assisted' | 'manual'
  composition?: { sectionIds: string[] }
}

export interface UpdateSkillPayload {
  name: string
  description?: string
  instructions: string
  triggerHint: string
  isEnabled: boolean
  assignedAgents: string[]
  files?: SkillFile[]
  capabilities?: SkillCapability[]
  keywords?: string[]
}

// AI 賦能對話修改用：只允許動這幾個內容欄位，不碰狀態／版本／來源關係。
// assignedAgents／keywords 只有積木方式的「基本設定」步驟會帶到；對話方式不傳這兩個
// 欄位（composable 的 save() 傳 undefined），維持原本「指派 Agent 只能透過啟用流程調整」的行為
export type StudioPatch = Partial<Pick<Skill, 'name' | 'description' | 'instructions' | 'triggerHint' | 'capabilities' | 'assignedAgents' | 'keywords' | 'composition'>>

export interface DraftSkill {
  id: string
  name: string
  description: string
  instructions: string
  type: 'system' | 'extension'
  forkSourceId?: string
  createdAt: string
  updatedAt: string
  triggerHint?: string
  assignedAgents?: string[]
  files?: SkillFile[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  toolTrace?: { name: string; latencyMs: number }[]
}

export type AITestTag = 'normal' | 'boundary' | 'trigger_edge'

export interface AITestScenario {
  id: string
  tag: AITestTag
  input: string
  expectedBehavior: string
  expectedTrigger: boolean   // 出題時的參考答案（模擬 Agent 作答的依據），不是最終判定——正確答案由使用者標註
  agentAnswer: boolean       // 答題 Agent 的判斷：這句話要不要觸發這顆技能
  agentReasoning: string     // 答題 Agent 給出這個判斷的理由
  status: 'pending' | 'correct' | 'incorrect'   // Agent 的判斷對不對（跟使用者標註的正確答案比）
  userAnswer?: boolean       // 使用者標註的正確答案：該觸發還是不該觸發
}

export interface AITestReport {
  total: number
  correct: number
  byTag: Record<AITestTag, { total: number; correct: number }>
  summary: string
}

const MOCK_SKILLS: Skill[] = [
  {
    id: 'sys-cs-001',
    name: '通用客服機器人',
    description: '處理客戶諮詢與 FAQ，支援多語言與情緒分析',
    functionType: '溝通協作',
    type: 'system',
    origin: 'platform_created',
    scope: 'system',
    // 這裡要跟 versions[] 裡 status:'active' 那筆的 versionName 一致
    // （初始客服版），不能自己寫一個 versions[] 裡根本不存在的名稱
    version: '初始客服版',
    isEnabled: true,
    usageCount: 0,
    testPassRate: 0.96,
    avgLatencyMs: 280,
    instructions: '你是一個專業的客服助理，負責處理客戶的訂單查詢、退換貨、付款方式等常見問題。回覆時語氣親切且專業，優先比對知識庫給出準確答案。遇到情緒激動或複雜投訴時，主動轉接人工客服。支援繁體中文、簡體中文、英文回覆。',
    capabilities: [
      '問題分類',
      'FAQ查詢',
      '情緒分析',
      '多語言支援',
    ],
    usageScenarios: [
      { title: '處理高峰期大量諮詢', description: '促銷活動期間湧入大量客戶詢問，AI 自動分流處理標準問題，讓人工客服聚焦在複雜投訴與退換貨審核。' },
      { title: '24 小時自動回覆', description: '夜間與假日無客服人員時，自動回覆訂單查詢、付款方式說明等常見問題，降低隔天早上的客服積壓量。' },
      { title: '識別高風險客訴', description: '分析對話情緒，當使用者情緒激烈或已升級為投訴語氣時，即時標記並轉介給資深客服代表接手。' },
    ],
    assignedAgents: ['客服中心助理', '電商小幫手'],
    auditLog: [
      { action: 'ENABLED' as const, by: '管理員', time: '2026-06-28T10:00:00Z' },
      { action: 'DISABLED' as const, by: '管理員', time: '2026-06-20T14:00:00Z' },
      { action: 'ENABLED' as const, by: '管理員', time: '2026-06-10T09:00:00Z' },
    ] satisfies OperationRecord[],
    versions: [
      {
        id: 'v-cs-001-v241',
        // 審核中，還沒核發版號
        versionName: '語氣優化與情緒分析',
        status: 'reviewing' as SkillVersionStatus,
        name: '通用客服機器人',
        description: '處理客戶諮詢與 FAQ，支援多語言與情緒分析',
        instructions: '你是一個專業客服助理，使用親切且專業的語氣，處理各類客戶諮詢。',
        reviewNote: '新增情緒分析能力，優化回覆語氣',
        updateNote: '優化 Prompt 語氣',
        reviewHistory: [
          { action: 'SUBMITTED' as const, by: '管理員', time: '2026-06-28T10:00:00Z' },
        ],
        createdAt: '2026-06-28T10:00:00Z',
      },
      {
        id: 'v-cs-001-v240',
        versionName: '初始客服版',
        status: 'active' as SkillVersionStatus,
        name: '通用客服機器人',
        description: '處理客戶諮詢與 FAQ，支援多語言與情緒分析',
        instructions: '你是一個客服助理，處理各類客戶諮詢與 FAQ。',
        createdAt: '2026-06-01T10:00:00Z',
      },
    ] satisfies SkillVersion[],
    testCases: [
      { name: '詢問訂單到貨', input: '我的訂單什麼時候會到？訂單號是 #20241201-0023' },
      { name: '詢問退換貨', input: '我上週買的商品有瑕疵，想退貨，請問流程是什麼？' },
      { name: '詢問付款方式', input: '你們支援哪些付款方式？可以用信用卡分期嗎？' },
      { name: '情緒測試', input: '你們的客服真的很差！我等了三天還沒有任何回音！' },
    ],
    children: [
      {
        id: 'ext-cs-return-001',
        name: '客服機器人 (退貨版)',
        description: '針對退貨問題，依設定的服務原則回應退貨政策與審核',
        type: 'extension',
        origin: 'custom_version',
        creationMethod: 'ai_assisted',
        scope: 'enterprise',
        version: '初始版本',
        isEnabled: true,
        usageCount: 89,
        testPassRate: 0.94,
        avgLatencyMs: 342,
        forkSourceId: 'sys-cs-001',
        forkSourceVersion: '初始客服版',
        upstreamUpdateStatus: 'update_available' as const,
        instructions: '你是專門處理退貨問題的客服助理。\n\n當客戶提出退貨請求時：\n1. 查詢訂單狀態確認購買日期\n2. 確認是否在 30 天退貨期限內\n3. 依據退貨政策給出具體建議\n4. 如有疑問轉接人工客服',
        triggerHint: '退貨、換貨、退款、品質問題',
        capabilities: [
          '訂單狀態查詢',
          '退貨資格判斷',
        ],
        usageScenarios: [
          { title: '標準退貨申請', description: '客戶詢問退貨資格，AI 自動查詢購買日期並比對 30 天退貨政策，直接給出可否退貨的判斷與後續申請步驟。' },
          { title: '超保固期彈性處理', description: '客戶反映商品瑕疵但已超過標準退貨期限，AI 依規則判斷是否符合「主管特批」或 VIP 延長優惠期，並引導後續申請流程。' },
        ],
        assignedAgents: ['客服中心助理'],
        upstreamConflicts: [
          {
            field: 'instructions',
            label: '技能指令',
            mine: '你是專門處理退貨問題的客服助理。',
            upstream: '你是一個專業客服助理，使用親切且專業的語氣，專門處理退貨相關問題。',
          },
        ],
        testCases: [
          { name: '退貨資格確認', input: '我在 2024/11/15 購買了一件外套，現在可以退貨嗎？' },
          { name: '逾期退貨申請', input: '我超過 30 天了，但商品真的有問題，有辦法退嗎？' },
          { name: '詢問退款時間', input: '退貨後多久可以收到退款？' },
        ],
        versions: [
          {
            id: 'v-cs-return-1.0',
            versionName: '初始版本',
            // 這是目前實際生效的版本（跟卡片上的 v1.0.0、skill.instructions
            // 等內容一致），要標 active，不是 history——history 是指「曾經
            // active、後來被別的版本取代」，這筆從沒被取代過
            status: 'active',
            name: '客服機器人 (退貨版)',
            description: '針對退貨問題，依設定的服務原則回應退貨政策與審核',
            instructions: '你是專門處理退貨問題的客服助理。\n\n當客戶提出退貨請求時：\n1. 查詢訂單狀態確認購買日期\n2. 確認是否在 30 天退貨期限內\n3. 依據退貨政策給出具體建議\n4. 如有疑問轉接人工客服',
            triggerHint: '退貨、換貨、退款、品質問題',
            capabilities: [
              '訂單狀態查詢',
              '退貨資格判斷',
            ],
            createdAt: '2026-05-10T10:00:00Z',
            createdBy: 'jocelyn.tseng',
            updateNote: '初始版本',
            reviewHistory: [
              { action: 'SUBMITTED', by: 'jocelyn.tseng', time: '2026-05-10T09:00:00Z' },
              { action: 'APPROVED', by: 'jocelyn.tseng', time: '2026-05-10T14:00:00Z' },
            ],
          },
          {
            id: 'v-cs-return-1.1',
            // 審核中，還沒核發版號
            versionName: '超保固彈性處理與VIP優惠',
            status: 'reviewing',
            name: '客服機器人 (退貨版)',
            description: '針對退貨問題，依設定的服務原則回應退貨政策與審核，新增超保固期彈性處理',
            instructions: '你是專門處理退貨問題的客服助理。\n\n當客戶提出退貨請求時：\n1. 查詢訂單狀態確認購買日期\n2. 確認是否在 30 天退貨期限內\n3. 依據退貨政策給出具體建議\n4. 若超過期限但有正當理由，提供「主管特批申請」流程\n5. 如有疑問轉接人工客服\n\n特殊規則：\n- 商品瑕疵不受期限限制，隨時可申請\n- VIP 客戶享有 45 天退貨優惠期',
            triggerHint: '退貨、換貨、退款、品質問題、保固、瑕疵、VIP',
            capabilities: [
              '訂單狀態查詢',
              '退貨資格判斷',
              'VIP優惠識別',
            ],
            createdAt: '2026-06-22T10:00:00Z',
            createdBy: 'jocelyn.tseng',
            updateNote: '新增超保固期彈性處理與 VIP 退貨優惠',
            reviewNote: '請確認新退貨邏輯是否符合公司最新政策，特別是 VIP 45 天退貨期的部分',
            reviewHistory: [
              {
                action: 'SUBMITTED',
                by: 'jocelyn.tseng',
                time: '2026-06-22T10:00:00Z',
                note: '請確認新退貨邏輯是否符合公司最新政策，特別是 VIP 45 天退貨期的部分',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'sys-doc-001',
    name: '文件摘要生成',
    description: '自動摘要長文件，支援 PDF / Word / Markdown',
    functionType: '文字生成',
    type: 'system',
    origin: 'platform_created',
    scope: 'system',
    version: 'Markdown支援與關鍵字提取',
    isEnabled: true,
    usageCount: 0,
    testPassRate: 0.91,
    avgLatencyMs: 450,
    instructions: '你是文件摘要助理，負責解析使用者上傳的長篇文件，提取重點與關鍵字，並依需求輸出條列式、段落式或 JSON 結構化摘要。優先保留原文的關鍵數據與結論，避免遺漏重要決策資訊。',
    files: [
      {
        id: 'sf-sys-doc-001-1',
        fileName: '摘要輸出格式規範.md',
        fileSize: 2048,
        fileType: 'MD',
        uploadedAt: '2026-05-20T02:00:00Z',
      },
    ],
    capabilities: [
      '長文摘要',
      '多格式支援',
      '關鍵字提取',
      '結構化輸出',
    ],
    usageScenarios: [
      { title: '快速吸收長篇報告', description: '主管在會議前 15 分鐘收到 30 頁季報，透過此技能取得結構化重點摘要，準確掌握關鍵數據與決策項目。' },
      { title: '建立知識庫索引', description: '知識管理員上傳大量內部文件，AI 自動提取關鍵字與摘要，作為知識庫搜尋與分類的基礎資料。' },
      { title: '跨文件比對分析', description: '法務或研發人員需要比對多份合約或技術規格，透過摘要快速定位差異點，節省人工逐頁閱讀的時間。' },
    ],
    assignedAgents: ['知識管理助理', '通用助理'],
    testCases: [
      { name: '摘要長報告', input: '請幫我摘要以下季報重點：第三季營收較去年同期成長 12%，主要來自海外市場擴張...' },
      { name: '提取關鍵字', input: '請從這份產品規格文件中提取 5 個最重要的關鍵字。' },
      { name: '結構化輸出', input: '請將這篇文章摘要成 JSON 格式，包含標題、重點列表與結論。' },
    ],
    versions: [
      {
        id: 'v-doc-001-v14',
        versionName: '初始版本',
        status: 'history',
        name: '文件摘要生成',
        description: '自動摘要長文件，支援 PDF / Word',
        instructions: '你是文件摘要助理，負責解析使用者上傳的長篇文件，提取重點並輸出條列式摘要。',
        createdAt: '2026-03-10T09:00:00Z',
        createdBy: '平台團隊',
        updateNote: '初始版本',
      },
      {
        id: 'v-doc-001-v15',
        versionName: 'Markdown支援與關鍵字提取',
        status: 'active',
        name: '文件摘要生成',
        description: '自動摘要長文件，支援 PDF / Word / Markdown',
        instructions: '你是文件摘要助理，負責解析使用者上傳的長篇文件，提取重點與關鍵字，並依需求輸出條列式、段落式或 JSON 結構化摘要。優先保留原文的關鍵數據與結論，避免遺漏重要決策資訊。',
        createdAt: '2026-05-20T09:00:00Z',
        createdBy: '平台團隊',
        updateNote: '新增 Markdown 格式支援與關鍵字提取能力',
      },
    ] satisfies SkillVersion[],
  },
  {
    id: 'sys-meeting-001',
    name: '會議摘要',
    description: '會議錄音轉文字並生成摘要與 action items',
    functionType: '文字生成',
    type: 'system',
    origin: 'platform_created',
    scope: 'system',
    version: 'Action Items自動識別',
    isEnabled: true,
    usageCount: 0,
    testPassRate: 0.88,
    avgLatencyMs: 520,
    instructions: '你是會議記錄助理，負責將會議錄音轉換為逐字稿，並自動生成結構化摘要，包含重點決策與 action items。輸出時明確標示每個待辦事項的負責人與預計完成日期。',
    capabilities: [
      '語音轉文字',
      '摘要生成',
      'ActionItems',
    ],
    usageScenarios: [
      { title: '週會後快速產出記錄', description: 'PM 在週會結束後立即上傳錄音，AI 自動生成摘要與 action items，10 分鐘內發送給所有與會者確認，取代人工手記。' },
      { title: '跨時區異步同步', description: '跨國團隊成員無法參加即時會議，透過 AI 摘要快速掌握決策內容與自己負責的待辦事項，不需觀看完整錄影。' },
      { title: '專案進度追蹤', description: 'PM 將每週站立會議的 action items 彙整到專案管理工具，AI 自動識別責任人與截止日期，減少手動輸入錯誤。' },
    ],
    assignedAgents: ['會議記錄助理', '通用助理'],
    testCases: [
      { name: '提取決策事項', input: '這次週會決定將上線日期延後兩週，並由 PM 負責更新排程，請整理出本次的決策事項。' },
      { name: '整理 Action Items', input: '今天的會議提到 John 要在週五前完成 API 文件，Lisa 負責 QA 測試計畫，請列出 action items。' },
      { name: '生成摘要', input: '請根據以下討論內容生成一份簡短的會議摘要：本次會議討論了新功能的技術方案...' },
    ],
    versions: [
      {
        id: 'v-meeting-001-v21',
        versionName: '初始版本',
        status: 'history',
        name: '會議摘要',
        description: '會議錄音轉文字並生成摘要',
        instructions: '你是會議記錄助理，負責將會議錄音轉換為逐字稿，並生成摘要。',
        createdAt: '2026-04-15T09:00:00Z',
        createdBy: '平台團隊',
        updateNote: '初始版本',
      },
      {
        id: 'v-meeting-001-v22',
        versionName: 'Action Items自動識別',
        status: 'active',
        name: '會議摘要',
        description: '會議錄音轉文字並生成摘要與 action items',
        instructions: '你是會議記錄助理，負責將會議錄音轉換為逐字稿，並自動生成結構化摘要，包含重點決策與 action items。輸出時明確標示每個待辦事項的負責人與預計完成日期。',
        createdAt: '2026-06-05T09:00:00Z',
        createdBy: '平台團隊',
        updateNote: '新增 Action Items 自動識別功能',
      },
    ] satisfies SkillVersion[],
    children: [
      {
        id: 'ext-meeting-eng-001',
        name: '會議摘要 (工程版)',
        description: '工程會議格式，自動標記 action items 至 Jira',
        type: 'extension',
        origin: 'custom_version',
        creationMethod: 'manual',
        scope: 'team',
        teamName: '工程部',
        version: 'Jira自動建票',
        isEnabled: true,
        usageCount: 34,
        testPassRate: 0.85,
        avgLatencyMs: 480,
        forkSourceId: 'sys-meeting-001',
        forkSourceVersion: '初始版本',
        upstreamUpdateStatus: 'update_available' as const,
        instructions: '你是工程團隊的會議記錄助理，負責將站立會議與架構討論的錄音轉換為摘要，並自動將識別出的 action items 建立為 Jira Issue，同時保留技術決策記錄與相關 PR 連結。',
        capabilities: [
          'Jira整合',
          '工程格式輸出',
        ],
        usageScenarios: [
          { title: '站立會議自動建票', description: '每日站立會議結束後，AI 自動識別出的待辦事項直接建立為 Jira Issue 並指派負責人，工程師不用再手動謄寫。' },
          { title: '架構決策留存記錄', description: '架構討論會議結束後，AI 自動整理成 ADR 格式並附上相關 PR 連結，方便日後回溯決策脈絡。' },
        ],
        assignedAgents: ['工程助理'],
        testCases: [
          { name: 'Jira 建票', input: '請將以下 action item 建立 Jira Issue：「後端 API 效能優化，負責人 Kevin，截止日 2024/12/20」' },
          { name: '工程決策記錄', input: '本次架構討論決定採用微服務方案，請整理成 ADR（架構決策記錄）格式。' },
        ],
        versions: [
          {
            id: 'v-meeting-eng-1.2',
            versionName: 'Jira自動建票',
            status: 'active',
            name: '會議摘要 (工程版)',
            description: '工程會議格式，自動標記 action items 至 Jira',
            instructions: '你是工程團隊的會議記錄助理，負責將站立會議與架構討論的錄音轉換為摘要，並自動將識別出的 action items 建立為 Jira Issue，同時保留技術決策記錄與相關 PR 連結。',
            createdAt: '2026-06-01T09:00:00Z',
            createdBy: 'jocelyn.tseng',
            updateNote: '新增 Jira 自動建票功能',
          },
        ] satisfies SkillVersion[],
      },
    ],
  },
  {
    id: 'ext-erp-001',
    name: 'ERP 庫存查詢',
    description: '根據產品 ID 查詢即時庫存量，支援多個倉庫',
    functionType: '資料查詢',
    type: 'extension',
    origin: 'manually_created',
    creationMethod: 'manual',
    scope: 'enterprise',
    version: '多倉庫整合',
    isEnabled: true,
    usageCount: 156,
    testPassRate: 0.99,
    avgLatencyMs: 120,
    instructions: '你是 ERP 庫存查詢助理。\n根據 SKU 查詢各倉庫即時庫存量。\n\n支援功能：\n- 指定倉庫查詢\n- 多倉庫匯總\n- 低於安全存量自動標示',
    triggerHint: '庫存、SKU、倉庫、庫存查詢',
    files: [
      {
        id: 'sf-ext-erp-001-1',
        fileName: '安全存量門檻表.xlsx',
        fileSize: 15360,
        fileType: 'EXCEL',
        uploadedAt: '2026-05-10T02:00:00Z',
      },
    ],
    capabilities: [
      '即時庫存查詢',
      '多倉庫整合',
    ],
    usageScenarios: [
      { title: '客服即時回覆庫存', description: '客服人員在對話中直接查詢指定 SKU 的各倉庫庫存量，不用切換到 ERP 系統畫面，加快客戶回覆速度。' },
      { title: '低庫存自動預警', description: '倉儲管理人員每日巡檢時，AI 自動掃描並列出低於安全存量的品項清單，提前安排補貨作業。' },
    ],
    assignedAgents: ['業務分析助理', '倉儲管理助理'],
    testCases: [
      { name: '單品庫存查詢', input: '查詢 SKU-00123 目前在所有倉庫的庫存數量' },
      { name: '指定倉庫查詢', input: '台北倉現在有多少 SKU-00456 的庫存？' },
      { name: '低庫存警示', input: '哪些產品目前庫存低於安全存量？請列出清單' },
      { name: '多品項查詢', input: '批次查詢以下產品庫存：SKU-00101、SKU-00102、SKU-00103' },
    ],
    versions: [
      {
        id: 'v-erp-1.0',
        versionName: '初始版本',
        status: 'history',
        name: 'ERP 庫存查詢',
        description: '根據產品 ID 查詢即時庫存量',
        instructions: '你是 ERP 庫存查詢助理。\n根據 SKU 查詢即時庫存量並回報。',
        triggerHint: '庫存、SKU、庫存查詢',
        capabilities: [
          '即時庫存查詢',
        ],
        createdAt: '2026-04-01T08:00:00Z',
        createdBy: 'jocelyn.tseng',
        updateNote: '初始版本',
        reviewHistory: [
          { action: 'SUBMITTED', by: 'jocelyn.tseng', time: '2026-04-01T08:00:00Z' },
          { action: 'APPROVED', by: 'jocelyn.tseng', time: '2026-04-01T10:00:00Z' },
        ],
      },
      {
        id: 'v-erp-1.1',
        versionName: '多倉庫整合',
        status: 'active',
        name: 'ERP 庫存查詢',
        description: '根據產品 ID 查詢即時庫存量，支援多個倉庫',
        instructions: '你是 ERP 庫存查詢助理。\n根據 SKU 查詢各倉庫即時庫存量。\n\n支援功能：\n- 指定倉庫查詢\n- 多倉庫匯總\n- 低於安全存量自動標示',
        triggerHint: '庫存、SKU、倉庫、庫存查詢',
        capabilities: [
          '即時庫存查詢',
          '多倉庫整合',
        ],
        createdAt: '2026-05-15T09:00:00Z',
        createdBy: 'jocelyn.tseng',
        updateNote: '新增多倉庫整合功能',
        reviewedBy: 'jocelyn.tseng',
        reviewHistory: [
          { action: 'SUBMITTED', by: 'jocelyn.tseng', time: '2026-05-15T09:00:00Z' },
          { action: 'APPROVED', by: 'jocelyn.tseng', time: '2026-05-15T11:00:00Z' },
        ],
      },
    ],
  },
  {
    id: 'team-weekly-001',
    name: '業績週報生成',
    description: '根據本週銷售數據自動整理業績摘要，含商品排行與目標達成率分析',
    functionType: '分析報表',
    type: 'extension',
    origin: 'manually_created',
    creationMethod: 'manual',
    scope: 'team',
    teamName: '業務部',
    version: '初始版本',
    isEnabled: true,
    usageCount: 28,
    testPassRate: 0.87,
    avgLatencyMs: 410,
    instructions: '你是業務團隊的週報助理。\n\n每週根據提供的銷售數據，自動生成結構化業績週報：\n1. 本週總業績與目標達成率\n2. Top 5 商品銷售排行\n3. 各區域業績比較\n4. 下週改善建議\n\n輸出格式以 Markdown 條列式為主，數字加粗標示。',
    triggerHint: '週報、業績、銷售報告、商品排行、達標率',
    capabilities: [
      '銷售數據分析',
      '商品排行生成',
    ],
    usageScenarios: [
      { title: '週五業績彙整', description: '每週五業務主管發出週報前，AI 自動整理當週數據並產出草稿，主管只需確認並補充備註即可發送。' },
      { title: '即時達標查詢', description: '業務同仁隨時可詢問目前達標進度，AI 即時計算本月目標達成率與缺口分析。' },
    ],
    assignedAgents: ['業務分析助理'],
    testCases: [
      { name: '生成本週週報', input: '請根據本週數據生成業績週報' },
      { name: '查詢達標率', input: '本週業績達標了嗎？與上週比較如何？' },
      { name: '商品排行查詢', input: '請列出本週銷售前五名的商品' },
    ],
    versions: [
      {
        id: 'v-team-weekly-1.0',
        versionName: '初始版本',
        status: 'active',
        name: '業績週報生成',
        description: '根據本週銷售數據自動整理業績摘要，含商品排行與目標達成率分析',
        instructions: '你是業務團隊的週報助理。\n\n每週根據提供的銷售數據，自動生成結構化業績週報：\n1. 本週總業績與目標達成率\n2. Top 5 商品銷售排行\n3. 各區域業績比較\n4. 下週改善建議',
        triggerHint: '週報、業績、銷售報告',
        capabilities: [
          '銷售數據分析',
          '商品排行生成',
        ],
        createdAt: '2026-06-15T09:00:00Z',
        createdBy: 'jocelyn.tseng',
        updateNote: '初始版本',
        reviewedBy: 'jocelyn.tseng',
        reviewHistory: [
          { action: 'SUBMITTED', by: 'jocelyn.tseng', time: '2026-06-15T09:00:00Z' },
          { action: 'APPROVED', by: 'jocelyn.tseng', time: '2026-06-15T14:00:00Z' },
        ],
      },
    ],
  },
  {
    id: 'team-marketing-001',
    name: '行銷文案生成',
    description: '根據活動主題與目標受眾，自動生成社群貼文、EDM 標題與 CTA 文案',
    functionType: '文字生成',
    type: 'extension',
    origin: 'manually_created',
    creationMethod: 'ai_assisted',
    scope: 'team',
    teamName: '行銷部',
    version: 'EDM主旨行與CTA選項',
    isEnabled: true,
    usageCount: 52,
    testPassRate: 0.91,
    avgLatencyMs: 320,
    instructions: '你是行銷文案助理，根據活動主題、目標受眾與品牌調性生成行銷文案。\n\n輸出包含：\n1. 社群貼文（Facebook / Instagram / LinkedIn 各一）\n2. EDM 主旨行（3 個選項）\n3. CTA 按鈕文案（2 個選項）\n\n語調依品牌調性調整，預設為專業但親切。',
    triggerHint: '文案、行銷、貼文、EDM、社群、活動',
    capabilities: [
      '多平台文案生成',
      'CTA最佳化',
    ],
    usageScenarios: [
      { title: '活動上線前趕文案', description: '行銷同仁在活動上線前一天才拿到主題，AI 依目標受眾與品牌調性直接生成三平台貼文與 EDM 標題，省去逐字發想的時間。' },
      { title: 'A/B 測試素材準備', description: '需要同時準備多組 CTA 文案做成效測試，AI 一次生成多個版本供行銷團隊挑選與比較。' },
    ],
    assignedAgents: ['行銷企劃助理'],
    versions: [
      {
        id: 'v-mkt-1.0',
        versionName: '初始版本',
        status: 'history',
        name: '行銷文案生成',
        description: '根據活動主題自動生成社群文案',
        createdAt: '2026-05-01T09:00:00Z',
        createdBy: 'jocelyn.tseng',
        updateNote: '初始版本',
      },
      {
        id: 'v-mkt-1.1',
        versionName: 'EDM主旨行與CTA選項',
        status: 'active',
        name: '行銷文案生成',
        description: '根據活動主題與目標受眾，自動生成社群貼文、EDM 標題與 CTA 文案',
        createdAt: '2026-06-10T09:00:00Z',
        createdBy: 'jocelyn.tseng',
        updateNote: '新增 EDM 主旨行與 CTA 選項輸出',
        reviewedBy: 'jocelyn.tseng',
      },
    ],
  },
]

// confusable：搶觸發反例（競爭技能的關鍵字），答題 Agent 最容易在這裡被搞混
type ScenarioTemplate = Omit<AITestScenario, 'id' | 'status' | 'agentAnswer' | 'agentReasoning'> & { confusable?: boolean }

const MOCK_AI_SCENARIO_TEMPLATES: Record<string, ScenarioTemplate[]> = {
  'sys-cs-001': [
    { tag: 'normal', input: '我的訂單什麼時候會到？訂單號是 #20241201-0023', expectedTrigger: true, expectedBehavior: '屬於客服核心情境：查詢訂單狀態並回覆預計到貨時間，應該觸發。' },
    { tag: 'normal', input: '你們支援哪些付款方式？可以用信用卡分期嗎？', expectedTrigger: true, expectedBehavior: '屬於客服核心情境：列出支援付款方式並說明分期條件，應該觸發。' },
    { tag: 'normal', input: '我想退貨，請問流程是什麼？', expectedTrigger: true, expectedBehavior: '屬於客服核心情境：說明退貨步驟與所需文件，應該觸發。' },
    { tag: 'boundary', input: '你好！', expectedTrigger: false, expectedBehavior: '只是打招呼，沒有具體客服需求，不應該觸發，一般問候即可。' },
    { tag: 'boundary', input: '你這破客服都沒在聽！我等了三天！', expectedTrigger: true, expectedBehavior: '帶有明顯客訴情緒與具體不滿，應該觸發並轉介人工客服。' },
    { tag: 'boundary', input: '幫我查 #99999999，是我朋友的訂單', expectedTrigger: false, expectedBehavior: '查詢的是他人訂單，不符合本人身份查詢的情境，不應該直接觸發，需先引導身份驗證。' },
    { tag: 'trigger_edge', input: '退款 換貨 保固', expectedTrigger: true, expectedBehavior: '雖然只有關鍵字沒有完整句子，但都是客服相關詞彙，應該觸發並引導使用者說明。' },
    { tag: 'trigger_edge', input: 'I want to return my order please', expectedTrigger: true, expectedBehavior: '雖然是英文輸入，仍是明確的退貨需求，應該觸發。' },
  ],
  'ext-cs-return-001': [
    { tag: 'normal', input: '我在 2024/11/15 購買了一件外套，現在可以退貨嗎？', expectedTrigger: true, expectedBehavior: '屬於退貨資格判斷的核心情境，應該觸發並確認是否在 30 天內。' },
    { tag: 'normal', input: '退貨後多久可以收到退款？', expectedTrigger: true, expectedBehavior: '屬於退貨流程的延伸提問，應該觸發並說明退款時程。' },
    { tag: 'boundary', input: '我超過 30 天了，但商品真的有問題，有辦法嗎？', expectedTrigger: true, expectedBehavior: '雖然超過一般期限，仍是瑕疵品退貨的合理延伸情境，應該觸發彈性處理流程。' },
    { tag: 'boundary', input: '我是 VIP 客戶，退貨期限是幾天？', expectedTrigger: true, expectedBehavior: '仍是退貨期限的提問，應該觸發並識別 VIP 身份給出對應天數。' },
    { tag: 'boundary', input: '我想換一台新手機，這台用了半年想換新的可以嗎？', expectedTrigger: false, expectedBehavior: '單純想換新機、非瑕疵或期限內退貨需求，不屬於這顆技能的退貨資格判斷範圍，不應該觸發。' },
    { tag: 'trigger_edge', input: '退貨 換貨 瑕疵 VIP', expectedTrigger: true, expectedBehavior: '關鍵字都指向退貨相關意圖，應該觸發。' },
  ],
  'sys-doc-001': [
    { tag: 'normal', input: '請幫我摘要以下季報重點：第三季營收較去年同期成長 12%...', expectedTrigger: true, expectedBehavior: '屬於文件摘要核心情境，應該觸發並生成結構化重點。' },
    { tag: 'normal', input: '請從這份文件中提取 5 個最重要的關鍵字', expectedTrigger: true, expectedBehavior: '屬於文件摘要的延伸功能，應該觸發並列出核心關鍵字。' },
    { tag: 'normal', input: '請將這篇文章摘要成 JSON 格式，包含標題、重點列表與結論', expectedTrigger: true, expectedBehavior: '仍是摘要需求，只是指定輸出格式，應該觸發。' },
    { tag: 'boundary', input: '這份文件只有一句話，請摘要', expectedTrigger: true, expectedBehavior: '雖然文件很短，仍是合理的摘要請求，應該觸發並給出對應說明。' },
    { tag: 'boundary', input: '這句話文法對不對？可以幫我改嗎？', expectedTrigger: false, expectedBehavior: '是文法校對需求，不是摘要或關鍵字提取，不屬於這顆技能的範圍，不應該觸發。' },
    { tag: 'trigger_edge', input: '摘要 PDF Word Markdown 文件', expectedTrigger: true, expectedBehavior: '關鍵字都指向多格式文件摘要意圖，應該觸發。' },
  ],
  'sys-meeting-001': [
    { tag: 'normal', input: '本次週會決定將上線日期延後兩週，請整理決策事項', expectedTrigger: true, expectedBehavior: '屬於會議決策整理的核心情境，應該觸發並條列決策事項。' },
    { tag: 'normal', input: 'John 要在週五前完成 API 文件，Lisa 負責 QA，請列出 action items', expectedTrigger: true, expectedBehavior: '屬於會議紀錄延伸的 action item 整理，應該觸發。' },
    { tag: 'boundary', input: '今天的會議沒有結論，請摘要', expectedTrigger: true, expectedBehavior: '雖然沒有明確決策，仍是會議摘要的合理情境，應該觸發並說明後續追蹤方式。' },
    { tag: 'boundary', input: '幫我訂明天下午三點跟客戶開會的會議室', expectedTrigger: false, expectedBehavior: '是行事曆／會議室預約需求，不是會議紀錄整理，不屬於這顆技能的範圍，不應該觸發。' },
    { tag: 'trigger_edge', input: '會議 摘要 action items 決策', expectedTrigger: true, expectedBehavior: '關鍵字都指向會議相關意圖，應該觸發。' },
  ],
  'ext-erp-001': [
    { tag: 'normal', input: '查詢 SKU-00123 目前在所有倉庫的庫存數量', expectedTrigger: true, expectedBehavior: '屬於庫存查詢核心情境，應該觸發並呼叫庫存查詢 tool。' },
    { tag: 'normal', input: '台北倉現在有多少 SKU-00456 的庫存？', expectedTrigger: true, expectedBehavior: '屬於指定倉庫的庫存查詢，應該觸發。' },
    { tag: 'normal', input: '哪些產品目前庫存低於安全存量？請列出清單', expectedTrigger: true, expectedBehavior: '屬於庫存查詢的延伸情境，應該觸發並掃描低庫存清單。' },
    { tag: 'boundary', input: '我要查 SKU-99999，但我不確定這個 SKU 存不存在', expectedTrigger: true, expectedBehavior: '仍是庫存查詢請求，應該觸發，查無結果時再提示即可。' },
    { tag: 'boundary', input: '這個 SKU 的建議售價應該訂多少？', expectedTrigger: false, expectedBehavior: '是定價策略問題，不是庫存查詢，不屬於這顆技能的範圍，不應該觸發。' },
    { tag: 'trigger_edge', input: '庫存 SKU 倉庫 查詢', expectedTrigger: true, expectedBehavior: '關鍵字都指向庫存查詢意圖，應該觸發。' },
  ],
}

// 觸發情境是一整句話，簡單切出長度 ≥2 的詞塊當關鍵字──不是真的中文斷詞，
// 只是要湊出幾個看起來像關鍵字的片段，跟 findSimilarSkill() 的 bigram 比對是不同用途
function extractTriggerKeywords(triggerHint: string | undefined): string[] {
  const hint = triggerHint?.trim()
  if (!hint) return []
  return hint
    .replace(/[，。！？、；：,.!?;:「」『』]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2)
    .slice(0, 4)
}

// 跟這顆技能完全無關的關鍵字組合，不然整組題目「永遠選該觸發」就沒有鑑別度。
// 備好 4 組，對應關鍵字很少（正例題目也跟著少）的技能，仍然湊得滿最低題數
const NEGATIVE_KEYWORD_SETS = ['天氣 心情 電影', '旅遊 美食 運動', '股票 房價 利率', '音樂 遊戲 寵物']

// MOCK_AI_SCENARIO_TEMPLATES 只收錄了少數幾顆精心撰寫的系統／企業技能；其餘絕大多數
// 都是使用者自己建立的個人技能，原本落到固定寫死的 DEFAULT_AI_SCENARIOS，裡面「請執行這個
// 技能的主要功能」「今天天氣真好」這類「正常流程」「邊界情況」範例句子其實跟這顆技能的
// 實際內容完全無關，對使用者來說沒有驗證意義——那兩個標籤需要真正理解技能完整語意才寫得出
// 有意義的題目，沒辦法無中生有。只留「觸發邊緣」：用這顆技能自己的覆蓋能力標籤（沒有的話
// 退回觸發情境裡的關鍵字，再沒有就用技能名稱本身）組成片語輸入，測的是「關鍵字夠不夠精準
// 讓它正確判斷要不要觸發」，這點所有技能都適用、也都跟內容本身相關。
// 題數至少 5 題：關鍵字夠多時正例最多到 4 題、反例固定 2 題；關鍵字很少（甚至只有技能名稱
// 這一個）時正例可能只有 1 題，改從反例池多補幾題撐到底線，而不是讓題目少到沒驗證意義
// 只收 name／triggerHint／capabilities／composition 四個欄位：草稿還沒存檔時沒有完整的
// Skill 物件可用，只需要這四個就能組題目關鍵字，不用整顆 Skill
// assignedAgents 只用來決定「答題 Agent 可以選誰」，不參與組題關鍵字
export type TriggerEdgeSource = Pick<Skill, 'name' | 'triggerHint' | 'capabilities' | 'composition' | 'assignedAgents'>

// 積木組裝的技能（有 composition）：「觸發情境」是使用者在「基本設定」步驟手寫、
// 專門描述「什麼時候該觸發」的必填欄位，比覆蓋能力（偏「這顆技能做什麼」而非
// 「什麼時候該用」）更貼近是非題要驗證的東西，優先用它抓關鍵字，沒抓到字才退回
// 覆蓋能力。對話建立的技能沒有這層區分（兩個欄位都是 AI 推導或口語補充的，沒有
// 「哪個更權威」的差異），維持原本「覆蓋能力優先」不變
function keywordPoolFor(source: TriggerEdgeSource | undefined): string[] {
  const name = source?.name?.trim() || '這顆技能'
  const fromTriggerHint = extractTriggerKeywords(source?.triggerHint)
  const fromCapabilities = source?.capabilities ?? []
  const keywords = source?.composition
    ? (fromTriggerHint.length ? fromTriggerHint : fromCapabilities)
    : (fromCapabilities.length ? fromCapabilities : fromTriggerHint)
  return keywords.length ? keywords : [name]
}

// 跟這顆技能「搶觸發」風險最高的候選：先看這顆技能指派給哪些 Agent，再從其他技能裡找出
// 「也指派給至少一個同樣 Agent」的——同一個 Agent 要是能同時調用兩顆內容很像的技能，
// 使用者講一句話時 Agent 该選哪一顆就會卡住。用 bigram 文字重疊比對（跟
// useSkillStudioConversation.ts 的 findSimilarSkill 同一套比對邏輯，這裡不直接 import
// 那邊的函式，避免 store 回頭依賴 composable）在這些候選裡挑重疊分數最高的最多兩顆
function bigramOverlapScore(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0
  const gramsA = new Set<string>()
  for (let i = 0; i < a.length - 1; i++) gramsA.add(a.slice(i, i + 2))
  let score = 0
  for (let i = 0; i < b.length - 1; i++) {
    if (gramsA.has(b.slice(i, i + 2))) score++
  }
  return score
}

function bestTextMatch(haystack: string, candidates: Skill[]): { skill: Skill; score: number } | null {
  let best: { skill: Skill; score: number } | null = null
  for (const s of candidates) {
    const score = bigramOverlapScore(haystack, `${s.name}${s.triggerHint ?? ''}${s.instructions ?? ''}`)
    if (score > 0 && (!best || score > best.score)) best = { skill: s, score }
  }
  return best
}

// 跟這顆技能「搶觸發」風險最高的候選：先看這顆技能指派給哪些 Agent，再從其他技能裡找出
// 「也指派給至少一個同樣 Agent」的——同一個 Agent 要是能同時調用兩顆內容很像的技能，
// 使用者講一句話時 Agent 该選哪一顆就會卡住。用 bigram 文字重疊比對（跟
// useSkillStudioConversation.ts 的 findSimilarSkill 同一套比對邏輯，這裡不直接 import
// 那邊的函式，避免 store 回頭依賴 composable）在這些候選裡挑重疊分數最高的最多兩顆。
//
// 這顆技能自己還沒有指派任何 Agent 時不直接放棄：改用純內容相似度在團隊內找最像的一顆，
// 「索引」回它指派的 Agent 當線索借來用——inferredFrom 記下是借用了哪一顆，讓呼叫端
// 可以在敘事文字裡講清楚這個推測從哪來，不是憑空冒出一群 Agent
//
// answeringAgent：使用者選了哪個 Agent 來答題時，只有「這個 Agent 也能調用」的技能
// 才會跟它搶觸發，候選範圍縮到這一個 Agent
function findCompetingSkills(
  skill: Skill,
  candidates: Skill[],
  answeringAgent?: string,
): { competing: Skill[]; inferredFrom?: Skill } {
  const haystack = `${skill.name}${skill.triggerHint ?? ''}${skill.instructions ?? ''}`
  let agents = new Set(skill.assignedAgents ?? [])
  let inferredFrom: Skill | undefined

  if (agents.size === 0) {
    const best = bestTextMatch(haystack, candidates.filter(s => s.id !== skill.id && (s.assignedAgents ?? []).length > 0))
    if (best) {
      inferredFrom = best.skill
      agents = new Set(best.skill.assignedAgents ?? [])
    }
  }
  if (answeringAgent) agents = new Set([answeringAgent])
  if (agents.size === 0) return { competing: [] }

  const competing = candidates
    .filter(s => s.id !== skill.id && (s.assignedAgents ?? []).some(a => agents.has(a)))
    .map(s => ({ skill: s, score: bigramOverlapScore(haystack, `${s.name}${s.triggerHint ?? ''}${s.instructions ?? ''}`) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(x => x.skill)
  return { competing, inferredFrom }
}

// 生成題目期間給使用者看的敘事文字，讓「生成中」不只是一顆乾乾的轉圈圈——
// 具體講出「正在做什麼」（查 Agent、比對相似技能），每次重新生成都會照當下的
// assignedAgents／搶觸發掃描結果重算一次，不是固定的罐頭句子
function buildGenerationNarration(
  source: TriggerEdgeSource | undefined,
  skill: Skill | undefined,
  competingSkills: Skill[],
  inferredFrom: Skill | undefined,
  answeringAgent: string,
): string[] {
  const name = source?.name?.trim() || '這顆技能'
  const agents = skill?.assignedAgents ?? []
  const lines: string[] = []
  if (agents.length === 0) {
    lines.push(
      inferredFrom
        ? `「${name}」目前還沒有指派 Agent，依技能內容判斷，推測與團隊內的「${inferredFrom.name}」相似，索引回它指派的 Agent：${(inferredFrom.assignedAgents ?? []).join('、')}，抓來作為測試，避免搶著被觸發。`
        : `「${name}」目前還沒有指派 Agent，團隊內也找不到內容相近的技能，先用技能本身的內容出題。`,
    )
  } else {
    lines.push(`正在查看「${name}」可調用的 Agent：${agents.join('、')}。`)
    lines.push(
      competingSkills.length > 0
        ? `發現 ${competingSkills.length} 個同樣被這些 Agent 調用、內容相近的技能：${competingSkills.map(s => s.name).join('、')}，一併納入測試避免搶著被觸發。`
        : '沒有發現其他搶著被觸發的相似技能。',
    )
  }
  lines.push(`由「${answeringAgent}」擔任答題 Agent，逐題判斷該不該觸發這顆技能。`)
  lines.push('正在產生測試情境...')
  return lines
}

// 「觸發邊緣」的反例優先用搶觸發風險最高的競爭技能自己的關鍵字——這比「天氣 心情 電影」
// 這種隨便湊的無關詞更有鑑別度，因為這才是真的可能被搞混、答錯的情境；競爭技能不夠湊滿
// 最低題數時，才用無關關鍵字池補滿
function generateDynamicTriggerEdgeScenarios(
  skill: TriggerEdgeSource | undefined,
  competingSkills: TriggerEdgeSource[] = [],
): ScenarioTemplate[] {
  const MIN_TOTAL = 5
  const name = skill?.name?.trim() || '這顆技能'
  const pool = keywordPoolFor(skill)

  const positives: ScenarioTemplate[] = pool.slice(0, 3).map(kw => ({
    tag: 'trigger_edge',
    input: kw,
    expectedTrigger: true,
    expectedBehavior: `「${kw}」是「${name}」涵蓋的關鍵字，應該觸發。`,
  }))
  // 關鍵字不只一個才疊一句「全部關鍵字湊在一起」的片語輸入；只有一個關鍵字（含退回技能
  // 名稱本身）的話疊出來會是同一個詞重複兩次，沒有意義
  if (pool.length > 1) {
    positives.push({
      tag: 'trigger_edge',
      input: pool.join(' '),
      expectedTrigger: true,
      expectedBehavior: `雖然只有關鍵字沒有完整句子，但都是「${name}」涵蓋的關鍵字，應該觸發。`,
    })
  }

  const negativeCount = Math.max(2, MIN_TOTAL - positives.length)
  const positiveInputs = new Set(positives.map(p => p.input))
  const competingNegatives: ScenarioTemplate[] = competingSkills
    .map(other => {
      const otherName = other.name?.trim() || '另一顆技能'
      const otherKeywords = keywordPoolFor(other).slice(0, 2).join(' ')
      return {
        tag: 'trigger_edge' as const,
        input: otherKeywords,
        expectedTrigger: false,
        expectedBehavior: `這些關鍵字其實是「${otherName}」的，不是「${name}」的——同一個 Agent 也能調用「${otherName}」，不該被「${name}」搶走觸發。`,
        confusable: true,
      }
    })
    // 競爭技能的關鍵字剛好跟這顆技能自己的某個正例一字不差時（例如兩顆技能不小心標了
    // 同一個覆蓋能力標籤），同一句輸入會同時出現在正例跟反例、答案互相矛盾，這題直接丟掉
    .filter(neg => !positiveInputs.has(neg.input))
  const negatives = competingNegatives.length >= negativeCount
    ? competingNegatives.slice(0, negativeCount)
    : [...competingNegatives, ...NEGATIVE_KEYWORD_SETS.slice(0, negativeCount - competingNegatives.length).map(kws => ({
        tag: 'trigger_edge' as const,
        input: kws,
        expectedTrigger: false,
        expectedBehavior: `這些關鍵字跟「${name}」的能力範圍無關，不應該觸發。`,
      }))]

  return [...positives, ...negatives]
}

// 模擬答題 Agent 的作答：大部分照參考答案判斷，但不會每題都對，不然測試永遠 100%
// 沒有意義——搶觸發反例（confusable）是最容易被搞混的情境，第一題固定答錯；其餘依
// Agent 名稱＋題目算一個固定雜湊，大約每 7 題錯 1 題。換一個 Agent 答題結果就會不同，
// 選誰來答題才有差別；同一個 Agent 重新生成同一批題目，答案維持一致
function hashString(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

function simulateAgentAnswers(
  templates: ScenarioTemplate[],
  answeringAgent: string,
  skillName: string,
): Pick<AITestScenario, 'agentAnswer' | 'agentReasoning'>[] {
  const firstConfusable = templates.findIndex(t => t.confusable)
  return templates.map((t, i) => {
    const misjudged = i === firstConfusable || hashString(`${answeringAgent}${t.input}`) % 7 === 0
    if (!misjudged) return { agentAnswer: t.expectedTrigger, agentReasoning: t.expectedBehavior }
    const agentAnswer = !t.expectedTrigger
    return {
      agentAnswer,
      agentReasoning: agentAnswer
        ? `判斷這句話跟「${skillName}」的能力範圍相關，選擇觸發。`
        : `判斷這句話不在「${skillName}」的能力範圍內，選擇不觸發。`,
    }
  })
}

const MOCK_PERSONAL_SKILLS: Skill[] = [
  {
    id: 'personal-001',
    name: '週報自動生成',
    description: '根據本週的會議記錄、任務清單，自動整理生成週報摘要',
    type: 'extension',
    origin: 'manually_created',
    creationMethod: 'ai_assisted',
    zone: 'personal',
    personalStatus: 'available',
    skillName: '會議摘要',
    derivedFrom: 'sys-meeting-001',
    derivedFromVersion: 'Action Items自動識別',
    version: '1.1.0',
    isEnabled: true,
    usageCount: 0,
    testPassRate: 0,
    avgLatencyMs: 0,
    assignedAgents: ['會議記錄助理', '業務分析助理'],
    instructions: '你是一個週報助理，協助使用者根據本週資料自動生成結構化週報。',
    triggerHint: '週報、會議紀錄、任務清單、彙整',
    capabilities: [
      '資料整合',
      '週報格式輸出',
    ],
    usageScenarios: [
      { title: '週五下班前產出草稿', description: '每週五下班前，根據本週會議記錄與任務清單自動整理出週報草稿，使用者只需微調用詞即可送出。' },
    ],
    files: [
      {
        id: 'sf-personal-001-1',
        fileName: '週報範本.docx',
        fileSize: 24576,
        fileType: 'WORD',
        uploadedAt: '2026-07-20T03:00:00Z',
      },
      {
        id: 'sf-personal-001-2',
        fileName: '會議記錄格式規則.md',
        fileSize: 3072,
        fileType: 'MD',
        uploadedAt: '2026-07-20T03:05:00Z',
      },
    ],
  },
  {
    id: 'personal-002',
    name: '客服對話品質評估',
    description: '自動分析客服對話品質，評估回答準確度與客戶滿意度',
    type: 'extension',
    origin: 'manually_created',
    creationMethod: 'ai_assisted',
    zone: 'personal',
    personalStatus: 'reviewing',
    skillName: '通用客服機器人',
    derivedFrom: 'sys-cs-001',
    // 跟 sys-cs-001 目前生效版本（初始客服版）不同名，用來示範「來源
    // Library 技能後來又出新版」的 hasLibraryUpdate 情境
    derivedFromVersion: '初始版本',
    submitMode: 'version_update',
    submitNote: '新增多輪對話品質評估邏輯，支援情緒分析',
    targetScope: 'enterprise',
    submittedBy: '陳雅婷',
    aiAnalysis: [
      '適合用於處理多輪對話的客服場景，尤其涉及退換貨等複雜流程時表現更穩定',
      '支援即時情緒辨識，可協助優先處理高風險或情緒激動的對話',
      '相較現有版本，預估準確率提升 12–15%，誤判率下降約 8%',
    ],
    version: '1.0.0',
    isEnabled: true,
    usageCount: 0,
    testPassRate: 0,
    avgLatencyMs: 0,
    assignedAgents: ['客服中心助理'],
    instructions: '你是客服品質評估助理，分析客服對話品質。',
    capabilities: [
      '多輪對話分析',
      '情緒辨識',
    ],
    usageScenarios: [
      { title: '每日客服品質抽查', description: '主管每日抽查數則客服對話，AI 自動評分並標記需要人工複核的對話。' },
    ],
  },
  {
    id: 'personal-004',
    name: '合約審核摘要',
    description: '自動擷取合約關鍵條款，生成風險摘要與審核建議',
    type: 'extension',
    origin: 'manually_created',
    creationMethod: 'manual',
    zone: 'personal',
    personalStatus: 'reviewing',
    skillName: '合約審核摘要',
    submitMode: 'new_skill',
    submitNote: '支援中英文合約自動摘要，標註高風險條款',
    targetScope: 'team',
    targetTeamName: '法務部',
    submittedBy: '林志明',
    aiAnalysis: [
      '適合法務、採購等需頻繁審閱合約的場景，可大幅縮短人工閱讀時間',
      '對常見條款類型（保密、違約、終止）識別率達 91%',
      '建議後續版本補充對特殊行業合約（金融、醫療）的識別能力',
    ],
    version: '1.0.0',
    isEnabled: false,
    usageCount: 0,
    testPassRate: 0,
    avgLatencyMs: 0,
    assignedAgents: ['知識管理助理'],
    instructions: '你是合約審核助理，負責擷取合約中的關鍵條款並評估潛在法律風險。請以條列方式輸出摘要，並標示高風險條款。',
    capabilities: [
      '關鍵條款擷取',
      '風險等級標示',
    ],
    usageScenarios: [
      { title: '合約初審快速篩查', description: '法務人員收到新合約時，先由 AI 快速標出高風險條款，縮短逐條人工閱讀的時間。' },
    ],
  },
  {
    id: 'personal-005',
    name: '會議記錄自動生成',
    description: '根據會議逐字稿或音訊，自動輸出結構化會議記錄與行動項目',
    type: 'extension',
    origin: 'manually_created',
    creationMethod: 'ai_assisted',
    zone: 'personal',
    personalStatus: 'reviewing',
    skillName: '會議摘要',
    derivedFrom: 'sys-meeting-001',
    derivedFromVersion: 'Action Items自動識別',
    submitMode: 'version_update',
    submitNote: '新增行動項目追蹤欄位，支援多位發言人識別',
    targetScope: 'enterprise',
    submittedBy: '黃思婷',
    aiAnalysis: [
      '多發言人識別功能在 5 人以下會議場景準確率達 95%，可有效減少後製時間',
      '行動項目自動配對負責人，相較舊版減少約 40% 的手動整理工作',
    ],
    version: '2.0.0',
    isEnabled: false,
    usageCount: 0,
    testPassRate: 0,
    avgLatencyMs: 0,
    assignedAgents: ['會議記錄助理'],
    instructions: '你是會議記錄助理，根據逐字稿整理結構化會議記錄，包含主題、決議、行動項目與負責人。',
    capabilities: [
      '多發言人識別',
      '行動項目配對',
    ],
    usageScenarios: [
      { title: '多人會議記錄整理', description: '5 人以下的會議結束後，AI 自動區分發言人並整理成結構化記錄，減少會後手動謄寫的時間。' },
    ],
  },
  {
    id: 'personal-006',
    name: '產品 FAQ 自動回覆',
    description: '根據產品文件與常見問題資料庫，自動回答用戶提問',
    type: 'extension',
    origin: 'manually_created',
    creationMethod: 'manual',
    zone: 'personal',
    personalStatus: 'reviewing',
    skillName: '產品 FAQ 自動回覆',
    submitMode: 'new_skill',
    submitNote: '',
    targetScope: 'team',
    targetTeamName: '客服部',
    submittedBy: '王建豪',
    version: '1.0.0',
    isEnabled: false,
    usageCount: 0,
    testPassRate: 0,
    avgLatencyMs: 0,
    assignedAgents: ['客服中心助理', '電商小幫手'],
    instructions: '你是產品 FAQ 助理，根據內部文件與常見問題資料庫回答用戶問題，無法回答時請引導至人工客服。',
    capabilities: [
      'FAQ比對回覆',
      '無法回答時導流',
    ],
    usageScenarios: [
      { title: '產品頁面即時問答', description: '用戶在產品頁面提出規格或使用方式的問題，AI 直接比對 FAQ 資料庫給出回覆，不用等人工客服上線。' },
    ],
  },
  {
    id: 'personal-003',
    name: 'ERP 報表彙整',
    description: '整合 ERP 系統數據，自動生成週期性報表',
    type: 'extension',
    origin: 'manually_created',
    creationMethod: 'manual',
    zone: 'personal',
    personalStatus: 'has_library',
    skillName: 'ERP 報表彙整',
    targetScope: 'team',
    targetTeamName: '業務部',
    version: '1.0.0',
    isEnabled: false,
    usageCount: 0,
    testPassRate: 0,
    avgLatencyMs: 0,
    assignedAgents: ['業務分析助理', '倉儲管理助理'],
    instructions: '你是 ERP 報表助理，整合多系統數據生成週期性報表。',
    capabilities: [
      '多系統資料彙整',
      '週期性報表產出',
    ],
    usageScenarios: [
      { title: '月底報表自動彙整', description: '每月底自動彙整銷售、庫存、財務等模組數據，產出主管需要的週期性報表初稿。' },
    ],
  },
  {
    // 用「AI 賦能」(SkillStudio) 的「用行銷積木組裝」方式建立——composition
    // 記錄選了哪些章節積木，instructions/triggerHint/capabilities 都是
    // deriveFromSections() 依選中的章節依序組出來的內容，格式要跟那份邏輯一致
    id: 'personal-007',
    name: '行銷週報快篩',
    description: '結合會員輪廓、促銷成效與渠道貢獻，一鍵產出行銷週報三大重點章節',
    type: 'extension',
    origin: 'manually_created',
    creationMethod: 'manual',
    zone: 'personal',
    personalStatus: 'available',
    skillName: '行銷週報快篩',
    version: '初始版本',
    isEnabled: true,
    usageCount: 0,
    testPassRate: 0,
    avgLatencyMs: 0,
    instructions: '依序產出以下章節：\n1. 會員人物誌：性別 × 年齡層 × 主力購買品類 × RFM 行為分群的四維輪廓。\n2. 活動排行：各促銷活動帶動效果排行，並自動生成圖表。\n3. 渠道別流量與收益貢獻：各渠道流量佔比與收益貢獻對照，圖表自動生成。',
    triggerHint: '當使用者要求產出行銷報告，或提到「TA 用戶畫像、行銷活動成效、渠道績效」相關分析時',
    assignedAgents: ['業務分析助理'],
    capabilities: [
      '會員人物誌',
      '活動排行',
      '渠道別流量與收益貢獻',
    ],
    files: [],
    composition: { sectionIds: ['ta_persona', 'promo_ranking', 'ch_traffic'] },
  },
  {
    // 專門示範用：從沒測試過（aiTestPassRate 未設定）、personalStatus 'available'
    // 所以「啟用技能」按鈕看得到，一點就會觸發 SkillEnableFlow 的「還不能啟用」
    // 閘門對話框——demo 時不用先去找哪顆技能符合條件
    id: 'personal-008',
    name: '待測試新流程示範（demo）',
    description: '示範項目：尚未通過 AI 快速測試，點「啟用技能」會先看到測試閘門對話框',
    type: 'extension',
    origin: 'manually_created',
    creationMethod: 'manual',
    zone: 'personal',
    personalStatus: 'available',
    skillName: '待測試新流程示範（demo）',
    version: '1.0.0',
    isEnabled: false,
    usageCount: 0,
    testPassRate: 0,
    avgLatencyMs: 0,
    // 這裡的文字內容故意避開跟其他關卡測試共用的詞彙（例如「技能」「修改」）——
    // routeIntent 的 findSimilarSkill 是全域 bigram 比對沒有門檻，一有共同的
    // 兩字重疊就可能被誤判成「找到相近技能」，見 useSkillStudioConversation.ts
    instructions: '這是示範用的一顆項目，內容可以隨時調整，主要用來展示啟用前的測試流程。',
    triggerHint: '示範用途，沒有特定觸發情境',
    assignedAgents: ['通用助理'],
    capabilities: [
      '示範能力',
    ],
  },
]

const MOCK_DRAFTS: DraftSkill[] = [
  {
    id: 'draft-001',
    name: '週報自動生成',
    description: '根據本週的會議記錄、任務清單、郵件往來，自動整理生成週報摘要',
    instructions: '你是一個週報助理，協助使用者根據本週資料自動生成結構化週報...',
    type: 'extension',
    forkSourceId: 'sys-meeting-001',
    createdAt: '2026-06-20T09:00:00Z',
    updatedAt: '2026-06-27T14:30:00Z',
  },
  {
    id: 'draft-002',
    name: '客服對話品質評估',
    description: '自動分析客服對話品質，評估回答準確度與客戶滿意度',
    instructions: '',
    type: 'extension',
    forkSourceId: 'sys-cs-001',
    createdAt: '2026-06-25T11:00:00Z',
    updatedAt: '2026-06-28T09:15:00Z',
  },
  {
    id: 'draft-003',
    name: '',
    description: '',
    instructions: '',
    type: 'extension',
    createdAt: '2026-06-29T10:00:00Z',
    updatedAt: '2026-06-29T10:00:00Z',
  },
]

// 這一版有沒有「測過」：交過卷就算，不看對錯。後端技能看後端記的記號；
// 假資料的技能看有沒有做完一輪 AI 快速測試（aiTestPassRate 有值）
export function isSkillTested(skill: Skill): boolean {
  if (skill.backendVersion) return skill.backendVersion.tested
  return skill.aiTestPassRate != null
}

// 個人技能是否可以啟用：只看這一版測過沒有，不要求全對（ADR 0014）。
// Library／系統技能（zone 不是 'personal'）不受這條規則限制，一律視為可以啟用。
export function canEnableSkill(skill: Skill): boolean {
  if (skill.zone !== 'personal') return true
  return isSkillTested(skill)
}

// 啟用前的檢查沒過時，決策對話框要顯示的說明文字
export function describeAiTestGateReason(): string {
  return '這顆技能這一版還沒測過。請先做一次 AI 快速測試，交卷就算測過，不用全部答對。'
}

export const useSkillStore = defineStore('skillStore', () => {
  const skills = ref<Skill[]>(JSON.parse(JSON.stringify(MOCK_SKILLS)))
  const myDrafts = ref<DraftSkill[]>(JSON.parse(JSON.stringify(MOCK_DRAFTS)))
  const myPersonalSkillsRef = ref<Skill[]>(JSON.parse(JSON.stringify(MOCK_PERSONAL_SKILLS)))

  const myPersonalSkills = computed<Skill[]>(() =>
    myPersonalSkillsRef.value
      .filter(s => !s.deletedAt)
      .map(s => {
        const librarySource = flatSkills.value.find(p => p.id === s.derivedFrom)
        return {
          ...s,
          hasLibraryUpdate: !!(
            librarySource &&
            s.derivedFromVersion &&
            librarySource.version !== s.derivedFromVersion
          ),
        }
      })
  )

  const selectedSkillId = ref<string | null>(null)
  const selectedVersionName = ref<string | null>(null)
  const testConversationHistory = ref<ChatMessage[]>([])
  const testIsRunning = ref(false)
  const aiTestScenarios = ref<AITestScenario[]>([])
  const aiTestReport = ref<AITestReport | null>(null)
  const aiTestScenariosSkillId = ref<string | null>(null)
  // 產生題目當下用來組關鍵字的 name／triggerHint／capabilities 快照（JSON 字串）：
  // 跟「目前的草稿內容」比對，用來判斷題目是不是已經跟不上最新的編輯內容，
  // 跟存不存檔無關——草稿還沒存檔也一樣可能需要提醒「重新生成」
  const aiTestScenariosSnapshot = ref<string | null>(null)
  const aiTestIsGenerating = ref(false)
  // 生成題目期間給使用者看的敘事文字（掃可調用 Agent／找搶觸發的相似技能／出題），
  // 讓「生成中」不只是一顆乾乾的轉圈圈——每次 generateAITestScenarios() 都會重算
  const aiTestGenerationNarration = ref<string[]>([])
  // 這一批題目是由哪個 Agent 作答（使用者生成前選的）；重新測試沒有另外指定時沿用
  const aiTestAnsweringAgent = ref<string | null>(null)

  const flatSkills = computed<Skill[]>(() => {
    const result: Skill[] = []
    for (const s of skills.value) {
      if (s.deletedAt) continue
      result.push(s)
      if (s.children) result.push(...s.children.filter(c => !c.deletedAt))
    }
    return result
  })

  const deletedSkills = computed<Skill[]>(() => {
    const result: Skill[] = []
    for (const s of skills.value) {
      if (s.deletedAt) result.push(s)
      if (s.children) result.push(...s.children.filter(c => !!c.deletedAt))
    }
    return result.sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''))
  })

  const enabledCount = computed(() => flatSkills.value.filter(s => s.isEnabled).length)
  const enterpriseExtensionCount = computed(() =>
    flatSkills.value.filter(s => s.type === 'extension' && s.scope === 'enterprise').length
  )
  const teamExtensionCount = computed(() =>
    flatSkills.value.filter(s => s.type === 'extension' && s.scope === 'team').length
  )
  const totalUsageCount = computed(() => flatSkills.value.reduce((sum, s) => sum + s.usageCount, 0))

  const avgTestPassRate = computed(() => {
    const enabled = flatSkills.value.filter(s => s.isEnabled && !s.deletedAt)
    if (!enabled.length) return 0
    const avg = enabled.reduce((sum, s) => sum + s.testPassRate, 0) / enabled.length
    return Math.round(avg * 100)
  })

  const reviewingSkillIds = computed<Set<string>>(() => {
    const ids = new Set<string>()
    for (const s of flatSkills.value) {
      if (s.versions?.some(v => v.status === 'reviewing')) ids.add(s.id)
    }
    return ids
  })

  const upstreamUpdateSkillIds = computed<Set<string>>(() => {
    const ids = new Set<string>()
    for (const s of flatSkills.value) {
      if (!s.forkSourceId || !s.forkSourceVersion) continue
      if (s.upstreamUpdateStatus === 'ignored') continue
      const source = skills.value.find(p => p.id === s.forkSourceId)
      if (source && source.version !== s.forkSourceVersion) ids.add(s.id)
    }
    return ids
  })

  const pendingUpdateCount = computed(() => upstreamUpdateSkillIds.value.size)
  const pendingUpdateSkills = computed<Skill[]>(() =>
    flatSkills.value.filter(s => upstreamUpdateSkillIds.value.has(s.id))
  )

  const testRunHistory = ref<TestRun[]>([])

  function findSkill(id: string): Skill | undefined {
    const library = flatSkills.value.find(s => s.id === id)
    if (library) return library
    const personal = myPersonalSkillsRef.value.find(s => s.id === id)
    if (personal) return personal
    // draft fallback（保留至草稿清理任務）
    const draft = myDrafts.value.find(d => d.id === id)
    if (!draft) return undefined
    return {
      id: draft.id,
      name: draft.name || '未命名草稿',
      description: draft.description,
      type: draft.type,
      origin: 'manually_created',
      version: '草稿',
      isEnabled: false,
      usageCount: 0,
      testPassRate: 0,
      avgLatencyMs: 0,
      instructions: draft.instructions,
      triggerHint: draft.triggerHint,
      assignedAgents: draft.assignedAgents,
      forkSourceId: draft.forkSourceId,
    }
  }

  function getSkillVersions(skillId: string): SkillVersion[] {
    const skill = _findAny(skillId)
    return skill?.versions ?? []
  }

  function getReviewingVersion(skillId: string): SkillVersion | undefined {
    return getSkillVersions(skillId).find(v => v.status === 'reviewing')
  }

  function getVersionOptions(skillId: string): { versionName: string; isActive: boolean }[] {
    const skill = findSkill(skillId)
    if (!skill) return []
    if (skill.versions?.length) {
      // 版本不用版號區隔，每個版本一律有名稱（含審核中／已退回），都可以拿來測試
      return skill.versions.map(v => ({ versionName: v.versionName, isActive: v.status === 'active' }))
    }
    return [{ versionName: skill.version, isActive: true }]
  }

  function getDefaultVersionName(skillId: string): string | null {
    const options = getVersionOptions(skillId)
    if (!options.length) return null
    return options.find(v => v.isActive)?.versionName ?? options[0].versionName
  }

  function toggleSkill(id: string): void {
    const skill = findSkill(id)
    if (skill) {
      skill.isEnabled = !skill.isEnabled
      skill.auditLog ??= []
      skill.auditLog.unshift({
        action: skill.isEnabled ? 'ENABLED' : 'DISABLED',
        by: '管理員',
        time: new Date().toISOString(),
      })
      if (skill.auditLog.length > 20) skill.auditLog.length = 20
    }
  }

  function assignSkillToAgent(skillId: string, agentName: string): void {
    const skill = findSkill(skillId)
    if (!skill) return
    skill.assignedAgents ??= []
    if (!skill.assignedAgents.includes(agentName)) {
      skill.assignedAgents.push(agentName)
    }
  }

  // 整份取代 assignedAgents（區別於 assignSkillToAgent 只能單筆新增）：
  // 啟用技能時的「確認可用 Agent」步驟用這個，使用者可能同時勾選、取消勾選多個
  function setAssignedAgents(skillId: string, agents: string[]): void {
    const skill = findSkill(skillId)
    if (!skill) return
    skill.assignedAgents = [...agents]
  }

  function deleteSkill(id: string): void {
    const skill = findSkill(id)
    if (skill) skill.deletedAt = new Date().toISOString()
  }

  function restoreSkill(id: string): void {
    const skill = _findAny(id)
    if (skill) delete skill.deletedAt
  }

  function permanentlyDeleteSkill(id: string): void {
    const topIdx = skills.value.findIndex(s => s.id === id)
    if (topIdx !== -1) { skills.value.splice(topIdx, 1); return }
    for (const parent of skills.value) {
      if (!parent.children) continue
      const childIdx = parent.children.findIndex(c => c.id === id)
      if (childIdx !== -1) { parent.children.splice(childIdx, 1); return }
    }
  }

  function _findAny(id: string): Skill | undefined {
    for (const s of skills.value) {
      if (s.id === id) return s
      if (s.children) {
        const c = s.children.find(c => c.id === id)
        if (c) return c
      }
    }
  }

  let personalSeq = 0

  // 手寫建立技能的正式入口（SkillEditor.vue 的「全新建立」）：一律先建立成個人技能，
  // 不需要送審就能個人使用，跟 duplicateAsPersonalSkill() 同一套「寫進
  // myPersonalSkillsRef」模式，只是沒有 derivedFrom（沒有來源可比對，personalStatus
  // 直接是 available，不是 draft）。createSkill() 保留給送審通過、正式發佈進 Library
  // 用（submitDraft()），不再由這裡呼叫。
  //
  // isEnabled 不採用 data.isEnabled：個人技能建立時一律未啟用、未測試，要先通過
  // 這一版測過（交卷即可，不用全對）才能開，見 canEnableSkill()。
  function createPersonalSkill(data: CreateSkillPayload): string {
    const id = `personal-${Date.now()}-${++personalSeq}`
    myPersonalSkillsRef.value.unshift({
      id,
      name: data.name,
      description: data.description ?? '',
      type: 'extension',
      origin: 'manually_created',
      creationMethod: data.creationMethod ?? 'manual',
      zone: 'personal',
      personalStatus: 'available',
      skillName: data.name,
      version: '初始版本',
      isEnabled: false,
      aiTestPassRate: null,
      usageCount: 0,
      testPassRate: 0,
      avgLatencyMs: 0,
      instructions: data.instructions,
      triggerHint: data.triggerHint,
      assignedAgents: data.assignedAgents,
      files: data.files ?? [],
      capabilities: data.capabilities ?? [],
      keywords: data.keywords ?? [],
      composition: data.composition ? { sectionIds: [...data.composition.sectionIds] } : undefined,
    })
    return id
  }

  // AI 賦能（SkillStudio）修改模式的儲存：只對個人技能生效。draft 複本內容一旦跟
  // 來源不同就轉 available。skillName 只在非衍生技能同步——衍生技能的 skillName
  // 記的是 Library 來源名稱，不能被改名蓋掉
  function applyStudioPatch(skillId: string, patch: StudioPatch): boolean {
    const skill = findSkill(skillId)
    if (!skill || skill.zone !== 'personal') return false
    if (patch.name !== undefined) {
      skill.name = patch.name
      if (!skill.derivedFrom) skill.skillName = patch.name
    }
    if (patch.description !== undefined) skill.description = patch.description
    if (patch.instructions !== undefined) skill.instructions = patch.instructions
    if (patch.triggerHint !== undefined) skill.triggerHint = patch.triggerHint
    if (patch.capabilities !== undefined) skill.capabilities = [...patch.capabilities]
    if (patch.assignedAgents !== undefined) skill.assignedAgents = [...patch.assignedAgents]
    if (patch.keywords !== undefined) skill.keywords = [...patch.keywords]
    if (patch.composition !== undefined) skill.composition = patch.composition ? { sectionIds: [...patch.composition.sectionIds] } : undefined
    if (
      skill.personalStatus === 'draft' &&
      skill.instructions !== findSkill(skill.derivedFrom ?? '')?.instructions
    ) {
      skill.personalStatus = 'available'
    }
    return true
  }

  function createSkill(data: CreateSkillPayload): void {
    skills.value.push({
      id: `ext-custom-${skills.value.length + 1}`,
      name: data.name,
      description: data.description ?? '',
      instructions: data.instructions,
      triggerHint: data.triggerHint,
      assignedAgents: data.assignedAgents,
      type: 'extension',
      origin: 'manually_created',
      scope: data.scope ?? 'enterprise',
      version: '初始版本',
      isEnabled: data.isEnabled ?? true,
      usageCount: 0,
      testPassRate: 0,
      avgLatencyMs: 0,
      files: data.files ?? [],
      capabilities: data.capabilities ?? [],
    })
  }

  function updateSkill(id: string, data: UpdateSkillPayload): void {
    const skill = findSkill(id)
    if (!skill) return
    skill.name = data.name
    if (data.description !== undefined) skill.description = data.description
    skill.instructions = data.instructions
    skill.triggerHint = data.triggerHint
    skill.isEnabled = data.isEnabled
    skill.assignedAgents = data.assignedAgents
    skill.files = data.files ?? []
    skill.capabilities = data.capabilities ?? []
    skill.keywords = data.keywords ?? []
    if (skill.personalStatus === 'draft' && skill.instructions !== findSkill(skill.derivedFrom ?? '')?.instructions) {
      skill.personalStatus = 'available'
    }
  }

  function filesEqual(a: SkillFile[], b: SkillFile[]): boolean {
    const key = (f: SkillFile) => `${f.fileName}::${f.fileSize}`
    const setA = new Set(a.map(key))
    const setB = new Set(b.map(key))
    if (setA.size !== setB.size) return false
    return [...setA].every(k => setB.has(k))
  }

  function updateSkillFiles(skillId: string, files: SkillFile[]): void {
    const skill = findSkill(skillId)
    if (!skill) return
    const previousFiles = skill.files ?? []
    skill.files = [...files]
    if (
      skill.personalStatus === 'draft' &&
      !filesEqual(files, previousFiles) &&
      !filesEqual(files, findSkill(skill.derivedFrom ?? '')?.files ?? [])
    ) {
      skill.personalStatus = 'available'
    }
  }

  function submitSkillForReview(skillId: string, versionId: string, note: string): void {
    const skill = _findAny(skillId)
    const version = skill?.versions?.find(v => v.id === versionId)
    if (!version) return
    version.status = 'reviewing'
    version.reviewNote = note
    if (!version.reviewHistory) version.reviewHistory = []
    version.reviewHistory.push({ action: 'SUBMITTED', by: 'jocelyn.tseng', time: new Date().toISOString(), note })
  }

  function getUpstreamVersion(skillId: string): string | undefined {
    const skill = _findAny(skillId)
    if (!skill?.forkSourceId) return undefined
    const source = skills.value.find(s => s.id === skill.forkSourceId)
    if (!source || source.version === skill.forkSourceVersion) return undefined
    return source.version
  }

  function acceptUpstreamUpdate(skillId: string): void {
    const skill = _findAny(skillId)
    if (!skill?.forkSourceId) return
    const source = skills.value.find(s => s.id === skill.forkSourceId)
    if (source) skill.forkSourceVersion = source.version
  }

  function detachFromUpstream(skillId: string): void {
    const skill = _findAny(skillId)
    if (!skill) return
    delete skill.forkSourceId
    delete skill.forkSourceVersion
    skill.upstreamUpdateStatus = 'ignored'
    skill.auditLog ??= []
    skill.auditLog.unshift({ action: 'UPSTREAM_DETACHED', by: '管理員', time: new Date().toISOString() })
  }

  const detachUpstream = detachFromUpstream

  function mergeUpstreamUpdate(id: string, _resolutions?: ConflictResolution[]): void {
    // _resolutions: in production, field-level choices would be applied here;
    // the mock simply clears conflicts and bumps forkSourceVersion regardless of choice.
    const skill = findSkill(id)
    if (!skill) return
    if (skill.forkSourceId) {
      const source = skills.value.find(s => s.id === skill.forkSourceId)
      if (source) skill.forkSourceVersion = source.version
    }
    skill.upstreamUpdateStatus = 'up_to_date'
    skill.upstreamConflicts = undefined
    skill.auditLog ??= []
    skill.auditLog.unshift({ action: 'UPSTREAM_MERGED', by: '管理員', time: new Date().toISOString() })
  }

  function ignoreUpstreamUpdate(id: string): void {
    const skill = findSkill(id)
    if (!skill) return
    skill.upstreamUpdateStatus = 'ignored'
    skill.auditLog ??= []
    skill.auditLog.unshift({ action: 'UPSTREAM_IGNORED', by: '管理員', time: new Date().toISOString() })
  }

  function approveSkillVersion(skillId: string, versionId: string): void {
    const skill = _findAny(skillId)
    if (!skill?.versions) return
    const version = skill.versions.find(v => v.id === versionId)
    if (!version || version.status !== 'reviewing') return

    // 審核通過只是狀態轉為「待啟用」，不會自動取代現有生效版本；要實際
    // 上線，管理者還要在版本歷史手動按「設為使用中」（setLibraryActiveVersion）
    version.status = 'approved'
    version.reviewedBy = 'jocelyn.tseng'
    version.reviewedAt = new Date().toISOString()
    if (!version.reviewHistory) version.reviewHistory = []
    version.reviewHistory.push({ action: 'APPROVED', by: 'jocelyn.tseng', time: new Date().toISOString() })
  }

  function rejectSkillVersion(skillId: string, versionId: string, feedback: string): void {
    const skill = _findAny(skillId)
    const version = skill?.versions?.find(v => v.id === versionId)
    if (!version || version.status !== 'reviewing') return
    version.status = 'rejected'
    version.reviewFeedback = feedback
    version.reviewedBy = 'jocelyn.tseng'
    version.reviewedAt = new Date().toISOString()
    if (!version.reviewHistory) version.reviewHistory = []
    version.reviewHistory.push({ action: 'REJECTED', by: 'jocelyn.tseng', time: new Date().toISOString(), note: feedback })
  }

  function createDraft(): DraftSkill {
    const draft: DraftSkill = {
      id: `draft-${Date.now()}`,
      name: '',
      description: '',
      instructions: '',
      type: 'extension',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    myDrafts.value.unshift(draft)
    return draft
  }

  function saveDraft(id: string, data: Partial<Pick<DraftSkill, 'name' | 'description' | 'instructions' | 'type' | 'forkSourceId'>>): void {
    const draft = myDrafts.value.find(d => d.id === id)
    if (!draft) return
    Object.assign(draft, data)
    draft.updatedAt = new Date().toISOString()
  }

  function updateDraft(id: string, patch: Partial<DraftSkill>): void {
    const draft = myDrafts.value.find(d => d.id === id)
    if (!draft) return
    Object.assign(draft, patch)
    draft.updatedAt = new Date().toISOString()
  }

  function deleteDraft(id: string): void {
    myDrafts.value = myDrafts.value.filter(d => d.id !== id)
  }

  function hasPendingReview(skill: Skill): boolean {
    return skill.personalStatus === 'reviewing'
  }

  function submitPersonalSkill(
    id: string,
    mode: 'new_skill' | 'version_update',
    note: string,
    versionName: string,
    targetScope: 'enterprise' | 'team' = 'enterprise',
    targetTeamName?: string
  ): void {
    const skill = myPersonalSkillsRef.value.find(s => s.id === id)
    if (!skill) return
    skill.personalStatus = 'reviewing'
    skill.submitNote = note
    skill.submitMode = mode
    skill.targetScope = targetScope
    skill.targetTeamName = targetScope === 'team' ? targetTeamName : undefined
    skill.submittedBy = 'jocelyn.tseng'

    // 更新版本模式：在來源 Library 技能的版本歷史新增一筆「審核中」版本，
    // 內容是這顆個人技能目前的快照。「建立新技能」模式的技能還不存在於
    // Library，沒有版本歷史可以掛
    if (mode === 'version_update' && skill.derivedFrom) {
      const target = _findAny(skill.derivedFrom)
      if (target) {
        target.versions ??= []
        const now = new Date().toISOString()
        // versions[] 是按時間由舊到新存放（SkillDetailDrawer 顯示時會 reverse
        // 成新到舊），新版本要 push 到最後面，不能 unshift 到最前面
        target.versions.push({
          id: `v-${id}-${Date.now()}`,
          versionName,
          status: 'reviewing',
          name: skill.name,
          description: skill.description,
          instructions: skill.instructions,
          triggerHint: skill.triggerHint,
          capabilities: skill.capabilities,
          createdAt: now,
          createdBy: skill.submittedBy,
          updateNote: note,
          reviewHistory: [{ action: 'SUBMITTED', by: skill.submittedBy!, time: now, note }],
        })
      }
    }
  }

  function setLibraryActiveVersion(skillId: string, versionId: string): void {
    let target: Skill | undefined
    for (const s of skills.value) {
      if (s.id === skillId) { target = s; break }
      if (s.children) {
        const child = s.children.find(c => c.id === skillId)
        if (child) { target = child; break }
      }
    }
    if (!target?.versions) return
    const ver = target.versions.find(v => v.id === versionId)
    if (!ver) return
    target.versions.forEach(v => {
      if (v.id === versionId) v.status = 'active'
      else if (v.status === 'active') v.status = 'history'
    })
    // 不管是從「待啟用」第一次上線，還是從「歷史」回滾，這裡才是真正
    // 讓技能內容生效的地方（審核通過那一步不會動到這些欄位）
    target.version = ver.versionName
    target.name = ver.name
    target.description = ver.description
    if (ver.instructions !== undefined) target.instructions = ver.instructions
    if (ver.triggerHint !== undefined) target.triggerHint = ver.triggerHint
    if (ver.capabilities !== undefined) target.capabilities = ver.capabilities

    target.auditLog ??= []
    target.auditLog.unshift({
      action: 'VERSION_ACTIVATED',
      by: '管理員',
      time: new Date().toISOString(),
      detail: ver.versionName,
    })
    if (target.auditLog.length > 20) target.auditLog.length = 20
  }

  function deletePersonalSkill(id: string): void {
    const idx = myPersonalSkillsRef.value.findIndex(s => s.id === id)
    if (idx !== -1) myPersonalSkillsRef.value.splice(idx, 1)
  }

  // 版本會隨時間越積越多，管理者可以清掉不需要的舊版本；生效中的版本
  // 不能刪，要刪之前得先用 setLibraryActiveVersion 切換到別的版本
  function deleteSkillVersion(skillId: string, versionId: string): void {
    const skill = _findAny(skillId)
    if (!skill?.versions) return
    const version = skill.versions.find(v => v.id === versionId)
    if (!version || version.status === 'active') return
    skill.versions = skill.versions.filter(v => v.id !== versionId)
  }

  function duplicateAsPersonalSkill(sourceId: string, nameOverride?: string): Skill {
    const source = findSkill(sourceId)
    if (!source) throw new Error(`duplicateAsPersonalSkill: source not found (${sourceId})`)
    const copy: Skill = {
      id: `personal-${Date.now()}`,
      name: nameOverride?.trim() || source.name,
      description: source.description,
      type: source.type,
      origin: 'manually_created',
      creationMethod: source.creationMethod,
      zone: 'personal',
      personalStatus: 'draft',
      skillName: source.zone === 'personal' ? source.skillName : source.name,
      derivedFrom: sourceId,
      derivedFromVersion: source.version,
      version: source.version,
      isEnabled: false,
      usageCount: 0,
      testPassRate: 0,
      avgLatencyMs: 0,
      instructions: source.instructions,
      triggerHint: source.triggerHint,
      capabilities: source.capabilities ? [...source.capabilities] : undefined,
      // 來源若是用行銷積木組裝出來的技能，複本要保留 composition——否則複本重開時
      // 會被 draftFromSkill() 誤判成對話建立，只給對話編輯介面，跟來源的建立方式不一致
      composition: source.composition ? { sectionIds: [...source.composition.sectionIds] } : undefined,
    }
    myPersonalSkillsRef.value.unshift(copy)
    return copy
  }

  function hasSkillNameConflict(skillId: string): boolean {
    const skill = myPersonalSkillsRef.value.find(s => s.id === skillId)
    if (!skill) return false
    return myPersonalSkillsRef.value.some(
      s => s.id !== skillId && !s.deletedAt && s.skillName === skill.skillName
    )
  }

  // 複製前的名稱衝突檢查——用來源技能推算出「複製後會得到的 skillName」，
  // 在還沒真正建立副本、副本也還沒出現在列表前，就先讓使用者知道要不要改名。
  function wouldSkillNameConflict(sourceId: string): boolean {
    const source = findSkill(sourceId)
    if (!source) return false
    const proposedSkillName = source.zone === 'personal' ? source.skillName : source.name
    if (!proposedSkillName) return false
    return myPersonalSkillsRef.value.some(
      s => s.id !== sourceId && !s.deletedAt && s.skillName === proposedSkillName,
    )
  }

  function approvePersonalSkill(id: string): void {
    const skill = myPersonalSkillsRef.value.find(s => s.id === id)
    if (!skill || skill.personalStatus !== 'reviewing') return
    skill.personalStatus = 'has_library'
    skill.reviewedBy = 'jocelyn.tseng'
    skill.reviewedAt = new Date().toISOString()
  }

  function rejectPersonalSkill(id: string, feedback: string): void {
    const skill = myPersonalSkillsRef.value.find(s => s.id === id)
    if (!skill || skill.personalStatus !== 'reviewing') return
    skill.personalStatus = 'available'
    skill.reviewedBy = 'jocelyn.tseng'
    skill.reviewedAt = new Date().toISOString()
    skill.reviewFeedback = feedback
  }

  const pendingReviewSkills = computed<Skill[]>(() =>
    myPersonalSkillsRef.value.filter(s => !s.deletedAt && hasPendingReview(s))
  )

  // 預設放幾筆假資料，畫面上才看得到「AI 建議建立的技能」在有複數筆待處理時
  // 長什麼樣子（佇列摘要列收合、展開後內部捲動）——只放一筆的話，永遠測不到
  // 多筆情境。真正的建議（conv4 demo 觸發的 useSkillSuggestion().offer()）
  // id 不同，不會跟這幾筆互相 dedupe 掉，可以同時存在
  const MOCK_SUGGESTIONS: SkillSuggestionEntry[] = [
    {
      id: 'demo-weekly-report-digest',
      name: '週報摘要整理',
      description: '整理本週對話中的重點需求，套用固定格式產出週報摘要',
      triggerHint: '偵測到「彙整本週重點＋套用週報格式」類型的整理需求',
      steps: ['彙整本週對話重點', '套用週報格式產出摘要'],
      reason: '示範用資料，方便直接看到「AI 建議建立的技能」的樣子',
      conversationId: 'demo',
    },
    {
      id: 'demo-complaint-triage',
      name: '客訴分類彙整',
      description: '將客服對話中的客訴內容自動分類，彙整成週期性報表',
      triggerHint: '偵測到「客服對話標記＋客訴週報彙整」類型的整理需求',
      steps: ['標記對話中的客訴類別', '彙整成客訴分類週報'],
      reason: '示範用資料，方便直接看到複數建議同時存在的樣子',
      conversationId: 'demo',
    },
    {
      id: 'demo-inventory-alert',
      name: '庫存異常示警',
      description: '偵測庫存數量低於安全水位時，自動整理成示警清單',
      triggerHint: '偵測到「庫存低於安全水位＋自動示警」類型的整理需求',
      steps: ['查詢各品項庫存數量', '篩選低於安全水位的品項並示警'],
      reason: '示範用資料，方便直接看到複數建議同時存在的樣子',
      conversationId: 'demo',
    },
    {
      id: 'demo-meeting-action-items',
      name: '會議行動項目追蹤',
      description: '從會議記錄中擷取行動項目，整理成待辦追蹤清單',
      triggerHint: '偵測到「會議記錄整理＋行動項目追蹤」類型的整理需求',
      steps: ['擷取會議記錄中的行動項目', '整理成待辦追蹤清單並標註負責人'],
      reason: '示範用資料，方便直接看到複數建議同時存在的樣子',
      conversationId: 'demo',
    },
  ]
  const pendingSuggestionsRef = ref<SkillSuggestionEntry[]>(JSON.parse(JSON.stringify(MOCK_SUGGESTIONS)))
  const pendingSuggestions = computed<SkillSuggestionEntry[]>(() => pendingSuggestionsRef.value)

  function addSuggestion(entry: SkillSuggestionEntry): void {
    if (pendingSuggestionsRef.value.some(s => s.id === entry.id)) return
    pendingSuggestionsRef.value.push(entry)
  }

  function dismissSuggestion(id: string): void {
    const idx = pendingSuggestionsRef.value.findIndex(s => s.id === id)
    if (idx !== -1) pendingSuggestionsRef.value.splice(idx, 1)
  }

  function submitDraft(id: string, mode: 'new_skill' | 'version_update' = 'new_skill'): void {
    const draft = myDrafts.value.find(d => d.id === id)
    if (!draft) return
    if (mode === 'new_skill') {
      createSkill({
        name: draft.name,
        description: draft.description,
        instructions: draft.instructions,
        triggerHint: draft.triggerHint ?? '',
        isEnabled: true,
        assignedAgents: draft.assignedAgents ?? [],
      })
    }
    // 'version_update' → patch forkSourceId skill with new SkillVersion + submitSkillForReview
    myDrafts.value = myDrafts.value.filter(d => d.id !== id)
  }

  function batchMergeUpstreamUpdates(skillIds: string[]): string[] {
    const merged: string[] = []
    for (const id of skillIds) {
      const skill = findSkill(id)
      if (!skill || (skill.upstreamConflicts && skill.upstreamConflicts.length > 0)) continue
      mergeUpstreamUpdate(id)
      merged.push(id)
    }
    return merged
  }

  function saveTestRun(skillId: string, result: { total: number; passed: number }): void {
    testRunHistory.value.push({
      id: `run-${Date.now()}`,
      skillId,
      date: new Date().toISOString(),
      total: result.total,
      passed: result.passed,
      passRate: result.total > 0 ? result.passed / result.total : 0,
    })
    const runs = testRunHistory.value.filter(r => r.skillId === skillId)
    if (runs.length > 10) {
      const oldestIdx = testRunHistory.value.indexOf(runs[0])
      testRunHistory.value.splice(oldestIdx, 1)
    }
  }

  function getTestRunHistory(skillId: string): TestRun[] {
    return testRunHistory.value
      .filter(r => r.skillId === skillId)
      .slice(-5)
      .reverse()
  }

  function setSelectedSkill(id: string, versionName?: string): void {
    selectedSkillId.value = id
    selectedVersionName.value = versionName ?? getDefaultVersionName(id)
    aiTestScenarios.value = []
    aiTestReport.value = null
    aiTestScenariosSkillId.value = null
    aiTestScenariosSnapshot.value = null
    aiTestIsGenerating.value = false
    aiTestGenerationNarration.value = []
  }

  // SkillTestAI.vue 可能被掛載在不同技能的畫面（獨立測試頁 / 抽屜內的測試 tab），
  // 但 aiTestScenarios／aiTestReport 是單一全域狀態；掛載或切換技能時呼叫這個函式，
  // 確保看到的不是另一顆技能留下的舊測試結果
  function ensureAITestStateForSkill(skillId: string): void {
    if (aiTestScenariosSkillId.value !== null && aiTestScenariosSkillId.value !== skillId) {
      aiTestScenarios.value = []
      aiTestReport.value = null
      aiTestScenariosSkillId.value = null
      aiTestScenariosSnapshot.value = null
      aiTestGenerationNarration.value = []
    }
  }

  // 手動建立精靈的「測試」步驟：使用者從測試步驟按「上一步」回到確認步驟時呼叫，
  // 無條件清空目前的測試情境／報告——下次再進測試步驟要重新點「生成測試情境」，
  // 不能延用舊的作答紀錄（跟 ensureAITestStateForSkill 不同，那個只在「換了一顆技能」
  // 時才清，這裡是同一顆技能也要清，因為使用者明確離開了這個測試回合）
  function resetAITestState(): void {
    aiTestScenarios.value = []
    aiTestReport.value = null
    aiTestScenariosSkillId.value = null
    aiTestScenariosSnapshot.value = null
    aiTestIsGenerating.value = false
    aiTestGenerationNarration.value = []
  }

  // draftContext：還沒存檔的草稿想先測試時，store 裡找不到這顆技能（或還是舊版本），
  // 用呼叫端目前編輯中的 name／triggerHint／capabilities 當作組題關鍵字的來源
  // 還沒存檔的草稿先測試過，存檔那一刻才拿到真正的技能 id：測試結果是同一份草稿
  // 測出來的，不該因為 id 從佔位的草稿 id 換成真正的技能 id，就被
  // ensureAITestStateForSkill 誤判成「換了一顆技能」而清掉。已經有完整報告的話，
  // 也把答對比例寫回這顆剛存檔的技能，使用者不用為了同一份內容重新作答一次
  function migrateAITestState(fromId: string, toId: string): void {
    if (aiTestScenariosSkillId.value !== fromId) return
    aiTestScenariosSkillId.value = toId
    const report = aiTestReport.value
    if (!report || report.total === 0) return
    const skill = findSkill(toId)
    if (!skill) return
    const rate = report.correct / report.total
    skill.aiTestPassRate = rate
  }

  // 生成題目前讓使用者選「答題 Agent」的候選：可以調用這顆技能的 Agent。
  // 還沒指派 Agent 時，比照搶觸發掃描借用團隊內最相似技能的 Agent（source: 'inferred'）；
  // 連借都借不到（全新草稿、團隊內沒有相近技能）才開放所有 Agent 讓使用者自己挑
  function getAITestCallableAgents(
    skillId: string,
    draftContext?: TriggerEdgeSource,
  ): { agents: string[]; source: 'assigned' | 'inferred' | 'all'; inferredFrom?: string } {
    const skill = findSkill(skillId)
    const assigned = skill?.assignedAgents?.length ? skill.assignedAgents : (draftContext?.assignedAgents ?? [])
    if (assigned.length) return { agents: [...assigned], source: 'assigned' }
    if (skill) {
      const { inferredFrom } = findCompetingSkills(skill, [...myPersonalSkills.value, ...flatSkills.value])
      if (inferredFrom?.assignedAgents?.length) {
        return { agents: [...inferredFrom.assignedAgents], source: 'inferred', inferredFrom: inferredFrom.name }
      }
    }
    return { agents: [...AVAILABLE_AGENTS], source: 'all' }
  }

  async function generateAITestScenarios(
    skillId: string,
    draftContext?: TriggerEdgeSource,
    answeringAgent?: string,
  ): Promise<void> {
    aiTestScenarios.value = []
    aiTestReport.value = null
    aiTestScenariosSkillId.value = skillId

    // 沒指定答題 Agent（例如對話裡點「重新測試」）：沿用上一次選的，上一次的不在
    // 這顆技能的候選裡才退回第一個候選
    const callable = getAITestCallableAgents(skillId, draftContext).agents
    const agent = answeringAgent
      ?? (aiTestAnsweringAgent.value && callable.includes(aiTestAnsweringAgent.value) ? aiTestAnsweringAgent.value : callable[0])
    aiTestAnsweringAgent.value = agent

    // 敘事文字要在「生成中」那段時間就看得到，所以搶觸發的掃描（查可調用 Agent、
    // 找相似技能）要在這裡先算好，不是等 900ms 的模擬延遲結束後才算
    const skill = findSkill(skillId)
    const source: TriggerEdgeSource | undefined = skill ?? draftContext
    const { competing: competingSkills, inferredFrom } = skill
      ? findCompetingSkills(skill, [...myPersonalSkills.value, ...flatSkills.value], agent)
      : { competing: [], inferredFrom: undefined }
    aiTestGenerationNarration.value = MOCK_AI_SCENARIO_TEMPLATES[skillId]
      ? [`正在為「${source?.name?.trim() || '這顆技能'}」產生測試情境，由「${agent}」擔任答題 Agent...`]
      : buildGenerationNarration(source, skill, competingSkills, inferredFrom, agent)
    aiTestIsGenerating.value = true

    await new Promise(r => setTimeout(r, 900))
    aiTestScenariosSnapshot.value = JSON.stringify({
      name: source?.name ?? '',
      triggerHint: source?.triggerHint ?? '',
      capabilities: source?.capabilities ?? [],
    })
    const templates = MOCK_AI_SCENARIO_TEMPLATES[skillId] ?? generateDynamicTriggerEdgeScenarios(source, competingSkills)
    const agentAnswers = simulateAgentAnswers(templates, agent, source?.name?.trim() || '這顆技能')
    aiTestScenarios.value = templates.map((t, i) => ({
      tag: t.tag,
      input: t.input,
      expectedBehavior: t.expectedBehavior,
      expectedTrigger: t.expectedTrigger,
      ...agentAnswers[i],
      id: `ai-sc-${skillId}-${i}`,
      status: 'pending',
    }))
    aiTestIsGenerating.value = false
    // 新一批題目，舊的測試結果不算數：重設這顆技能的測試狀態（不動 isEnabled，
    // 已經啟用的技能不會因為重新出題就被打回停用，見 canEnableSkill 只管「切成啟用」這個動作本身）
    if (skill) {
      skill.aiTestPassRate = null
    }
  }

  function _computeAITestReport(skillId: string): void {
    const all = aiTestScenarios.value
    const allDone = all.every(s => s.status === 'correct' || s.status === 'incorrect')
    if (!allDone) return

    const byTag: AITestReport['byTag'] = {
      normal: { total: 0, correct: 0 },
      boundary: { total: 0, correct: 0 },
      trigger_edge: { total: 0, correct: 0 },
    }
    let total = 0
    let correct = 0
    for (const s of all) {
      byTag[s.tag].total++
      total++
      if (s.status === 'correct') { byTag[s.tag].correct++; correct++ }
    }

    const rate = total > 0 ? correct / total : 0
    let summary: string
    const agent = aiTestAnsweringAgent.value ? `「${aiTestAnsweringAgent.value}」` : 'Agent'
    if (rate === 1) {
      summary = `${agent}全部判斷正確，這顆技能的觸發條件描述得夠清楚。`
    } else if (rate >= 0.7) {
      summary = `${agent}判斷對 ${correct} / ${total} 題，整體不錯；看看判斷錯的題目，補強 triggerHint 或說明，讓 Agent 更容易分辨。`
    } else {
      summary = `${agent}只判斷對 ${correct} / ${total} 題，建議重新檢視這顆技能的 triggerHint 與說明，修改後再測一次。`
    }

    aiTestReport.value = { total, correct, byTag, summary }

    // 把這輪測驗的答對比例寫回技能記錄；有值就代表這一版測過，供 canEnableSkill() 判斷能不能啟用
    const skill = findSkill(skillId)
    if (skill) {
      skill.aiTestPassRate = rate
    }
  }

  // 使用者對某一題標註正確答案：這句話該不該觸發這顆技能？拿來跟答題 Agent 的判斷
  // （agentAnswer）比，立刻算出 Agent 對不對。已標註過的題目不再改動（one-shot，避免改答案影響報告）
  function answerAITestScenario(skillId: string, scenarioId: string, userAnswer: boolean): void {
    const scenario = aiTestScenarios.value.find(s => s.id === scenarioId)
    if (!scenario || scenario.status !== 'pending') return

    scenario.userAnswer = userAnswer
    scenario.status = userAnswer === scenario.agentAnswer ? 'correct' : 'incorrect'

    _computeAITestReport(skillId)
  }

  // 統一送答案：使用者先把每一題的正確答案都標好（還沒送出前都算 pending，不逐題判分），
  // 按「送出答案」才一次跟 Agent 的判斷比對、只算一次報告。answers 沒涵蓋到的題目（理論上
  // 不該發生，呼叫端要先確定全部選過才能按送出）維持 pending，不會被誤判
  function submitAITestAnswers(skillId: string, answers: Record<string, boolean>): void {
    for (const scenario of aiTestScenarios.value) {
      if (scenario.status !== 'pending') continue
      const userAnswer = answers[scenario.id]
      if (userAnswer === undefined) continue
      scenario.userAnswer = userAnswer
      scenario.status = userAnswer === scenario.agentAnswer ? 'correct' : 'incorrect'
    }
    _computeAITestReport(skillId)
  }

  function resetConversation(): void {
    testConversationHistory.value = []
  }

  // 回覆內容要帶出這顆技能實際的名稱／覆蓋能力，不能不管測哪顆技能都回同一句通用罐頭訊息——
  // 不然使用者在對話測試裡完全看不出這次模擬有沒有真的對應到技能內容
  async function sendChatMessage(skillId: string, message: string): Promise<void> {
    testIsRunning.value = true
    testConversationHistory.value.push({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
    })
    await new Promise(r => setTimeout(r, 800))
    const skill = findSkill(skillId)
    const name = skill?.name ?? '這顆技能'
    const capsText = skill?.capabilities?.length
      ? `（涉及 ${skill.capabilities.map(c => `#${c}`).join('、')}）`
      : ''
    testConversationHistory.value.push({
      id: `msg-${Date.now() + 1}`,
      role: 'agent',
      content: `（Mock）已依「${name}」的技能指令處理您的問題：「${message}」${capsText}，正在產生結果...`,
      toolTrace: [
        { name: 'match-trigger-hint', latencyMs: 156 },
        { name: 'apply-instructions', latencyMs: 234 },
      ],
    })
    testIsRunning.value = false
  }

  // 送審時的「AI 建議版本名稱」：優先參考使用者已經填的說明文字摘要成短標題，
  // 沒填說明時退回用技能名稱＋送審模式給一個泛用建議。使用者仍可自行編輯，
  // 這裡只是預填草稿，不是強制採用
  async function suggestVersionName(
    skillId: string,
    note: string,
    mode: 'new_skill' | 'version_update'
  ): Promise<string> {
    await new Promise(r => setTimeout(r, 600))
    const skill = findSkill(skillId)
    const cleaned = note.trim().replace(/[，。！？、\n]+/g, ' ').trim()
    if (cleaned) {
      return cleaned.length > 16 ? `${cleaned.slice(0, 16)}…` : cleaned
    }
    const baseName = skill?.skillName ?? skill?.name ?? '技能'
    return mode === 'version_update' ? `${baseName}功能更新` : `${baseName}首次發布`
  }

  return {
    skills,
    myDrafts,
    myPersonalSkills,
    drafts: myDrafts,
    selectedSkillId,
    selectedVersionName,
    testConversationHistory,
    testIsRunning,
    aiTestScenarios,
    aiTestReport,
    aiTestScenariosSkillId,
    aiTestScenariosSnapshot,
    migrateAITestState,
    aiTestIsGenerating,
    aiTestGenerationNarration,
    aiTestAnsweringAgent,
    getAITestCallableAgents,
    flatSkills,
    enabledCount,
    enterpriseExtensionCount,
    teamExtensionCount,
    totalUsageCount,
    avgTestPassRate,
    deletedSkills,
    reviewingSkillIds,
    upstreamUpdateSkillIds,
    pendingUpdateCount,
    pendingUpdateSkills,
    testRunHistory,
    getUpstreamVersion,
    acceptUpstreamUpdate,
    detachFromUpstream,
    detachUpstream,
    findSkill,
    getSkillVersions,
    getReviewingVersion,
    getVersionOptions,
    getDefaultVersionName,
    deleteSkill,
    restoreSkill,
    permanentlyDeleteSkill,
    createSkill,
    createPersonalSkill,
    applyStudioPatch,
    updateSkill,
    updateSkillFiles,
    toggleSkill,
    assignSkillToAgent,
    setAssignedAgents,
    mergeUpstreamUpdate,
    ignoreUpstreamUpdate,
    submitSkillForReview,
    approveSkillVersion,
    rejectSkillVersion,
    createDraft,
    saveDraft,
    updateDraft,
    deleteDraft,
    submitDraft,
    submitPersonalSkill,
    suggestVersionName,
    deletePersonalSkill,
    duplicateAsPersonalSkill,
    hasSkillNameConflict,
    wouldSkillNameConflict,
    setLibraryActiveVersion,
    deleteSkillVersion,
    approvePersonalSkill,
    rejectPersonalSkill,
    hasPendingReview,
    pendingReviewSkills,
    pendingSuggestions,
    addSuggestion,
    dismissSuggestion,
    batchMergeUpstreamUpdates,
    saveTestRun,
    getTestRunHistory,
    setSelectedSkill,
    generateAITestScenarios,
    ensureAITestStateForSkill,
    resetAITestState,
    answerAITestScenario,
    submitAITestAnswers,
    resetConversation,
    sendChatMessage,
  }
})
