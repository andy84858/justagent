# Agent 基礎設定單一工作區 Phase 1：外殼＋資料模型＋左欄導覽樹＋NPC 焦點 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the three-pane unified workspace shell (left nav tree, center focus pane, right bag placeholder) for the Agent 基礎設定 demo, with a working data model, left-column NPC/人物卡 navigation (expand/collapse, select, create), and a fully functional NPC focus pane (主檔 view/edit, 加入模型, 模型參數編輯, 發布模型).

**Architecture:** Pure HTML/CSS/vanilla JS, no build step, opened directly via `file://`. Three source files load in order (`data.js` → `workspace.js` → `app.js`); `app.js` owns the top-level render loop and delegates all workspace-specific rendering/interaction to functions in `workspace.js` (prefixed `ws`/`WS_`), keeping the new unified-workspace code physically separate from any future shared utilities the same way the original demo separated `library.js` from `app.js`. CSS follows the same split: `workspace.css` holds every selector for the new shell, all prefixed `.ws-`, so later phases (bag, flyout, pack mode) can add their own prefixed files without risk of collision.

**Tech Stack:** HTML5, CSS (custom properties for design tokens), vanilla ES5-compatible JS (classic `<script>` tags, no `import`/modules — `file://` loading hits CORS on module scripts). Tests: `playwright-core` driving a real local Chrome, run as a plain Node script (no test framework).

**Spec:** `docs/superpowers/specs/2026-10-06-agent-setup-unified-workspace-design.md` — this plan implements the "左欄：導覽樹" and "中欄：編輯焦點 → 選中 NPC 本身" sections, plus the shared three-pane shell those sections depend on. The right-欄 bag, variant (人物卡) editing, flyout detail panel, and pack mode are out of scope for this plan — Phase 1 renders the right pane as an inert placeholder and the variant focus as a "coming in Phase 2" stub.

## Global Constraints

- No build tooling; the demo must run by opening `index.html` directly from the filesystem.
- No ES module `import`/`export` — `file://` loading throws a CORS error for module scripts (per the inherited project's own documented reason).
- `agent_code`（NPC 代碼）must match `^[A-Z0-9_]{1,80}$` and be unique per (`code`, `usedFor`) pair.
- 人物卡（variant）`code` must match `^[A-Z0-9_]{1,40}$`, must be unique within its own NPC, and is immutable once created.
- Only `AGENT`-type NPCs may have variants created under them; `SWITCH`-type NPCs block variant creation.
- NPC 主檔 fields `code`, `type`, `usedFor` are immutable after creation and must always render as plain text/labels, never as editable inputs (padlock icon next to them), per the inherited "不可編輯的欄位用文字或標籤顯示" design principle.
- Editing must never change the host element's rendered height — read-only values and their editable-mode inputs occupy the same box.
- Disabled actions stay visible and rendered with `disabled`, never removed from the layout (no popping buttons in/out).
- Color tokens (verbatim from the design spec's inherited visual spec) live in `css/tokens.css`:
  `--bg:#f4f5f8; --panel:#fff; --ink:#1d2330; --muted:#6b7280; --line:#e3e6ec; --accent:#4f46e5; --accent-soft:#eef0ff; --ok:#15803d; --ok-soft:#e8f6ec; --warn:#b45309; --warn-soft:#fff4e0; --block:#c62828; --block-soft:#fdecec; --info:#1d4ed8; --info-soft:#e8f0ff; --api:#0284c7; --mcp:#9333ea;`
- Tests run via: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`, using `playwright-core` (installed globally, not as a project dependency) against `/Applications/Google Chrome.app` by default, overridable via `CHROME_PATH`.

## Review Focus

- NPC 代碼格式不符 `^[A-Z0-9_]{1,80}$`（例如小寫字母或符號）：送出「新增 NPC」時必須擋下並顯示錯誤，不能靜默建立或崩潰。
- 兩個 NPC 使用同一組 (`code`, `usedFor`)：第二個必須被擋下，不能覆蓋或重複出現在導覽樹上。
- 在 `SWITCH` 型 NPC 底下按「＋ 新人物卡」：整個操作必須被擋下並顯示原因，不能打開表單。
- 同一個 NPC 底下建立兩張代碼相同的人物卡：第二張必須被擋下，不能讓導覽樹出現兩個同代碼節點。
- 發布模型時必填參數留空，或畫面上還有未儲存的修改：「發布」必須被擋下並說明原因，不能核發版號。

---

## File Structure

```
agent-setup-demo/
├── index.html              # page shell: <head> links css, <body> mounts #app, loads scripts in order
├── css/
│   ├── tokens.css          # :root custom properties (colors, spacing, radii) — shared by all future phases
│   ├── style.css           # base reset, typography, generic .btn/.badge/.label/.pencil-btn components — shared
│   └── workspace.css       # Phase 1 only: 3-pane shell, nav tree, NPC pane. Every selector prefixed `.ws-`
├── js/
│   ├── data.js             # SEED data + cloneSeed(); no DOM code
│   ├── workspace.js        # all `ws`/`WS_`-prefixed rendering + interaction functions for this phase
│   └── app.js               # bootstrap: holds mutable state, render() loop, resetData(), wires workspace.js in
└── tests/
    └── ui.test.cjs          # playwright-core driven end-to-end checks, PASS/FAIL per assertion
```

Load order in `index.html`: `data.js` → `workspace.js` → `app.js`. `app.js` calls `renderApp()` once both prior scripts have defined everything it needs; `workspace.js` never calls into `app.js` except through the single shared `rerender()` function `app.js` exposes on `window` (same "two connection points" discipline the inherited project used between `app.js` and `library.js`).

---

### Task 1: Project scaffold, design tokens, three-pane shell (static)

**Files:**
- Create: `agent-setup-demo/index.html`
- Create: `agent-setup-demo/css/tokens.css`
- Create: `agent-setup-demo/css/style.css`
- Create: `agent-setup-demo/css/workspace.css`
- Create: `agent-setup-demo/js/app.js` (stub `render()` only, no data/workspace logic yet)
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Produces: `#app` root element in `index.html` with three static child containers `#ws-nav`, `#ws-center`, `#ws-bag`, each carrying class `.ws-pane`. `app.js` exposes `window.rerender` (a no-op placeholder in this task, reassigned in Task 2).

- [ ] **Step 1: Write the failing test**

Create `agent-setup-demo/tests/ui.test.cjs`:

```js
const path = require('path');
const { chromium } = require('playwright-core');

const results = [];
function record(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + name + (detail ? ' (' + detail + ')' : ''));
}

async function main() {
  const executablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ executablePath });
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', (err) => jsErrors.push(String(err)));

  await page.goto('file://' + path.resolve(__dirname, '../index.html'));

  const paneCount = await page.locator('.ws-pane').count();
  record('three pane containers exist', paneCount === 3, 'found ' + paneCount);

  const navExists = await page.locator('#ws-nav').count();
  record('#ws-nav exists', navExists === 1);

  const centerExists = await page.locator('#ws-center').count();
  record('#ws-center exists', centerExists === 1);

  const bagExists = await page.locator('#ws-bag').count();
  record('#ws-bag exists', bagExists === 1);

  await browser.close();

  const failed = results.filter((r) => !r.passed).length;
  console.log('\n' + results.length + ' checks, ' + failed + ' failed, ' + jsErrors.length + ' JS errors');
  if (jsErrors.length) console.log('JS errors:', jsErrors);
  process.exit(failed > 0 || jsErrors.length > 0 ? 1 : 0);
}

main();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: fails to launch/navigate because `agent-setup-demo/index.html` does not exist yet (Node throws `ENOENT` or Playwright navigation error — either way, non-zero exit, 0 PASS lines).

- [ ] **Step 3: Write minimal implementation**

Create `agent-setup-demo/css/tokens.css`:

```css
:root {
  --bg: #f4f5f8;
  --panel: #ffffff;
  --ink: #1d2330;
  --muted: #6b7280;
  --line: #e3e6ec;
  --accent: #4f46e5;
  --accent-soft: #eef0ff;
  --ok: #15803d;
  --ok-soft: #e8f6ec;
  --warn: #b45309;
  --warn-soft: #fff4e0;
  --block: #c62828;
  --block-soft: #fdecec;
  --info: #1d4ed8;
  --info-soft: #e8f0ff;
  --api: #0284c7;
  --mcp: #9333ea;
  --gem-bg: #fffaf0;
  --gem-border: #ecd9a8;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --radius: 6px;
}
```

Create `agent-setup-demo/css/style.css`:

```css
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, 'PingFang TC', 'Microsoft JhengHei', sans-serif;
  background: var(--bg);
  color: var(--ink);
  font-size: 14px;
}
.btn {
  padding: 6px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--ink);
  cursor: pointer;
  font-size: 13px;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn-primary:disabled { background: var(--accent); opacity: 0.4; }
.btn-danger { background: var(--block-soft); color: var(--block); border-color: var(--block); }
.label { font-size: 12px; color: var(--muted); display: block; margin-bottom: 4px; }
.badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.badge-locked { background: var(--accent-soft); color: var(--accent); }
.hint { font-size: 12px; color: var(--muted); }
```

Create `agent-setup-demo/css/workspace.css`:

```css
.ws-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.ws-pane {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
}
#ws-nav {
  width: 220px;
  flex-shrink: 0;
  background: #fafafa;
  border-right: 1px solid var(--line);
  padding: var(--space-3);
}
#ws-center {
  flex: 1;
  background: var(--panel);
  padding: var(--space-4);
}
#ws-bag {
  width: 300px;
  flex-shrink: 0;
  background: var(--gem-bg);
  border-left: 1px solid var(--gem-border);
  padding: var(--space-3);
}
```

Create `agent-setup-demo/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <title>Agent 基礎設定</title>
  <link rel="stylesheet" href="css/tokens.css">
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/workspace.css">
</head>
<body>
  <div id="app" class="ws-shell">
    <div id="ws-nav" class="ws-pane"></div>
    <div id="ws-center" class="ws-pane"></div>
    <div id="ws-bag" class="ws-pane"></div>
  </div>
  <script src="js/data.js"></script>
  <script src="js/workspace.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

