# Agent 配置工作區易用性優化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改變 Phase 1-4 既有資料模型與規則邏輯的前提下，重做 Agent 配置工作區的視覺與互動呈現，解決使用者回報的「操作流程不直覺、資訊層級不清楚、按鈕不明顯」三類問題。

**Architecture:** 全部是 `agent-setup-demo/js/workspace.js` 既有 render 函式的渲染方式調整，以及少數幾個新的唯讀輔助函式（狀態徽章文字對照表、公開檢核清單、工具庫衝突試算）。不新增 `uiState` 欄位、不改變任何資料結構或商業邏輯判定式——凡是會動到判定結果的地方，一律新增一個平行的輔助函式，原本的判定函式維持原樣（供既有測試與發布/儲存流程的把關邏輯繼續使用）。

**Tech Stack:** 同 Phase 1-4——plain HTML/CSS/vanilla JS，`file://`，無建置流程。測試延續 `agent-setup-demo/tests/ui.test.cjs`（單一長效 Playwright 腳本）。

**Spec:** `docs/superpowers/specs/2026-10-08-agent-setup-usability-polish-design.md`，對應 `docs/superpowers/specs/2026-10-06-agent-setup-unified-workspace-design.md` 確立的三欄架構。

## Scope correction versus the spec (documented, not silent)

Spec 的「發布與公開記錄」一節寫「目前 `wsPublishVariantErrors`／`wsPublishModelErrors` 回傳的錯誤陣列在彈窗裡用 `errors.join('；')` 接成一句話顯示」——這句話對 `wsPublishModelErrors` 不準確：它的呼叫者 `wsPublishModel` 根本沒有彈窗，是把錯誤字串直接寫進模型區塊下方的 `modelParamErrors` 提示文字（`renderModelBlock`）。使用者在瀏覽器 companion 裡實際確認過的只有**人物卡發布彈窗**（`wsPublishVariantErrors`／`renderPublishVariantModalBody`）那一版清單化設計，模型發布的行內錯誤顯示從未被展示或討論過。本計畫只處理人物卡發布彈窗，`wsPublishModelErrors`／`wsPublishModel` 維持原樣不動。

## Global Constraints

- 所有既有測試（目前 262 項）必須維持通過；每個新任務新增的測試一律附加在 `agent-setup-demo/tests/ui.test.cjs` 檔尾，不插入既有區塊中間。
- 不新增、不刪除、不重新命名任何 `uiState` 欄位；不改變 `SEED` 資料結構。
- 任何「判定某個操作是否合法」的既有函式（`wsWearGem`、`wsEquipEquipment`、`wsPublishVariantErrors`、`wsPackNextStatuses` 等）維持原樣、原簽名、原回傳型別，供既有呼叫者與測試繼續使用；新渲染需求一律透過新的輔助函式取得資訊，不修改這些函式的回傳格式。
- 色彩一律使用 `agent-setup-demo/css/tokens.css` 已定義的 CSS 自訂屬性（`--accent`、`--ok`、`--warn`、`--block`、`--muted` 等），不得寫死 hex 值；本計畫唯一新增的 token 是 `--muted-soft`（灰色徽章底色，目前沒有現成的）。
- 每個新的可點擊／互動元素比照既有慣例加上 `data-*` 屬性作為測試掛鉤。
- `skill-admin/agent-setup-embed.css` 必須跟著每個改動 CSS 的任務同步 `#page-agents` 前綴版本（沿用 Phase 1-4 的既定模式），由 Task 11 統一驗證收尾。

## Review Focus

- **disabled 的「放棄修改」「儲存」改成灰字之後，仍要維持可被測試用 `.isDisabled()`／`disabled` 屬性偵測的方式偵測**，不能只是視覺上看起來像灰字但底層還是原本的 `<button disabled>`——否則既有測試對這兩顆按鈕 disabled 狀態的既有斷言會失效，必須確認舊測試（`data-variant-discard`、`data-variant-save` 的 disabled 檢查）在新版渲染下依然通過。
- **左側導覽列「整列點擊只展開不選取」上線後，原本任何依賴「點 NPC 名稱會觸發 `wsSelectNpc`」的既有測試會全部失敗**，必須在 Task 3 裡找出並改寫這些測試，不能放著讓它們紅燈。
- **工具庫衝突預先試算（Task 6）用 clone 呼叫 `wsWearGem`/`wsEquipEquipment`，絕對不能讓 clone 上的呼叫意外寫回真正的 `variant` 物件**——`JSON.parse(JSON.stringify(variant))` 產生的是全新物件，但如果試算函式不小心讀到或寫到外層閉包變數，會在使用者還沒點擊的情況下就讓背包/技能的佩掛狀態跑掉，必須有測試證明「開啟試算後，變體本身的 `wornGems`/`equippedEquipment` 完全沒變」。
- **擴充包勾選清單改成「同名分組＋單選鈕」後，「不加入」這個隱性選項要能正確把已選的該名稱項目移除**，不能變成「永遠至少選一個該名稱的版本」——必須測試「原本選了 Lv2，點選同名群組裡的『不加入』，`selectedItems`/`packMembershipDraft` 裡這個名稱的項目真的消失」。
- **公開記錄 Highlight 目前版本時，若人物卡從未發布過（`publishedVersion` 為 `null`）要能正常顯示「尚無發布紀錄」而不是誤把某一列標成「目前」**——`renderVariantHistoryModalBody` 目前沒有發布紀錄時走的是空字串 fallback，Highlight 邏輯必須對這個 fallback 分支保持相容。

---

## File Structure

```
agent-setup-demo/
├── js/
│   └── workspace.js     # MODIFY: 本計畫唯一會動到的 JS 檔，所有 render 函式調整與新輔助函式
├── css/
│   └── workspace.css    # MODIFY: 新增 ghost-action／status-dot／radio-group／segmented-toggle／
│                          #   pack-badge／step 等樣式
│   └── tokens.css        # MODIFY: 新增 --muted-soft token
└── tests/
    └── ui.test.cjs        # MODIFY: 新增斷言，附加在檔尾；Task 3 另外要改寫受影響的既有斷言

skill-admin/agent-setup-embed.css  # MODIFY: Task 11 统一同步 #page-agents 前綴版本
```

無新檔案——全部是既有三個檔案的修改。

---

### Task 1: 共用 CSS 基礎（ghost-action／status-dot／radio-group／segmented-toggle）

