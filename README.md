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
- 後端技能的詳情抽屜不提供複製、送審（後端還沒有對應功能）；刪除會呼叫後端 `DELETE /skills/{id}`，連同所有版本一起刪、救不回來；也不走「指派 Agent」的對話框。
- 修改既有技能目前只有對話方式的技能走後端；積木組裝的技能仍用假資料。
- 假資料的測試也改成同一條規則：做完一輪測驗就算測過，不用全對；`aiTestOverridden`（視為通過）已移除。

## 驗測指南（給 PM）

驗測分兩層。**第一層不用準備任何東西**，只需要 5 分鐘；第二層要看真的後端，需要先準備環境。

### 第一層：確認沒有影響現有畫面（不用後端）

```bash
npm install
npm run dev
```

打開 `http://localhost:8088`，進「技能管理」，確認：

- 「我的技能」卡片、點開的詳情抽屜、建立技能的對話，跟以前一樣。
- 啟用技能時，沒測過的技能會說明要先測試；**測過但沒全對的可以啟用**，也沒有「視為通過」的按鈕（這是這次改的規則）。

### 第二層：看串接後端的行為

**先準備這些東西**

| 要準備 | 說明 | 備註 |
|---|---|---|
| 後端專案 `skill_creator_poc_5` | 另一個 repo，不在這個專案裡 | 向 PR 作者取得 |
| Python 3.13 以上，加 [`uv`](https://docs.astral.sh/uv/) | 跑後端用 | `uv` 會自己裝後端的套件 |
| MongoDB | 存技能與版本，預設連 `mongodb://localhost:27017/skill_creator_poc_5` | 本機裝一個，或請人給連線網址（要寫進後端的 `config.yaml`） |
| TypeSafe API 金鑰 | 「Jev＋LLM」模式的判斷用 | 寫進 `config.yaml` 的 `jev.api_key`，或設環境變數 `TYPESAFE_API_KEY` |
| 強模型的 API 金鑰 | 對話 agent 回話、出測試題、「純 LLM」模式都用它（OpenAI 相容介面，例如 OpenAI 或 OpenRouter） | 寫進 `config.yaml` 的 `strong_model`（`base_url`、`api_key`、`model`） |
| 兩個終端機視窗 | 一個跑後端、一個跑前端 | |

設定檔做法：在後端專案把 `config.example.yaml` 複製成 `config.yaml`，填入上面的金鑰。`config.yaml` 不會進版本庫，不要把金鑰貼到別處。

**注意**：驗測時每一句對話、每一次出題與交卷都會呼叫模型，會產生費用。

**啟動**：照上面「串接技能後端（選用）」的步驟 1、2。後端缺金鑰或連不上 MongoDB 時，會印「啟動失敗：…」並說明缺什麼，照訊息補就好。對話只存在後端記憶體，**重啟後端後進行中的對話會消失**（已儲存的技能在 MongoDB，不會消失）。

**建議驗測順序**

| # | 操作 | 預期結果 |
|---|---|---|
| 1 | 技能管理 →「建立技能」→ 選對話方式；在聊天框上方先選「純 LLM」或維持「Jev＋LLM」，再送出第一句 | 按鈕變成鎖頭標籤，標出目前模式，對話中不能再切換 |
| 2 | 跟助理聊一個技能（例如「客人退貨要先問訂單編號」），聊到有草稿 | 右側預覽出現草稿；被規則擋下時，對話裡會講原因 |
| 3 | 還沒按儲存時，切到右側「測試」tab →「生成測試情境」 | 出現選擇題，題目只有題目文字，沒有標準答案 |
| 4 | 每題選「該用／不該用」 | 選完**不會**立刻出結果；沒選完時「交卷」是灰的 |
| 5 | 按「交卷」 | 每題只顯示「一致」或「不一致」；看不到標準答案與出題理由；顯示「已算測過」 |
| 6 | 按左下角「儲存為個人技能」 | 「我的技能」出現新卡片，狀態寫「第 1 版 · 測過」 |
| 7 | 點開卡片 | 沿用原本的詳情抽屜；有「版本歷史」，每版標示測過／沒測過 |
| 8 | 在抽屜按「編輯」，要助理改一處內容，再儲存 | 多一個第 2 版；第 1 版內容不變；第 2 版是「沒測過」 |
| 9 | 對沒測過的版本按「啟用技能」 | 說明這一版還沒測過，請先測試；沒有啟用 |
| 10 | 對第 2 版做測試並交卷（**即使有題目不一致**），按左下角「記下測過」，然後「啟用技能」 | 可以啟用；不要求全對。版本歷史裡第 2 版變成「測過」，沒有多出第 3 版 |
| 11 | 在抽屜的「版本歷史」找一個沒測過的版本，按「從這一版修改」，**不改任何字**直接測試並交卷 | 左下角按鈕變「記下測過」；按下去不會多出新版本，只有那一版標成測過 |
| 12 | 同上，但**沒測試**就想儲存 | 儲存鈕是灰的，旁邊說明「內容還沒修改，沒有新版本可存」 |

**遇到問題先看**

| 現象 | 可能原因 |
|---|---|
| 技能管理頁還是假資料 | `.env.local` 沒有 `VITE_SKILL_AGENT_API=true`，或設完沒重啟 `npm run dev` |
| 畫面提示「連不上技能後端」 | 後端沒啟動、port 不是 8000，或前端不是用 `http://localhost:8088` 開的（後端只放行這個網址） |
| 後端一啟動就「啟動失敗」 | `config.yaml` 缺 `strong_model` 或金鑰，或 MongoDB 沒開 |
| 對話回覆很慢 | 每一輪都呼叫模型，單輪最多等 2 分鐘；逾時會顯示「連不上技能後端」的提示，可重送一次 |

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
