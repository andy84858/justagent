# JustAgent UI

企業 AI 協作平台的前端（Demo Site）。

企業 → 團隊 → 專案，每個專案有一塊 AI 畫布，可以放 PDF、Excel、圖片、圖表等內容區塊，還能建立 AI 技能（Skill）。

> 目前是**切版階段**：API 尚未全部串接，部分頁面用假資料。

## 主要功能

| 功能 | 說明 |
|---|---|
| 最近使用 / 團隊專案 | 專案卡片與清單、建立、刪除 |
| AI 畫布（AiViewer） | Konva.js 拖拉縮放畫布，放各種內容區塊、便條紙評論 |
| AI 技能 | 技能管理、AI 賦能（對話建立技能）、技能測試沙盒；可選擇串接後端 agent（見下方「串接技能後端」） |
| 探索 | Agent 探索、Skill 探索 |
| 共享資源庫 | 共用檔案管理、知識庫管理 |
| 權限管理 | 團隊成員與角色 |
| 企業 / 團隊設定 | 企業資訊、方案、管理員 |
| 專案垃圾桶 | 軟刪除、還原、永久刪除 |

## 技術棧

Vue 3（`<script setup lang="ts">`）· TypeScript · Vite · Pinia · Vue Router · SCSS · Axios · Konva · Chart.js · Vitest · Playwright

## 快速開始

需要 Node `^20.19.0` 或 `>=22.12.0`。

```bash
npm install
npm run dev
```

開發伺服器：`http://localhost:8088`（port 被占用會直接失敗，不會換 port）。

## 常用指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 本地開發 |
| `npm run build` | 一般 build |
| `npm run sit` / `uat` / `biz` | 對應環境 build（`biz` 是正式環境） |
| `npm run preview` | 預覽 build 結果 |
| `npm run type-check` | TypeScript 型別檢查 |
| `npm run lint` | ESLint 並自動修正 |
| `npm run test:unit` | Vitest 單元測試 |
| `npm run test:e2e` | Playwright E2E 測試 |
| `npm run test:e2e:ui` | E2E 測試（UI 模式） |
| `npm run test:e2e:report` | 開啟 E2E 測試報告 |

## 環境變數

| 變數 | 說明 |
|---|---|
| `VITE_API_BASE_URL` | API 伺服器位址 |
| `VITE_DOMAIN` | 登入 Cookie 所屬 domain |
| `VITE_APP_TITLE` | 網頁標題 |
| `VITE_DEV_MODE` | 開發模式 flag |
| `VITE_SKILL_AGENT_API` | 設成 `true` 才把 AI 技能功能接到後端 agent；沒設或不是 `true` 一律用假資料（預設） |

部署路徑前綴是 `/aiviews/`。

## 串接技能後端（選用）

預設不用後端，AI 技能整套是假資料。要看真的後端行為，才需要做這一節。

後端是另一個專案 `skill_creator_poc_5`（Python，需要 MongoDB 與模型金鑰，設定見該專案的 `config.example.yaml`）。

1. 啟動後端（只綁本機，port 8000）：

   ```bash
   cd skill_creator_poc_5
   PYTHONPATH=src uv run python -m skill_store --port 8000
   ```

   看到 `Uvicorn running on http://127.0.0.1:8000` 就是好了。後端只放行 `http://localhost:8088`（前端開發伺服器的位址）。

2. 前端建立 `.env.local`（不會進版本庫），重啟 `npm run dev`：

   ```bash
   VITE_API_BASE_URL=http://127.0.0.1:8000
   VITE_SKILL_AGENT_API=true
   ```

   `VITE_API_BASE_URL` 是前端所有 API 共用的位址，設了之後其他還沒串接的功能不受影響（它們用假資料）。

3. 打開「技能管理」，用「建立技能」選對話方式。

### 串接後能做什麼

| 功能 | 行為 |
|---|---|
| 判斷模式 | 建立對話前可選「Jev＋LLM」或「純 LLM」，預設 Jev＋LLM；對話開始後鎖住，不能切換，畫面會標出目前模式 |
| 對話建立 / 修改 | 草稿、便利貼都由後端回傳；被後端規則擋下時，對話裡會講原因 |
| 儲存 | 按「儲存為個人技能」才會寫入；每次儲存是一個新版本，舊版本內容不動 |
| 技能清單與版本 | 「我的技能」卡片來自後端；點開可看每個版本有沒有「測過」，並從任一版進入修改 |
| 測試 | 題目由後端出。選答案不會立刻計分，要按「交卷」；交卷後每題只顯示「一致」或「不一致」，不顯示標準答案 |
| 啟用 | 只看這一版「測過」沒有（交卷就算，不要求全對）；沒測過會說明要先測試。移除了「視為通過」 |
| 沒改內容時 | 從舊版本進修改、沒改內容就測試：不會多出重複版本，按「記下測過」只把那一版標成測過 |

### 目前的限制

- 後端的「啟用」只檢查「測過」，不記錄啟用狀態，所以前端的「啟用中」只在這次開啟期間有效，重新整理就不見；後端也沒有「停用」。
- 後端技能的詳情抽屜不提供複製、送審、刪除（後端還沒有對應功能）；也不走「指派 Agent」的對話框。
- 修改既有技能目前只有對話方式的技能走後端；積木組裝的技能仍用假資料。
- 假資料的測試也改成同一條規則：做完一輪測驗就算測過，不用全對；`aiTestOverridden`（視為通過）已移除。

## 專案結構

```
src/
├── components/   共用元件
├── views/        頁面（路由目標）
├── router/       路由
├── stores/       Pinia stores
├── services/     HTTP 與業務邏輯
├── utils/        純函式工具
├── types/        共用型別
└── scss/         全域樣式（base / components / views / libs）
e2e/              Playwright 測試
```

## 開發規則（重點）

- 只用 `<script setup lang="ts">`，不用 Options API
- 不寫 `<style scoped>`，樣式放 `src/scss/`
- HTTP 一律走 `src/services/http.ts`
- import 一律用 `@/`
- 顏色用 CSS 變數，不寫死 hex
- 新增 SCSS 檔要在對應的 `_index.scss` 手動 `@forward`

## 更多文件

| 文件 | 內容 |
|---|---|
| [AI_RULES.md](./AI_RULES.md) | 程式規範、命名慣例 |
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | 業務背景、功能模組、術語 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 技術架構、資料流、設計決策 |
| [CLAUDE.md](./CLAUDE.md) | AI 工具的開發指引 |