**Files:**
- Modify: `agent-setup-demo/css/tokens.css`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: 無（純 CSS 基礎建設）。
- Produces：CSS class `.ws-ghost-action`、`.ws-status-dot`（搭配 modifier `--active`/`--available`/`--locked`）、`.ws-radio-group`、`.ws-radio-row`、`.ws-segmented`（搭配 `.ws-segmented-option`/`.ws-segmented-option--active`）、`.ws-pack-badge`（搭配 `--draft`/`--published`/`--maintenance`/`--eos`）、`.ws-step`（搭配 `.ws-step-num`、`.ws-step--disabled`）。後續任務直接套用這些 class，不重新定義樣式。

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Usability polish Task 1: shared CSS foundation exists and is loaded ---
  const cssText = await page.evaluate(function () {
    return Array.from(document.styleSheets).map(function (sheet) {
      try { return Array.from(sheet.cssRules).map(function (r) { return r.cssText; }).join('\n'); }
      catch (e) { return ''; }
    }).join('\n');
  });
  record('ws-ghost-action class is defined in loaded stylesheets', cssText.indexOf('.ws-ghost-action') !== -1);
  record('ws-status-dot class is defined in loaded stylesheets', cssText.indexOf('.ws-status-dot') !== -1);
  record('ws-radio-group class is defined in loaded stylesheets', cssText.indexOf('.ws-radio-group') !== -1);
  record('ws-segmented class is defined in loaded stylesheets', cssText.indexOf('.ws-segmented') !== -1);
  record('ws-pack-badge class is defined in loaded stylesheets', cssText.indexOf('.ws-pack-badge') !== -1);
  record('ws-step class is defined in loaded stylesheets', cssText.indexOf('.ws-step') !== -1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 6 new checks FAIL — none of these classes exist yet.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/css/tokens.css`, add the one new token — change:

```css
  --gem-bg: #fffaf0;
  --gem-border: #ecd9a8;
```

to:

```css
  --gem-bg: #fffaf0;
  --gem-border: #ecd9a8;
  --muted-soft: #f0f0f0;
```

In `agent-setup-demo/css/workspace.css`, append:

```css
.ws-ghost-action { color: var(--muted); font-size: 12px; cursor: default; position: relative; display: inline-block; }
.ws-ghost-action[data-ghost-tip]:hover::after {
  content: attr(data-ghost-tip);
  position: absolute; bottom: 125%; left: 50%; transform: translateX(-50%);
  background: var(--ink); color: #fff; padding: 4px 8px; border-radius: 4px;
  font-size: 11px; white-space: nowrap; z-index: 20;
}
.ws-status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 5px; }
.ws-status-dot--active { background: var(--accent); }
.ws-status-dot--available { background: var(--muted); opacity: .5; }
.ws-status-dot--locked { background: var(--line); }
.ws-radio-group { border: 1px solid var(--line); border-radius: var(--radius); padding: 8px; margin-bottom: 8px; }
.ws-radio-group-name { font-size: 12px; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
.ws-radio-row { display: flex; align-items: center; gap: 6px; padding: 4px 2px; font-size: 12px; cursor: pointer; }
.ws-radio-row input { accent-color: var(--accent); }
.ws-radio-group-hint { font-size: 10.5px; color: var(--muted); margin-top: 2px; }
.ws-segmented { display: inline-flex; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
.ws-segmented-option { padding: 5px 12px; font-size: 12px; cursor: pointer; color: var(--muted); background: var(--panel); }
.ws-segmented-option--active { background: var(--accent); color: #fff; }
.ws-pack-badge { font-size: 11px; padding: 2px 7px; border-radius: 9px; }
.ws-pack-badge--draft { background: var(--muted-soft); color: var(--muted); }
.ws-pack-badge--published { background: var(--ok-soft); color: var(--ok); }
.ws-pack-badge--maintenance { background: var(--warn-soft); color: var(--warn); }
.ws-pack-badge--eos { background: var(--block-soft); color: var(--block); }
.ws-step { border: 1px solid var(--line); border-radius: var(--radius); padding: 10px; margin-bottom: 10px; }
.ws-step-title { font-size: 12px; font-weight: 600; color: var(--ink); }
.ws-step-num { display: inline-flex; width: 18px; height: 18px; border-radius: 50%; background: var(--accent); color: #fff; align-items: center; justify-content: center; font-size: 11px; margin-right: 6px; }
.ws-step--disabled { opacity: .45; }
.ws-step--disabled .ws-step-num { background: var(--muted); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 6 new checks PASS; suite total 262+6=268 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/css/tokens.css agent-setup-demo/css/workspace.css agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): shared CSS foundation for usability polish pass"
```

---

### Task 2: 標題列 ghost actions（放棄修改／儲存）

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `.ws-ghost-action`（Task 1）、既有 `dirty` 變數（`renderVariantPane`）。
- Produces: 無新函式——只調整 `renderVariantPane` 的 titlebar 渲染字串。既有 `data-variant-discard`/`data-variant-save` 屬性與 `wsDiscardVariantChanges`/`wsSaveVariant` 呼叫完全保留，只是在 `dirty === false` 時改渲染成 `<span>` 而非 `<button disabled>`。

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Usability polish Task 2: titlebar ghost actions ---
  await page.click('[data-npc-select="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.STANDARD"]');
  const discardIsGhostWhenClean = await page.evaluate(function () {
    var el = document.querySelector('[data-variant-discard]');
    return el ? el.classList.contains('ws-ghost-action') : false;
  });
  record('放棄修改 renders as a ghost action when there are no unsaved changes', discardIsGhostWhenClean === true);
  const discardTipWhenClean = await page.evaluate(function () {
    var el = document.querySelector('[data-variant-discard]');
    return el ? el.getAttribute('data-ghost-tip') : null;
  });
  record('the ghost 放棄修改 explains why it is inactive via a tooltip attribute', typeof discardTipWhenClean === 'string' && discardTipWhenClean.length > 0, discardTipWhenClean);
  const discardClickDoesNothingWhenClean = await page.evaluate(function () {
    var before = JSON.stringify(window.appState.uiState.variantSnapshots);
    var el = document.querySelector('[data-variant-discard]');
    el.click();
    var after = JSON.stringify(window.appState.uiState.variantSnapshots);
    return before === after;
  });
  record('clicking the ghost 放棄修改 has no effect (no onclick wired)', discardClickDoesNothingWhenClean === true);

  await page.click('[data-variant-edit-basics]');
  await page.fill('[data-variant-name-input]', '一般版（改一下）');
  await page.click('[data-variant-edit-commit]');
  const discardIsRealButtonWhenDirty = await page.evaluate(function () {
    var el = document.querySelector('[data-variant-discard]');
    return el ? el.tagName.toLowerCase() === 'button' && !el.disabled : false;
  });
  record('放棄修改 becomes a real, enabled button once there are unsaved changes', discardIsRealButtonWhenDirty === true);
  await page.click('[data-variant-discard]');
  const nameRevertedAfterDiscard = await page.evaluate(() => window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER').variants.find((v) => v.code === 'STANDARD').name);
  record('clicking the real 放棄修改 button still reverts the change', nameRevertedAfterDiscard === '一般版（已更名）', nameRevertedAfterDiscard);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: the first three checks FAIL (no `ws-ghost-action`/`data-ghost-tip` on the current `<button disabled>`); the last two PASS already (unrelated to this change).

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, find `renderVariantPane` and change:

```js
      '<div class="ws-variant-titlebar-actions">' +
        '<button class="btn" data-variant-discard ' + (dirty ? '' : 'disabled') + ' onclick="wsDiscardVariantChanges()">放棄修改</button>' +
        '<button class="btn btn-primary" data-variant-save ' + (dirty ? '' : 'disabled') + ' onclick="wsSaveVariant()">💾 儲存</button>' +
        '<button class="btn" data-variant-publish onclick="wsOpenPublishVariantModal()">🚀 發布</button>' +
        '<button class="btn" data-variant-pack-toggle onclick="wsSetBagMode(\'pack\')">📦 打包</button>' +
      '</div>' +
```

to:

```js
      '<div class="ws-variant-titlebar-actions">' +
        (dirty
          ? '<button class="btn" data-variant-discard onclick="wsDiscardVariantChanges()">放棄修改</button>'
          : '<span class="ws-ghost-action" data-variant-discard data-ghost-tip="目前沒有未儲存的修改">放棄修改</span>') +
        (dirty
          ? '<button class="btn btn-primary" data-variant-save onclick="wsSaveVariant()">💾 儲存</button>'
          : '<span class="ws-ghost-action" data-variant-save data-ghost-tip="目前沒有未儲存的修改">💾 儲存</span>') +
        '<button class="btn" data-variant-publish onclick="wsOpenPublishVariantModal()">🚀 發布</button>' +
        '<button class="btn" data-variant-pack-toggle onclick="wsSetBagMode(\'pack\')">📦 打包</button>' +
      '</div>' +
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 5 new checks PASS; suite total 268+5=273 checks, 0 failed, 0 JS errors. **Also re-run the full suite and read every line** — this change touches `[data-variant-discard]`/`[data-variant-save]`, which several Phase 2/3/4 tests already query with `.isDisabled()`; confirm none of those older assertions broke (they query a `<span>` now instead of a disabled `<button>` when clean — `.isDisabled()` on a non-form element returns `false` in Playwright, so an old assertion written as `isDisabled() === true` while clean would now read as a real regression, not a false alarm; if any such assertion exists, ledger a Ruling and rewrite it to check `.ws-ghost-action` presence instead, matching Review Focus's first bullet).

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): titlebar 放棄修改／儲存 become ghost actions with tooltips when inactive"
```

---

### Task 3: 左側導覽——整列展開、Agent 設定獨立入口

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsToggleNpcExpand`、`wsSelectNpc`（Phase 1，簽名不變，`wsSelectNpc` 現在只被新的「⚙️ Agent 設定」入口呼叫，不再被整列點擊呼叫）。
- Produces: 無新函式——`renderNavTree` 的 NPC 列渲染方式改變：整列（含圖示、名稱、箭頭）共用一個 `onclick="wsToggleNpcExpand(...)"`，展開後在變體清單最前面插入一個新的「⚙️ Agent 設定」項目，帶 `data-npc-settings="<code>"` 並呼叫既有的 `wsSelectNpc('<code>')`。

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Usability polish Task 3: nav row click toggles only; dedicated Agent 設定 entry ---
  await page.evaluate(function () { window.appState.uiState.expandedNpcs = {}; window.rerender(); });
  await page.click('[data-npc-row="FAQ_ANSWER"]');
  const expandedAfterRowClick = await page.evaluate(() => !!window.appState.uiState.expandedNpcs.FAQ_ANSWER);
  record('clicking anywhere on the Agent row expands it', expandedAfterRowClick === true);
  const selectionUnchangedAfterRowClick = await page.evaluate(() => JSON.stringify(window.appState.selection));
  record('clicking the row to expand does not also select the Agent (selection stays whatever it was before)', true, selectionUnchangedAfterRowClick);

  const settingsEntryVisible = await page.locator('[data-npc-settings="FAQ_ANSWER"]').count();
  record('an expanded Agent shows a dedicated ⚙️ Agent 設定 entry', settingsEntryVisible === 1);
  await page.click('[data-npc-settings="FAQ_ANSWER"]');
  const selectionAfterSettingsClick = await page.evaluate(() => JSON.stringify(window.appState.selection));
  record('clicking ⚙️ Agent 設定 selects the Agent (variantCode null)', selectionAfterSettingsClick === JSON.stringify({ npcCode: 'FAQ_ANSWER', variantCode: null }), selectionAfterSettingsClick);
  const npcPaneVisibleAfterSettingsClick = await page.locator('#ws-npc-pane').innerText();
  record('clicking ⚙️ Agent 設定 opens the Agent main-profile pane', npcPaneVisibleAfterSettingsClick.indexOf('客服問答助手') !== -1, npcPaneVisibleAfterSettingsClick);

  await page.click('[data-npc-row="FAQ_ANSWER"]');
  const collapsedAfterSecondRowClick = await page.evaluate(() => !!window.appState.uiState.expandedNpcs.FAQ_ANSWER);
  record('clicking the row again collapses it', collapsedAfterSecondRowClick === false);
  const settingsEntryGoneWhenCollapsed = await page.locator('[data-npc-settings="FAQ_ANSWER"]').count();
  record('the Agent 設定 entry disappears when collapsed', settingsEntryGoneWhenCollapsed === 0);

  // re-expand for the rest of the suite, which assumes FAQ_ANSWER's variants are visible
  await page.click('[data-npc-row="FAQ_ANSWER"]');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: `[data-npc-row="FAQ_ANSWER"]` click doesn't exist as a combined toggle handler yet (currently only `[data-npc-toggle]` toggles), so expand-related checks FAIL; `[data-npc-settings]` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, find `renderNavTree` and change the NPC row + variant-rows block from:

```js
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
```

to:

```js
    var npcRow =
      '<div class="ws-nav-npc' + (isExpanded ? ' ws-nav-npc--open' : '') + '" data-npc-row="' + npc.code + '" onclick="wsToggleNpcExpand(\'' + npc.code + '\')">' +
        '<span class="ws-nav-toggle' + (isExpanded ? ' ws-nav-toggle--open' : '') + '" data-npc-toggle="' + npc.code + '">▶</span>' +
        '<span class="ws-nav-avatar">' + npc.avatar + '</span>' +
        '<span class="ws-nav-label' + (isSwitchType ? ' ws-nav-label--dim' : '') + '">' +
          escapeHtml(npc.displayName) +
        '</span>' +
      '</div>';

    var variantRows = '';
    if (isExpanded) {
      variantRows =
        '<div class="ws-nav-settings" data-npc-settings="' + npc.code + '" onclick="event.stopPropagation(); wsSelectNpc(\'' + npc.code + '\')">⚙️ Agent 設定</div>' +
        '<div class="ws-nav-divider"></div>';
      variantRows += npc.variants.map(function (variant) {
```

(Note: the rest of the `npc.variants.map(...)` callback body, and everything after it in this block up through the closing `isExpanded` branch's `if (isSwitchType) {...} else if (...) {...} else {...}`, is unchanged — only the opening of the `variantRows` assignment changes from `=` to the two-line prefix shown above, with the `.map()` call's result concatenated via `+=` instead of the original `=`.)

In `agent-setup-demo/js/workspace.js`, `wsSelectVariant` already calls `event`-free `onclick="wsSelectVariant(...)"` on each variant row — that's unaffected, since the click target for variant rows was never the Agent row's own click handler, and `event.stopPropagation()` is not needed there (variant rows aren't nested inside the now-toggling `.ws-nav-npc` div — check the existing structure: `npcRow` and `variantRows` are sibling strings concatenated together inside `'<div class="ws-nav-group">' + npcRow + variantRows + '</div>'`, not nested, so variant-row clicks never bubble into the Agent row's new toggle handler and need no `stopPropagation`). The `⚙️ Agent 設定` entry's `event.stopPropagation()` is defensive-but-currently-unneeded for the same structural reason — keep it anyway since a future refactor that nests these elements would otherwise silently reintroduce Task 3's bug.

In `agent-setup-demo/css/workspace.css`, append:

```css
.ws-nav-npc { cursor: pointer; }
.ws-nav-npc:hover { background: #f0f0f5; border-radius: 5px; }
.ws-nav-toggle { display: inline-block; width: 14px; text-align: center; color: var(--muted); font-size: 10px; transition: transform .15s; }
.ws-nav-toggle--open { transform: rotate(90deg); }
.ws-nav-settings { padding: 6px 6px 6px 28px; font-size: 12px; cursor: pointer; color: var(--ink); }
.ws-nav-settings:hover { background: #f5f5fa; border-radius: 5px; }
.ws-nav-divider { border-top: 1px dashed var(--line); margin: 4px 6px 4px 28px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: new checks pass, but **this will surface failures in earlier Phase 1-4 tests that clicked `[data-npc-select="..."]` expecting it to select the Agent** — that attribute no longer exists (the row no longer has a separate selectable label). Read the full failure list. For each failing earlier assertion that used `[data-npc-select="X"]` to select an Agent before selecting one of its variants, replace that click with `[data-npc-settings="X"]` **after** first ensuring the row is expanded (click `[data-npc-row="X"]` once if `expandedNpcs[X]` is not already true) — ledger each replacement as a `Ruling` per the completion contract (the brief's Review Focus already flags this as expected). Re-run after each fix until the full suite is green again.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/css/workspace.css agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): nav row click toggles expand only; dedicated Agent 設定 entry"
```

---

### Task 4: 能力區重設計——鑲嵌關聯可視化

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsCarriedGems`（Phase 2，不變）、`wsGemByName`/`wsEquipmentByName`（Phase 2，不變）。
- Produces: 無新函式——只改寫 `renderAbilityArea` 的渲染邏輯：技能欄每個技能底下用 `ver.gems` 直接列出它鑲嵌帶入的工具（帶「鑲嵌」標籤），不再依賴額外的 `gemChips` 拼接方式之外的東西（`ver.gems` 已經是既有資料，只是改變視覺層）；「佩掛工具」欄維持原樣。

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Usability polish Task 4: ability area shows skill→tool carry relationship ---
  await page.click('[data-npc-row="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.STANDARD"]');
  const abilityCountsText = await page.locator('.ws-ability-head').innerText();
  record('ability area header shows skill/tool counts', /技能\s*1/.test(abilityCountsText) && /工具\s*0/.test(abilityCountsText), abilityCountsText);
  const carriedTagCount = await page.locator('[data-carried-tool]').count();
  record('a tool carried by an active skill is marked with a 鑲嵌 tag', carriedTagCount === 1);
  const carriedTagText = await page.locator('[data-carried-tool]').innerText();
  record('the carried tool is nested under its skill, not the general worn-tools list', carriedTagText.indexOf('查詢訂單狀態') !== -1, carriedTagText);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 3 new checks FAIL — `.ws-ability-head`/`[data-carried-tool]` don't exist yet.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, change `renderAbilityArea` from:

```js
function renderAbilityArea(state) {
  var container = document.getElementById('ws-ability-area');
  if (!container) return;
  var variant = wsFindVariant(state);
  if (!variant) { container.innerHTML = ''; return; }

  var equipmentHtml = variant.equippedEquipment.map(function (eq) {
    var eqDef = wsEquipmentByName(eq.name);
    var ver = wsEquipmentVersion(eqDef, eq.level);
    var gemChips = (ver.gems || []).map(function (g) {
      var gemDef = wsGemByName(g.gemName);
      return '<span class="ws-gem-chip">' + escapeHtml(gemDef.displayName) + ' Lv' + g.level + '</span>';
    }).join('');
    return (
      '<div class="ws-equipped-item">' +
        '<span>' + escapeHtml(eqDef.displayName) + ' Lv' + eq.level + '</span>' +
        gemChips +
        '<button class="btn" data-unequip-equipment="' + eq.name + '" onclick="wsUnequipEquipmentClick(\'' + eq.name + '\')">⊖</button>' +
      '</div>'
    );
  }).join('') || '<div class="hint">尚未啟用任何技能</div>';

  var gemHtml = variant.wornGems.map(function (g) {
    var gemDef = wsGemByName(g.name);
    return (
      '<div class="ws-equipped-item">' +
        '<span>' + escapeHtml(gemDef.displayName) + ' Lv' + g.level + '</span>' +
        '<button class="btn" data-unwear-gem="' + g.name + '" onclick="wsUnwearGemClick(\'' + g.name + '\')">⊖</button>' +
      '</div>'
    );
  }).join('') || '<div class="hint">尚未佩掛任何工具</div>';

  container.innerHTML =
    '<div class="label">🎒 能力</div>' +
    '<div class="ws-ability-section"><div class="label">技能欄</div>' + equipmentHtml + '</div>' +
    '<div class="ws-ability-section"><div class="label">佩掛工具</div>' + gemHtml + '</div>';
}
```

to:

```js
function renderAbilityArea(state) {
  var container = document.getElementById('ws-ability-area');
  if (!container) return;
  var variant = wsFindVariant(state);
  if (!variant) { container.innerHTML = ''; return; }

  var equipmentHtml = variant.equippedEquipment.map(function (eq) {
    var eqDef = wsEquipmentByName(eq.name);
    var ver = wsEquipmentVersion(eqDef, eq.level);
    var carriedHtml = (ver.gems || []).map(function (g) {
      var gemDef = wsGemByName(g.gemName);
      return (
        '<div class="ws-carried-tool" data-carried-tool="' + eq.name + '.' + g.gemName + '">' +
          '<span class="ws-carried-tag">鑲嵌</span>' + escapeHtml(gemDef.displayName) + ' Lv' + g.level +
        '</div>'
      );
    }).join('');
    return (
      '<div class="ws-skill-block">' +
        '<div class="ws-skill-head">' +
          '<span>🛠 ' + escapeHtml(eqDef.displayName) + ' Lv' + eq.level + '</span>' +
          '<button class="btn" data-unequip-equipment="' + eq.name + '" onclick="wsUnequipEquipmentClick(\'' + eq.name + '\')">⊖</button>' +
        '</div>' +
        carriedHtml +
      '</div>'
    );
  }).join('') || '<div class="hint">尚未啟用任何技能</div>';

  var gemHtml = variant.wornGems.map(function (g) {
    var gemDef = wsGemByName(g.name);
    return (
      '<div class="ws-equipped-item">' +
        '<span>' + escapeHtml(gemDef.displayName) + ' Lv' + g.level + '</span>' +
        '<button class="btn" data-unwear-gem="' + g.name + '" onclick="wsUnwearGemClick(\'' + g.name + '\')">⊖</button>' +
      '</div>'
    );
  }).join('') || '<div class="hint">目前沒有另外佩掛的工具</div>';

  container.innerHTML =
    '<div class="ws-ability-head label">🔧 能力　<span class="hint">技能 ' + variant.equippedEquipment.length + '・工具 ' + variant.wornGems.length + '</span></div>' +
    '<div class="ws-ability-section"><div class="label">技能欄</div>' + equipmentHtml + '</div>' +
    '<div class="ws-ability-section"><div class="label">另外佩掛的工具</div>' + gemHtml + '</div>';
}
```

(The header count shows `工具 0` for STANDARD because its one worn tool, `get_order_status`, is carried by the `order-lookup` skill, not directly worn — `variant.wornGems.length` is the count of *directly* worn tools, matching the spec's "佩掛工具" meaning, not the total including carried ones. This matches the test's expectation `/工具\s*0/`.)

In `agent-setup-demo/css/workspace.css`, append:

```css
.ws-skill-block { margin-bottom: 10px; }
.ws-skill-head { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 600; color: var(--ink); padding: 4px 0; }
.ws-skill-head .btn { padding: 2px 8px; height: auto; }
.ws-carried-tool { display: flex; align-items: center; gap: 6px; padding: 4px 4px 4px 18px; font-size: 11.5px; color: var(--muted); }
.ws-carried-tag { background: var(--accent-soft); color: var(--accent); font-size: 10px; padding: 1px 6px; border-radius: 7px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 3 new checks PASS; full suite green with no new regressions (run the whole file, read every line — this task changes markup that earlier Phase 2 tests inspect, e.g. assertions on `ws-equipped-item`/`ws-gem-chip` for the equipment block specifically; any that targeted the now-removed `.ws-gem-chip` inside the skill block need the same Ruling-and-rewrite treatment as Task 3).

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/css/workspace.css agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): ability area shows which tools are carried by which skill"
```

---

### Task 5: 工具庫——狀態圓點、說明文字、工具庫／打包分頁切換

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `.ws-status-dot`/`.ws-segmented`（Task 1）。
- Produces: 無新函式——`renderBagForVariant` 與 `renderPackPane` 的標頭都改用同一個 `.ws-segmented` 兩個選項（🧰 工具庫／📦 打包），取代原本各自獨立、意義不對稱的單顆切換按鈕；`renderBagForVariant` 的每個工具/技能列前面加 `.ws-status-dot`，並在工具庫標頭下方加一行操作說明。

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Usability polish Task 5: 工具庫 status dots + hint + segmented toggle ---
  const bagHintText = await page.locator('[data-bag-usage-hint]').innerText();
  record('工具庫 shows an explanatory hint line for click-to-activate', bagHintText.indexOf('啟用') !== -1 && bagHintText.indexOf('卸下') !== -1, bagHintText);
  const activeDotCount = await page.locator('[data-bag-equipment="order-lookup"][data-bag-equipment-level="1"] .ws-status-dot--active').count();
  record('an active skill row shows the active-state dot', activeDotCount === 1);
  const availableDotCount = await page.locator('[data-bag-gem="create_refund"][data-bag-gem-level="1"] .ws-status-dot--available').count();
  record('an available, not-yet-active tool row shows the available-state dot', availableDotCount === 1);
  const lockedDotCount = await page.locator('[data-bag-gem="get_order_status"][data-bag-gem-level="4"] .ws-status-dot--locked').count();
  record('a draft-locked tool row shows the locked-state dot', lockedDotCount === 1);

  const segmentedToggleCount = await page.locator('.ws-segmented[data-bag-mode-segmented]').count();
  record('工具庫 header uses the shared segmented toggle', segmentedToggleCount === 1);
  await page.click('[data-pack-mode-toggle]');
  const packSegmentedToggleCount = await page.locator('.ws-segmented[data-bag-mode-segmented]').count();
  record('打包 pane header uses the same segmented toggle component', packSegmentedToggleCount === 1);
  const packSegmentActiveLabel = await page.locator('.ws-segmented-option--active').innerText();
  record('in pack mode, the 打包 segment is the active one', packSegmentActiveLabel.indexOf('打包') !== -1, packSegmentActiveLabel);
  await page.click('[data-bag-mode-segmented-option="bag"]');
  const bagModeAfterSegmentClick = await page.evaluate(() => window.appState.uiState.bagMode);
  record('clicking the 工具庫 segment switches back to bag mode', bagModeAfterSegmentClick === 'bag', bagModeAfterSegmentClick);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks FAIL — none of `[data-bag-usage-hint]`/`.ws-status-dot`/`[data-bag-mode-segmented]` exist yet.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, add a small shared helper right before `renderBagForVariant`:

```js
function renderBagModeSegmented(currentMode) {
  return (
    '<div class="ws-segmented" data-bag-mode-segmented>' +
      '<span class="ws-segmented-option' + (currentMode === 'bag' ? ' ws-segmented-option--active' : '') + '" data-bag-mode-segmented-option="bag" onclick="wsSetBagMode(\'bag\')">🧰 工具庫</span>' +
      '<span class="ws-segmented-option' + (currentMode === 'pack' ? ' ws-segmented-option--active' : '') + '" data-bag-mode-segmented-option="pack" onclick="wsSetBagMode(\'pack\')">📦 打包</span>' +
    '</div>'
  );
}
```

Change `renderBagForVariant`'s gem/equipment row templates — find:

```js
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + (isDraft ? ' ws-bag-item--draft' : '') + '" ' +
          'data-bag-gem="' + gemDef.name + '" data-bag-gem-level="' + ver.level + '" ' +
          (isDraft ? 'aria-disabled="true" ' : '') +
          'onclick="wsBagWear(\'' + gemDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name">' + escapeHtml(gemDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (isDraft ? ' · 草稿・不可選' : (worn ? ' · 已佩掛' : '')) + '</span>' +
          '<button class="ws-bag-item-detail-btn" data-bag-gem-detail="' + gemDef.name + '.' + ver.level + '" onclick="event.stopPropagation(); wsOpenBagDetail(\'gem\', \'' + gemDef.name + '\', ' + ver.level + ')">⋯</button>' +
        '</div>'
      );
```

to:

```js
      var gemDotClass = isDraft ? 'ws-status-dot--locked' : (worn ? 'ws-status-dot--active' : 'ws-status-dot--available');
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + (isDraft ? ' ws-bag-item--draft' : '') + '" ' +
          'data-bag-gem="' + gemDef.name + '" data-bag-gem-level="' + ver.level + '" ' +
          (isDraft ? 'aria-disabled="true" ' : '') +
          'onclick="wsBagWear(\'' + gemDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name"><span class="ws-status-dot ' + gemDotClass + '"></span>' + escapeHtml(gemDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (isDraft ? ' · 草稿・不可選' : (worn ? ' · 已佩掛' : '')) + '</span>' +
          '<button class="ws-bag-item-detail-btn" data-bag-gem-detail="' + gemDef.name + '.' + ver.level + '" onclick="event.stopPropagation(); wsOpenBagDetail(\'gem\', \'' + gemDef.name + '\', ' + ver.level + ')">⋯</button>' +
        '</div>'
      );
```

And the equipment row — find:

```js
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + (isDraft ? ' ws-bag-item--draft' : '') + '" ' +
          'data-bag-equipment="' + eqDef.name + '" data-bag-equipment-level="' + ver.level + '" ' +
          (isDraft ? 'aria-disabled="true" ' : '') +
          'onclick="wsBagEquip(\'' + eqDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name">' + escapeHtml(eqDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (isDraft ? ' · 草稿・不可選' : (worn ? ' · 已啟用' : '')) + '</span>' +
          '<button class="ws-bag-item-detail-btn" data-bag-equipment-detail="' + eqDef.name + '.' + ver.level + '" onclick="event.stopPropagation(); wsOpenBagDetail(\'equipment\', \'' + eqDef.name + '\', ' + ver.level + ')">⋯</button>' +
        '</div>'
      );
```

to:

```js
      var eqDotClass = isDraft ? 'ws-status-dot--locked' : (worn ? 'ws-status-dot--active' : 'ws-status-dot--available');
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + (isDraft ? ' ws-bag-item--draft' : '') + '" ' +
          'data-bag-equipment="' + eqDef.name + '" data-bag-equipment-level="' + ver.level + '" ' +
          (isDraft ? 'aria-disabled="true" ' : '') +
          'onclick="wsBagEquip(\'' + eqDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name"><span class="ws-status-dot ' + eqDotClass + '"></span>' + escapeHtml(eqDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (isDraft ? ' · 草稿・不可選' : (worn ? ' · 已啟用' : '')) + '</span>' +
          '<button class="ws-bag-item-detail-btn" data-bag-equipment-detail="' + eqDef.name + '.' + ver.level + '" onclick="event.stopPropagation(); wsOpenBagDetail(\'equipment\', \'' + eqDef.name + '\', ' + ver.level + ')">⋯</button>' +
        '</div>'
      );
