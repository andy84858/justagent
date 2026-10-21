# ARCHITECTURE.md — 系統架構文件

本文件描述 JustAgent UI 的技術架構、設計決策與模組互動方式。
尚未確定的部分以 `TODO` 標記，待開發進度推進後補充。

---

## 1. 整體架構概覽

```
┌─────────────────────────────────────────────┐
│                 Browser                      │
│                                              │
│  ┌──────────┐   ┌──────────┐   ┌─────────┐  │
│  │  Views   │   │  Stores  │   │ Services│  │
│  │ (Pages)  │◄──│ (Pinia)  │◄──│ (Logic) │  │
│  └────┬─────┘   └──────────┘   └────┬────┘  │
│       │                             │        │
│  ┌────▼─────────────────────────────▼────┐   │
│  │           Components                  │   │
│  └───────────────────────────────────────┘   │
│                      │                       │
│              ┌───────▼────────┐              │
│              │  HTTP Service  │              │
│              │  (Axios Layer) │              │
│              └───────┬────────┘              │
└──────────────────────┼──────────────────────┘
                       │
              ┌────────▼────────┐
              │   Backend API   │
              │   (TODO: 補充)  │
              └─────────────────┘
```

**資料流向（單向）：**
```
View / Component
    → 呼叫 Store Action 或 Service
        → Service 呼叫 HTTP Layer
            → HTTP Layer 發送 API Request
                → Response 回傳至 Store 更新狀態
                    → View 透過 reactivity 自動更新
```

---

## 2. 應用程式啟動流程

```
main.ts
  ├── import scss/style.scss        (全域樣式最先載入)
  ├── createApp(App)
  ├── app.use(createPinia())        (狀態管理)
  ├── app.use(router)               (路由)
  ├── app.use(FloatingVue)          (tooltip，distance: 10px)
  ├── app.use(VueSweetalert2)       (dialog)
  └── app.mount('#app')

App.vue
  ├── mounted: 字型載入完成後加上 .show class（避免 FOUT）
  ├── window.debug = {}             (開發用全域 debug 物件)
  └── <RouterView />                (所有畫面透過此渲染)

Router beforeEach
  ├── 清除全域搜尋狀態（isEnterAppSearchPage, appSearchKeyword）
  └── next()（TODO: 尚未實作 auth 驗證）

Full.vue（主框架，/view/* 路由的容器）
  ├── <AppMenuTree />               (隱藏條件: route.meta.hideMenuTree)
  ├── <RouterView />                (子頁面渲染區)
  ├── <AppSearchPage />             (條件: isEnterAppSearchPage)
  └── <AppBatchUpload />            (全域批次上傳，跨路由持久存在)
```

---

## 3. 路由結構

```
/                          → AppEntrance（登入 / 入口頁）
/view/                     → Full.vue（需登入的主框架）
  ├── ProjectDashboard     → 最近使用專案
  ├── TeamProject          → 團隊專案列表 (?teamId=&teamName=)
  ├── ResourceLibrary      → 共享資源庫 (?teamId=&teamName=)
  ├── TeamAccessManagement → 權限管理 (?teamId=&teamName=)
  ├── AiViewer             → AI 畫布編輯器 (meta: hideMenuTree: true)
  ├── CompanyTeamSettings  → 企業/團隊設定
  ├── ProjectTrashCans     → 專案垃圾桶 (?teamId=&teamName=)
  ├── SkillStudio          → AI 賦能：對話式建立／修改／測試技能 (meta.parentLabel: 'AI 技能')
  └── GUI                  → 元件展示/測試頁（開發用）
```

**設計說明：**
- 所有路由使用 `() => import()` 動態載入（Code Splitting）
- 團隊相關頁面透過 URL Query 傳遞 `teamId` / `teamName`，不使用路由參數
- `hideMenuTree` meta flag 讓 AiViewer 全螢幕使用

---

## 4. 狀態管理（Pinia）