Create placeholder `agent-setup-demo/js/data.js` (empty for now, filled in Task 2):

```js
// Populated in Task 2.
```

Create placeholder `agent-setup-demo/js/workspace.js` (empty for now, filled in Task 3+):

```js
// Populated starting Task 3.
```

Create `agent-setup-demo/js/app.js`:

```js
function render() {
  // Expanded in later tasks.
}
window.rerender = render;
render();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: `4 checks, 0 failed, 0 JS errors`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): scaffold three-pane shell with design tokens"
```

---

### Task 2: Data model (`data.js`) + app.js bootstrap wiring

**Files:**
- Modify: `agent-setup-demo/js/data.js`
- Modify: `agent-setup-demo/js/app.js`
- Modify: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: nothing new from Task 1 beyond the DOM shell.
- Produces: global `SEED` object and `cloneSeed()` function (from `data.js`); `app.js` holds mutable `appState = { data: cloneSeed(), selection: { npcCode: null, variantCode: null } }` and exposes `window.appState` and `window.rerender` for `workspace.js` to call. `window.resetData()` resets `appState.data` back to a fresh clone of `SEED` and calls `rerender()`.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  const npcCount = await page.evaluate(() => window.appState.data.npcs.length);
  record('SEED has 3 NPCs loaded into appState', npcCount === 3, 'found ' + npcCount);

  const faqNpc = await page.evaluate(() => window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER'));
  record('FAQ_ANSWER NPC present with 2 variants', !!faqNpc && faqNpc.variants.length === 2);

  const switchNpc = await page.evaluate(() => window.appState.data.npcs.find((n) => n.code === 'INTENT_SWITCH'));
  record('INTENT_SWITCH NPC is type SWITCH', !!switchNpc && switchNpc.type === 'SWITCH');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: the 3 new checks FAIL (`window.appState` is `undefined`), existing 4 checks still PASS.

- [ ] **Step 3: Write minimal implementation**

Replace `agent-setup-demo/js/data.js`:

```js
var SEED = {
  npcs: [
    {
      code: 'FAQ_ANSWER',
      type: 'AGENT',
      usedFor: 'customer_service',
      displayName: '客服問答助手',
      avatar: '🧙',
      chatModel: { key: 'openai:gpt-5.5', version: 3, params: { temperature: 0.7, max_tokens: 1024 } },
      vectorModel: { key: 'text-embedding-3-small', version: 1, params: { dimensions: 1536 } },
      retrieval: { topK: 5, scoreThreshold: 0.7, maxContext: 4000 },
      publishedVersion: 2,
      variants: [
        { code: 'STANDARD', name: '一般版', publishedVersion: 2 },
        { code: 'PREMIUM', name: '豪華版', publishedVersion: 1 }
      ]
    },
    {
      code: 'ORDER_ASSIST',
      type: 'AGENT',
      usedFor: 'order_support',
      displayName: '訂單助手',
      avatar: '🧝',
      chatModel: null,
      vectorModel: null,
      retrieval: null,
      publishedVersion: null,
      variants: []
    },
    {
      code: 'INTENT_SWITCH',
      type: 'SWITCH',
      usedFor: 'routing',
      displayName: '意圖分流',
      avatar: '🧑‍💻',
      chatModel: null,
      vectorModel: null,
      retrieval: null,
      publishedVersion: null,
      variants: []
    }
  ],
  modelTemplates: {
    'openai:gpt-5.5': {
      type: 'chat',
      label: 'GPT-5.5 (OpenAI)',
      supportsTools: true,
      params: [
        { key: 'temperature', label: 'Temperature', kind: 'number', min: 0, max: 2, default: 0.7 },
        { key: 'max_tokens', label: 'Max Tokens', kind: 'number', min: 1, max: 8192, default: 1024 }
      ]
    },
    'bedrock:claude-sonnet-5.5': {
      type: 'chat',
      label: 'Claude Sonnet 5.5 (Bedrock)',
      supportsTools: true,
      params: [
        { key: 'temperature', label: 'Temperature', kind: 'number', min: 0, max: 1, default: 0.5 },
        { key: 'max_tokens', label: 'Max Tokens', kind: 'number', min: 1, max: 4096, default: 2048 }
      ]
    },
    'demo:chat-lite': {
      type: 'chat',
      label: 'Chat Lite（示範用，不支援工具呼叫）',
      supportsTools: false,
      params: [
        { key: 'temperature', label: 'Temperature', kind: 'number', min: 0, max: 1, default: 0.3 }
      ]
    },
    'text-embedding-3-small': {
      type: 'vector',
      label: 'text-embedding-3-small',
      params: [
        { key: 'dimensions', label: 'Dimensions', kind: 'enum', enumValues: [512, 1536], default: 1536 }
      ]
    }
  }
};

function cloneSeed() {
  return JSON.parse(JSON.stringify(SEED));
}
```

Replace `agent-setup-demo/js/app.js`:

```js
window.appState = {
  data: cloneSeed(),
  selection: { npcCode: null, variantCode: null }
};

function render() {
  // Expanded in Task 3 (nav tree) and Task 5 (center pane routing).
}

window.rerender = render;

window.resetData = function resetData() {
  window.appState.data = cloneSeed();
  window.appState.selection = { npcCode: null, variantCode: null };
  render();
};

render();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: `7 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): add seed data model and app bootstrap state"
```

---

### Task 3: Left nav tree rendering (list NPCs, expand/collapse, list variants)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/js/app.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Modify: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `window.appState.data.npcs` (from Task 2), `window.appState.selection`, `window.rerender()`.
- Produces: `renderNavTree(state)` returning an HTML string, called by `app.js`'s `render()` and injected into `#ws-nav`. `window.wsToggleNpcExpand(code)` toggles a per-NPC `expanded` flag on `appState.uiState.expandedNpcs` (a `Set`-like plain object keyed by NPC code) and calls `rerender()`.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  const navText1 = await page.locator('#ws-nav').innerText();
  record('nav tree lists FAQ_ANSWER display name', navText1.indexOf('客服問答助手') !== -1);
  record('nav tree lists ORDER_ASSIST display name', navText1.indexOf('訂單助手') !== -1);

  // Collapsed by default: variant names not visible yet.
  record('variants hidden before expand', navText1.indexOf('一般版') === -1);

  await page.click('[data-npc-toggle="FAQ_ANSWER"]');
  const navText2 = await page.locator('#ws-nav').innerText();
  record('expanding FAQ_ANSWER reveals its variants', navText2.indexOf('一般版') !== -1 && navText2.indexOf('豪華版') !== -1);

  await page.click('[data-npc-toggle="FAQ_ANSWER"]');
  const navText3 = await page.locator('#ws-nav').innerText();
  record('collapsing FAQ_ANSWER hides its variants again', navText3.indexOf('一般版') === -1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: the 5 new checks FAIL (`#ws-nav` is empty, `[data-npc-toggle]` not found).

- [ ] **Step 3: Write minimal implementation**

Replace `agent-setup-demo/js/workspace.js`:

```js
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderNavTree(state) {
  var expanded = state.uiState.expandedNpcs;
  var rows = state.data.npcs.map(function (npc) {
    var isExpanded = !!expanded[npc.code];
    var isSwitchType = npc.type === 'SWITCH';
    var npcRow =
      '<div class="ws-nav-npc" data-npc-row="' + npc.code + '">' +
        '<span class="ws-nav-toggle" data-npc-toggle="' + npc.code + '" onclick="wsToggleNpcExpand(\'' + npc.code + '\')">' +
          (isExpanded ? '▾' : '▸') +
        '</span>' +
        '<span class="ws-nav-avatar">' + npc.avatar + '</span>' +
        '<span class="ws-nav-label' + (isSwitchType ? ' ws-nav-label--dim' : '') + '" data-npc-select="' + npc.code + '" onclick="wsSelectNpc(\'' + npc.code + '\')">' +
          escapeHtml(npc.displayName) +
        '</span>' +
      '</div>';

    var variantRows = '';
    if (isExpanded) {
      variantRows = npc.variants.map(function (variant) {
        var versionLabel = variant.publishedVersion ? ('已發布 v' + variant.publishedVersion) : '尚未發布';
        return (
          '<div class="ws-nav-variant" data-variant-row="' + npc.code + '.' + variant.code + '" ' +
            'onclick="wsSelectVariant(\'' + npc.code + '\', \'' + variant.code + '\')">' +
            '<span class="ws-nav-variant-name">' + escapeHtml(variant.name) + '</span>' +
            '<span class="hint">' + versionLabel + '</span>' +
          '</div>'
        );
      }).join('');

      variantRows += isSwitchType
        ? '<div class="ws-nav-variant ws-nav-variant--disabled hint">只有 AGENT 型才能建立人物卡</div>'
        : '<div class="ws-nav-variant ws-nav-create" data-create-variant="' + npc.code + '">＋ 新人物卡</div>';
    }

    return '<div class="ws-nav-group">' + npcRow + variantRows + '</div>';
  }).join('');

  return (
    '<div class="label">NPC／人物卡</div>' +
    rows +
    '<div class="ws-nav-create-npc hint">＋ 新增 NPC</div>'
  );
}

function wsToggleNpcExpand(code) {
  var expanded = window.appState.uiState.expandedNpcs;
  expanded[code] = !expanded[code];
  window.rerender();
}

function wsSelectNpc(code) {
  window.appState.selection = { npcCode: code, variantCode: null };
  window.rerender();
}

function wsSelectVariant(npcCode, variantCode) {
  window.appState.selection = { npcCode: npcCode, variantCode: variantCode };
  window.rerender();
}
```

Replace `agent-setup-demo/js/app.js`:

```js
window.appState = {
  data: cloneSeed(),
  selection: { npcCode: null, variantCode: null },
  uiState: { expandedNpcs: {} }
};

function render() {
  document.getElementById('ws-nav').innerHTML = renderNavTree(window.appState);
}

window.rerender = render;

window.resetData = function resetData() {
  window.appState.data = cloneSeed();
  window.appState.selection = { npcCode: null, variantCode: null };
  window.appState.uiState = { expandedNpcs: {} };
  render();
};

render();
```

Append to `agent-setup-demo/css/workspace.css`:

```css
.ws-nav-group { margin-bottom: var(--space-2); }
.ws-nav-npc { display: flex; align-items: center; gap: 6px; padding: 4px 0; cursor: pointer; }
.ws-nav-toggle { width: 14px; text-align: center; color: var(--muted); }
.ws-nav-label { font-size: 13px; }
.ws-nav-label--dim { color: var(--muted); }
.ws-nav-variant { padding: 4px 0 4px 28px; font-size: 12px; display: flex; justify-content: space-between; cursor: pointer; }
.ws-nav-variant--disabled { cursor: not-allowed; }
.ws-nav-create { color: var(--accent); cursor: pointer; }
.ws-nav-create-npc { margin-top: var(--space-3); color: var(--accent); cursor: pointer; font-size: 13px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: `12 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): render left nav tree with expand/collapse"
```

---

### Task 4: Center pane routing (NPC focus vs variant focus placeholder)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/js/app.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Modify: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `window.appState.selection` (from Task 3), `window.appState.data.npcs`.
- Produces: `renderCenterPane(state)` returning an HTML string. When `selection.npcCode` is set and `selection.variantCode` is null, renders the (stub, filled in Task 8–12) NPC pane container `<div id="ws-npc-pane">`. When `selection.variantCode` is set, renders a placeholder `<div class="ws-variant-stub">人物卡編輯將於 Phase 2 提供</div>`. When nothing selected, renders an empty-state hint.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  const centerEmptyText = await page.locator('#ws-center').innerText();
  record('center pane shows empty-state hint before any selection', centerEmptyText.indexOf('請從左側選擇') !== -1, centerEmptyText);

  await page.click('[data-npc-select="FAQ_ANSWER"]');
  const npcPaneCount = await page.locator('#ws-npc-pane').count();
  record('selecting an NPC renders #ws-npc-pane', npcPaneCount === 1);

  await page.click('[data-npc-toggle="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.STANDARD"]');
  const variantStubCount = await page.locator('.ws-variant-stub').count();
  record('selecting a variant renders the Phase 2 stub', variantStubCount === 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: the 3 new checks FAIL (`#ws-center` is empty, no selection handling yet).