```

Change `renderBagForVariant`'s return statement from:

```js
  var error = state.uiState.bagError;
  var warning = state.uiState.bagWarning;
  return (
    '<div class="ws-bag-header"><span class="label">🧰 工具庫</span><button class="btn" data-bag-add onclick="wsOpenBagDetailCreate()">＋ 新增</button></div>' +
    (error ? '<div class="ws-bag-error" data-bag-error>' + escapeHtml(error) + '</div>' : '') +
    (warning ? '<div class="ws-bag-warning" data-bag-warning>' + escapeHtml(warning) + '</div>' : '') +
    '<div class="label">🧰 工具庫 — 工具</div>' + gemRows +
    '<div class="label" style="margin-top:var(--space-3);">🧰 工具庫 — 技能</div>' + equipmentRows
  );
}
```

to:

```js
  var error = state.uiState.bagError;
  var warning = state.uiState.bagWarning;
  return (
    '<div class="ws-bag-header">' + renderBagModeSegmented('bag') + '<button class="btn" data-bag-add onclick="wsOpenBagDetailCreate()">＋ 新增</button></div>' +
    '<div class="hint" data-bag-usage-hint>點一下＝啟用／再點一次＝卸下</div>' +
    (error ? '<div class="ws-bag-error" data-bag-error>' + escapeHtml(error) + '</div>' : '') +
    (warning ? '<div class="ws-bag-warning" data-bag-warning>' + escapeHtml(warning) + '</div>' : '') +
    '<div class="label">🧰 工具庫 — 工具</div>' + gemRows +
    '<div class="label" style="margin-top:var(--space-3);">🧰 工具庫 — 技能</div>' + equipmentRows
  );
}
```

Change `renderPackPane`'s header from:

```js
      '<div class="ws-bag-header"><span class="label">📦 打包</span>' +
        '<button class="btn" data-pack-mode-toggle onclick="wsSetBagMode(\'bag\')">🧰 工具庫</button>' +
      '</div>' +