### 分層原則

| Store | 範圍 | 職責 |
|---|---|---|
| `rootStore` | 全域 | App 層級 UI 狀態、跨頁面共享 |
| `AiViewerStore` | 功能域 | AiViewer 畫布所有狀態與操作 |

**原則：**
- 多個根層級頁面都需要的狀態 → `rootStore`
- 單一功能子樹（AiViewer）的狀態 → 對應的 domain store
- 純元件內部狀態 → `ref()` / `reactive()`，不放進 store

### rootStore 狀態

```typescript
// UI 狀態
isShowBatchUpload: boolean       // 批次上傳元件顯示
isBatchUploading: boolean        // 上傳中（防重複觸發）
isBatchUploadSuccess: boolean    // 上傳成功
isEnterAppSearchPage: boolean    // 全域搜尋頁顯示
appSearchKeyword: string         // 搜尋關鍵字
projectListMode: 'card' | 'list' // 專案列表視圖模式
nowMenuTreeCompanyId: string     // 側邊欄當前企業 ID
```

### AiViewerStore 狀態（主要）

```typescript
// 畫布
mainStage: Konva.Stage | null    // Konva Stage 實例
aiViewerBlocks: AiViewerBlock[]  // 所有畫布區塊
nowChoiceAiViewerId: string      // 選取的區塊 ID
isMultiChoiceAiViewerMode: boolean
nowMultiChoiceAiViewerIds: string[]

// 使用者輸入
userInputModal: { msg, userUploadFiles[], aiFiles[] }

// 面板顯示
isShowCommentListView: boolean
isShowBlockListView: boolean
isShowFileListView: boolean
isOpenConversationListModal: boolean
```

### 元件使用 Store 的方式

```typescript
const store = useRootStore()
const { isShowBatchUpload, projectListMode } = storeToRefs(store)  // 響應式狀態
const { openBatchUploadFn } = store                                  // Action 直接解構
```

---

## 5. 服務層（Services）

所有業務邏輯與 HTTP 呼叫集中在 `src/services/`，不在元件內直接操作。

### http.ts — HTTP 核心層

**Axios 實例設定：**
- Base URL：`import.meta.env.VITE_API_BASE_URL`
- Timeout：10 秒
- 預設 Headers：`Content-Type: application/json`

**Request Interceptor：**
1. 檢查是否已有 `Authorization` header
2. 若無，從 localStorage 透過 `loginUtils.getToken()` 注入 `Bearer {token}`

**Response Interceptor：**
1. 成功（2xx）：直接回傳
2. 錯誤：log 狀態碼與訊息
3. `401 Unauthorized`：自動呼叫 `loginUtils.logout()`

**RequestManager（請求取消機制）：**
```typescript
// 每個請求都包裝在 AbortController 中
const controller = requestManager.createController()
axios.get(url, { signal: controller.signal })

// 需要時取消全部（例如元件 unmount）
requestManager.cancelAllRequests()
```

**泛型 API 方法：**
```typescript
httpService.get<T>(url, config?)
httpService.post<T>(url, data, config?)
httpService.put<T>(url, data, config?)
httpService.patch<T>(url, data, config?)
httpService.delete<T>(url, config?)
httpService.all<T>(requests[])   // Promise.all wrapper
```

### popDialog.ts — Dialog 服務

包裝 SweetAlert2，禁止在元件內直接使用 `window.alert` / `window.confirm`。

```typescript
popDialog.alert(msg, [btnText], [callback])
popDialog.confirm(msg, [confirmBtn], [cancelBtn], [confirmCb], [cancelCb])
popDialog.toast(msg, duration)   // 右上角非阻塞通知，有排隊機制
```

### authService.ts — 認證服務

```typescript
loginUtils.setToken(token)   // 注入至 httpService
loginUtils.isLogged()        // 檢查 Cookie 'justkaB'
loginUtils.logout()          // 清除 Cookie，登出
```