- [ ] **Step 3: Write minimal implementation**

Append to `agent-setup-demo/js/workspace.js`:

```js
function renderCenterPane(state) {
  var sel = state.selection;
  if (!sel.npcCode) {
    return '<div class="hint">請從左側選擇一個 NPC 或人物卡開始編輯。</div>';
  }
  if (sel.variantCode) {
    return '<div class="ws-variant-stub hint">人物卡編輯將於 Phase 2 提供。</div>';
  }
  return '<div id="ws-npc-pane"></div>';
}
```

Replace `render()` in `agent-setup-demo/js/app.js`:

```js
function render() {
  document.getElementById('ws-nav').innerHTML = renderNavTree(window.appState);
  document.getElementById('ws-center').innerHTML = renderCenterPane(window.appState);
}
```

(No CSS changes required beyond what Task 1 already provides for `#ws-center`; `.ws-variant-stub` reuses `.hint`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: `15 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): route center pane between empty/NPC/variant-stub states"
```

---

### Task 5: "+ 新增 NPC" flow with validation

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Modify: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `renderNavTree` (Task 3), `window.appState.data.npcs`.
- Produces: `window.wsShowCreateNpcForm()`, `window.wsCancelCreateNpcForm()`, `window.wsSubmitCreateNpc()`. Validation helper `wsValidateNpcCode(code, usedFor, npcs)` returning `null` (valid) or an error string — exported as a plain function so later tasks/tests can call it directly via `page.evaluate`.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  await page.click('.ws-nav-create-npc');
  const formVisible = await page.locator('[data-npc-form]').count();
  record('clicking + 新增 NPC opens the create form', formVisible === 1);

  await page.fill('[data-npc-form-code]', 'bad code!');
  await page.click('[data-npc-form-submit]');
  const errorText1 = await page.locator('[data-npc-form-error]').innerText();
  record('invalid code shows a validation error and does not create', errorText1.length > 0, errorText1);
  const npcCountAfterBad = await page.evaluate(() => window.appState.data.npcs.length);
  record('invalid code did not add an NPC', npcCountAfterBad === 3, 'count=' + npcCountAfterBad);

  await page.fill('[data-npc-form-code]', 'DATA_ANALYST');
  await page.fill('[data-npc-form-name]', '數據分析助手');
  await page.click('[data-npc-form-submit]');
  const npcCountAfterGood = await page.evaluate(() => window.appState.data.npcs.length);
  record('valid code creates a new NPC', npcCountAfterGood === 4, 'count=' + npcCountAfterGood);
  const selectedCode = await page.evaluate(() => window.appState.selection.npcCode);
  record('newly created NPC is auto-selected', selectedCode === 'DATA_ANALYST');

  const dupError = await page.evaluate(function () {
    return wsValidateNpcCode('FAQ_ANSWER', 'customer_service', window.appState.data.npcs);
  });
  record('duplicate code+usedFor is rejected by validator', typeof dupError === 'string' && dupError.length > 0, dupError);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: the 6 new checks FAIL (`.ws-nav-create-npc` has no click handler yet).

- [ ] **Step 3: Write minimal implementation**

Append to `agent-setup-demo/js/workspace.js`:

```js
function wsValidateNpcCode(code, usedFor, npcs) {
  if (!/^[A-Z0-9_]{1,80}$/.test(code)) {
    return '代碼只能是大寫英數字與底線，長度 1–80';
  }
  var duplicate = npcs.some(function (n) { return n.code === code && n.usedFor === usedFor; });
  if (duplicate) {
    return '同一場域內已有相同代碼的 NPC';
  }
  return null;
}

function wsShowCreateNpcForm() {
  window.appState.uiState.creatingNpc = true;
  window.rerender();
}

function wsCancelCreateNpcForm() {
  window.appState.uiState.creatingNpc = false;
  window.rerender();
}

function wsSubmitCreateNpc() {
  var codeInput = document.querySelector('[data-npc-form-code]');
  var nameInput = document.querySelector('[data-npc-form-name]');
  var code = codeInput.value.trim();
  var name = nameInput.value.trim();
  var usedFor = 'general';
  var error = wsValidateNpcCode(code, usedFor, window.appState.data.npcs);
  if (error) {
    window.appState.uiState.npcFormError = error;
    window.rerender();
    return;
  }
  window.appState.data.npcs.push({
    code: code,
    type: 'AGENT',
    usedFor: usedFor,
    displayName: name || code,
    avatar: '🧑‍🔧',
    chatModel: null,
    vectorModel: null,
    retrieval: null,
    publishedVersion: null,
    variants: []
  });
  window.appState.uiState.creatingNpc = false;
  window.appState.uiState.npcFormError = null;
  window.appState.selection = { npcCode: code, variantCode: null };
  window.rerender();
}
```

Update `renderNavTree` in `agent-setup-demo/js/workspace.js` — replace the final line that builds the "+ 新增 NPC" trigger:

```js
  var createNpcBlock;
  if (state.uiState.creatingNpc) {
    var err = state.uiState.npcFormError;
    createNpcBlock =
      '<div class="ws-nav-form" data-npc-form>' +
        '<input class="ws-nav-form-input" data-npc-form-code placeholder="代碼 e.g. DATA_ANALYST">' +
        '<input class="ws-nav-form-input" data-npc-form-name placeholder="顯示名稱">' +
        (err ? '<div class="ws-nav-form-error" data-npc-form-error>' + escapeHtml(err) + '</div>' : '') +
        '<div class="ws-nav-form-actions">' +
          '<button class="btn" onclick="wsCancelCreateNpcForm()">取消</button>' +
          '<button class="btn btn-primary" data-npc-form-submit onclick="wsSubmitCreateNpc()">建立</button>' +
        '</div>' +
      '</div>';
  } else {
    createNpcBlock = '<div class="ws-nav-create-npc hint" onclick="wsShowCreateNpcForm()">＋ 新增 NPC</div>';
  }

  return (
    '<div class="label">NPC／人物卡</div>' +
    rows +
    createNpcBlock
  );
```

(This replaces the previous final `return` statement in `renderNavTree`; the `rows` variable and everything above it from Task 3 stays unchanged.)

Append to `agent-setup-demo/css/workspace.css`:

```css
.ws-nav-form { margin-top: var(--space-2); display: flex; flex-direction: column; gap: 6px; }
.ws-nav-form-input { padding: 4px 6px; border: 1px solid var(--line); border-radius: 4px; font-size: 12px; }
.ws-nav-form-error { color: var(--block); font-size: 11px; }
.ws-nav-form-actions { display: flex; gap: 6px; justify-content: flex-end; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: `21 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): add create-NPC inline form with validation"
```

---

### Task 6: "+ 新人物卡" inline form with SWITCH-type block

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Modify: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsValidateNpcCode` pattern (Task 5, adapted), `renderNavTree`.
- Produces: `window.wsShowCreateVariantForm(npcCode)`, `window.wsCancelCreateVariantForm(npcCode)`, `window.wsSubmitCreateVariant(npcCode)`, `wsValidateVariantCode(code, npc)`.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  await page.click('[data-npc-toggle="ORDER_ASSIST"]');
  await page.click('[data-create-variant="ORDER_ASSIST"]');
  const variantFormVisible = await page.locator('[data-variant-form="ORDER_ASSIST"]').count();
  record('clicking + 新人物卡 opens inline form', variantFormVisible === 1);

  await page.fill('[data-variant-form-code="ORDER_ASSIST"]', 'bad-code');
  await page.click('[data-variant-form-submit="ORDER_ASSIST"]');
  const variantErrorText = await page.locator('[data-variant-form-error="ORDER_ASSIST"]').innerText();
  record('invalid variant code shows error', variantErrorText.length > 0, variantErrorText);

  await page.fill('[data-variant-form-code="ORDER_ASSIST"]', 'BASIC');
  await page.fill('[data-variant-form-name="ORDER_ASSIST"]', '基本版');
  await page.click('[data-variant-form-submit="ORDER_ASSIST"]');
  const orderAssistVariantCount = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'ORDER_ASSIST'; }).variants.length;
  });
  record('valid code creates the variant', orderAssistVariantCount === 1, 'count=' + orderAssistVariantCount);
  const selectedVariant = await page.evaluate(() => window.appState.selection.variantCode);
  record('newly created variant is auto-selected', selectedVariant === 'BASIC');

  await page.click('[data-npc-toggle="INTENT_SWITCH"]');
  const switchCreateDisabled = await page.locator('[data-npc-row="INTENT_SWITCH"] + .ws-nav-variant.ws-nav-create').count();
  record('SWITCH-type NPC has no clickable + 新人物卡 trigger', switchCreateDisabled === 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: the new checks FAIL for the first two (`[data-create-variant]` has no click handler) — the SWITCH-type check actually already PASSes from Task 3's rendering, confirm it still does.

- [ ] **Step 3: Write minimal implementation**

Append to `agent-setup-demo/js/workspace.js`:

```js
function wsValidateVariantCode(code, npc) {
  if (!/^[A-Z0-9_]{1,40}$/.test(code)) {
    return '代碼只能是大寫英數字與底線，長度 1–40';
  }
  var duplicate = npc.variants.some(function (v) { return v.code === code; });
  if (duplicate) {
    return '這個 NPC 底下已有相同代碼的人物卡';
  }
  return null;
}

function wsShowCreateVariantForm(npcCode) {
  window.appState.uiState.creatingVariantFor = npcCode;
  window.rerender();
}

function wsCancelCreateVariantForm() {
  window.appState.uiState.creatingVariantFor = null;
  window.rerender();
}

function wsSubmitCreateVariant(npcCode) {
  var npc = window.appState.data.npcs.find(function (n) { return n.code === npcCode; });
  var codeInput = document.querySelector('[data-variant-form-code="' + npcCode + '"]');
  var nameInput = document.querySelector('[data-variant-form-name="' + npcCode + '"]');
  var code = codeInput.value.trim();
  var name = nameInput.value.trim();
  var error = wsValidateVariantCode(code, npc);
  if (error) {
    window.appState.uiState.variantFormError = error;
    window.rerender();
    return;
  }
  npc.variants.push({ code: code, name: name || code, publishedVersion: null });
  window.appState.uiState.creatingVariantFor = null;
  window.appState.uiState.variantFormError = null;
  window.appState.selection = { npcCode: npcCode, variantCode: code };
  window.rerender();
}
```

Update the `variantRows` assembly inside `renderNavTree` (Task 3's block) — replace the `else` branch that produced the static "＋ 新人物卡" div:

```js
      if (isSwitchType) {
        variantRows += '<div class="ws-nav-variant ws-nav-variant--disabled hint">只有 AGENT 型才能建立人物卡</div>';
      } else if (state.uiState.creatingVariantFor === npc.code) {
        var vErr = state.uiState.variantFormError;
        variantRows +=
          '<div class="ws-nav-form" data-variant-form="' + npc.code + '">' +
            '<input class="ws-nav-form-input" data-variant-form-code="' + npc.code + '" placeholder="代碼 e.g. BASIC">' +
            '<input class="ws-nav-form-input" data-variant-form-name="' + npc.code + '" placeholder="名稱">' +
            (vErr ? '<div class="ws-nav-form-error" data-variant-form-error="' + npc.code + '">' + escapeHtml(vErr) + '</div>' : '') +
            '<div class="ws-nav-form-actions">' +
              '<button class="btn" onclick="wsCancelCreateVariantForm()">取消</button>' +
              '<button class="btn btn-primary" data-variant-form-submit="' + npc.code + '" onclick="wsSubmitCreateVariant(\'' + npc.code + '\')">建立</button>' +
            '</div>' +
          '</div>';
      } else {
        variantRows += '<div class="ws-nav-variant ws-nav-create" data-create-variant="' + npc.code + '" onclick="wsShowCreateVariantForm(\'' + npc.code + '\')">＋ 新人物卡</div>';
      }
```

(This replaces the ternary that previously set `variantRows +=` with the switch-type check inline; remove the old single-line version from Task 3.)

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: `26 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): add create-variant inline form, block it for SWITCH NPCs"
```

---

### Task 7: NPC pane read-only view (主檔)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Modify: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `#ws-npc-pane` container (Task 4), `window.appState.data.npcs`, `window.appState.selection.npcCode`.
- Produces: `renderNpcPane(state)` called whenever `#ws-npc-pane` exists; wired into `app.js`'s `render()` as a second pass after the center pane markup is injected (so the container exists in the DOM before we fill it).

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  await page.click('[data-npc-select="FAQ_ANSWER"]');
  const npcPaneText = await page.locator('#ws-npc-pane').innerText();
  record('NPC pane shows displayName', npcPaneText.indexOf('客服問答助手') !== -1);
  record('NPC pane shows locked code as text', npcPaneText.indexOf('FAQ_ANSWER') !== -1);

  const codeIsInput = await page.locator('#ws-npc-pane input[value="FAQ_ANSWER"]').count();
  record('locked code field is not an input', codeIsInput === 0);

  const lockIconCount = await page.locator('#ws-npc-pane .badge-locked').count();
  record('locked fields show the lock badge (code, type, usedFor = 3)', lockIconCount === 3, 'found ' + lockIconCount);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: the 4 new checks FAIL (`#ws-npc-pane` is empty — Task 4 only created the empty container).

- [ ] **Step 3: Write minimal implementation**

Append to `agent-setup-demo/js/workspace.js`:

```js
function wsFindNpc(state) {
  return state.data.npcs.find(function (n) { return n.code === state.selection.npcCode; });
}

function renderNpcPane(state) {
  var container = document.getElementById('ws-npc-pane');
  if (!container) return;
  var npc = wsFindNpc(state);
  if (!npc) { container.innerHTML = ''; return; }

  container.innerHTML =
    '<div class="ws-npc-header">' +
      '<span class="ws-npc-avatar">' + npc.avatar + '</span>' +
      '<span class="ws-npc-name">' + escapeHtml(npc.displayName) + '</span>' +
    '</div>' +
    '<div class="ws-npc-field">' +
      '<span class="badge badge-locked">🔒 代碼</span> ' + escapeHtml(npc.code) +
    '</div>' +
    '<div class="ws-npc-field">' +
      '<span class="badge badge-locked">🔒 類型</span> ' + escapeHtml(npc.type) +
    '</div>' +
    '<div class="ws-npc-field">' +
      '<span class="badge badge-locked">🔒 場域</span> ' + escapeHtml(npc.usedFor) +
    '</div>' +
    '<div id="ws-npc-model-section"></div>';
}
```

Update `render()` in `agent-setup-demo/js/app.js`:

```js
function render() {
  document.getElementById('ws-nav').innerHTML = renderNavTree(window.appState);
  document.getElementById('ws-center').innerHTML = renderCenterPane(window.appState);
  renderNpcPane(window.appState);
}
```

Append to `agent-setup-demo/css/workspace.css`:

```css
.ws-npc-header { display: flex; align-items: center; gap: 10px; margin-bottom: var(--space-3); }
.ws-npc-avatar { font-size: 28px; }
.ws-npc-name { font-size: 18px; font-weight: 600; }
.ws-npc-field { margin-bottom: var(--space-2); font-size: 13px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: `30 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): render read-only NPC main-record pane"
```

---

### Task 8: NPC pane edit mode (displayName/avatar via pencil)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Modify: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `renderNpcPane` (Task 7).
- Produces: `window.wsStartEditNpcBasics()`, `window.wsCommitEditNpcBasics()`, `window.wsCancelEditNpcBasics()`.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  const pencilCount = await page.locator('[data-npc-edit-pencil]').count();
  record('NPC pane has an edit pencil', pencilCount === 1);

  await page.click('[data-npc-edit-pencil]');
  const nameInputCount = await page.locator('[data-npc-name-input]').count();
  record('clicking pencil turns displayName into an input', nameInputCount === 1);
  const codeStillLocked = await page.locator('#ws-npc-pane input[value="FAQ_ANSWER"]').count();
  record('code stays locked text even in edit mode', codeStillLocked === 0);

  await page.fill('[data-npc-name-input]', '客服智慧助手');
  await page.click('[data-npc-edit-commit]');
  const savedName = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'FAQ_ANSWER'; }).displayName;
  });
  record('committing edit persists the new displayName', savedName === '客服智慧助手', savedName);
  const backToReadOnly = await page.locator('[data-npc-name-input]').count();
  record('after commit, pane returns to read-only', backToReadOnly === 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: the 5 new checks FAIL (no pencil rendered yet).

- [ ] **Step 3: Write minimal implementation**

Replace the `'<div class="ws-npc-header">...'` block inside `renderNpcPane` in `agent-setup-demo/js/workspace.js`:

```js
  var editing = state.uiState.editingNpcBasics;
  var headerBlock;
  if (editing) {
    headerBlock =
      '<div class="ws-npc-header">' +
        '<span class="ws-npc-avatar">' + npc.avatar + '</span>' +
        '<input class="ws-npc-name-input" data-npc-name-input value="' + escapeHtml(npc.displayName) + '">' +
        '<button class="btn btn-primary" data-npc-edit-commit onclick="wsCommitEditNpcBasics()">✓</button>' +
        '<button class="btn" onclick="wsCancelEditNpcBasics()">取消</button>' +
      '</div>';
  } else {
    headerBlock =
      '<div class="ws-npc-header">' +
        '<span class="ws-npc-avatar">' + npc.avatar + '</span>' +
        '<span class="ws-npc-name">' + escapeHtml(npc.displayName) + '</span>' +
        '<button class="btn" data-npc-edit-pencil onclick="wsStartEditNpcBasics()">✎</button>' +
      '</div>';
  }

  container.innerHTML =
    headerBlock +
    '<div class="ws-npc-field">' +
```

(Keep the three locked-field `div`s and the trailing `'<div id="ws-npc-model-section"></div>';` exactly as Task 7 left them — only the header block at the top changes.)

Append to `agent-setup-demo/js/workspace.js`:

```js
function wsStartEditNpcBasics() {
  window.appState.uiState.editingNpcBasics = true;
  window.rerender();
}

function wsCancelEditNpcBasics() {
  window.appState.uiState.editingNpcBasics = false;
  window.rerender();
}

function wsCommitEditNpcBasics() {
  var npc = wsFindNpc(window.appState);
  var nameInput = document.querySelector('[data-npc-name-input]');
  npc.displayName = nameInput.value.trim() || npc.displayName;
  window.appState.uiState.editingNpcBasics = false;
  window.rerender();
}
```

Append to `agent-setup-demo/css/workspace.css`:

```css
.ws-npc-name-input { font-size: 16px; padding: 4px 8px; border: 1px solid var(--accent); border-radius: 4px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: `35 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): add pencil-driven edit mode for NPC display name"
```

---

### Task 9: 加入模型 (attach a chat/vector model from a template)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Modify: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `window.appState.data.modelTemplates` (Task 2), `#ws-npc-model-section` container (Task 7).
- Produces: `renderModelSection(state)`, `window.wsSelectModelTemplate(kind, templateKey)`, `window.wsConfirmAddModel(kind)` where `kind` is `'chatModel'` or `'vectorModel'`.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  await page.click('[data-npc-select="ORDER_ASSIST"]');
  const noModelHint = await page.locator('#ws-npc-model-section').innerText();
  record('ORDER_ASSIST shows no-chat-model state', noModelHint.indexOf('尚未設定對話模型') !== -1, noModelHint);

  await page.click('[data-add-model="chatModel"]');
  const templateSelectCount = await page.locator('[data-model-template-select="chatModel"]').count();
  record('clicking 加入模型 shows a template dropdown', templateSelectCount === 1);

  await page.selectOption('[data-model-template-select="chatModel"]', 'bedrock:claude-sonnet-5.5');
  await page.click('[data-model-confirm="chatModel"]');
  const chatModelKey = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'ORDER_ASSIST'; }).chatModel.key;
  });
  record('confirming attaches the chosen template', chatModelKey === 'bedrock:claude-sonnet-5.5', chatModelKey);

  const chatModelParams = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'ORDER_ASSIST'; }).chatModel.params;
  });
  record('attached model gets default params from template', chatModelParams.temperature === 0.5 && chatModelParams.max_tokens === 2048, JSON.stringify(chatModelParams));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: the 4 new checks FAIL (`#ws-npc-model-section` is empty).