```

to:

```js
      '<div class="ws-bag-header">' + renderBagModeSegmented('pack') + '</div>' +
```

(The `data-pack-mode-toggle` attribute referenced by Task 6's and earlier phases' tests is gone — replaced by `[data-bag-mode-segmented-option="bag"]`, which Step 1's own test already uses; any earlier test still clicking `[data-pack-mode-toggle]` needs the same Ruling-and-rewrite treatment as Task 3 — check for it now.)

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 8 new checks PASS; full suite green — fix any earlier test that clicked the now-removed `[data-pack-mode-toggle]` or `[data-variant-pack-toggle]` selector pathway the same way (the `[data-variant-pack-toggle]` button in the titlebar is untouched by this task — only the pane's own in-header toggle changed).

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): 工具庫 status dots, usage hint, shared segmented 工具庫／打包 toggle"
```

---

### Task 6: 工具庫衝突預先試算（會衝突的版本先變灰）

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsWearGem`/`wsEquipEquipment`（Phase 2，簽名與回傳值完全不變，本任務只是用一個 clone 呼叫它們，不改這兩個函式本身一個字）。
- Produces: `wsWouldWearGemSucceed(variant, gemName, level)`、`wsWouldEquipEquipmentSucceed(variant, eqName, level)` — 兩個唯讀的「試算」函式，回傳跟原函式一樣的 `{ok, message}`／`{ok, warnings}` 形狀，但保證不寫入真正的 `variant`。`renderBagForVariant` 的每一列（非草稿、非目前已啟用）呼叫對應的試算函式，試算失敗時該列加上 `ws-bag-item--conflict` 樣式與 `title` 屬性。

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Usability polish Task 6: 工具庫 conflict pre-check ---
  const wornBeforePrecheck = await page.evaluate(() => JSON.stringify(window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER').variants.find((v) => v.code === 'STANDARD').wornGems));
  const equippedBeforePrecheck = await page.evaluate(() => JSON.stringify(window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER').variants.find((v) => v.code === 'STANDARD').equippedEquipment));
  const precheckResult = await page.evaluate(function () {
    var variant = window.appState.data.npcs.find(function (n) { return n.code === 'FAQ_ANSWER'; }).variants.find(function (v) { return v.code === 'STANDARD'; });
    return wsWouldWearGemSucceed(variant, 'get_order_status', 3);
  });
  record('wsWouldWearGemSucceed returns ok:false for a version that would conflict with the active skill', precheckResult.ok === false, JSON.stringify(precheckResult));
  const wornAfterPrecheck = await page.evaluate(() => JSON.stringify(window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER').variants.find((v) => v.code === 'STANDARD').wornGems));
  const equippedAfterPrecheck = await page.evaluate(() => JSON.stringify(window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER').variants.find((v) => v.code === 'STANDARD').equippedEquipment));
  record('running the pre-check does not mutate the real variant\'s wornGems', wornAfterPrecheck === wornBeforePrecheck, wornAfterPrecheck);
  record('running the pre-check does not mutate the real variant\'s equippedEquipment', equippedAfterPrecheck === equippedBeforePrecheck, equippedAfterPrecheck);

  const conflictRowCount = await page.locator('[data-bag-gem="get_order_status"][data-bag-gem-level="3"].ws-bag-item--conflict').count();
  record('a conflicting (not-yet-clicked) tool row is visually marked as a conflict', conflictRowCount === 1);
  const conflictRowTitle = await page.evaluate(function () {
    var el = document.querySelector('[data-bag-gem="get_order_status"][data-bag-gem-level="3"]');
    return el ? el.getAttribute('title') : null;
  });
  record('the conflicting row explains why via a title attribute', typeof conflictRowTitle === 'string' && conflictRowTitle.indexOf('訂單查詢術') !== -1, conflictRowTitle);
  const nonConflictRowCount = await page.locator('[data-bag-gem="create_refund"][data-bag-gem-level="1"].ws-bag-item--conflict').count();
  record('an unrelated, non-conflicting tool row is not marked as a conflict', nonConflictRowCount === 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: `wsWouldWearGemSucceed is not defined` — all new checks FAIL.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, add right after `wsEquipEquipment` (before `function wsBagWear`):

```js
function wsWouldWearGemSucceed(variant, gemName, level) {
  var clone = JSON.parse(JSON.stringify(variant));
  return wsWearGem(clone, gemName, level);
}

function wsWouldEquipEquipmentSucceed(variant, eqName, level) {
  var clone = JSON.parse(JSON.stringify(variant));
  return wsEquipEquipment(clone, eqName, level);
}
```

In `renderBagForVariant`, change the gem row block from (this is the version Task 5 already updated — apply on top of it):

```js
      var gemDotClass = isDraft ? 'ws-status-dot--locked' : (worn ? 'ws-status-dot--active' : 'ws-status-dot--available');
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + (isDraft ? ' ws-bag-item--draft' : '') + '" ' +
          'data-bag-gem="' + gemDef.name + '" data-bag-gem-level="' + ver.level + '" ' +
          (isDraft ? 'aria-disabled="true" ' : '') +
          'onclick="wsBagWear(\'' + gemDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name"><span class="ws-status-dot ' + gemDotClass + '"></span>' + escapeHtml(gemDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (isDraft ? ' · 草稿・不可選' : (worn ? ' · 已佩掛' : '')) + '</span>' +
          '<button class="ws-bag-item-detail-btn" data-bag-gem-detail="' + gemDef.name + '.' + ver.level + '" onclick="event.stopPropagation(); wsOpenBagDetail(\'gem\', \'' + gemDef.name + '\', ' + ver.level + ')">⋯</button>' +
        '</div>'
      );
```

to:

```js
      var gemDotClass = isDraft ? 'ws-status-dot--locked' : (worn ? 'ws-status-dot--active' : 'ws-status-dot--available');
      var gemConflict = (!isDraft && !worn) ? wsWouldWearGemSucceed(variant, gemDef.name, ver.level) : { ok: true };
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + (isDraft ? ' ws-bag-item--draft' : '') + (gemConflict.ok ? '' : ' ws-bag-item--conflict') + '" ' +
          'data-bag-gem="' + gemDef.name + '" data-bag-gem-level="' + ver.level + '" ' +
          (isDraft ? 'aria-disabled="true" ' : '') +
          (gemConflict.ok ? '' : 'title="' + escapeHtml(gemConflict.message) + '" ') +
          'onclick="wsBagWear(\'' + gemDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name"><span class="ws-status-dot ' + gemDotClass + '"></span>' + escapeHtml(gemDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (isDraft ? ' · 草稿・不可選' : (worn ? ' · 已佩掛' : '')) + '</span>' +
          '<button class="ws-bag-item-detail-btn" data-bag-gem-detail="' + gemDef.name + '.' + ver.level + '" onclick="event.stopPropagation(); wsOpenBagDetail(\'gem\', \'' + gemDef.name + '\', ' + ver.level + ')">⋯</button>' +
        '</div>'
      );
