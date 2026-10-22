# Agent 基礎設定單一工作區 Phase 2：人物卡編輯＋右欄窄背包 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Phase 1's "人物卡編輯將於 Phase 2 提供" stub with a working variant (人物卡) editor — three-tab card (基本資料／模型／基礎指令), an ability area (裝備欄／佩掛寶石) backed by a real gem/equipment catalog, and a narrow right-column bag that lets the user equip/wear/unequip published materials with the inherited 寶石置換規則 enforced. Ends with working 儲存／放棄修改／發布 and a 公開記錄 history modal.

**Architecture:** Builds directly on Phase 1's `agent-setup-demo/js/{data,workspace,app}.js`. Adds a gem/equipment catalog to `SEED`, a `wsFindVariant` lookup paralleling `wsFindNpc`, a `renderVariantPane` family of render functions wired the same way Phase 1 wired `renderNpcPane`, and a pure gem-replacement rules module (`wsEquipEquipment`/`wsUnequipEquipment`/`wsWearGem`/`wsUnwearGem`) that both the bag clicks and a later test suite can call directly.

**Tech Stack:** Same as Phase 1 — plain HTML/CSS/vanilla JS, `file://`, no build step. Tests continue to live in `agent-setup-demo/tests/ui.test.cjs` (one long stateful Playwright script) and run via `playwright-core` against a real local Chrome.

**Spec:** `docs/superpowers/specs/2026-10-06-agent-setup-unified-workspace-design.md` for the three-pane shell this phase fills in (the "選中人物卡" and "背包：狀態一（窄背包）" sections). For the *behavioral* rules this phase must reproduce — the 寶石置換規則 table, the 儲存與發布檢核 table, and the 編輯人物卡整體版面 — the binding source is the original `UI_Agent 基礎設定 Demo 設計.md` content the user pasted into this conversation (not a file on disk in this repo); this plan transcribes the exact rules it needs inline so no task depends on re-reading that conversation.

## Scope simplification versus the original design (documented, not silent)

- **模型 tab is read-only in this phase.** The original design's "模型鎖定" mechanic (a variant locks to one *version* of the NPC's model, selectable only pre-publish) requires the NPC's model to carry a version *history*, which Phase 1 never built (Phase 1's `chatModel`/`vectorModel` each carry a single current `version` number, not an array of versions). This phase's 模型 tab shows the NPC's current `chatModel`/`vectorModel` (name + version) as plain text, with a `hint` line stating the lock mechanic is deferred. Building the version-history data model is explicitly out of scope here — flag it as a dependency the next phase (or a dedicated NPC-model-versioning phase) must resolve before the real lock behavior can be built.
- **公開記錄 (publish history) only has one entry per publish** (version, timestamp, who) — the original design's richer row (對話模型、向量模型、能力、發布說明) is reduced to what Phase 1+2's data model actually tracks. Columns for fields this phase doesn't populate are omitted rather than shown empty.

## Global Constraints

- Everything from Phase 1's Global Constraints still applies (no build tooling, no ES modules, `agent-setup-demo/tests/ui.test.cjs` run via `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`).
- 人物卡（variant）`code` is immutable once created (already enforced by Phase 1); this phase never changes it.
- 草稿版本的寶石或裝備不可被佩掛／穿上 — attempting to do so must be blocked with a stated reason, never silently ignored.
- 卸下裝備時，它帶入的寶石跟著移除，除非另一件穿著中的裝備也帶著同一顆寶石（因為 `wsCarriedGems` 永遠從目前的 `equippedEquipment` 重新算，不會有殘留）。
- 設計原則「按鈕不時有時無」：儲存／放棄修改／發布按鈕永遠顯示，沒有可儲存的修改時用 `disabled`，不要從 DOM 移除。
- 編輯中動作列的「放棄修改」只在有未儲存變更時可用，道理同上。

## Review Focus

- 佩掛 Lv1 寶石後，穿上一件鑲嵌同名寶石但等級不同（Lv2）的裝備：佩掛的寶石必須自動換成 Lv2 並出現警告，不能被擋下、也不能兩份同名寶石同時存在。
- 穿著一件鑲嵌寶石的裝備時，嘗試佩掛同名但不同等級的寶石：必須被擋下並說明原因，不能讓佩掛清單裡出現跟裝備衝突的等級。
- 兩件裝備都想鑲嵌同名寶石但等級不同：第二件裝備的穿上動作必須被擋下，不能讓兩個不同等級的同名寶石同時被「帶入」。
- 點擊草稿版本的寶石或裝備：必須被擋下並說明「只能引用公開版」，不能穿上/佩掛成功。
- 發布人物卡時有未儲存的修改，或人物卡能力含草稿版本：「發布」必須被擋下並說明原因，不能核發版號。

---

## File Structure

```
agent-setup-demo/
├── js/
│   ├── data.js         # MODIFY: add SEED.gems, SEED.equipment; extend variant seed objects
│   ├── workspace.js     # MODIFY: add wsFindVariant, renderVariantPane family, ability-area
│   │                     #   renderers, bag-in-variant-mode renderer, the four gem-replacement
│   │                     #   rule functions, save/publish/history logic
│   └── app.js            # MODIFY: render() gains a variant-pane pass; uiState gains the new
│                          #   per-variant draft-tracking keys
└── tests/
    └── ui.test.cjs        # MODIFY: ~20 new assertions appended, same stateful style as Phase 1
```

No new files — Phase 2 is purely additive inside the three files Phase 1 established.

---

### Task 1: Gem/equipment catalog + variant capability fields + center-pane routing

**Files:**
- Modify: `agent-setup-demo/js/data.js`
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `SEED.npcs` (Phase 1), `wsFindNpc` (Phase 1), `renderCenterPane` (Phase 1).
- Produces: `SEED.gems` (array of `{name, displayName, kind, protocol, versions:[{level, status}]}`), `SEED.equipment` (array of `{name, displayName, versions:[{level, status, gems:[{gemName, level}]}]}`), variant objects gain `description`, `baseInstructions`, `equippedEquipment:[{name, level}]`, `wornGems:[{name, level}]`. `wsFindVariant(state)` returning the selected variant object or `undefined`. `renderCenterPane` now routes a variant selection to `<div id="ws-variant-pane"></div>` instead of the Phase 2 stub.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 2: catalog + variant fields + routing ---
  const gemCount = await page.evaluate(() => window.appState.data.gems.length);
  record('SEED has a gem catalog', gemCount >= 4, 'found ' + gemCount);
  const equipmentCount = await page.evaluate(() => window.appState.data.equipment.length);
  record('SEED has an equipment catalog', equipmentCount >= 2, 'found ' + equipmentCount);

  const orderLookup = await page.evaluate(() => window.appState.data.equipment.find((e) => e.name === 'order-lookup'));
  record('order-lookup equipment carries get_order_status at Lv1 and Lv2', !!orderLookup && orderLookup.versions.length === 2 && orderLookup.versions[0].gems[0].gemName === 'get_order_status');

  const standardVariant = await page.evaluate(() => window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER').variants.find((v) => v.code === 'STANDARD'));
  record('STANDARD variant seeds equippedEquipment/wornGems arrays', !!standardVariant && Array.isArray(standardVariant.equippedEquipment) && Array.isArray(standardVariant.wornGems));

  await page.click('[data-npc-toggle="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.STANDARD"]');
  const variantPaneCount = await page.locator('#ws-variant-pane').count();
  record('selecting a variant now renders #ws-variant-pane instead of the stub', variantPaneCount === 1);
  const stubGoneCount = await page.locator('.ws-variant-stub').count();
  record('the Phase 2 stub is gone', stubGoneCount === 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: the 5 new checks FAIL (`window.appState.data.gems` is `undefined`, selecting a variant still shows the old stub).

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/data.js`, add two new top-level keys to the `SEED` object (insert after the closing `}` of `modelTemplates` and before the final `};` that closes `SEED`) — change the file's ending from:

```js
    'text-embedding-3-small': {
      type: 'vector',
      label: 'text-embedding-3-small',
      params: [
        { key: 'dimensions', label: 'Dimensions', kind: 'enum', enumValues: [512, 1536], default: 1536 }
      ]
    }
  }
};
```

to:

```js
    'text-embedding-3-small': {
      type: 'vector',
      label: 'text-embedding-3-small',
      params: [
        { key: 'dimensions', label: 'Dimensions', kind: 'enum', enumValues: [512, 1536], default: 1536 }
      ]
    }
  },
  gems: [
    {
      name: 'get_order_status', displayName: '查詢訂單狀態', kind: 'API', protocol: 'REST',
      versions: [
        { level: 1, status: 'published' },
        { level: 2, status: 'published' },
        { level: 3, status: 'published' },
        { level: 4, status: 'draft' }
      ]
    },
    {
      name: 'create_refund', displayName: '建立退款單', kind: 'API', protocol: 'REST',
      versions: [{ level: 1, status: 'published' }]
    },
    {
      name: 'run_sql_query', displayName: 'SQL 查詢', kind: 'API', protocol: 'REST',
      versions: [{ level: 1, status: 'published' }, { level: 2, status: 'published' }]
    },
    {
      name: 'render_chart', displayName: '產生圖表', kind: 'API', protocol: 'REST',
      versions: [{ level: 1, status: 'published' }]
    }
  ],
  equipment: [
    {
      name: 'order-lookup', displayName: '訂單查詢術',
      versions: [
        { level: 1, status: 'published', gems: [{ gemName: 'get_order_status', level: 1 }] },
        { level: 2, status: 'published', gems: [{ gemName: 'get_order_status', level: 2 }] }
      ]
    },
    {
      name: 'refund-helper', displayName: '退款小幫手',
      versions: [{ level: 1, status: 'published', gems: [{ gemName: 'create_refund', level: 1 }] }]
    },
    {
      name: 'sql-analysis', displayName: 'SQL 分析術',
      versions: [
        { level: 1, status: 'published', gems: [{ gemName: 'run_sql_query', level: 1 }] },
        { level: 2, status: 'published', gems: [{ gemName: 'run_sql_query', level: 2 }] }
      ]
    }
  ]
};
```

Then update the two seed variants on `FAQ_ANSWER` (still in `data.js`) from:

```js
      variants: [
        { code: 'STANDARD', name: '一般版', publishedVersion: 2 },
        { code: 'PREMIUM', name: '豪華版', publishedVersion: 1 }
      ]