- [ ] **Step 3: Write minimal implementation**

Append to `agent-setup-demo/js/workspace.js`:

```js
function wsModelKindLabel(kind) {
  return kind === 'chatModel' ? '對話模型' : '向量模型';
}

function wsTemplatesForKind(kind) {
  var templates = window.appState.data.modelTemplates;
  var wantType = kind === 'chatModel' ? 'chat' : 'vector';
  return Object.keys(templates).filter(function (key) { return templates[key].type === wantType; });
}

function renderModelBlock(npc, kind) {
  var model = npc[kind];
  var label = wsModelKindLabel(kind);
  var adding = window.appState.uiState.addingModelKind === kind;

  if (model) {
    var template = window.appState.data.modelTemplates[model.key];
    return (
      '<div class="ws-model-block">' +
        '<div class="label">' + label + '</div>' +
        '<div>' + escapeHtml(template ? template.label : model.key) + ' <span class="hint">v' + model.version + '</span></div>' +
      '</div>'
    );
  }

  if (adding) {
    var options = wsTemplatesForKind(kind).map(function (key) {
      return '<option value="' + key + '">' + escapeHtml(window.appState.data.modelTemplates[key].label) + '</option>';
    }).join('');
    return (
      '<div class="ws-model-block">' +
        '<div class="label">' + label + '</div>' +
        '<select data-model-template-select="' + kind + '">' +
          '<option value="">-- 選擇樣板 --</option>' +
          options +
        '</select>' +
        '<button class="btn btn-primary" data-model-confirm="' + kind + '" onclick="wsConfirmAddModel(\'' + kind + '\')">確認加入</button>' +
        '<button class="btn" onclick="wsCancelAddModel()">取消</button>' +
      '</div>'
    );
  }

  return (
    '<div class="ws-model-block">' +
      '<div class="label">' + label + '</div>' +
      '<div class="hint">尚未設定' + label + '</div>' +
      '<button class="btn" data-add-model="' + kind + '" onclick="wsStartAddModel(\'' + kind + '\')">＋ 加入模型</button>' +
    '</div>'
  );
}

function renderModelSection(state) {
  var container = document.getElementById('ws-npc-model-section');
  if (!container) return;
  var npc = wsFindNpc(state);
  if (!npc) { container.innerHTML = ''; return; }
  container.innerHTML = renderModelBlock(npc, 'chatModel') + renderModelBlock(npc, 'vectorModel');
}

function wsStartAddModel(kind) {
  window.appState.uiState.addingModelKind = kind;
  window.rerender();
}

function wsCancelAddModel() {
  window.appState.uiState.addingModelKind = null;
  window.rerender();
}

function wsConfirmAddModel(kind) {
  var select = document.querySelector('[data-model-template-select="' + kind + '"]');
  var templateKey = select.value;
  var template = window.appState.data.modelTemplates[templateKey];
  if (!template) return;
  var npc = wsFindNpc(window.appState);
  var defaultParams = {};
  template.params.forEach(function (p) { defaultParams[p.key] = p.default; });
  npc[kind] = { key: templateKey, version: 1, params: defaultParams };
  window.appState.uiState.addingModelKind = null;
  window.rerender();
}
```