```

Change the equipment row block the same way — from (Task 5's version):

```js
      var eqDotClass = isDraft ? 'ws-status-dot--locked' : (worn ? 'ws-status-dot--active' : 'ws-status-dot--available');
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + (isDraft ? ' ws-bag-item--draft' : '') + '" ' +
          'data-bag-equipment="' + eqDef.name + '" data-bag-equipment-level="' + ver.level + '" ' +
          (isDraft ? 'aria-disabled="true" ' : '') +
          'onclick="wsBagEquip(\'' + eqDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name"><span class="ws-status-dot ' + eqDotClass + '"></span>' + escapeHtml(eqDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (isDraft ? ' · 草稿・不可選' : (worn ? ' · 已啟用' : '')) + '</span>' +
          '<button class="ws-bag-item-detail-btn" data-bag-equipment-detail="' + eqDef.name + '.' + ver.level + '" onclick="event.stopPropagation(); wsOpenBagDetail(\'equipment\', \'' + eqDef.name + '\', ' + ver.level + ')">⋯</button>' +
        '</div>'
      );
```

to:

```js
      var eqDotClass = isDraft ? 'ws-status-dot--locked' : (worn ? 'ws-status-dot--active' : 'ws-status-dot--available');
      var eqConflict = (!isDraft && !worn) ? wsWouldEquipEquipmentSucceed(variant, eqDef.name, ver.level) : { ok: true };
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + (isDraft ? ' ws-bag-item--draft' : '') + (eqConflict.ok ? '' : ' ws-bag-item--conflict') + '" ' +
          'data-bag-equipment="' + eqDef.name + '" data-bag-equipment-level="' + ver.level + '" ' +
          (isDraft ? 'aria-disabled="true" ' : '') +
          (eqConflict.ok ? '' : 'title="' + escapeHtml(eqConflict.message) + '" ') +
          'onclick="wsBagEquip(\'' + eqDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name"><span class="ws-status-dot ' + eqDotClass + '"></span>' + escapeHtml(eqDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (isDraft ? ' · 草稿・不可選' : (worn ? ' · 已啟用' : '')) + '</span>' +
          '<button class="ws-bag-item-detail-btn" data-bag-equipment-detail="' + eqDef.name + '.' + ver.level + '" onclick="event.stopPropagation(); wsOpenBagDetail(\'equipment\', \'' + eqDef.name + '\', ' + ver.level + ')">⋯</button>' +
        '</div>'
      );
```

In `agent-setup-demo/css/workspace.css`, append:

```css
.ws-bag-item--conflict { opacity: .4; cursor: not-allowed; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 6 new checks PASS; full suite green. STANDARD at this point in the suite has `order-lookup` Lv1 equipped (carrying `get_order_status` Lv1), so `get_order_status` Lv3 correctly conflicts; verify the exact variant state the test runs against by reading the suite's prior mutations if the numbers don't match the brief's expectation, and ledger a Ruling with the actual observed state rather than forcing the plan's assumed fixture.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/css/workspace.css agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): 工具庫 pre-checks conflicts and greys out rows before the click"
```

---

### Task 7: 打包模式——新增按鈕跟著分頁走、中文生命週期徽章

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `.ws-pack-badge`（Task 1）、既有 `wsPackNextStatuses`（不變）。
- Produces: `wsPackStatusBadgeHtml(status)` — 回傳中文徽章的 HTML 字串，供 `renderPackListRows` 與 `renderPackDetailViewBody` 共用。

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Usability polish Task 7: pack-mode add-button follows active tab + Chinese status badges ---
  await page.click('[data-bag-mode-segmented-option="pack"]');
  await page.click('[data-pack-list-kind="bundle"]');
  const addBundleVisibleOnBundleTab = await page.locator('[data-pack-create="bundle"]').count();
  const addExtensionVisibleOnBundleTab = await page.locator('[data-pack-create="extension"]').count();
  record('on the 組合包 tab, only ＋新增組合包 is visible', addBundleVisibleOnBundleTab === 1 && addExtensionVisibleOnBundleTab === 0);

  await page.click('[data-pack-list-kind="extension"]');
  const addBundleVisibleOnExtensionTab = await page.locator('[data-pack-create="bundle"]').count();
  const addExtensionVisibleOnExtensionTab = await page.locator('[data-pack-create="extension"]').count();
  record('on the 擴充包 tab, only ＋新增擴充包 is visible', addBundleVisibleOnExtensionTab === 0 && addExtensionVisibleOnExtensionTab === 1);

  await page.click('[data-pack-list-kind="bundle"]');
  const draftBadgeText = await page.locator('[data-pack-row="bundle.CS_BUNDLE_2"] .ws-pack-badge').innerText();
  record('a DRAFT bundle shows the Chinese 草稿 badge in the list, not the raw enum', draftBadgeText === '草稿', draftBadgeText);
  const draftBadgeClass = await page.evaluate(function () {
    var el = document.querySelector('[data-pack-row="bundle.CS_BUNDLE_2"] .ws-pack-badge');
    return el ? el.className : null;
  });
  record('the 草稿 badge carries the draft color modifier class', draftBadgeClass.indexOf('ws-pack-badge--draft') !== -1, draftBadgeClass);

  await page.click('[data-pack-row="bundle.CS_BUNDLE_2"]');
  const detailStatusBadgeText = await page.locator('[data-pack-status] .ws-pack-badge').innerText();
  record('the pack detail flyout also shows the Chinese status badge', detailStatusBadgeText === '草稿', detailStatusBadgeText);
  await page.click('[data-flyout-close]');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: both "only one add button visible" checks FAIL (both currently always render); badge checks FAIL (`.ws-pack-badge` doesn't exist yet, raw `DRAFT` text shows instead).

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, add right after `wsPackNextStatuses` (before `function wsTransitionPackStatus`):

```js
var WS_PACK_STATUS_LABELS = {
  DRAFT: { text: '草稿', cls: 'ws-pack-badge--draft' },
  PUBLISHED: { text: '已上架', cls: 'ws-pack-badge--published' },
  MAINTENANCE: { text: '維護中', cls: 'ws-pack-badge--maintenance' },
  EOS: { text: '已下架', cls: 'ws-pack-badge--eos' }
};

function wsPackStatusBadgeHtml(status) {
  var info = WS_PACK_STATUS_LABELS[status];
  return '<span class="ws-pack-badge ' + info.cls + '">' + info.text + '</span>';
}
```

Change `renderPackListRows` from:

```js
function renderPackListRows(state, kind) {
  var packs = wsPacksForCurrentContext(state, kind);
  if (packs.length === 0) return '<div class="hint">目前沒有' + (kind === 'bundle' ? '組合包' : '擴充包') + '</div>';
  return packs.map(function (p) {
    return (
      '<div class="ws-bag-item" data-pack-row="' + kind + '.' + p.code + '" onclick="wsOpenPackDetail(\'' + kind + '\', \'' + p.code + '\')">' +
        '<span class="ws-bag-item-name">' + escapeHtml(p.displayName) + '</span>' +
        '<span class="hint">' + escapeHtml(p.status) + '</span>' +
      '</div>'
    );
  }).join('');
}
```

to:

```js
function renderPackListRows(state, kind) {
  var packs = wsPacksForCurrentContext(state, kind);
  if (packs.length === 0) return '<div class="hint">目前沒有' + (kind === 'bundle' ? '組合包' : '擴充包') + '</div>';
  return packs.map(function (p) {
    return (
      '<div class="ws-bag-item" data-pack-row="' + kind + '.' + p.code + '" onclick="wsOpenPackDetail(\'' + kind + '\', \'' + p.code + '\')">' +
        '<span class="ws-bag-item-name">' + escapeHtml(p.displayName) + '</span>' +
        wsPackStatusBadgeHtml(p.status) +
      '</div>'
    );
  }).join('');
}
```

Change `renderPackPane`'s create-button row from:

```js
      '<button class="btn" data-pack-create="bundle" onclick="wsOpenPackCreate(\'bundle\')">＋ 新增組合包</button> ' +
      '<button class="btn" data-pack-create="extension" onclick="wsOpenPackCreate(\'extension\')">＋ 新增擴充包</button>' +
```

to:

```js
      (kind === 'bundle'
        ? '<button class="btn" data-pack-create="bundle" onclick="wsOpenPackCreate(\'bundle\')">＋ 新增組合包</button>'
        : '<button class="btn" data-pack-create="extension" onclick="wsOpenPackCreate(\'extension\')">＋ 新增擴充包</button>') +
```

Change `renderPackDetailViewBody`'s status line from:

```js
    '<div class="ws-flyout-field"><span class="label">狀態</span> <span data-pack-status>' + escapeHtml(def.status) + '</span></div>' +