- 讀取 B 端身份中心 Cookie（domain: `VITE_DOMAIN`）
- TODO: 多系統登出清理

---

## 5-1. 工具層（Utils）

純函式、無副作用的工具函式放在 `src/utils/`，與有副作用的 `src/services/` 區分。

### file.ts — 檔案工具

```typescript
formatFileSize(bytes)                          // 格式化檔案大小
getFileMimeType(file)                          // 取得 MIME（含 .md fallback）
validateUploadFiles(files, existing, types, options)
// 驗證：類型、數量（上限 5）、單檔大小（≤ 5GB）、總大小（≤ 25GB）
// 回傳：{ valid: boolean, error?: string }
```

### chart.ts — 圖表工具

```typescript
chartAdapter(source: SourceChart): ChartConfiguration
// 將後端回傳的 SourceChart 資料轉換為 Chart.js 設定物件
```

---

## 6. 元件通訊模式

| 情境 | 模式 | 說明 |
|---|---|---|
| 直接父子關係 | Props / Emits | 1 層以內的資料傳遞 |
| 跨元件共享狀態 | Pinia Store | 透過 `storeToRefs()` 取得響應式狀態 |
| 可重用業務邏輯 | Service 函式 | 純函式，無副作用 |
| 第三方套件事件 | 事件監聽器 | Konva / DOM 事件直接綁定 |
| 大量訊息列表 | Virtual Scroll | `vue3-virtual-scroll-list` |

**不使用 `provide` / `inject`**：全域狀態統一由 Pinia 管理，避免隱性依賴。

---

## 7. AiViewer / Konva 整合

AiViewer 是最複雜的功能模組，使用 Konva.js 處理畫布，Vue 負責 UI 層。

### Konva Stage 生命週期

```typescript
// 元件 onMounted 時初始化 Stage
onMounted(() => {
  const stage = new Konva.Stage({
    container: 'canvas-container',   // DOM 元素 ID
    width: containerWidth,
    height: containerHeight,
  })
  aiViewerStore.mainStage = stage    // 存入 Pinia，跨元件共享
})

// 元件 onUnmounted 時清理
onUnmounted(() => {
  aiViewerStore.mainStage?.destroy()
  aiViewerStore.resetAiViewerState()
})
```

### 區塊（Block）渲染方式

- 每個 Block 用 `DragResizeBox.vue`（自製）包裝，綁定 store 中的 `x, y, width, height, z`
- Block 內容依 `blockType` 渲染不同子元件（PDF / Excel / Image…）
- 拖動 / 縮放結果直接更新 store 中的 block 物件
- `blockType` 分兩類：檔案型（PDF/EXCEL/PPT/IMAGE/CHART/TXT/HTML/MD/WORD/OTHER）與功能型（目前只有 SKILL）。功能型的 icon／label 由 `src/constants/toolBlocks.ts` 的 `TOOL_BLOCK_META` 統一提供，`AiViewerContentBox` 依此掛 `is-tool` 樣式與 header 徽章；SKILL 區塊的狀態以 `StudioSnapshot` 存在 block data，由 `viewBlock/skillBuilderViewBox.vue` hydrate／寫回。行銷報告章節目錄在 `src/constants/reportSections.ts`，積木 → 技能指令／RD 步驟／覆蓋能力的推導是 `useSkillStudioConversation.ts` 的純函式 `deriveFromSections`。技能定義依 RD 六段組成（技能描述＝`description`、步驟 `steps`（必填）、例外或特殊情況 `exceptions`、固定輸出格式 `outputFormat`、適用範圍 `applicableScope`、覆蓋能力 `capabilities`），由 `src/utils/skillMarkdown.ts` 的 `buildSkillDefinitionMarkdown` 組出；`instructions`（技能內文）另外保留，不進技能定義。store 內建立／更新／版本快照一律用 `copyRdFields()` 整組複製這四欄

### 碰撞偵測（createPos）