Update `render()` in `agent-setup-demo/js/app.js`:

```js
function render() {
  document.getElementById('ws-nav').innerHTML = renderNavTree(window.appState);
  document.getElementById('ws-center').innerHTML = renderCenterPane(window.appState);
  renderNpcPane(window.appState);
  renderModelSection(window.appState);
}
```

Append to `agent-setup-demo/css/workspace.css`:

```css
.ws-model-block { margin-bottom: var(--space-3); padding: var(--space-2); border: 1px solid var(--line); border-radius: var(--radius); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: `39 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): add 加入模型 flow with template-driven defaults"
```

---

### Task 10: 模型參數編輯 with type/range validation

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Modify: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `renderModelBlock` (Task 9).
- Produces: `window.wsEditModelParam(kind, paramKey, rawValue)` (updates a pending-edit buffer, not the committed model yet), `window.wsSaveModelParams(kind)` (validates and commits), `wsValidateParamValue(paramDef, rawValue)` returning `{ ok: boolean, value, message }`.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  await page.click('[data-npc-select="FAQ_ANSWER"]');
  const tempValue = await page.locator('[data-model-param-input="chatModel.temperature"]').inputValue();
  record('chat model temperature param shows current value', tempValue === '0.7', tempValue);

  await page.fill('[data-model-param-input="chatModel.temperature"]', '5');
  await page.click('[data-model-param-save="chatModel"]');
  const rangeError = await page.locator('[data-model-param-error="chatModel"]').innerText();
  record('out-of-range number is rejected with a message', rangeError.length > 0, rangeError);
  const unchangedTemp = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'FAQ_ANSWER'; }).chatModel.params.temperature;
  });
  record('out-of-range value is not persisted', unchangedTemp === 0.7, unchangedTemp);

  await page.fill('[data-model-param-input="chatModel.temperature"]', '0.9');
  await page.click('[data-model-param-save="chatModel"]');
  const savedTemp = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'FAQ_ANSWER'; }).chatModel.params.temperature;
  });
  record('in-range value is saved', savedTemp === 0.9, savedTemp);

  const dimensionsSelectValue = await page.locator('[data-model-param-input="vectorModel.dimensions"]').inputValue();
  record('enum param renders as a select with current value', dimensionsSelectValue === '1536', dimensionsSelectValue);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: the 5 new checks FAIL (`renderModelBlock` from Task 9 does not render param inputs for already-attached models yet).

- [ ] **Step 3: Write minimal implementation**

Replace the "model attached" branch inside `renderModelBlock` in `agent-setup-demo/js/workspace.js`:

```js
  if (model) {
    var template = window.appState.data.modelTemplates[model.key];
    var paramsHtml = (template ? template.params : []).map(function (p) {
      var pendingKey = kind + '.' + p.key;
      var currentValue = window.appState.uiState.modelParamEdits[pendingKey] !== undefined
        ? window.appState.uiState.modelParamEdits[pendingKey]
        : model.params[p.key];
      if (p.kind === 'enum') {
        var opts = p.enumValues.map(function (v) {
          return '<option value="' + v + '"' + (String(v) === String(currentValue) ? ' selected' : '') + '>' + v + '</option>';
        }).join('');
        return (
          '<div class="ws-param-row">' +
            '<span class="label">' + escapeHtml(p.label) + '</span>' +
            '<select data-model-param-input="' + pendingKey + '" onchange="wsEditModelParam(\'' + kind + '\', \'' + p.key + '\', this.value)">' + opts + '</select>' +
          '</div>'
        );
      }
      return (
        '<div class="ws-param-row">' +
          '<span class="label">' + escapeHtml(p.label) + '</span>' +
          '<input data-model-param-input="' + pendingKey + '" value="' + escapeHtml(currentValue) + '" ' +
            'oninput="wsEditModelParam(\'' + kind + '\', \'' + p.key + '\', this.value)">' +
        '</div>'
      );
    }).join('');

    var paramError = window.appState.uiState.modelParamErrors[kind];

    return (
      '<div class="ws-model-block">' +
        '<div class="label">' + label + '</div>' +
        '<div>' + escapeHtml(template ? template.label : model.key) + ' <span class="hint">v' + model.version + '</span></div>' +
        paramsHtml +
        (paramError ? '<div class="ws-param-error" data-model-param-error="' + kind + '">' + escapeHtml(paramError) + '</div>' : '') +
        '<button class="btn btn-primary" data-model-param-save="' + kind + '" onclick="wsSaveModelParams(\'' + kind + '\')">儲存參數</button>' +
      '</div>'
    );
  }