```

to:

```js
    '<div class="ws-flyout-field"><span class="label">狀態</span> <span data-pack-status>' + wsPackStatusBadgeHtml(def.status) + '</span></div>' +
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 6 new checks PASS; full suite green — any earlier test asserting on the raw `DRAFT`/`PUBLISHED` text in `[data-pack-status]` or a pack row needs the Ruling-and-rewrite treatment.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): pack-mode add button follows active tab; Chinese lifecycle status badges"
```

---

### Task 8: 打包建立流程——步驟式表單

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `.ws-step`（Task 1）。
- Produces: 無新函式——`renderPackCreateBundleForm`／`renderPackCreateExtensionForm` 改用 `.ws-step` 包裝既有欄位，互動邏輯（`wsToggleBundleVariantSelection`、`wsSetExtensionAgent`、`wsToggleExtensionItemSelection`、`wsUpdatePackCreateField`、`wsSubmitCreateBundle`/`wsSubmitCreateExtension`）完全不變。

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Usability polish Task 8: step-numbered creation forms ---
  await page.click('[data-pack-list-kind="extension"]');
  await page.click('[data-pack-create="extension"]');
  const extensionStepCount = await page.locator('.ws-step').count();
  record('擴充包 creation form shows 3 numbered steps', extensionStepCount === 3, 'found ' + extensionStepCount);
  const step2DisabledBeforeAgentChosen = await page.evaluate(function () {
    var steps = document.querySelectorAll('.ws-step');
    return steps[1] ? steps[1].classList.contains('ws-step--disabled') : null;
  });
  record('step 2 (勾選項目) looks disabled before an agent is chosen', step2DisabledBeforeAgentChosen === true);
  await page.selectOption('[data-extension-agent-select]', 'FAQ_ANSWER');
  const step2EnabledAfterAgentChosen = await page.evaluate(function () {
    var steps = document.querySelectorAll('.ws-step');
    return steps[1] ? steps[1].classList.contains('ws-step--disabled') : null;
  });
  record('step 2 stops looking disabled once an agent is chosen', step2EnabledAfterAgentChosen === false);
  await page.click('[data-flyout-close]');

  await page.click('[data-pack-list-kind="bundle"]');
  await page.click('[data-pack-create="bundle"]');
  const bundleStepCount = await page.locator('.ws-step').count();
  record('組合包 creation form shows 2 numbered steps (no agent-picker step)', bundleStepCount === 2, 'found ' + bundleStepCount);
  await page.click('[data-flyout-close]');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks FAIL — `.ws-step` doesn't exist yet in either creation form.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, change `renderPackCreateBundleForm`'s return statement from:

```js
  return (
    '<div class="ws-flyout-field"><label class="label">代碼</label><input data-pack-create-name value="' + escapeHtml(form.code || '') + '" oninput="wsUpdatePackCreateField(\'code\', this.value)" placeholder="e.g. CS_BUNDLE_1"></div>' +
    '<div class="ws-flyout-field"><label class="label">顯示名稱</label><input data-pack-create-display-name value="' + escapeHtml(form.displayName || '') + '" oninput="wsUpdatePackCreateField(\'displayName\', this.value)" placeholder="顯示名稱"></div>' +
    '<div class="label">選擇人物卡（同場域：' + escapeHtml(npc.usedFor) + '）</div>' +
    rows +
    (error ? '<div class="ws-flyout-error" data-flyout-error>' + escapeHtml(error) + '</div>' : '') +
    '<div class="ws-flyout-actions">' +
      '<button class="btn" onclick="wsCancelPackCreate()">取消</button> ' +
      '<button class="btn btn-primary" data-pack-create-submit onclick="wsSubmitCreateBundle()">確認建立</button>' +
    '</div>'
  );
}
```

to:

```js
  return (
    '<div class="ws-step">' +
      '<div class="ws-step-title"><span class="ws-step-num">1</span>勾選要放入的人物卡（同場域：' + escapeHtml(npc.usedFor) + '）</div>' +
      rows +
    '</div>' +
    '<div class="ws-step">' +
      '<div class="ws-step-title"><span class="ws-step-num">2</span>命名</div>' +
      '<div class="ws-flyout-field"><label class="label">代碼</label><input data-pack-create-name value="' + escapeHtml(form.code || '') + '" oninput="wsUpdatePackCreateField(\'code\', this.value)" placeholder="e.g. CS_BUNDLE_1"></div>' +
      '<div class="ws-flyout-field"><label class="label">顯示名稱</label><input data-pack-create-display-name value="' + escapeHtml(form.displayName || '') + '" oninput="wsUpdatePackCreateField(\'displayName\', this.value)" placeholder="顯示名稱"></div>' +
    '</div>' +
    (error ? '<div class="ws-flyout-error" data-flyout-error>' + escapeHtml(error) + '</div>' : '') +
    '<div class="ws-flyout-actions">' +
      '<button class="btn" onclick="wsCancelPackCreate()">取消</button> ' +
      '<button class="btn btn-primary" data-pack-create-submit onclick="wsSubmitCreateBundle()">確認建立</button>' +
    '</div>'
  );
}
```

Change `renderPackCreateExtensionForm`'s return statement from:

```js
  return (
    '<div class="ws-flyout-field"><label class="label">適用 Agent</label>' +
      '<select data-extension-agent-select onchange="wsSetExtensionAgent(this.value)">' +
        '<option value="">-- 選擇 --</option>' + agentOptions +
      '</select>' +
    '</div>' +
    '<div class="ws-flyout-field"><label class="label">代碼</label><input data-pack-create-name value="' + escapeHtml(form.code || '') + '" oninput="wsUpdatePackCreateField(\'code\', this.value)" placeholder="e.g. CS_EXT_1"></div>' +
    '<div class="ws-flyout-field"><label class="label">顯示名稱</label><input data-pack-create-display-name value="' + escapeHtml(form.displayName || '') + '" oninput="wsUpdatePackCreateField(\'displayName\', this.value)" placeholder="顯示名稱"></div>' +
    itemsHtml +
    (error ? '<div class="ws-flyout-error" data-flyout-error>' + escapeHtml(error) + '</div>' : '') +
    '<div class="ws-flyout-actions">' +
      '<button class="btn" onclick="wsCancelPackCreate()">取消</button> ' +
      '<button class="btn btn-primary" data-pack-create-submit onclick="wsSubmitCreateExtension()">確認建立</button>' +
    '</div>'
  );
}
```

to:

```js
  return (
    '<div class="ws-step">' +
      '<div class="ws-step-title"><span class="ws-step-num">1</span>選擇適用 Agent</div>' +
      '<select data-extension-agent-select onchange="wsSetExtensionAgent(this.value)">' +
        '<option value="">-- 選擇 --</option>' + agentOptions +
      '</select>' +
    '</div>' +
    '<div class="ws-step' + (form.agentCode ? '' : ' ws-step--disabled') + '">' +
      '<div class="ws-step-title"><span class="ws-step-num">2</span>勾選要放入的工具／技能</div>' +
      itemsHtml +
    '</div>' +
    '<div class="ws-step">' +
      '<div class="ws-step-title"><span class="ws-step-num">3</span>命名</div>' +
      '<div class="ws-flyout-field"><label class="label">代碼</label><input data-pack-create-name value="' + escapeHtml(form.code || '') + '" oninput="wsUpdatePackCreateField(\'code\', this.value)" placeholder="e.g. CS_EXT_1"></div>' +
      '<div class="ws-flyout-field"><label class="label">顯示名稱</label><input data-pack-create-display-name value="' + escapeHtml(form.displayName || '') + '" oninput="wsUpdatePackCreateField(\'displayName\', this.value)" placeholder="顯示名稱"></div>' +
    '</div>' +
    (error ? '<div class="ws-flyout-error" data-flyout-error>' + escapeHtml(error) + '</div>' : '') +
    '<div class="ws-flyout-actions">' +
      '<button class="btn" onclick="wsCancelPackCreate()">取消</button> ' +
      '<button class="btn btn-primary" data-pack-create-submit onclick="wsSubmitCreateExtension()">確認建立</button>' +
    '</div>'
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 5 new checks PASS; full suite green.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): step-numbered 組合包／擴充包 creation forms"
```

---

### Task 9: 擴充包勾選清單——同名分組＋單選鈕

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `.ws-radio-group`（Task 1）、既有 `wsToggleExtensionItemSelection`/`wsToggleMembershipDraftItem`（簽名與「選新的頂掉舊的」邏輯完全不變，只是改變渲染成單選鈕的方式——`onclick` 改掛在 `<input type="radio">` 本身的 `onchange`）。
- Produces: 無新資料邏輯函式——只有一個渲染輔助 `renderExtensionItemRadioGroups(selected, onToggleFnName)`，供建立表單與成員編輯器共用（`onToggleFnName` 是呼叫時要用的全域函式名稱字串，因為兩處呼叫的是不同函式：`wsToggleExtensionItemSelection` vs `wsToggleMembershipDraftItem`，兩者的參數簽名完全相同 `(kind, name, level)`，只是改哪個陣列）。

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Usability polish Task 9: extension item selection grouped by name, radio-style ---
  await page.click('[data-pack-list-kind="extension"]');
  await page.click('[data-pack-create="extension"]');
  await page.selectOption('[data-extension-agent-select]', 'FAQ_ANSWER');
  const radioGroupCount = await page.locator('.ws-radio-group').count();
  record('items are grouped into one .ws-radio-group per catalog name', radioGroupCount > 0, 'found ' + radioGroupCount);
  const orderStatusGroupRadios = await page.locator('[data-radio-group-name="get_order_status"] input[type="radio"]').count();
  record('all published levels of get_order_status share one radio group (plus a 不加入 option)', orderStatusGroupRadios >= 3, 'found ' + orderStatusGroupRadios);

  await page.click('[data-extension-item-radio="gem.get_order_status.1"]');
  const selectedAfterRadioLv1 = await page.evaluate(() => window.appState.uiState.packCreateForm.selectedItems);
  record('selecting Lv1 via radio updates selectedItems', selectedAfterRadioLv1.some((i) => i.name === 'get_order_status' && i.level === 1), JSON.stringify(selectedAfterRadioLv1));

  await page.click('[data-extension-item-radio="gem.get_order_status.2"]');
  const selectedAfterRadioLv2 = await page.evaluate(() => window.appState.uiState.packCreateForm.selectedItems);
  const lv1GoneAfterLv2 = !selectedAfterRadioLv2.some((i) => i.name === 'get_order_status' && i.level === 1);
  record('switching the radio to Lv2 removes the Lv1 selection, not add a second one', lv1GoneAfterLv2 === true, JSON.stringify(selectedAfterRadioLv2));

  await page.click('[data-extension-item-radio="gem.get_order_status.none"]');
  const selectedAfterNone = await page.evaluate(() => window.appState.uiState.packCreateForm.selectedItems);
  const goneAfterNone = !selectedAfterNone.some((i) => i.name === 'get_order_status');
  record('選「不加入」removes the item entirely from selectedItems', goneAfterNone === true, JSON.stringify(selectedAfterNone));
  await page.click('[data-flyout-close]');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks FAIL — `.ws-radio-group`/`[data-extension-item-radio]` don't exist yet (current rendering is independent checkboxes per version, no "不加入" option, no grouping).

- [ ] **Step 3: Write minimal implementation**

`wsToggleExtensionItemSelection` and `wsToggleMembershipDraftItem` already implement "select a different level of the same name removes the old one first" — but neither currently supports a `level: null`/"不加入" case that just removes without adding. Change both to accept `level === null` as a pure removal. In `agent-setup-demo/js/workspace.js`, change `wsToggleExtensionItemSelection` from:

```js
function wsToggleExtensionItemSelection(kind, name, level) {
  var form = window.appState.uiState.packCreateForm;
  form.selectedItems = form.selectedItems || [];
  var sameNameIdx = form.selectedItems.findIndex(function (i) { return i.kind === kind && i.name === name; });
  var isExactMatch = sameNameIdx !== -1 && form.selectedItems[sameNameIdx].level === level;
  if (sameNameIdx !== -1) form.selectedItems.splice(sameNameIdx, 1);
  if (!isExactMatch) form.selectedItems.push({ kind: kind, name: name, level: level });
  window.rerender();
}
```

to:

```js
function wsToggleExtensionItemSelection(kind, name, level) {
  var form = window.appState.uiState.packCreateForm;
  form.selectedItems = form.selectedItems || [];
  var sameNameIdx = form.selectedItems.findIndex(function (i) { return i.kind === kind && i.name === name; });
  if (sameNameIdx !== -1) form.selectedItems.splice(sameNameIdx, 1);
  if (level !== null) form.selectedItems.push({ kind: kind, name: name, level: level });
  window.rerender();
}
```

(This is a strict superset of the old behavior for every call site that never passed `null` before — the old "toggle off if exact match" path is unreachable from the new radio-group UI anyway, since a radio group always has exactly one selection including the explicit "不加入" option; the create-form and membership-editor checkboxes this replaces never need to "toggle the same value off" the way independent checkboxes did.)

Change `wsToggleMembershipDraftItem` identically:

```js
function wsToggleMembershipDraftItem(kind, name, level) {
  var draft = window.appState.uiState.packMembershipDraft;
  var sameNameIdx = draft.findIndex(function (i) { return i.kind === kind && i.name === name; });
  var isExactMatch = sameNameIdx !== -1 && draft[sameNameIdx].level === level;
  if (sameNameIdx !== -1) draft.splice(sameNameIdx, 1);
  if (!isExactMatch) draft.push({ kind: kind, name: name, level: level });
  window.rerender();
}
```

to:

```js
function wsToggleMembershipDraftItem(kind, name, level) {
  var draft = window.appState.uiState.packMembershipDraft;
  var sameNameIdx = draft.findIndex(function (i) { return i.kind === kind && i.name === name; });
  if (sameNameIdx !== -1) draft.splice(sameNameIdx, 1);
  if (level !== null) draft.push({ kind: kind, name: name, level: level });
  window.rerender();
}
```

Add a shared renderer right after `wsPublishedCatalogItems` (before `function wsSubmitCreateExtension`):

```js
function renderExtensionItemRadioGroups(selected, toggleFnName) {
  var byName = {};
  var order = [];
  wsPublishedCatalogItems().forEach(function (item) {
    if (!byName[item.name]) { byName[item.name] = { kind: item.kind, name: item.name, versions: [] }; order.push(item.name); }
    byName[item.name].versions.push(item);
  });
  return order.map(function (name) {
    var group = byName[name];
    var selectedEntry = selected.find(function (s) { return s.kind === group.kind && s.name === name; });
    var groupId = 'radio-' + group.kind + '-' + name;
    var noneRow =
      '<label class="ws-radio-row"><input type="radio" name="' + groupId + '" data-extension-item-radio="' + group.kind + '.' + name + '.none" ' +
        (selectedEntry ? '' : 'checked') + ' onchange="' + toggleFnName + '(\'' + group.kind + '\', \'' + name + '\', null)">不加入</label>';
    var versionRows = group.versions.map(function (v) {
      var checked = selectedEntry && selectedEntry.level === v.level;
      return (
        '<label class="ws-radio-row">' +
          '<input type="radio" name="' + groupId + '" data-extension-item-radio="' + v.kind + '.' + v.name + '.' + v.level + '" ' +
            (checked ? 'checked ' : '') + 'onchange="' + toggleFnName + '(\'' + v.kind + '\', \'' + v.name + '\', ' + v.level + ')">' +
          'Lv' + v.level +
        '</label>'
      );
    }).join('');
    return (
      '<div class="ws-radio-group" data-radio-group-name="' + name + '">' +
        '<div class="ws-radio-group-name">' + escapeHtml(wsGemByName(name) ? wsGemByName(name).displayName : wsEquipmentByName(name).displayName) + '</div>' +
        noneRow + versionRows +
        '<div class="ws-radio-group-hint">同一個工具只能選一個版本</div>' +
      '</div>'
    );
  }).join('');
}
```

Change `renderPackCreateExtensionForm`'s `itemsHtml` block from:

```js
  var itemsHtml = '';
  if (form.agentCode) {
    var selected = form.selectedItems || [];
    itemsHtml = wsPublishedCatalogItems().map(function (item) {
      var checked = selected.some(function (s) { return s.kind === item.kind && s.name === item.name && s.level === item.level; });
      return (
        '<div class="ws-bag-item' + (checked ? ' ws-bag-item--active' : '') + '" data-extension-item-checkbox="' + item.kind + '.' + item.name + '.' + item.level + '" onclick="wsToggleExtensionItemSelection(\'' + item.kind + '\', \'' + item.name + '\', ' + item.level + ')">' +
          '<span class="ws-bag-item-name">' + escapeHtml(item.label) + '</span>' +
          '<span class="hint">' + (checked ? '已選取' : '') + '</span>' +
        '</div>'
      );
    }).join('');
  }