新建或貼上 Block 時，`checkCreatePos()` 遞迴檢查位置是否與現有 Block 重疊：
- 重疊則偏移 `centerSpaceX: 60px` / `centerSpaceY: 70px`
- 直到找到空位為止

---

## 8. SCSS 架構

### 載入順序

```scss
// src/scss/style.scss
@import "./base/index";        // 1. CSS 變數、SCSS 變數、Mixin、Reset
@import "./libs/index";        // 2. 第三方套件樣式覆寫
@import "./layout";            // 3. 頁面骨架佈局
@import "./views/index";       // 4. 各頁面樣式
@import "./components/index";  // 5. 各元件樣式
@import "./custom.scss";       // 6. 全域覆寫（最高優先）
```

### 設計 Token

```scss
// 品牌色
$color_main_1: #3eb5cc;

// 間距 / 版型
$header-height: 36px;
$menu-width: 306px;
$border-radius: 8px;

// 斷點
$breakpoint-desktop: 1024px;
$breakpoint-tablet: 900px;
$breakpoint-mobile: 375px;
```

### 主題（Theme）

- Light / Dark 主題以 **CSS Custom Properties** 實作
- `_theme.scss`（亮色）、`_themeDark.scss`（暗色）
- 依瀏覽器偏好自動切換（`prefers-color-scheme`）
- 所有顏色使用 `var(--color-xxx)`，不寫死 hex

### 命名規則

- 元件樣式：頂層 class 與元件同名（`.AppMenuTree { ... }`）
- 子元素：在頂層 class 下巢狀選取（`.AppMenuTree .header-box { ... }`）
- 不使用 `<style scoped>`：所有樣式在對應的 `scss/components/` 或 `scss/views/` 管理

---

## 9. 建置設定（Vite）

```typescript
// vite.config.ts 重點設定
{
  resolve: {
    alias: { '@': './src' }       // @/ 對應 src/
  },
  server: {
    host: '0.0.0.0',
    port: 8087,                   // strictPort: true
  },
  build: {
    base: '/aiviews/'             // 部署路徑前綴
  }
}
```

### 環境模式

| 指令 | 模式 | 對應 env 檔 |
|---|---|---|
| `npm run dev` | development | `.env.dev` |
| `npm run build:sit` | sit | `.env.sit` |
| `npm run build:uat` | uat | `.env.uat` |
| `npm run build:biz` | biz | `.env.biz` |

**環境變數：**
```
VITE_API_BASE_URL   API 伺服器位址
VITE_DOMAIN         Cookie 所屬 domain（登入用）
VITE_APP_TITLE      網頁標題
VITE_DEV_MODE       開發模式 flag
```

---

## 10. 關鍵設計決策

| 決策 | 原因 |
|---|---|
| 不使用 `<style scoped>` | 統一在 SCSS 目錄管理，便於主題切換與覆寫 |
| Pinia 不拆太細 | AiViewerStore 集中管理畫布狀態，減少跨 store 依賴 |
| 不使用 provide/inject | 使用 Pinia 讓依賴關係明確可追蹤 |
| HTTP 封裝成 Service | 元件不直接使用 Axios，便於統一修改攔截器 |
| 路由 Lazy Loading | 減少初始 bundle 大小 |
| Konva Stage 存在 Store | 讓多個子元件都能操作同一個 Stage 實例 |

---

## 11. TODO（待補充）

> 以下章節待開發進度確定後補充。

- **API 層設計** — RESTful / GraphQL？API 版本策略？錯誤碼規範？
- **Authentication 流程** — B 端身份中心的完整 SSO 流程
- **部署架構** — 容器化（Buildpacks）、CDN、Nginx 設定
- **WebSocket / 即時通訊** — AI 回應串流方式（SSE？WS？）
- **快取策略** — 是否需要前端快取 API 結果
- **錯誤追蹤** — Sentry 或其他 Error Monitoring 整合