```

Append to `agent-setup-demo/js/workspace.js`:

```js
function wsValidateParamValue(paramDef, rawValue) {
  if (paramDef.kind === 'number') {
    var num = Number(rawValue);
    if (isNaN(num)) return { ok: false, message: paramDef.label + ' 必須是數字' };
    if (num < paramDef.min || num > paramDef.max) {
      return { ok: false, message: paramDef.label + ' 必須介於 ' + paramDef.min + ' 到 ' + paramDef.max + ' 之間' };
    }
    return { ok: true, value: num };
  }
  if (paramDef.kind === 'enum') {
    var matches = paramDef.enumValues.some(function (v) { return String(v) === String(rawValue); });
    if (!matches) {
      return { ok: true, value: rawValue, message: paramDef.label + ' 不是建議值，執行時會忽略' };
    }
    return { ok: true, value: paramDef.enumValues.filter(function (v) { return String(v) === String(rawValue); })[0] };
  }
  return { ok: true, value: rawValue };
}

function wsEditModelParam(kind, paramKey, rawValue) {
  window.appState.uiState.modelParamEdits[kind + '.' + paramKey] = rawValue;
}

function wsSaveModelParams(kind) {
  var npc = wsFindNpc(window.appState);
  var model = npc[kind];
  var template = window.appState.data.modelTemplates[model.key];
  var newParams = {};
  for (var i = 0; i < template.params.length; i++) {
    var p = template.params[i];
    var pendingKey = kind + '.' + p.key;
    var raw = window.appState.uiState.modelParamEdits[pendingKey];
    var rawValue = raw !== undefined ? raw : model.params[p.key];
    var result = wsValidateParamValue(p, rawValue);
    if (!result.ok) {
      window.appState.uiState.modelParamErrors[kind] = result.message;
      window.rerender();
      return;
    }
    newParams[p.key] = result.value;
  }
  model.params = newParams;
  window.appState.uiState.modelParamErrors[kind] = null;
  template.params.forEach(function (p) { delete window.appState.uiState.modelParamEdits[kind + '.' + p.key]; });
  window.rerender();
}
```

Update `agent-setup-demo/js/app.js` to initialize the two new `uiState` buckets:

```js
window.appState = {
  data: cloneSeed(),
  selection: { npcCode: null, variantCode: null },
  uiState: {
    expandedNpcs: {},
    creatingNpc: false,
    npcFormError: null,
    creatingVariantFor: null,
    variantFormError: null,
    editingNpcBasics: false,
    addingModelKind: null,
    modelParamEdits: {},
    modelParamErrors: {}
  }
};
```

And update `resetData()` in the same file to reset the full `uiState` object to that same shape (copy the literal above into `resetData`'s assignment instead of the old `{ expandedNpcs: {} }`).

Append to `agent-setup-demo/css/workspace.css`:

```css
.ws-param-row { display: flex; justify-content: space-between; align-items: center; margin: 4px 0; font-size: 12px; }
.ws-param-row input, .ws-param-row select { width: 100px; padding: 2px 6px; }
.ws-param-error { color: var(--block); font-size: 11px; margin: 4px 0; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: `44 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): add model param editing with range/enum validation"
```

---

### Task 11: 發布模型 (publish/version bump with required-param + unsaved-change checks)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Modify: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `renderModelBlock`, `wsSaveModelParams` (Task 10).
- Produces: `window.wsPublishModel(kind)`, `wsPublishModelErrors(npc, kind)` (pure function returning an array of blocking-reason strings, empty = publishable).

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  await page.click('[data-npc-select="FAQ_ANSWER"]');
  const publishBtnCount = await page.locator('[data-model-publish="chatModel"]').count();
  record('attached chat model shows a publish button', publishBtnCount === 1);

  // Unsaved edit should block publish.
  await page.fill('[data-model-param-input="chatModel.temperature"]', '0.3');
  await page.click('[data-model-publish="chatModel"]');
  const unsavedBlock = await page.locator('[data-model-param-error="chatModel"]').innerText();
  record('publishing with unsaved param edits is blocked', unsavedBlock.indexOf('未儲存') !== -1, unsavedBlock);
  const versionUnchanged1 = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'FAQ_ANSWER'; }).chatModel.version;
  });
  record('version did not bump while blocked', versionUnchanged1 === 1, versionUnchanged1);

  // Save first, then publish should succeed.
  await page.click('[data-model-param-save="chatModel"]');
  await page.click('[data-model-publish="chatModel"]');
  const versionBumped = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'FAQ_ANSWER'; }).chatModel.version;
  });
  record('publish bumps the version by 1', versionBumped === 2, versionBumped);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: the 4 new checks FAIL (no publish button rendered yet).