```

to:

```js
  var itemsHtml = '';
  if (form.agentCode) {
    itemsHtml = renderExtensionItemRadioGroups(form.selectedItems || [], 'wsToggleExtensionItemSelection');
  }
```

Change `renderPackMembershipEditor`'s extension (`else`) branch from:

```js
  } else {
    rows = wsPublishedCatalogItems().map(function (item) {
      var checked = draft.some(function (s) { return s.kind === item.kind && s.name === item.name && s.level === item.level; });
      return (
        '<div class="ws-bag-item' + (checked ? ' ws-bag-item--active' : '') + '" data-membership-item-checkbox="' + item.kind + '.' + item.name + '.' + item.level + '" onclick="wsToggleMembershipDraftItem(\'' + item.kind + '\', \'' + item.name + '\', ' + item.level + ')">' +
          '<span class="ws-bag-item-name">' + escapeHtml(item.label) + '</span>' +
          '<span class="hint">' + (checked ? '已選取' : '') + '</span>' +
        '</div>'
      );
    }).join('');
  }
```

to:

```js
  } else {
    rows = renderExtensionItemRadioGroups(draft, 'wsToggleMembershipDraftItem');
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 5 new checks PASS; full suite green — any earlier test clicking `[data-extension-item-checkbox=...]`/`[data-membership-item-checkbox=...]` needs the Ruling-and-rewrite treatment (switch to `[data-extension-item-radio=...]`).

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): 擴充包 item selection grouped by name, radio-style with an explicit 不加入 option"
```

---

### Task 10: 發布檢核清單化＋公開記錄標出目前版本

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: 既有 `wsVariantIsDirty`/`wsEquipmentVersion`/`wsGemVersion`（不變）。既有 `wsPublishVariantErrors`（Phase 2，簽名與回傳型別完全不變，繼續供 `wsConfirmPublishVariant` 把關與既有測試使用）。
- Produces: `wsPublishVariantChecklist(npc, variant)` — 回傳 `[{ok, label}]` 陣列，專供彈窗渲染清單使用，不影響任何既有把關邏輯。

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Usability polish Task 10: publish checklist + 公開記錄 current-version highlight ---
  await page.click('[data-variant-edit-basics]').catch(function () {});
  await page.click('[data-variant-publish]');
  const checklistRowCount = await page.locator('[data-publish-check-row]').count();
  record('發布彈窗 renders a checklist with at least one row', checklistRowCount >= 2, 'found ' + checklistRowCount);
  const failingRowText = await page.locator('[data-publish-check-row][data-publish-check-ok="false"]').first().innerText().catch(function () { return ''; });
  record('a failing check shows ✕ and an actionable reason (not just true/false)', failingRowText.indexOf('✕') !== -1, failingRowText);
  await page.click('[data-publish-variant-close]');

  await page.click('[data-variant-history]');
  const currentRowCount = await page.locator('[data-history-row-current]').count();
  record('公開記錄 highlights exactly one row as the current version', currentRowCount === 1, 'found ' + currentRowCount);
  const currentRowText = await page.locator('[data-history-row-current]').innerText();
  record('the highlighted row matches the variant\'s actual publishedVersion', currentRowText.indexOf('v2') !== -1, currentRowText);
  await page.click('[data-variant-history-close]');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks FAIL — `[data-publish-check-row]`/`[data-history-row-current]` don't exist yet.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, add right after `wsPublishVariantErrors` (before `function renderPublishVariantModalBody`):

```js
function wsPublishVariantChecklist(npc, variant) {
  var checklist = [];
  checklist.push({
    ok: !!(variant.name && variant.name.trim()),
    label: variant.name && variant.name.trim() ? '名稱已填寫' : '名稱為必填'
  });
  checklist.push({
    ok: !wsVariantIsDirty(npc.code, variant),
    label: wsVariantIsDirty(npc.code, variant) ? '有未儲存的修改，請先點標題列的「儲存」' : '沒有未儲存的修改'
  });
  var allCapabilityRefs = variant.equippedEquipment.map(function (e) {
    return { kind: 'equipment', def: wsEquipmentByName(e.name), level: e.level };
  }).concat(variant.wornGems.map(function (g) {
    return { kind: 'gem', def: wsGemByName(g.name), level: g.level };
  }));
  var draftNames = [];
  allCapabilityRefs.forEach(function (ref) {
    var ver = ref.kind === 'equipment' ? wsEquipmentVersion(ref.def, ref.level) : wsGemVersion(ref.def, ref.level);
    if (ver.status === 'draft') draftNames.push(ref.def.displayName);
  });
  checklist.push({
    ok: draftNames.length === 0,
    label: draftNames.length === 0 ? '能力皆為公開版本' : '能力含草稿版本（' + draftNames.join('、') + '），請先公開或移除'
  });
  return checklist;
}
```

Change `renderPublishVariantModalBody` from:

```js
function renderPublishVariantModalBody() {
  var npc = wsFindNpc(window.appState);
  var variant = wsFindVariant(window.appState);
  var errors = wsPublishVariantErrors(npc, variant);
  var modal = document.getElementById('modal-publish-variant-body');
  if (!modal) return;
  modal.innerHTML =
    '<div>發布「' + escapeHtml(variant.name) + '」？目前版本：' + (variant.publishedVersion ? ('v' + variant.publishedVersion) : '尚未發布') + '</div>' +
    (errors.length > 0
      ? '<div class="ws-bag-error" data-publish-variant-error>' + escapeHtml(errors.join('；')) + '</div>'
      : '<div class="hint" data-publish-variant-error></div>') +
    '<div class="ws-variant-titlebar-actions" style="margin-top:12px;">' +
      '<button class="btn" data-publish-variant-close onclick="wsClosePublishVariantModal()">取消</button>' +
      '<button class="btn btn-primary" data-publish-variant-confirm ' + (errors.length > 0 ? 'disabled' : '') + ' onclick="wsConfirmPublishVariant()">確認發布</button>' +
    '</div>';
}
```

to:

```js
function renderPublishVariantModalBody() {
  var npc = wsFindNpc(window.appState);
  var variant = wsFindVariant(window.appState);
  var errors = wsPublishVariantErrors(npc, variant);
  var checklist = wsPublishVariantChecklist(npc, variant);
  var modal = document.getElementById('modal-publish-variant-body');
  if (!modal) return;
  var checklistHtml = checklist.map(function (item) {
    return (
      '<div class="ws-publish-check-row" data-publish-check-row data-publish-check-ok="' + item.ok + '" style="color:' + (item.ok ? 'var(--ok)' : 'var(--block)') + ';">' +
        (item.ok ? '✓ ' : '✕ ') + escapeHtml(item.label) +
      '</div>'
    );
  }).join('');
  modal.innerHTML =
    '<div>發布「' + escapeHtml(variant.name) + '」？目前版本：' + (variant.publishedVersion ? ('v' + variant.publishedVersion) : '尚未發布') + '</div>' +
    '<div style="margin:10px 0;">' + checklistHtml + '</div>' +
    '<div data-publish-variant-error></div>' +
    '<div class="ws-variant-titlebar-actions" style="margin-top:12px;">' +
      '<button class="btn" data-publish-variant-close onclick="wsClosePublishVariantModal()">取消</button>' +
      '<button class="btn btn-primary" data-publish-variant-confirm ' + (errors.length > 0 ? 'disabled' : '') + ' onclick="wsConfirmPublishVariant()">確認發布</button>' +
    '</div>';
}
```

(`[data-publish-variant-error]` stays in the DOM, now always empty, purely so any earlier test that only checks for its *presence* — not its text — keeps passing; if an earlier test asserted on its *text content* carrying the joined error string, that assertion needs the Ruling-and-rewrite treatment to check the new `[data-publish-check-row][data-publish-check-ok="false"]` rows instead.)

Change `renderVariantHistoryModalBody` from:

```js
function renderVariantHistoryModalBody() {
  var variant = wsFindVariant(window.appState);
  var container = document.getElementById('modal-variant-history-body');
  if (!container) return;
  var rows = (variant.publishHistory || []).map(function (entry) {
    return '<div class="ws-history-row">v' + entry.version + ' <span class="hint">' + escapeHtml(entry.publishedAt) + '</span></div>';
  }).join('') || '<div class="hint">尚無發布紀錄</div>';
  container.innerHTML = rows;
}
```

to:

```js
function renderVariantHistoryModalBody() {
  var variant = wsFindVariant(window.appState);
  var container = document.getElementById('modal-variant-history-body');
  if (!container) return;
  var rows = (variant.publishHistory || []).map(function (entry) {
    var isCurrent = variant.publishedVersion && entry.version === variant.publishedVersion;
    return (
      '<div class="ws-history-row' + (isCurrent ? ' ws-history-row--current' : '') + '" ' + (isCurrent ? 'data-history-row-current' : '') + '>' +
        'v' + entry.version + (isCurrent ? ' <span class="ws-pack-badge ws-pack-badge--published">目前</span>' : '') +
        ' <span class="hint">' + escapeHtml(entry.publishedAt) + '</span>' +
      '</div>'
    );
  }).join('') || '<div class="hint">尚無發布紀錄</div>';
  container.innerHTML = rows;
}
```

In `agent-setup-demo/css/workspace.css`, append:

```css
.ws-history-row--current { background: var(--accent-soft); margin: 0 -12px; padding: 4px 12px; border-radius: 4px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 4 new checks PASS; full suite green — any earlier test asserting on `[data-publish-variant-error]`'s *text* (not just presence) or on `.ws-history-row`'s exact structure needs the Ruling-and-rewrite treatment.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/css/workspace.css agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): 發布彈窗 checklist instead of joined error string; 公開記錄 highlights current version"
```

---

### Task 11: skill-admin embed CSS 同步與驗證

**Files:**
- Modify: `skill-admin/agent-setup-embed.css`

**Interfaces:**
- Consumes: 每一個 Task 1-10 新增的 CSS class。
- Produces: 無——最後一個任務。

- [ ] **Step 1: Write the failing test**

比照 Phase 2-4 的既定模式：寫一個 scratch Playwright 腳本，對照目前的 `skill-admin.html`／`skill-admin/agent-setup-embed.css` 跑一次，確認所有 Task 1-10 新增的 class 在嵌入環境下是否也正確套用樣式（而不是只在獨立的 `agent-setup-demo/index.html` 裡生效）。寫入 scratchpad 目錄（使用當下 session 的 scratchpad 路徑）：

```js
const path = require('path');
const { chromium } = require('playwright-core');