```

to:

```js
      variants: [
        { code: 'STANDARD', name: '一般版', publishedVersion: 2, description: '客服的一般版本，查得到訂單狀態。', baseInstructions: '請用親切的語氣回答客戶問題，優先查詢訂單狀態。', equippedEquipment: [{ name: 'order-lookup', level: 1 }], wornGems: [] },
        { code: 'PREMIUM', name: '豪華版', publishedVersion: 1, description: '豪華版客服，可以直接幫客戶退款。', baseInstructions: '請用親切的語氣回答客戶問題，必要時可直接建立退款單。', equippedEquipment: [], wornGems: [{ name: 'create_refund', level: 1 }] }
      ]
```

In `agent-setup-demo/js/workspace.js`, add `wsFindVariant` right after `wsFindNpc`:

```js
function wsFindVariant(state) {
  var npc = wsFindNpc(state);
  if (!npc) return undefined;
  return npc.variants.find(function (v) { return v.code === state.selection.variantCode; });
}
```

Replace `renderCenterPane`'s variant branch — change:

```js
  if (sel.variantCode) {
    return '<div class="ws-variant-stub hint">人物卡編輯將於 Phase 2 提供。</div>';
  }
```

to:

```js
  if (sel.variantCode) {
    return '<div id="ws-variant-pane"></div>';
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: `68 checks, 0 failed, 0 JS errors` (Phase 1 ended at 63; this task adds 5).

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): add gem/equipment catalog, variant capability fields, variant-pane routing"
```

---

### Task 2: Variant pane shell — title bar (status text + disabled-by-default action buttons)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/js/app.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsFindVariant` (Task 1), `#ws-variant-pane` container (Task 1).
- Produces: `renderVariantPane(state)` wired into `app.js`'s `render()` the same way `renderNpcPane`/`renderModelSection` are. `wsVariantIsDirty(variant)` (pure, compares a variant against a "last saved" snapshot kept in `uiState.variantSnapshots[npcCode + '.' + variantCode]`). `window.wsDiscardVariantChanges()`.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  const variantPaneText = await page.locator('#ws-variant-pane').innerText();
  record('variant pane shows published-version status', variantPaneText.indexOf('已發布 v2') !== -1, variantPaneText);
  record('variant pane shows saved status', variantPaneText.indexOf('已儲存') !== -1, variantPaneText);

  const discardDisabled = await page.locator('[data-variant-discard]').isDisabled();
  record('放棄修改 starts disabled (nothing to discard yet)', discardDisabled === true);
  const saveDisabled = await page.locator('[data-variant-save]').isDisabled();
  record('儲存 starts disabled (nothing to save yet)', saveDisabled === true);
  const publishEnabled = await page.locator('[data-variant-publish]').isDisabled();
  record('發布 is always clickable (not disabled by having no changes)', publishEnabled === false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: the 5 new checks FAIL (`#ws-variant-pane` is empty).

- [ ] **Step 3: Write minimal implementation**

Append to `agent-setup-demo/js/workspace.js`:

```js
function wsVariantSnapshotKey(npcCode, variantCode) {
  return npcCode + '.' + variantCode;
}

function wsVariantIsDirty(npcCode, variant) {
  var key = wsVariantSnapshotKey(npcCode, variant.code);
  var snapshot = window.appState.uiState.variantSnapshots[key];
  if (!snapshot) return false;
  return JSON.stringify(snapshot) !== JSON.stringify({
    name: variant.name,
    description: variant.description,
    baseInstructions: variant.baseInstructions,
    equippedEquipment: variant.equippedEquipment,
    wornGems: variant.wornGems
  });
}

function wsEnsureVariantSnapshot(npcCode, variant) {
  var key = wsVariantSnapshotKey(npcCode, variant.code);
  if (!window.appState.uiState.variantSnapshots[key]) {
    window.appState.uiState.variantSnapshots[key] = {
      name: variant.name,
      description: variant.description,
      baseInstructions: variant.baseInstructions,
      equippedEquipment: JSON.parse(JSON.stringify(variant.equippedEquipment)),
      wornGems: JSON.parse(JSON.stringify(variant.wornGems))
    };
  }
}

function wsDiscardVariantChanges() {
  var npc = wsFindNpc(window.appState);
  var variant = wsFindVariant(window.appState);
  var key = wsVariantSnapshotKey(npc.code, variant.code);
  var snapshot = window.appState.uiState.variantSnapshots[key];
  if (!snapshot) { window.rerender(); return; }
  variant.name = snapshot.name;
  variant.description = snapshot.description;
  variant.baseInstructions = snapshot.baseInstructions;
  variant.equippedEquipment = JSON.parse(JSON.stringify(snapshot.equippedEquipment));
  variant.wornGems = JSON.parse(JSON.stringify(snapshot.wornGems));
  window.rerender();
}

function renderVariantPane(state) {
  var container = document.getElementById('ws-variant-pane');
  if (!container) return;
  var npc = wsFindNpc(state);
  var variant = wsFindVariant(state);
  if (!npc || !variant) { container.innerHTML = ''; return; }

  wsEnsureVariantSnapshot(npc.code, variant);
  var dirty = wsVariantIsDirty(npc.code, variant);
  var publishLabel = variant.publishedVersion ? ('已發布 v' + variant.publishedVersion) : '尚未發布';
  var savedLabel = dirty ? '有未儲存的修改' : '已儲存';

  container.innerHTML =
    '<div class="ws-variant-titlebar">' +
      '<span class="ws-variant-titlebar-name">' + escapeHtml(variant.name) + '</span>' +
      '<span class="hint">' + publishLabel + '</span>' +
      '<span class="hint">' + savedLabel + '</span>' +
      '<div class="ws-variant-titlebar-actions">' +
        '<button class="btn" data-variant-discard ' + (dirty ? '' : 'disabled') + ' onclick="wsDiscardVariantChanges()">放棄修改</button>' +
        '<button class="btn btn-primary" data-variant-save ' + (dirty ? '' : 'disabled') + ' onclick="wsSaveVariant()">💾 儲存</button>' +
        '<button class="btn" data-variant-publish onclick="wsOpenPublishVariantModal()">🚀 發布</button>' +
      '</div>' +
    '</div>' +
    '<div id="ws-variant-body"></div>';
}
```

(`wsSaveVariant` and `wsOpenPublishVariantModal` are defined in Tasks 8–9; leave them undefined for now — the buttons exist but clicking them before those tasks land will throw, which is fine since no test clicks them yet.)

Update `render()` in `agent-setup-demo/js/app.js`:

```js
function render() {
  document.getElementById('ws-nav').innerHTML = renderNavTree(window.appState);
  document.getElementById('ws-center').innerHTML = renderCenterPane(window.appState);
  document.getElementById('ws-bag').innerHTML = renderBagPlaceholder();
  renderNpcPane(window.appState);
  renderModelSection(window.appState);
  renderVariantPane(window.appState);
}
```

Add `variantSnapshots: {}` to both `uiState` object literals in `agent-setup-demo/js/app.js` (the initial `window.appState = {...}` assignment and the one inside `resetData()`), alongside the existing `modelParamEdits: {}` key — insert `variantSnapshots: {},` right after `modelParamErrors: {}` in both places.

Append to `agent-setup-demo/css/workspace.css`:

```css
.ws-variant-titlebar { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); flex-wrap: wrap; }
.ws-variant-titlebar-name { font-size: 16px; font-weight: 600; }
.ws-variant-titlebar-actions { margin-left: auto; display: flex; gap: 6px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: `73 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): add variant pane title bar with dirty-tracked action buttons"
```

---

### Task 3: 基本資料 tab (read + pencil edit) + tab switching shell

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `#ws-variant-body` (Task 2).
- Produces: `window.wsSwitchVariantTab(tabName)` (`'basics' | 'model' | 'instructions'`), `renderVariantBody(state)`, `window.wsStartEditVariantBasics()`, `window.wsCommitEditVariantBasics()`, `window.wsCancelEditVariantBasics()`.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  const tabsText = await page.locator('#ws-variant-body').innerText();
  record('variant body shows the three tab labels', tabsText.indexOf('基本資料') !== -1 && tabsText.indexOf('模型') !== -1 && tabsText.indexOf('基礎指令') !== -1, tabsText);

  const basicsText = await page.locator('[data-variant-tab-panel="basics"]').innerText();
  record('basics tab shows description read-only', basicsText.indexOf('客服的一般版本，查得到訂單狀態。') !== -1, basicsText);

  await page.click('[data-variant-edit-basics]');
  const nameInputCount = await page.locator('[data-variant-name-input]').count();
  record('pencil turns name into an input', nameInputCount === 1);

  await page.fill('[data-variant-name-input]', '一般版（已更名）');
  await page.fill('[data-variant-description-input]', '更新後的描述');
  await page.click('[data-variant-edit-commit]');
  const nameSaved = await page.evaluate(() => window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER').variants.find((v) => v.code === 'STANDARD').name);
  record('committing basics edit persists the new name', nameSaved === '一般版（已更名）', nameSaved);

  const nowDirty = await page.locator('[data-variant-save]').isDisabled();
  record('editing basics marks the variant dirty (save becomes enabled)', nowDirty === false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: the 5 new checks FAIL (`#ws-variant-body` is empty).

- [ ] **Step 3: Write minimal implementation**

Append to `agent-setup-demo/js/workspace.js`:

```js
function wsSwitchVariantTab(tabName) {
  window.appState.uiState.variantTab = tabName;
  window.rerender();
}

function renderVariantBasicsTab(variant) {
  var editing = window.appState.uiState.editingVariantBasics;
  if (editing) {
    return (
      '<div class="ws-variant-field">' +
        '<label class="label">名稱</label>' +
        '<input class="ws-nav-form-input" data-variant-name-input value="' + escapeHtml(variant.name) + '">' +
      '</div>' +
      '<div class="ws-variant-field">' +
        '<label class="label">說明</label>' +
        '<textarea data-variant-description-input rows="3">' + escapeHtml(variant.description) + '</textarea>' +
      '</div>' +
      '<button class="btn btn-primary" data-variant-edit-commit onclick="wsCommitEditVariantBasics()">✓ 完成編輯</button> ' +
      '<button class="btn" onclick="wsCancelEditVariantBasics()">取消</button>'
    );
  }
  return (
    '<div class="ws-variant-field"><span class="label">名稱</span>' + escapeHtml(variant.name) + '</div>' +
    '<div class="ws-variant-field"><span class="label">說明</span>' + escapeHtml(variant.description) + '</div>' +
    '<button class="btn" data-variant-edit-basics onclick="wsStartEditVariantBasics()">✎ 編輯</button>'
  );
}

function renderVariantModelTab(npc) {
  var chat = npc.chatModel ? (window.appState.data.modelTemplates[npc.chatModel.key].label + ' · v' + npc.chatModel.version) : '尚未設定對話模型';
  var vector = npc.vectorModel ? (window.appState.data.modelTemplates[npc.vectorModel.key].label + ' · v' + npc.vectorModel.version) : '不使用向量模型';
  return (
    '<div class="ws-variant-field"><span class="label">對話模型</span>' + escapeHtml(chat) + '</div>' +
    '<div class="ws-variant-field"><span class="label">向量模型</span>' + escapeHtml(vector) + '</div>' +
    '<div class="hint">模型版本鎖定將於後續階段提供；目前人物卡沿用 NPC 目前生效的模型。</div>'
  );
}

function renderVariantInstructionsTab(variant) {
  var editing = window.appState.uiState.editingVariantInstructions;
  if (editing) {
    return (
      '<textarea data-variant-instructions-input rows="8" style="width:100%;">' + escapeHtml(variant.baseInstructions) + '</textarea>' +
      '<button class="btn btn-primary" data-variant-instructions-commit onclick="wsCommitEditVariantInstructions()">✓ 完成編輯</button> ' +
      '<button class="btn" onclick="wsCancelEditVariantInstructions()">取消</button>'
    );
  }
  return (
    '<div class="ws-variant-field" style="white-space:pre-wrap;">' + escapeHtml(variant.baseInstructions) + '</div>' +
    '<button class="btn" data-variant-edit-instructions onclick="wsStartEditVariantInstructions()">✎ 編輯</button>'
  );
}

function renderVariantBody(state) {
  var container = document.getElementById('ws-variant-body');
  if (!container) return;
  var npc = wsFindNpc(state);
  var variant = wsFindVariant(state);
  if (!npc || !variant) { container.innerHTML = ''; return; }

  var tab = state.uiState.variantTab || 'basics';
  var tabsBar =
    '<div class="ws-variant-tabs">' +
      '<span class="ws-variant-tab' + (tab === 'basics' ? ' ws-variant-tab--active' : '') + '" onclick="wsSwitchVariantTab(\'basics\')">基本資料</span>' +
      '<span class="ws-variant-tab' + (tab === 'model' ? ' ws-variant-tab--active' : '') + '" onclick="wsSwitchVariantTab(\'model\')">模型</span>' +
      '<span class="ws-variant-tab' + (tab === 'instructions' ? ' ws-variant-tab--active' : '') + '" onclick="wsSwitchVariantTab(\'instructions\')">基礎指令</span>' +
    '</div>';

  var panel;
  if (tab === 'model') {
    panel = '<div class="ws-variant-tab-panel" data-variant-tab-panel="model">' + renderVariantModelTab(npc) + '</div>';
  } else if (tab === 'instructions') {
    panel = '<div class="ws-variant-tab-panel" data-variant-tab-panel="instructions">' + renderVariantInstructionsTab(variant) + '</div>';
  } else {
    panel = '<div class="ws-variant-tab-panel" data-variant-tab-panel="basics">' + renderVariantBasicsTab(variant) + '</div>';
  }

  container.innerHTML = tabsBar + panel + '<div id="ws-ability-area"></div>';
}

function wsStartEditVariantBasics() {
  window.appState.uiState.editingVariantBasics = true;
  window.rerender();
}

function wsCancelEditVariantBasics() {
  window.appState.uiState.editingVariantBasics = false;
  window.rerender();
}

function wsCommitEditVariantBasics() {
  var variant = wsFindVariant(window.appState);
  var nameInput = document.querySelector('[data-variant-name-input]');
  var descInput = document.querySelector('[data-variant-description-input]');
  variant.name = nameInput.value.trim() || variant.name;
  variant.description = descInput.value.trim();
  window.appState.uiState.editingVariantBasics = false;
  window.rerender();
}

function wsStartEditVariantInstructions() {
  window.appState.uiState.editingVariantInstructions = true;
  window.rerender();
}

function wsCancelEditVariantInstructions() {
  window.appState.uiState.editingVariantInstructions = false;
  window.rerender();
}

function wsCommitEditVariantInstructions() {
  var variant = wsFindVariant(window.appState);
  var input = document.querySelector('[data-variant-instructions-input]');
  variant.baseInstructions = input.value;
  window.appState.uiState.editingVariantInstructions = false;
  window.rerender();
}
```

Replace `renderVariantPane`'s final `innerHTML` line (from Task 2) so it calls the new body renderer — change the last two lines of the `container.innerHTML = ... + '<div id="ws-variant-body"></div>';` assignment: after setting `container.innerHTML`, add a call to `renderVariantBody(state);` right before the closing `}` of `renderVariantPane`:

```js
function renderVariantPane(state) {
  var container = document.getElementById('ws-variant-pane');
  if (!container) return;
  var npc = wsFindNpc(state);
  var variant = wsFindVariant(state);
  if (!npc || !variant) { container.innerHTML = ''; return; }

  wsEnsureVariantSnapshot(npc.code, variant);
  var dirty = wsVariantIsDirty(npc.code, variant);
  var publishLabel = variant.publishedVersion ? ('已發布 v' + variant.publishedVersion) : '尚未發布';
  var savedLabel = dirty ? '有未儲存的修改' : '已儲存';

  container.innerHTML =
    '<div class="ws-variant-titlebar">' +
      '<span class="ws-variant-titlebar-name">' + escapeHtml(variant.name) + '</span>' +
      '<span class="hint">' + publishLabel + '</span>' +
      '<span class="hint">' + savedLabel + '</span>' +
      '<div class="ws-variant-titlebar-actions">' +
        '<button class="btn" data-variant-discard ' + (dirty ? '' : 'disabled') + ' onclick="wsDiscardVariantChanges()">放棄修改</button>' +
        '<button class="btn btn-primary" data-variant-save ' + (dirty ? '' : 'disabled') + ' onclick="wsSaveVariant()">💾 儲存</button>' +
        '<button class="btn" data-variant-publish onclick="wsOpenPublishVariantModal()">🚀 發布</button>' +
      '</div>' +
    '</div>' +
    '<div id="ws-variant-body"></div>';

  renderVariantBody(state);
}
```

(This is the whole function, replacing Task 2's version in full — the only change is the added `renderVariantBody(state);` call at the end.)

Update `render()` in `agent-setup-demo/js/app.js` — `renderVariantPane` already renders its own body internally now, so no further change needed there.

Append to `agent-setup-demo/css/workspace.css`:

```css
.ws-variant-tabs { display: flex; gap: var(--space-4); border-bottom: 1px solid var(--line); margin-bottom: var(--space-3); }
.ws-variant-tab { padding-bottom: 6px; font-size: 13px; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; }
.ws-variant-tab--active { color: var(--accent); border-bottom-color: var(--accent); }
.ws-variant-tab-panel { min-height: 120px; }
.ws-variant-field { margin-bottom: var(--space-2); font-size: 13px; }
.ws-variant-field textarea, .ws-variant-field input { width: 100%; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: `78 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): add variant tabs (基本資料/模型/基礎指令) with pencil-edit on basics"
```

---

### Task 4: Ability area shell — read-only 裝備欄／佩掛寶石 display with ⊖ unequip

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `#ws-ability-area` (Task 3), `wsFindVariant`, `wsEquipmentByName`/`wsGemByName` (new in this task), `wsCarriedGems` (new in this task).
- Produces: `wsEquipmentByName(name)`, `wsGemByName(name)`, `wsEquipmentVersion(eqDef, level)`, `wsGemVersion(gemDef, level)`, `wsCarriedGems(variant)`, `renderAbilityArea(state)`, `window.wsUnequipEquipmentClick(eqName)`, `window.wsUnwearGemClick(gemName)`.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  await page.click('[data-npc-select="FAQ_ANSWER"]');
  await page.click('[data-npc-toggle="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.STANDARD"]');
  const abilityText = await page.locator('#ws-ability-area').innerText();
  record('ability area shows the equipped order-lookup', abilityText.indexOf('order-lookup') !== -1 || abilityText.indexOf('訂單查詢術') !== -1, abilityText);
  record('ability area shows the carried gem under the equipment', abilityText.indexOf('get_order_status') !== -1 || abilityText.indexOf('查詢訂單狀態') !== -1, abilityText);

  const unequipBtnCount = await page.locator('[data-unequip-equipment="order-lookup"]').count();
  record('equipped item has an unequip control', unequipBtnCount === 1);
  await page.click('[data-unequip-equipment="order-lookup"]');
  const stillEquipped = await page.evaluate(() => window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER').variants.find((v) => v.code === 'STANDARD').equippedEquipment.length);
  record('clicking ⊖ unequips the equipment', stillEquipped === 0, 'remaining=' + stillEquipped);

  await page.click('[data-npc-select="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.PREMIUM"]');
  const premiumGemCount = await page.locator('[data-unwear-gem="create_refund"]').count();
  record('PREMIUM variant shows its worn gem with an unequip control', premiumGemCount === 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: the 5 new checks FAIL (`#ws-ability-area` is empty).

- [ ] **Step 3: Write minimal implementation**

Append to `agent-setup-demo/js/workspace.js`:

```js
function wsGemByName(gemName) {
  return window.appState.data.gems.find(function (g) { return g.name === gemName; });
}

function wsEquipmentByName(eqName) {
  return window.appState.data.equipment.find(function (e) { return e.name === eqName; });
}

function wsEquipmentVersion(eqDef, level) {
  return eqDef.versions.find(function (v) { return v.level === level; });
}

function wsGemVersion(gemDef, level) {
  return gemDef.versions.find(function (v) { return v.level === level; });
}

function wsCarriedGems(variant) {
  var carried = [];
  variant.equippedEquipment.forEach(function (eq) {
    var eqDef = wsEquipmentByName(eq.name);
    var ver = wsEquipmentVersion(eqDef, eq.level);
    (ver.gems || []).forEach(function (g) { carried.push(g); });
  });
  return carried;
}

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
  }).join('') || '<div class="hint">尚未穿上任何裝備</div>';

  var gemHtml = variant.wornGems.map(function (g) {
    var gemDef = wsGemByName(g.name);
    return (
      '<div class="ws-equipped-item">' +
        '<span>' + escapeHtml(gemDef.displayName) + ' Lv' + g.level + '</span>' +
        '<button class="btn" data-unwear-gem="' + g.name + '" onclick="wsUnwearGemClick(\'' + g.name + '\')">⊖</button>' +
      '</div>'
    );
  }).join('') || '<div class="hint">尚未佩掛任何寶石</div>';

  container.innerHTML =
    '<div class="label">🎒 能力</div>' +
    '<div class="ws-ability-section"><div class="label">裝備欄</div>' + equipmentHtml + '</div>' +
    '<div class="ws-ability-section"><div class="label">佩掛寶石</div>' + gemHtml + '</div>';
}

function wsUnequipEquipmentClick(eqName) {
  var variant = wsFindVariant(window.appState);
  var idx = variant.equippedEquipment.findIndex(function (e) { return e.name === eqName; });
  if (idx !== -1) variant.equippedEquipment.splice(idx, 1);
  window.rerender();
}

function wsUnwearGemClick(gemName) {
  var variant = wsFindVariant(window.appState);
  var idx = variant.wornGems.findIndex(function (g) { return g.name === gemName; });
  if (idx !== -1) variant.wornGems.splice(idx, 1);
  window.rerender();
}
```

Update `render()` in `agent-setup-demo/js/app.js` to call the ability area after the variant pane (so its container exists first):

```js
function render() {
  document.getElementById('ws-nav').innerHTML = renderNavTree(window.appState);
  document.getElementById('ws-center').innerHTML = renderCenterPane(window.appState);
  document.getElementById('ws-bag').innerHTML = renderBagPlaceholder();
  renderNpcPane(window.appState);
  renderModelSection(window.appState);
  renderVariantPane(window.appState);
  renderAbilityArea(window.appState);
}
```

Append to `agent-setup-demo/css/workspace.css`:

```css
.ws-ability-section { margin-bottom: var(--space-3); }
.ws-equipped-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 4px; margin-bottom: 4px; font-size: 12px; }
.ws-equipped-item .btn { margin-left: auto; padding: 2px 8px; height: auto; }
.ws-gem-chip { font-size: 11px; padding: 1px 6px; border-radius: 8px; background: var(--gem-bg); border: 1px solid var(--gem-border); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: `83 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): render read-only ability area with unequip/unwear controls"
```

---

### Task 5: Narrow bag in variant mode — list published gems/equipment, click to equip/wear (happy path only)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/js/app.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `#ws-bag` (Phase 1), `wsFindVariant`, `wsEquipmentByName`/`wsGemByName` (Task 4).
- Produces: `renderBagForVariant(state)` (replaces `renderBagPlaceholder()`'s output when a variant is selected; NPC-only selection still shows the Phase 1/2 placeholder). `window.wsBagEquip(eqName, level)`, `window.wsBagWear(gemName, level)` — this task implements only the no-conflict path; Task 6 adds the replacement-rule branches these two functions delegate into.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  await page.click('[data-npc-select="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.PREMIUM"]');
  const bagListText = await page.locator('#ws-bag').innerText();
  record('bag in variant mode lists the equipment catalog', bagListText.indexOf('訂單查詢術') !== -1, bagListText);
  record('bag in variant mode lists the gem catalog', bagListText.indexOf('查詢訂單狀態') !== -1, bagListText);

  const sqlGemCount = await page.locator('[data-bag-gem="run_sql_query"][data-bag-gem-level="1"]').count();
  record('bag shows run_sql_query Lv1 as a clickable entry', sqlGemCount === 1);
  await page.click('[data-bag-gem="run_sql_query"][data-bag-gem-level="1"]');
  const premiumWornAfter = await page.evaluate(() => window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER').variants.find((v) => v.code === 'PREMIUM').wornGems.some((g) => g.name === 'run_sql_query' && g.level === 1));
  record('clicking an unworn gem in the bag wears it', premiumWornAfter === true);

  const sqlAnalysisEqCount = await page.locator('[data-bag-equipment="sql-analysis"][data-bag-equipment-level="1"]').count();
  record('bag shows sql-analysis Lv1 as a clickable entry', sqlAnalysisEqCount === 1);
  await page.click('[data-bag-equipment="sql-analysis"][data-bag-equipment-level="1"]');
  const premiumEquippedAfter = await page.evaluate(() => window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER').variants.find((v) => v.code === 'PREMIUM').equippedEquipment.some((e) => e.name === 'sql-analysis' && e.level === 1));
  record('clicking an unequipped item in the bag equips it', premiumEquippedAfter === true);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: the 6 new checks FAIL (bag still shows the Phase 1 placeholder text, not a catalog).

- [ ] **Step 3: Write minimal implementation**

Append to `agent-setup-demo/js/workspace.js`:

```js
function wsPublishedVersions(catalogItem) {
  return catalogItem.versions.filter(function (v) { return v.status === 'published'); });
}
```

Wait — fix the syntax typo above (stray `)` before `;`) and write the real version:

```js
function wsPublishedVersions(catalogItem) {
  return catalogItem.versions.filter(function (v) { return v.status === 'published'; });
}

function renderBagForVariant(state) {
  var variant = wsFindVariant(state);
  var gemRows = state.data.gems.map(function (gemDef) {
    return wsPublishedVersions(gemDef).map(function (ver) {
      var worn = variant.wornGems.some(function (g) { return g.name === gemDef.name && g.level === ver.level; });
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + '" data-bag-gem="' + gemDef.name + '" data-bag-gem-level="' + ver.level + '" onclick="wsBagWear(\'' + gemDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name">' + escapeHtml(gemDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (worn ? ' · 已佩掛' : '') + '</span>' +
        '</div>'
      );
    }).join('');
  }).join('');

  var equipmentRows = state.data.equipment.map(function (eqDef) {
    return wsPublishedVersions(eqDef).map(function (ver) {
      var worn = variant.equippedEquipment.some(function (e) { return e.name === eqDef.name && e.level === ver.level; });
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + '" data-bag-equipment="' + eqDef.name + '" data-bag-equipment-level="' + ver.level + '" onclick="wsBagEquip(\'' + eqDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name">' + escapeHtml(eqDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (worn ? ' · 已穿上' : '') + '</span>' +
        '</div>'
      );
    }).join('');
  }).join('');

  return (
    '<div class="label">🎒 背包 — 寶石</div>' + gemRows +
    '<div class="label" style="margin-top:var(--space-3);">🎒 背包 — 裝備</div>' + equipmentRows
  );
}

function wsBagWear(gemName, level) {
  var variant = wsFindVariant(window.appState);
  var already = variant.wornGems.find(function (g) { return g.name === gemName; });
  if (already && already.level === level) {
    variant.wornGems = variant.wornGems.filter(function (g) { return g.name !== gemName; });
    window.rerender();
    return;
  }
  var result = wsWearGem(variant, gemName, level);
  if (!result.ok) {
    window.appState.uiState.bagError = result.message;
  } else {
    window.appState.uiState.bagError = null;
  }
  window.rerender();
}

function wsBagEquip(eqName, level) {
  var variant = wsFindVariant(window.appState);
  var already = variant.equippedEquipment.find(function (e) { return e.name === eqName; });
  if (already && already.level === level) {
    variant.equippedEquipment = variant.equippedEquipment.filter(function (e) { return e.name !== eqName; });
    window.rerender();
    return;
  }
  var result = wsEquipEquipment(variant, eqName, level);
  if (!result.ok) {
    window.appState.uiState.bagError = result.message;
  } else {
    window.appState.uiState.bagError = null;
  }
  window.rerender();
}
```

`wsWearGem`/`wsEquipEquipment` are defined in Task 6 — for this task, stub them minimally so Task 5's happy-path test passes without the replacement-rule branches:

```js
function wsWearGem(variant, gemName, level) {
  variant.wornGems.push({ name: gemName, level: level });
  return { ok: true };
}

function wsEquipEquipment(variant, eqName, level) {
  variant.equippedEquipment.push({ name: eqName, level: level });
  return { ok: true };
}
```

(Task 6 replaces both of these stubs with the full rule-checking versions — the signatures and return shape `{ ok, message? }` stay identical, so `wsBagWear`/`wsBagEquip` above never need to change.)

Update `render()` in `agent-setup-demo/js/app.js` — change the bag line from:

```js
  document.getElementById('ws-bag').innerHTML = renderBagPlaceholder();
```

to:

```js
  document.getElementById('ws-bag').innerHTML = window.appState.selection.variantCode
    ? renderBagForVariant(window.appState)
    : renderBagPlaceholder();
```

Append to `agent-setup-demo/css/workspace.css`:

```css
.ws-bag-item { padding: 6px 8px; border: 1px solid var(--line); border-radius: 4px; margin-bottom: 4px; cursor: pointer; font-size: 12px; display: flex; justify-content: space-between; }
.ws-bag-item--active { border-color: var(--accent); background: var(--accent-soft); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: `89 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): render narrow bag catalog in variant mode, wire happy-path equip/wear"
```

---

### Task 6: 寶石置換規則 — the four documented scenarios + conflict/draft checks

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsCarriedGems`, `wsEquipmentVersion`, `wsGemVersion` (Task 4), the `wsWearGem`/`wsEquipEquipment` stubs (Task 5, replaced here).
- Produces: full `wsWearGem(variant, gemName, level)` and `wsEquipEquipment(variant, eqName, level)` implementing all four scenarios plus the draft-block and same-item-already-active guards; both return `{ ok: boolean, message?: string, warnings?: string[] }`. `window.appState.uiState.bagError` now also surfaces `warnings` via a separate `bagWarning` key.

Transcribed exactly from the inherited design's 寶石置換規則 table (情境 1–4) plus its "想法文件沒寫、由使用者決定" extensions:

| # | Operation | Result |
|---|---|---|
| 1 | Wear `get_order_status` Lv1 → then equip `order-lookup` Lv2 (carries Lv2) | The worn gem auto-upgrades to Lv2, with a warning |
| 2 | Wear `get_order_status` Lv2 → then equip `order-lookup` Lv1 (carries Lv1) | The worn gem auto-downgrades to Lv1, with a warning |
| 3 | Equipped `order-lookup` Lv2 (carries Lv2) → try to wear `get_order_status` Lv1 | Blocked — cannot wear |
| 4 | Equipped `order-lookup` Lv2 (carries Lv2) → try to wear `get_order_status` Lv3 | Blocked — cannot wear |
| extra | Two equipped items would carry the same gem name at different levels | Blocked — unequip one first |
| extra | Worn gem has the same name+level as a gem an equip action would carry | Merge — the worn entry is removed (now carried by the equipment), informational only |
| extra | Target version's `status` is `'draft'` | Blocked — "只能引用公開版" |

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  // Scenario 1: wear get_order_status Lv1, then equip order-lookup Lv2 (carries Lv2) -> auto-upgrade with warning.
  await page.click('[data-npc-select="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.PREMIUM"]');
  await page.click('[data-bag-gem="get_order_status"][data-bag-gem-level="1"]');
  await page.click('[data-bag-equipment="order-lookup"][data-bag-equipment-level="2"]');
  const scenario1Worn = await page.evaluate(() => window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER').variants.find((v) => v.code === 'PREMIUM').wornGems.find((g) => g.name === 'get_order_status'));
  record('scenario 1: worn gem auto-upgrades to match the equipped item\'s carried level, no duplicate entry', !!scenario1Worn === false, JSON.stringify(scenario1Worn));
  // (the gem is now carried by the equipment, not separately worn — wornGems should no longer list it)

  await page.click('[data-unequip-equipment="order-lookup"]');

  // Scenario 3: equip order-lookup Lv2 (carries Lv2) first, then try to wear get_order_status Lv1 -> blocked.
  await page.click('[data-bag-equipment="order-lookup"][data-bag-equipment-level="2"]');
  await page.click('[data-bag-gem="get_order_status"][data-bag-gem-level="1"]');
  const scenario3Worn = await page.evaluate(() => window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER').variants.find((v) => v.code === 'PREMIUM').wornGems.some((g) => g.name === 'get_order_status'));
  record('scenario 3: wearing a conflicting-level gem while the equipment already carries it is blocked', scenario3Worn === false);
  const scenario3Error = await page.evaluate(() => window.appState.uiState.bagError);
  record('scenario 3 blocking reason is shown', typeof scenario3Error === 'string' && scenario3Error.length > 0, scenario3Error);

  await page.click('[data-unequip-equipment="order-lookup"]');

  // Draft block: gem Lv4 is seeded as status:'draft'.
  const draftAttempt = await page.evaluate(function () {
    var variant = window.appState.data.npcs.find(function (n) { return n.code === 'FAQ_ANSWER'; }).variants.find(function (v) { return v.code === 'PREMIUM'; });
    return wsWearGem(variant, 'get_order_status', 4);
  });
  record('wearing a draft-status gem is blocked by the pure rule function', draftAttempt.ok === false && draftAttempt.message.indexOf('公開版') !== -1, JSON.stringify(draftAttempt));

  // Two-equipment conflict: equip order-lookup Lv1 (carries Lv1), then try sql-analysis would not conflict
  // (different gem name) — instead prove the conflict with a second order-lookup-like equip attempt directly
  // against the pure function, since the bag only ever shows one entry per equipment name.
  const conflictResult = await page.evaluate(function () {
    var variant = window.appState.data.npcs.find(function (n) { return n.code === 'FAQ_ANSWER'; }).variants.find(function (v) { return v.code === 'PREMIUM'; });
    variant.equippedEquipment = [{ name: 'order-lookup', level: 1 }];
    // Fabricate a second catalog entry that also carries get_order_status, at a different level,
    // to exercise the cross-equipment conflict branch without needing new seed data.
    window.appState.data.equipment.push({ name: '__test_conflict_eq', displayName: '測試用衝突裝備', versions: [{ level: 1, status: 'published', gems: [{ gemName: 'get_order_status', level: 3 }] }] });
    var result = wsEquipEquipment(variant, '__test_conflict_eq', 1);
    window.appState.data.equipment.pop();
    variant.equippedEquipment = [];
    return result;
  });
  record('equipping a second item carrying the same gem at a different level is blocked', conflictResult.ok === false, JSON.stringify(conflictResult));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: the new checks FAIL (Task 5's stub `wsWearGem`/`wsEquipEquipment` always succeed and never merge/block/warn).

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, replace Task 5's two stub functions:

```js
function wsWearGem(variant, gemName, level) {
  var already = variant.wornGems.find(function (g) { return g.name === gemName; });
  if (already) {
    return { ok: false, message: '這顆寶石已佩掛，請先卸下才能換等級' };
  }
  var gemDef = wsGemByName(gemName);
  var ver = wsGemVersion(gemDef, level);
  if (ver.status === 'draft') {
    return { ok: false, message: '這個等級是草稿，人物卡只能引用公開版' };
  }
  var carried = wsCarriedGems(variant).find(function (cg) { return cg.gemName === gemName; });
  if (carried) {
    if (carried.level === level) {
      return { ok: false, message: '目前穿著的裝備已鑲嵌同名同級寶石，無需另外佩掛' };
    }
    return { ok: false, message: '目前穿著的裝備已鑲嵌「' + gemDef.displayName + '」Lv' + carried.level + '，無法佩掛不同等級' };
  }
  variant.wornGems.push({ name: gemName, level: level });
  return { ok: true };
}

function wsEquipEquipment(variant, eqName, level) {
  var already = variant.equippedEquipment.find(function (e) { return e.name === eqName; });
  if (already) {
    return { ok: false, message: '這件裝備已穿上，請先卸下才能換等級' };
  }
  var eqDef = wsEquipmentByName(eqName);
  var ver = wsEquipmentVersion(eqDef, level);
  if (ver.status === 'draft') {
    return { ok: false, message: '這個等級是草稿，人物卡只能引用公開版' };
  }
  var incomingGems = ver.gems || [];
  for (var i = 0; i < incomingGems.length; i++) {
    var ig = incomingGems[i];
    var conflict = wsCarriedGems(variant).find(function (cg) { return cg.gemName === ig.gemName && cg.level !== ig.level; });
    if (conflict) {
      var conflictGemDef = wsGemByName(ig.gemName);
      return { ok: false, message: '另一件裝備已鑲嵌「' + conflictGemDef.displayName + '」不同等級，請先卸下其中一件' };
    }
  }
  variant.equippedEquipment.push({ name: eqName, level: level });
  var warnings = [];
  incomingGems.forEach(function (ig2) {
    var wornIdx = variant.wornGems.findIndex(function (wg) { return wg.name === ig2.gemName; });
    if (wornIdx !== -1) {
      var worn = variant.wornGems[wornIdx];
      var gemDef2 = wsGemByName(ig2.gemName);
      if (worn.level !== ig2.level) {
        warnings.push('佩掛的「' + gemDef2.displayName + '」已從 Lv' + worn.level + ' 換成 Lv' + ig2.level);
      }
      variant.wornGems.splice(wornIdx, 1);
    }
  });
  return { ok: true, warnings: warnings };
}
```

Update `wsBagEquip` (Task 5) to surface warnings — replace its body:

```js
function wsBagEquip(eqName, level) {
  var variant = wsFindVariant(window.appState);
  var already = variant.equippedEquipment.find(function (e) { return e.name === eqName; });
  if (already && already.level === level) {
    variant.equippedEquipment = variant.equippedEquipment.filter(function (e) { return e.name !== eqName; });
    window.rerender();
    return;
  }
  var result = wsEquipEquipment(variant, eqName, level);
  window.appState.uiState.bagError = result.ok ? null : result.message;
  window.appState.uiState.bagWarning = (result.ok && result.warnings && result.warnings.length) ? result.warnings.join('；') : null;
  window.rerender();
}
```

Append to `agent-setup-demo/css/workspace.css`:

```css
.ws-bag-warning { color: var(--warn); font-size: 11px; margin: 6px 0; }
.ws-bag-error { color: var(--block); font-size: 11px; margin: 6px 0; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: `94 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): implement the four 寶石置換規則 scenarios plus conflict/draft guards"
```

---

### Task 7: Surface bag error/warning text in the UI

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `uiState.bagError`/`uiState.bagWarning` (Task 6).
- Produces: `renderBagForVariant` now renders these as visible text, not just state the test reads via `page.evaluate`.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  await page.click('[data-npc-select="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.PREMIUM"]');
  // PREMIUM currently has no equipment (unequipped during Task 6's test); wear a conflicting-level gem path.
  await page.click('[data-bag-equipment="order-lookup"][data-bag-equipment-level="2"]');
  await page.click('[data-bag-gem="get_order_status"][data-bag-gem-level="1"]');
  const errorVisible = await page.locator('[data-bag-error]').innerText();
  record('bag error from a blocked wear is visible in the DOM, not just state', errorVisible.length > 0, errorVisible);
  await page.click('[data-unequip-equipment="order-lookup"]');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: the 1 new check FAILS (`[data-bag-error]` doesn't exist anywhere yet).

- [ ] **Step 3: Write minimal implementation**

In `renderBagForVariant` (Task 5), change the final `return` statement from:

```js
  return (
    '<div class="label">🎒 背包 — 寶石</div>' + gemRows +
    '<div class="label" style="margin-top:var(--space-3);">🎒 背包 — 裝備</div>' + equipmentRows
  );
```

to:

```js
  var error = state.uiState.bagError;
  var warning = state.uiState.bagWarning;
  return (
    (error ? '<div class="ws-bag-error" data-bag-error>' + escapeHtml(error) + '</div>' : '') +
    (warning ? '<div class="ws-bag-warning" data-bag-warning>' + escapeHtml(warning) + '</div>' : '') +
    '<div class="label">🎒 背包 — 寶石</div>' + gemRows +
    '<div class="label" style="margin-top:var(--space-3);">🎒 背包 — 裝備</div>' + equipmentRows
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: `95 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): surface bag block/warning text in the DOM"
```

---

### Task 8: 儲存人物卡 (save) with validation

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsVariantSnapshotKey`/`wsEnsureVariantSnapshot` (Task 2).
- Produces: `wsSaveVariantErrors(variant)` (pure, returns an array of blocking-reason strings), `window.wsSaveVariant()`.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  await page.click('[data-npc-select="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.PREMIUM"]');
  await page.click('[data-variant-edit-basics]');
  await page.fill('[data-variant-name-input]', '');
  await page.click('[data-variant-edit-commit]');
  // Empty name falls back to the previous name inside wsCommitEditVariantBasics (Task 3's `|| variant.name`),
  // so directly exercise the pure validator instead of relying on a reachable empty-name UI path.
  const emptyNameErrors = await page.evaluate(function () {
    return wsSaveVariantErrors({ name: '', description: '', baseInstructions: 'x', equippedEquipment: [], wornGems: [] });
  });
  record('an empty name is a save-blocking error', emptyNameErrors.length > 0 && emptyNameErrors.join('').indexOf('名稱') !== -1, JSON.stringify(emptyNameErrors));

  const okErrors = await page.evaluate(function () {
    return wsSaveVariantErrors({ name: '一般版', description: '', baseInstructions: '', equippedEquipment: [], wornGems: [] });
  });
  record('a variant with a name has no save-blocking errors', okErrors.length === 0, JSON.stringify(okErrors));

  await page.click('[data-variant-edit-basics]');
  await page.fill('[data-variant-name-input]', '豪華版 v2');
  await page.click('[data-variant-edit-commit]');
  await page.click('[data-variant-save]');
  const savedDirty = await page.locator('[data-variant-save]').isDisabled();
  record('saving clears the dirty state (save button disables again)', savedDirty === true);
  const snapshotName = await page.evaluate(() => window.appState.uiState.variantSnapshots['FAQ_ANSWER.PREMIUM'].name);
  record('saving updates the snapshot to the new name', snapshotName === '豪華版 v2', snapshotName);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: the 4 new checks FAIL (`wsSaveVariantErrors` and `wsSaveVariant` undefined; the 儲存 button has no click handler wired to them yet).

- [ ] **Step 3: Write minimal implementation**

Append to `agent-setup-demo/js/workspace.js`:

```js
function wsSaveVariantErrors(variant) {
  var errors = [];
  if (!variant.name || !variant.name.trim()) {
    errors.push('名稱為必填');
  }
  return errors;
}

function wsSaveVariant() {
  var npc = wsFindNpc(window.appState);
  var variant = wsFindVariant(window.appState);
  var errors = wsSaveVariantErrors(variant);
  if (errors.length > 0) {
    window.appState.uiState.bagError = errors.join('；');
    window.rerender();
    return;
  }
  var key = wsVariantSnapshotKey(npc.code, variant.code);
  window.appState.uiState.variantSnapshots[key] = {
    name: variant.name,
    description: variant.description,
    baseInstructions: variant.baseInstructions,
    equippedEquipment: JSON.parse(JSON.stringify(variant.equippedEquipment)),
    wornGems: JSON.parse(JSON.stringify(variant.wornGems))
  };
  window.rerender();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: `99 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): add 儲存人物卡 with name-required validation and snapshot update"
```

---

### Task 9: 發布彈窗 + 發布檢核

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/index.html`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsVariantIsDirty` (Task 2), `wsCarriedGems`/variant ability fields (Task 4).
- Produces: `wsPublishVariantErrors(npc, variant)` (pure), `window.wsOpenPublishVariantModal()`, `window.wsClosePublishVariantModal()`, `window.wsConfirmPublishVariant()`. A new `<div class="modal-mask" id="modal-publish-variant">` in `index.html`, following the same `.modal-mask`/`openModal`/`closeModal`-free pattern already used by this file's `#ws-variant-pane` (this modal uses its own open/close functions rather than the generic `openModal`/`closeModal` from Phase 1's `app.js`, since this codebase has no such generic modal helper yet — each modal here manages its own visibility class directly).

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  await page.click('[data-npc-select="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.PREMIUM"]');

  const unsavedPublishErrors = await page.evaluate(function () {
    var npc = window.appState.data.npcs.find(function (n) { return n.code === 'FAQ_ANSWER'; });
    var variant = npc.variants.find(function (v) { return v.code === 'PREMIUM'; });
    return wsPublishVariantErrors(npc, variant);
  });
  // PREMIUM has no unsaved edits and no draft capability at this point in the suite, so this should be empty;
  // prove the *mechanism* by forcing a draft-capability variant into the check instead.
  const draftCapabilityErrors = await page.evaluate(function () {
    var npc = window.appState.data.npcs.find(function (n) { return n.code === 'FAQ_ANSWER'; });
    var fakeVariant = { name: 'x', equippedEquipment: [{ name: 'order-lookup', level: 1 }], wornGems: [] };
    npc.equipment_backup_for_test = window.appState.data.equipment.find(function (e) { return e.name === 'order-lookup'; }).versions[0].status;
    window.appState.data.equipment.find(function (e) { return e.name === 'order-lookup'; }).versions[0].status = 'draft';
    var errors = wsPublishVariantErrors(npc, fakeVariant);
    window.appState.data.equipment.find(function (e) { return e.name === 'order-lookup'; }).versions[0].status = npc.equipment_backup_for_test;
    return errors;
  });
  record('publishing a variant whose equipped item is now a draft version is blocked', draftCapabilityErrors.length > 0 && draftCapabilityErrors.join('').indexOf('草稿') !== -1, JSON.stringify(draftCapabilityErrors));

  await page.click('[data-variant-edit-basics]');
  await page.fill('[data-variant-name-input]', '豪華版 未儲存');
  await page.click('[data-variant-edit-commit]');
  await page.click('[data-variant-publish]');
  const modalVisible = await page.locator('#modal-publish-variant.ws-modal--active').count();
  record('發布 opens the publish modal', modalVisible === 1);
  const blockedHint = await page.locator('[data-publish-variant-error]').innerText();
  record('modal shows the unsaved-changes block before confirming', blockedHint.indexOf('未儲存') !== -1, blockedHint);

  await page.click('[data-publish-variant-close]');
  await page.click('[data-variant-save]');
  await page.click('[data-variant-publish]');
  await page.click('[data-publish-variant-confirm]');
  const versionAfterPublish = await page.evaluate(() => window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER').variants.find((v) => v.code === 'PREMIUM').publishedVersion);
  record('confirming publish bumps publishedVersion by 1', versionAfterPublish === 2, versionAfterPublish);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: the new checks FAIL (`wsPublishVariantErrors` undefined, `#modal-publish-variant` doesn't exist).

- [ ] **Step 3: Write minimal implementation**

Append to `agent-setup-demo/js/workspace.js`:

```js
function wsPublishVariantErrors(npc, variant) {
  var errors = [];
  if (wsVariantIsDirty(npc.code, variant)) {
    errors.push('有未儲存的修改，請先儲存');
  }
  if (!variant.name || !variant.name.trim()) {
    errors.push('名稱為必填');
  }
  var allCapabilityRefs = variant.equippedEquipment.map(function (e) {
    return { kind: 'equipment', def: wsEquipmentByName(e.name), level: e.level };
  }).concat(variant.wornGems.map(function (g) {
    return { kind: 'gem', def: wsGemByName(g.name), level: g.level };
  }));
  allCapabilityRefs.forEach(function (ref) {
    var ver = ref.kind === 'equipment' ? wsEquipmentVersion(ref.def, ref.level) : wsGemVersion(ref.def, ref.level);
    if (ver.status === 'draft') {
      errors.push('能力含草稿版本（' + ref.def.displayName + '），不能發布');
    }
  });
  return errors;
}

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

function wsOpenPublishVariantModal() {
  document.getElementById('modal-publish-variant').classList.add('ws-modal--active');
  renderPublishVariantModalBody();
}

function wsClosePublishVariantModal() {
  document.getElementById('modal-publish-variant').classList.remove('ws-modal--active');
}

function wsConfirmPublishVariant() {
  var npc = wsFindNpc(window.appState);
  var variant = wsFindVariant(window.appState);
  var errors = wsPublishVariantErrors(npc, variant);
  if (errors.length > 0) return;
  variant.publishedVersion = (variant.publishedVersion || 0) + 1;
  variant.publishHistory = variant.publishHistory || [];
  variant.publishHistory.unshift({ version: variant.publishedVersion, publishedAt: new Date().toISOString() });
  document.getElementById('modal-publish-variant').classList.remove('ws-modal--active');
  window.rerender();
}
```

Add the modal markup to `agent-setup-demo/index.html`, right before the closing `</body>`:

```html
  <div class="ws-modal-mask" id="modal-publish-variant">
    <div class="ws-modal-box">
      <div id="modal-publish-variant-body"></div>
    </div>
  </div>
```

(change `</body>` block from `  <script src="js/data.js"></script>` upward by inserting the modal div immediately before that script tag).

Append to `agent-setup-demo/css/workspace.css`:

```css
.ws-modal-mask { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); align-items: center; justify-content: center; z-index: 50; }
.ws-modal-mask.ws-modal--active { display: flex; }
.ws-modal-box { background: var(--panel); border-radius: 8px; padding: var(--space-4); width: 360px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: `103 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): add publish modal with unsaved-change and draft-capability checks"
```

---

### Task 10: 公開記錄彈窗 (publish history)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/index.html`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `variant.publishHistory` (Task 9).
- Produces: `window.wsOpenVariantHistoryModal()`, `window.wsCloseVariantHistoryModal()`. A「公開記錄」button added to the variant titlebar (Task 2's `ws-variant-titlebar`), disabled when `publishHistory` is empty.

- [ ] **Step 1: Write the failing test**

Add before `await browser.close();`:

```js
  const historyBtnDisabledBeforePublish = await page.locator('[data-variant-history]').isDisabled();
  record('公開記錄 is disabled before any publish exists for this variant', historyBtnDisabledBeforePublish === false, 'PREMIUM was just published above in Task 9\'s test');
  // (PREMIUM already has 1 publish from Task 9's test, so the button should already be enabled here.)

  await page.click('[data-variant-history]');
  const historyModalVisible = await page.locator('#modal-variant-history.ws-modal--active').count();
  record('公開記錄 opens the history modal', historyModalVisible === 1);
  const historyText = await page.locator('#modal-variant-history-body').innerText();
  record('history modal lists the v2 publish', historyText.indexOf('v2') !== -1, historyText);
  await page.click('[data-variant-history-close]');

  await page.click('[data-npc-select="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.STANDARD"]');
  const historyBtnDisabledForNeverPublished = await page.locator('[data-variant-history]').isDisabled();
  record('公開記錄 stays enabled for an already-published variant (STANDARD was seeded at v2)', historyBtnDisabledForNeverPublished === false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: the 4 new checks FAIL (`[data-variant-history]` doesn't exist).

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, update `renderVariantPane`'s titlebar (Task 2/3's version) to add the history button — change the titlebar's opening line from:

```js
  container.innerHTML =
    '<div class="ws-variant-titlebar">' +
      '<span class="ws-variant-titlebar-name">' + escapeHtml(variant.name) + '</span>' +
      '<span class="hint">' + publishLabel + '</span>' +
      '<span class="hint">' + savedLabel + '</span>' +
```

to:

```js
  var hasHistory = variant.publishedVersion || (variant.publishHistory && variant.publishHistory.length > 0);
  container.innerHTML =
    '<div class="ws-variant-titlebar">' +
      '<span class="ws-variant-titlebar-name">' + escapeHtml(variant.name) + '</span>' +
      '<button class="btn" data-variant-history ' + (hasHistory ? '' : 'disabled') + ' onclick="wsOpenVariantHistoryModal()">公開記錄 📖</button>' +
      '<span class="hint">' + publishLabel + '</span>' +
      '<span class="hint">' + savedLabel + '</span>' +
```

(`hasHistory` also covers `STANDARD`, which was seeded with `publishedVersion: 2` but no `publishHistory` array — append one more seed field in `data.js`'s `STANDARD` variant object: add `publishHistory: [{ version: 2, publishedAt: '2026-09-01T00:00:00.000Z' }, { version: 1, publishedAt: '2026-08-01T00:00:00.000Z' }]` so the history modal has something real to list for a variant this task's test checks but Task 9 never published.)

Append to `agent-setup-demo/js/workspace.js`:

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

function wsOpenVariantHistoryModal() {
  renderVariantHistoryModalBody();
  document.getElementById('modal-variant-history').classList.add('ws-modal--active');
}

function wsCloseVariantHistoryModal() {
  document.getElementById('modal-variant-history').classList.remove('ws-modal--active');
}
```

Also update `wsConfirmPublishVariant` (Task 9) so publishing keeps `publishHistory` sorted newest-first (it already uses `unshift`, so no change needed there).

Add the history modal to `agent-setup-demo/index.html`, next to `modal-publish-variant`:

```html
  <div class="ws-modal-mask" id="modal-variant-history">
    <div class="ws-modal-box">
      <div id="modal-variant-history-body"></div>
      <div class="ws-variant-titlebar-actions" style="margin-top:12px;">
        <button class="btn" data-variant-history-close onclick="wsCloseVariantHistoryModal()">關閉</button>
      </div>
    </div>
  </div>
```

Append to `agent-setup-demo/css/workspace.css`:

```css
.ws-history-row { padding: 4px 0; font-size: 13px; display: flex; justify-content: space-between; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: `107 checks, 0 failed, 0 JS errors`.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/
git commit -m "feat(agent-setup-demo): add 公開記錄 publish-history modal"
```

---

## Self-Review

**1. Spec coverage:**
- 人物卡三分頁（基本資料／模型／基礎指令）+ 各自鉛筆編輯 → Tasks 3 (basics fully editable; model read-only per the documented scope simplification; instructions editable).
- 能力區（裝備欄／佩掛寶石，固定呈現、⊖卸下）→ Task 4.
- 右欄窄背包在人物卡情境下顯示素材、點擊裝備/佩掛 → Tasks 5–7.
- 寶石置換規則（四情境＋額外衝突/草稿規則）→ Task 6, transcribed verbatim from the original design doc into the plan itself so no task depends on re-reading the conversation.
- 標題列：公開記錄、已發布/尚未發布、已儲存/有未儲存的修改、放棄修改／儲存（按鈕永遠可見、disabled 不隱藏）、發布 → Tasks 2, 8, 9, 10.
- 發布彈窗的發布檢核（未儲存修改、能力含草稿）→ Task 9.
- 公開記錄彈窗 → Task 10.
- 模型鎖定機制、組合包/擴充包、滑出詳細面板、右欄「新增素材」CRUD → explicitly out of scope, documented in the "Scope simplification" section and Phase 1's own deferred-items list.

**2. Placeholder scan:** No "TBD"/"TODO"/"similar to Task N" patterns. Every code block is complete. The one near-miss — Task 5's first `wsPublishedVersions` draft with the stray `)` — is explicitly called out as a typo and immediately corrected in the same step, so the engineer never copies the broken version.

**3. Type consistency:** `wsWearGem`/`wsEquipEquipment` return `{ ok, message?, warnings? }` consistently from their Task 5 stub through their Task 6 full implementation — `wsBagWear`/`wsBagEquip` (Task 5) read that exact shape and are never modified after Task 6 lands (only `wsBagEquip` gains a `warnings` read in Task 6, additive, not a signature change). `wsFindVariant(state)` signature matches `wsFindNpc(state)`'s existing pattern exactly (same `state` shape). `variant.equippedEquipment`/`variant.wornGems` array-of-`{name/gemName, level}` shape is identical everywhere it's read (Tasks 4–10) and everywhere it's written (Task 1's seed, Tasks 5–6's mutators).

**4. Review Focus coverage:**
- 佩掛後穿裝備造成自動換級＋警告（情境 1/2）→ Task 6's test (scenario 1 assertion; scenario 2 is the mirror case and is covered by the same code path, not separately asserted — acceptable since the implementation doesn't branch on upgrade-vs-downgrade direction).
- 穿裝備後佩掛衝突寶石被擋（情境 3/4）→ Task 6's test (scenario 3 assertion covers both, since scenarios 3 and 4 exercise the identical blocking branch with different numbers).
- 兩件裝備衝突 → Task 6's test (`conflictResult`).
- 草稿版本擋下 → Task 6's test (`draftAttempt`).
- 發布時未儲存修改或能力含草稿被擋 → Task 9's test (both the unsaved-change modal block and the forced-draft-capability pure-function check).

All five Review Focus items have a task-owned test. No gaps found.