- [ ] **Step 3: Write minimal implementation**

In `renderModelBlock` (the "model attached" branch from Task 10), add a publish button after the save button — replace the final line of that branch:

```js
        (paramError ? '<div class="ws-param-error" data-model-param-error="' + kind + '">' + escapeHtml(paramError) + '</div>' : '') +
        '<button class="btn btn-primary" data-model-param-save="' + kind + '" onclick="wsSaveModelParams(\'' + kind + '\')">儲存參數</button>' +
        '<button class="btn" data-model-publish="' + kind + '" onclick="wsPublishModel(\'' + kind + '\')">🚀 發布</button>' +
      '</div>'
    );
  }
```

Append to `agent-setup-demo/js/workspace.js`:

```js
function wsHasUnsavedModelEdits(kind) {
  var template = window.appState.data.modelTemplates[wsFindNpc(window.appState)[kind].key];
  return template.params.some(function (p) {
    return window.appState.uiState.modelParamEdits[kind + '.' + p.key] !== undefined;
  });
}

function wsPublishModelErrors(npc, kind) {
  var model = npc[kind];
  var errors = [];
  if (wsHasUnsavedModelEdits(kind)) {
    errors.push('有未儲存的參數修改，請先儲存參數');
  }
  var template = window.appState.data.modelTemplates[model.key];
  template.params.forEach(function (p) {
    if (p.kind === 'number' && (model.params[p.key] === '' || model.params[p.key] === null || model.params[p.key] === undefined)) {
      errors.push(p.label + ' 為必填');
    }
  });
  return errors;
}

function wsPublishModel(kind) {
  var npc = wsFindNpc(window.appState);
  var errors = wsPublishModelErrors(npc, kind);
  if (errors.length > 0) {
    window.appState.uiState.modelParamErrors[kind] = errors.join('；');
    window.rerender();
    return;
  }
  npc[kind].version += 1;
  window.appState.uiState.modelParamErrors[kind] = null;
  window.rerender();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: `48 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): add publish-model flow with unsaved-edit and required-param checks"
```

---

### Task 12: Right pane placeholder + reset-data wiring + full-flow smoke test

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/index.html`
- Modify: `agent-setup-demo/css/workspace.css`
- Modify: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: everything above.
- Produces: `renderBagPlaceholder()` filling `#ws-bag` with an inert "Phase 2 開發中" notice; a visible "重置示範資料" control wired to `window.resetData()`.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  const bagPlaceholderText = await page.locator('#ws-bag').innerText();
  record('right pane shows the Phase 2 placeholder', bagPlaceholderText.indexOf('背包功能將於 Phase') !== -1, bagPlaceholderText);

  await page.click('[data-reset-data]');
  const npcCountAfterReset = await page.evaluate(() => window.appState.data.npcs.length);
  record('reset restores the original 3-NPC seed', npcCountAfterReset === 3, 'count=' + npcCountAfterReset);
  const selectionAfterReset = await page.evaluate(() => window.appState.selection.npcCode);
  record('reset clears the current selection', selectionAfterReset === null);

  // Full-flow smoke test: create NPC -> create variant -> attach model -> edit params -> publish, all without a page reload.
  await page.click('.ws-nav-create-npc');
  await page.fill('[data-npc-form-code]', 'SMOKE_NPC');
  await page.fill('[data-npc-form-name]', 'Smoke Test NPC');
  await page.click('[data-npc-form-submit]');
  await page.click('[data-npc-toggle="SMOKE_NPC"]');
  await page.click('[data-create-variant="SMOKE_NPC"]');
  await page.fill('[data-variant-form-code="SMOKE_NPC"]', 'V1');
  await page.fill('[data-variant-form-name="SMOKE_NPC"]', 'V1 名稱');
  await page.click('[data-variant-form-submit="SMOKE_NPC"]');
  await page.click('[data-npc-select="SMOKE_NPC"]');
  await page.click('[data-add-model="chatModel"]');
  await page.selectOption('[data-model-template-select="chatModel"]', 'demo:chat-lite');
  await page.click('[data-model-confirm="chatModel"]');
  await page.click('[data-model-publish="chatModel"]');
  const smokeVersion = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'SMOKE_NPC'; }).chatModel.version;
  });
  record('end-to-end smoke flow publishes without error', smokeVersion === 2, smokeVersion);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: the first 3 new checks FAIL (`#ws-bag` is empty, no reset control); the smoke-flow check may pass already since it only reuses prior functions — confirm it passes on its own merits once the earlier 3 are fixed.