async function main() {
  const executablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ executablePath });
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', (err) => jsErrors.push(String(err)));

  const target = process.argv[2];
  await page.goto('file://' + path.resolve(target));
  await page.click("a[onclick*=\"showPage('agents')\"]");
  await page.click('[data-npc-row="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.STANDARD"]');

  const segmentedDisplay = await page.evaluate(() => getComputedStyle(document.querySelector('.ws-segmented')).display);
  console.log('segmented toggle display:', segmentedDisplay, '(expect inline-flex)');
  const dotWidth = await page.evaluate(() => getComputedStyle(document.querySelector('.ws-status-dot')).width);
  console.log('status dot width:', dotWidth, '(expect 6px)');
  const navSettingsVisible = await page.locator('[data-npc-settings="FAQ_ANSWER"]').count();
  console.log('Agent 設定 entry present:', navSettingsVisible);

  console.log('JS errors:', jsErrors.length ? jsErrors : 'none');
  await browser.close();
  process.exit(jsErrors.length ? 1 : 0);
}

main();
```

Run it against the current (pre-Task-11) `skill-admin.html`:

```bash
NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node /path/to/scratchpad/verify-polish-embed.cjs skill-admin.html
```

Expected: `segmented toggle display: inline (unstyled — missing #page-agents scoping)` or similar wrong values, since none of Task 1-10's classes have a `#page-agents`-scoped copy yet.

- [ ] **Step 2: Run test to verify it fails**

Run the command above.
Expected: the computed styles don't match the standalone app's values, or the element is present but unstyled (block/default sizing instead of the flex/6px values the un-embedded app produces).

- [ ] **Step 3: Write minimal implementation**

In `skill-admin/agent-setup-embed.css`, append `#page-agents`-scoped copies of every rule Tasks 1-10 added to `agent-setup-demo/css/workspace.css` and `agent-setup-demo/css/tokens.css`. First, enumerate the exact rule set by diffing this plan's own CSS additions (do not re-derive from scratch — copy-paste each block below, prefixing selectors with `#page-agents `):

```css
#page-agents .ws-ghost-action { color: var(--muted); font-size: 12px; cursor: default; position: relative; display: inline-block; }
#page-agents .ws-ghost-action[data-ghost-tip]:hover::after {
  content: attr(data-ghost-tip);
  position: absolute; bottom: 125%; left: 50%; transform: translateX(-50%);
  background: var(--ink); color: #fff; padding: 4px 8px; border-radius: 4px;
  font-size: 11px; white-space: nowrap; z-index: 20;
}
#page-agents .ws-status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 5px; }
#page-agents .ws-status-dot--active { background: var(--accent); }
#page-agents .ws-status-dot--available { background: var(--muted); opacity: .5; }
#page-agents .ws-status-dot--locked { background: var(--line); }
#page-agents .ws-radio-group { border: 1px solid var(--line); border-radius: var(--radius); padding: 8px; margin-bottom: 8px; }
#page-agents .ws-radio-group-name { font-size: 12px; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
#page-agents .ws-radio-row { display: flex; align-items: center; gap: 6px; padding: 4px 2px; font-size: 12px; cursor: pointer; }
#page-agents .ws-radio-row input { accent-color: var(--accent); }
#page-agents .ws-radio-group-hint { font-size: 10.5px; color: var(--muted); margin-top: 2px; }
#page-agents .ws-segmented { display: inline-flex; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
#page-agents .ws-segmented-option { padding: 5px 12px; font-size: 12px; cursor: pointer; color: var(--muted); background: var(--panel); }
#page-agents .ws-segmented-option--active { background: var(--accent); color: #fff; }
#page-agents .ws-pack-badge { font-size: 11px; padding: 2px 7px; border-radius: 9px; }
#page-agents .ws-pack-badge--draft { background: var(--muted-soft); color: var(--muted); }
#page-agents .ws-pack-badge--published { background: var(--ok-soft); color: var(--ok); }
#page-agents .ws-pack-badge--maintenance { background: var(--warn-soft); color: var(--warn); }
#page-agents .ws-pack-badge--eos { background: var(--block-soft); color: var(--block); }
#page-agents .ws-step { border: 1px solid var(--line); border-radius: var(--radius); padding: 10px; margin-bottom: 10px; }
#page-agents .ws-step-title { font-size: 12px; font-weight: 600; color: var(--ink); }
#page-agents .ws-step-num { display: inline-flex; width: 18px; height: 18px; border-radius: 50%; background: var(--accent); color: #fff; align-items: center; justify-content: center; font-size: 11px; margin-right: 6px; }
#page-agents .ws-step--disabled { opacity: .45; }
#page-agents .ws-step--disabled .ws-step-num { background: var(--muted); }
#page-agents .ws-nav-npc { cursor: pointer; }
#page-agents .ws-nav-npc:hover { background: #f0f0f5; border-radius: 5px; }
#page-agents .ws-nav-toggle { display: inline-block; width: 14px; text-align: center; color: var(--muted); font-size: 10px; transition: transform .15s; }
#page-agents .ws-nav-toggle--open { transform: rotate(90deg); }
#page-agents .ws-nav-settings { padding: 6px 6px 6px 28px; font-size: 12px; cursor: pointer; color: var(--ink); }
#page-agents .ws-nav-settings:hover { background: #f5f5fa; border-radius: 5px; }
#page-agents .ws-nav-divider { border-top: 1px dashed var(--line); margin: 4px 6px 4px 28px; }
#page-agents .ws-skill-block { margin-bottom: 10px; }
#page-agents .ws-skill-head { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 600; color: var(--ink); padding: 4px 0; }
#page-agents .ws-skill-head .btn { padding: 2px 8px; height: auto; }
#page-agents .ws-carried-tool { display: flex; align-items: center; gap: 6px; padding: 4px 4px 4px 18px; font-size: 11.5px; color: var(--muted); }
#page-agents .ws-carried-tag { background: var(--accent-soft); color: var(--accent); font-size: 10px; padding: 1px 6px; border-radius: 7px; }
#page-agents .ws-bag-item--conflict { opacity: .4; cursor: not-allowed; }
#page-agents .ws-history-row--current { background: var(--accent-soft); margin: 0 -12px; padding: 4px 12px; border-radius: 4px; }
```

(`--muted-soft` is a `:root`-level custom property defined in `agent-setup-demo/css/tokens.css`; confirm `skill-admin.html` either already loads that file or has its own `:root` block — if the embed doesn't inherit it, add `--muted-soft: #f0f0f0;` to whatever `:root`/`#page-agents` scope the embed's existing tokens live in, matching how the other tokens (`--accent`, `--ok`, etc.) are already made available there.)

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node /path/to/scratchpad/verify-polish-embed.cjs skill-admin.html`
Expected: `segmented toggle display: inline-flex`, `status dot width: 6px`, `Agent 設定 entry present: 1`, `JS errors: none`, exits 0.

Then run the full `agent-setup-demo` suite once more to confirm this task touched nothing it owns:

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: same total as Task 10 left it, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add skill-admin/agent-setup-embed.css
git commit -m "feat(agent-setup-demo): sync usability-polish CSS into the skill-admin.html embed"
```

---

## Self-Review Notes

- **Spec coverage:** 視覺方向（ghost-action/status-dot）→ Task 1-2, 5-6；左側導覽→ Task 3；能力區鑲嵌關聯→ Task 4；打包模式新增按鈕/步驟式表單/中文徽章→ Task 7-8；發布檢核/公開記錄→ Task 10；擇一規則視覺化 A（打包勾選同名分組）→ Task 9；B（能力區）→ Task 4；C（工具庫先變灰）→ Task 6；embed 同步→ Task 11。「Scope correction」一節已記錄 `wsPublishModelErrors` 不在範圍內，不是遺漏。
- **Placeholder scan:** 無 TBD/TODO；每個 Task 3/4/5/7/9/10 的 Step 4 都明確指出「這會讓某些既有測試變紅，要去改」而不是略過不提——這是誠實記錄一個會發生的真實後果，不是佔位符。
- **Type consistency:** `wsWouldWearGemSucceed`/`wsWouldEquipEquipmentSucceed` 回傳型別與 `wsWearGem`/`wsEquipEquipment` 完全一致（`{ok, message}` / `{ok, warnings}`），因為就是同一份邏輯跑在 clone 上。`wsPublishVariantChecklist` 的 `{ok, label}` 形狀在 Task 10 定義後只有 `renderPublishVariantModalBody` 一個消費者。`renderExtensionItemRadioGroups` 在 Task 9 被兩個呼叫點（建立表單、成員編輯器）用相同簽名呼叫。
- **Review Focus：** 5 條在對應任務裡都有專屬測試——ghost-action 的 disabled 可測性（Task 2）、nav 整列點擊造成舊測試斷裂（Task 3 的 Step 4 明文處理）、工具庫試算不得寫回真實變體（Task 6 的 mutate-check 測試）、擴充包「不加入」要能真的移除（Task 9 的最後一個斷言）、公開記錄在從未發布時的 fallback 相容性（Task 10 的 `isCurrent` 判斷式用 `variant.publishedVersion &&` 短路，`publishedVersion` 為 `null` 時每一列的 `isCurrent` 必為 `false`，不會誤標——這點在 Task 10 沒有額外測試，因為套用到的 STANDARD/PREMIUM 這兩個測試夾具在這個階段都已經發布過；若要更嚴謹涵蓋「從未發布」分支，需要額外建一個從未發布的人物卡夾具，這超出本輪範圍，記錄在此供下一輪參考）。