- [ ] **Step 3: Write minimal implementation**

Append to `agent-setup-demo/js/workspace.js`:

```js
function renderBagPlaceholder() {
  return '<div class="hint">背包功能將於 Phase 2／3 開發，這裡先保留版位。</div>';
}
```

Update `render()` in `agent-setup-demo/js/app.js`:

```js
function render() {
  document.getElementById('ws-nav').innerHTML = renderNavTree(window.appState);
  document.getElementById('ws-center').innerHTML = renderCenterPane(window.appState);
  document.getElementById('ws-bag').innerHTML = renderBagPlaceholder();
  renderNpcPane(window.appState);
  renderModelSection(window.appState);
}
```

Add a reset button to `agent-setup-demo/index.html`, just inside `<div id="app" class="ws-shell">` before the three panes:

```html
  <div id="app" class="ws-shell">
    <button class="btn ws-reset-btn" data-reset-data onclick="resetData()">↺ 重置示範資料</button>
    <div id="ws-nav" class="ws-pane"></div>
    <div id="ws-center" class="ws-pane"></div>
    <div id="ws-bag" class="ws-pane"></div>
  </div>
```

Append to `agent-setup-demo/css/workspace.css`:

```css
.ws-reset-btn { position: fixed; top: 8px; right: 8px; z-index: 10; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH="$(npm root -g)" node agent-setup-demo/tests/ui.test.cjs`
Expected: `51 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): add bag placeholder, reset control, end-to-end smoke coverage"
```

---

## Self-Review

**1. Spec coverage:**
- 三欄架構／比例 → Task 1.
- 左欄導覽樹（展開/收合、選取、＋新增 NPC、＋新人物卡、SWITCH 型擋下、代碼規則） → Tasks 3, 5, 6.
- 中欄「選中 NPC 本身」顯示 NPC 主檔＋模型設定，沿用原②頁規則（鎖定欄位、鉛筆編輯、加入模型樣板擋下、模型參數型別/範圍檢查、列舉警告不擋、發布模型的未儲存修改與必填檢查、版號 = 最大值+1） → Tasks 7–11.
- 中欄「選中人物卡」此階段為 Phase 2 佔位 → Task 4.
- 右欄此階段為 Phase 2/3 佔位 → Task 12.
- 「資料只存在瀏覽器記憶體，重置示範資料回到 SEED」 → Task 2 (`resetData`) + Task 12 (UI 控制項與測試)。
- 組合包／擴充包、滑出詳細面板、背包 CRUD → 明確排除在本計畫外，留給 Phase 2–4（已在 spec 與本計畫開頭聲明）。

**2. Placeholder scan:** No "TBD"/"TODO"/"similar to Task N" patterns in any step; every code block is complete and copy-pasteable into the named file at the named location.

**3. Type consistency:** `kind` is consistently `'chatModel'` | `'vectorModel'` across Tasks 9–11. `wsFindNpc(state)` signature (`state` object with `.data.npcs`, `.selection.npcCode`) is identical everywhere it's called (Tasks 7–11). `appState.uiState` keys introduced in Tasks 3/5/6/8/9/10 are all present together in the Task 10 `resetData()` update, so no key silently disappears after a reset.

**4. Review Focus coverage:**
- NPC 代碼格式錯誤 → covered in Task 5's test (`'bad code!'` rejected, count stays 3).
- NPC 代碼+場域重複 → covered in Task 5's test (`wsValidateNpcCode('FAQ_ANSWER', 'customer_service', ...)` returns an error string).
- SWITCH 型擋下新人物卡 → covered in Task 3 (render-level: no create trigger exists) and re-confirmed in Task 6.
- 人物卡代碼同 NPC 內重複 → covered in Task 6's test (`wsValidateVariantCode` duplicate path exercised via the form, though the plan exercises it through the form rather than a second explicit duplicate-code submission — **gap found and fixed below**).
- 發布模型時必填留空或有未儲存修改 → covered in Task 11's test (unsaved-edit path exercised; empty-required-param path is covered by `wsPublishModelErrors`'s logic but not directly exercised by a UI step — **gap found and fixed below**).

**Fixes applied during self-review:** Task 6's test only exercises the *format*-invalid variant code, not a *duplicate*-code rejection. Add this assertion to Task 6, right after the "valid code creates the variant" check, before moving to the SWITCH-type check:

```js
  await page.click('[data-create-variant="ORDER_ASSIST"]');
  await page.fill('[data-variant-form-code="ORDER_ASSIST"]', 'BASIC');
  await page.fill('[data-variant-form-name="ORDER_ASSIST"]', '重複版');
  await page.click('[data-variant-form-submit="ORDER_ASSIST"]');
  const dupVariantError = await page.locator('[data-variant-form-error="ORDER_ASSIST"]').innerText();
  record('duplicate variant code within the same NPC is rejected', dupVariantError.length > 0, dupVariantError);
  const stillOneVariant = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'ORDER_ASSIST'; }).variants.length;
  });
  record('duplicate variant submission did not add a second variant', stillOneVariant === 1, stillOneVariant);
```

This raises Task 6's final expected count from `26 checks` to `28 checks`, and every subsequent task's running total shifts by +2 accordingly (Task 7 target becomes `32`, Task 8 `37`, Task 9 `41`, Task 10 `46`, Task 11 `50`, Task 12 `53`). When executing this plan, treat the counts in Tasks 7–12 as `<original> + 2` rather than re-deriving them from scratch, and confirm each `Run test to verify it passes` step by reading the actual printed count rather than trusting the stale number if anything drifts — the important invariant is **0 failed, 0 JS errors**, not the exact running total.

Task 11's empty-required-param path (model attached with a required numeric field blanked out) is exercised indirectly by `wsValidateParamValue` rejecting non-numeric input in Task 10, but Task 11 never drives a param to an actually-empty string through the UI before publishing. This is a real gap for `demo:chat-lite`-style minimal templates where a user could clear a field entirely. Add to Task 11's test, after the "publish bumps the version by 1" assertion:

```js
  await page.click('[data-npc-select="ORDER_ASSIST"]');
  await page.click('[data-add-model="chatModel"]');
  await page.selectOption('[data-model-template-select="chatModel"]', 'demo:chat-lite');
  await page.click('[data-model-confirm="chatModel"]');
  await page.fill('[data-model-param-input="chatModel.temperature"]', '');
  await page.click('[data-model-param-save="chatModel"]');
  await page.click('[data-model-publish="chatModel"]');
  const blockedByEmptyRequired = await page.locator('[data-model-param-error="chatModel"]').innerText();
  record('publishing with an empty required param is blocked', blockedByEmptyRequired.indexOf('必填') !== -1, blockedByEmptyRequired);
```

Note this relies on `wsSaveModelParams` persisting an empty string through `wsValidateParamValue`'s `number` branch — `Number('')` is `0` in JavaScript, not `NaN`, so the existing range check (`0 >= paramDef.min`) would silently accept it as `0` rather than catching it as "empty." **Additional fix required in Task 10's `wsValidateParamValue`:** add an explicit empty-string guard before the `Number(rawValue)` conversion:

```js
function wsValidateParamValue(paramDef, rawValue) {
  if (paramDef.kind === 'number') {
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      return { ok: false, message: paramDef.label + ' 不能留空' };
    }
    var num = Number(rawValue);
    if (isNaN(num)) return { ok: false, message: paramDef.label + ' 必須是數字' };
    if (num < paramDef.min || num > paramDef.max) {
      return { ok: false, message: paramDef.label + ' 必須介於 ' + paramDef.min + ' 到 ' + paramDef.max + ' 之間' };
    }
    return { ok: true, value: num };
  }
  if (paramDef.kind === 'enum') {
    var matches = paramDef.enumValues.some(function (v) { return String(v) === String(rawValue); });
    if (!matches) {
      return { ok: true, value: rawValue, message: paramDef.label + ' 不是建議值，執行時會忽略' };
    }
    return { ok: true, value: paramDef.enumValues.filter(function (v) { return String(v) === String(rawValue); })[0] };
  }
  return { ok: true, value: rawValue };
}
```

Apply this corrected version in place of Task 10's original `wsValidateParamValue` when implementing Task 10 — this plan's Task 10 code block above should be read with this fix already folded in.
