# Agent 基礎設定單一工作區 Phase 3：背包滑出詳細面板＋寶石／裝備 CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the right-column bag its second state — a 460px flyout detail panel that slides out over the center pane's left edge — so a person editing a 人物卡 can inspect a gem/equipment's full record (種類/協定、從哪一級複製、被引用清單), edit it in place, open a new draft level, publish or delete a draft, and create brand-new gems/equipment, all without leaving the workspace.

**Architecture:** Builds directly on Phase 1+2's `agent-setup-demo/js/{data,workspace,app}.js`. Adds a `copiedFromLevel` field to every gem/equipment version, two pure reference-lookup functions (`wsGemReferences`/`wsEquipmentReferences`) that scan `SEED` state for cross-references, a `uiState.bagDetail` family of fields mirroring the existing `uiState.editingVariantBasics`-style transient-UI pattern, and a `renderBagDetailFlyout` render pass wired into `render()` the same way Phase 2 wired `renderAbilityArea`. A `#ws-bag-detail-flyout` element and a global `keydown` listener are new additions to `index.html`/`app.js`.

**Tech Stack:** Same as Phase 1/2 — plain HTML/CSS/vanilla JS, `file://`, no build step. Tests continue to live in `agent-setup-demo/tests/ui.test.cjs` (one long stateful Playwright script) and run via `playwright-core` against a real local Chrome.

**Spec:** `docs/superpowers/specs/2026-10-06-agent-setup-unified-workspace-design.md`, section `## 右欄：背包（取代獨立素材庫頁）` → `### 狀態二：滑出詳細面板（460px，蓋住中欄左側）` (lines 102-117) is what this phase implements. The flyout's *content* rules (鉛筆就地編輯規則、寶石/裝備的欄位語意) trace back to the original `UI_Agent 基礎設定 Demo 設計.md` the user pasted earlier in this project's conversation history, not a file on disk; this plan transcribes the exact rules it needs inline (see Scope simplification below) so no task depends on re-reading that conversation.

## Scope simplification versus the spec (documented, not silent)

- **窄背包（狀態一）chrome is still out of scope.** Spec lines 97-100 describe 分類鈕／搜尋放大鏡／漏斗篩選／▦☰ 檢視切換 for the narrow bag itself. Phase 2 never built these (it shipped a flat gem-list-then-equipment-list), and this phase doesn't either — it only adds a per-item "⋯" detail button and one "＋ 新增" header button to the existing narrow-bag markup. The spec's own 已知限制 table already defers "書籤篩選併入窄背包" to "下一輪"; this plan treats the rest of state-一's chrome (search/filter/grid-list) the same way.
- **書籤（全部／API／MCP）become the gem's `kind` field**, already present in `SEED.gems` (all seeded as `'API'`). This phase's create-gem flow lets `kind` be `'API'` or `'MCP'`; no separate bookmark UI is built, consistent with spec line 116's "併入既有篩選機制" direction without building the filter UI itself (out of scope per the point above).
- **裝備草稿「鑲嵌鎖住」是以「掛載中」而非「唯讀」實作**：spec line 113 says a 裝備 draft's 鑲嵌 locks "被掛載時" (when referenced). Under this app's existing invariant (Phase 2 already blocks wearing/equipping any draft-status version — see Phase 2's `wsWearGem`/`wsEquipEquipment`), a draft equipment version can never be *equipped by a variant*. It *can* still be referenced by another equipment's... no — equipment doesn't reference equipment. So the only way a 裝備 draft version becomes "referenced" is if a variant equips it, which is structurally impossible while it's a draft. This phase therefore gates the 鑲嵌寶石 editor purely on `ver.status === 'draft'` (editable) vs `'published'` (locked) — the "locked while referenced" branch is unreachable under current invariants and is not built; if a later phase allows referencing draft equipment, revisit this gate.
- **寶石的「只有新建立的草稿能換種類／協定」是以「從未公開過」實作**: a gem's `kind`/`protocol` stay editable on every draft version until the *first* time any version of that gem is published; after that, `kind`/`protocol` lock permanently on all future drafts too (identity fields, not per-version data). This matches the spec's intent (种类/協定 are the gem's identity, not something that should drift version to version) and is what `wsGemEverPublished` implements.

## Global Constraints

- Everything from Phase 1/2's Global Constraints still applies (no build tooling, no ES modules, tests run via `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`).
- New catalog item codes: gem `name` matches `^[a-z][a-z0-9_]{0,59}$`; equipment `name` matches `^[a-z][a-z0-9-]{0,59}$` (matches existing seed casing — `get_order_status` vs `order-lookup`). Both checked for uniqueness within their own catalog array only (`SEED.gems` / `SEED.equipment` — a gem and an equipment are allowed to share a name since nothing in the UI looks them up across kinds by bare name alone).
- Every new gem/equipment version object gets a `copiedFromLevel: number|null` field — `null` for an item's very first version, the source level's number for any version opened via "開 LvN 草稿".
- A newly created catalog item starts with exactly one version: `{ level: 1, status: 'draft', copiedFromLevel: null, ... }`.
- The flyout is 460px wide, anchored to the immediate left of `#ws-bag` (`right: 300px` inside `.ws-shell`, matching `#ws-bag`'s existing fixed width), and dims+`inert`s `#ws-center` while open — never the other way around, and never both bag panes replaced at once.
- All interpolated text in new markup goes through the existing `escapeHtml()` helper — no new unescaped string concatenation into HTML.
- Every new clickable/input element gets a `data-*` attribute test hook, following the existing convention (`data-bag-gem`, `data-variant-save`, etc).
- "開 LvN 草稿" / "公開" / "刪除" never appear as unstyled "disabled-looking but still clickable" states — use the native `disabled` attribute (delete) or simply don't render the button for the wrong state (publish/open-draft are mutually exclusive by version status, so "not applicable" means "not rendered", matching how Phase 1/2 already treat mutually-exclusive action buttons).

## Review Focus

- **Deleting a gem/equipment version that is still referenced** (by another item's carried-gems list, or by a variant's `equippedEquipment`/`wornGems`) must be blocked with a stated reason, never silently delete and leave a dangling reference that later crashes `renderAbilityArea`/`wsCarriedGems`.
- **Editing 種類／協定 on a gem that has already been published once** (even if the *currently viewed* version is itself still a draft, e.g. its Lv2 draft cloned from a published Lv1) must be locked — only a gem with zero published versions anywhere in its history may change these fields.
- **Creating a new gem/equipment with a duplicate or malformed code** must be rejected with a visible error and must not create a second catalog entry silently overwriting data read by `wsGemByName`/`wsEquipmentByName` (both do `.find()`, so a duplicate name makes the second entry permanently unreachable — a silent data-loss bug, not just a cosmetic one).
- **Opening the flyout on one item, leaving an edit (pencil mode) uncommitted, then opening it on a different item** must not leak the stale `bagDetailEditing`/`bagDetailGemsDraft`/`bagDetailError` state onto the new item — same bug class as Phase 2's Important #4 (`wsResetVariantTransientUi`), now for `uiState.bagDetail*`.
- **With the flyout open, the center pane must be truly non-interactive** — clicking a button that's visually "underneath" the dimmed `#ws-center` (e.g. a variant's 儲存 button) must not fire, proving `inert` is actually applied and removed correctly across open/close/Esc.

---

## File Structure

```
agent-setup-demo/
├── js/
│   ├── data.js         # MODIFY: add copiedFromLevel:null to every existing gem/equipment version
│   ├── workspace.js     # MODIFY: reference-lookup helpers, bag-detail open/close/edit/action
│   │                     #   functions, renderBagDetailFlyout family, ⋯/＋新增 wiring in
│   │                     #   renderBagForVariant
│   └── app.js            # MODIFY: uiState gains bagDetail* keys (both initial state and
│                          #   resetData), render() calls renderBagDetailFlyout, new global
│                          #   keydown listener for Esc
├── css/
│   └── workspace.css    # MODIFY: flyout panel, level-switch row, dim overlay, new field/action
│                          #   classes
└── tests/
    └── ui.test.cjs        # MODIFY: new assertions appended, same stateful style as Phase 1/2

skill-admin.html                   # MODIFY: add #ws-bag-detail-flyout markup matching index.html
skill-admin/agent-setup-embed.css  # MODIFY: #page-agents-scoped copies of the new workspace.css rules
```

No new files — Phase 3 is purely additive inside the files Phase 1/2 established, plus the already-existing skill-admin embed files.

---

### Task 1: `copiedFromLevel` field + reference-lookup helpers

**Files:**
- Modify: `agent-setup-demo/js/data.js`
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `SEED.gems`, `SEED.equipment`, `SEED.npcs` (Phase 1/2).
- Produces: every seeded gem/equipment version object gains `copiedFromLevel: null`. `wsGemReferences(gemName, level)` → `{ equipment: [{name, displayName, level}], variants: [{npcCode, variantCode, variantName}] }`. `wsEquipmentReferences(eqName, level)` → `{ variants: [{npcCode, variantCode, variantName}] }`.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 3 Task 1: copiedFromLevel seeded + reference-lookup helpers ---
  const allVersionsHaveCopiedFromLevel = await page.evaluate(function () {
    var ok = true;
    window.appState.data.gems.forEach(function (g) { g.versions.forEach(function (v) { if (!('copiedFromLevel' in v)) ok = false; }); });
    window.appState.data.equipment.forEach(function (e) { e.versions.forEach(function (v) { if (!('copiedFromLevel' in v)) ok = false; }); });
    return ok;
  });
  record('every seeded gem/equipment version has a copiedFromLevel field', allVersionsHaveCopiedFromLevel === true);

  const orderLookupGemRefs = await page.evaluate(function () { return wsGemReferences('get_order_status', 1); });
  record('wsGemReferences finds order-lookup Lv1 as an equipment reference for get_order_status Lv1', orderLookupGemRefs.equipment.some(function (e) { return e.name === 'order-lookup' && e.level === 1; }), JSON.stringify(orderLookupGemRefs));
  record('wsGemReferences finds FAQ_ANSWER.STANDARD as a variant reference (via equipped order-lookup Lv1)', orderLookupGemRefs.variants.some(function (v) { return v.npcCode === 'FAQ_ANSWER' && v.variantCode === 'STANDARD'; }), JSON.stringify(orderLookupGemRefs));

  const refundGemRefs = await page.evaluate(function () { return wsGemReferences('create_refund', 1); });
  record('wsGemReferences finds FAQ_ANSWER.PREMIUM as a direct wornGems reference for create_refund Lv1', refundGemRefs.variants.some(function (v) { return v.npcCode === 'FAQ_ANSWER' && v.variantCode === 'PREMIUM'; }), JSON.stringify(refundGemRefs));

  const unreferencedGemRefs = await page.evaluate(function () { return wsGemReferences('render_chart', 1); });
  record('wsGemReferences returns empty arrays for a never-used gem', unreferencedGemRefs.equipment.length === 0 && unreferencedGemRefs.variants.length === 0, JSON.stringify(unreferencedGemRefs));

  const orderLookupEqRefs = await page.evaluate(function () { return wsEquipmentReferences('order-lookup', 1); });
  record('wsEquipmentReferences finds FAQ_ANSWER.STANDARD as a reference for order-lookup Lv1', orderLookupEqRefs.variants.some(function (v) { return v.npcCode === 'FAQ_ANSWER' && v.variantCode === 'STANDARD'; }), JSON.stringify(orderLookupEqRefs));

  const sqlAnalysisEqRefs = await page.evaluate(function () { return wsEquipmentReferences('sql-analysis', 1); });
  record('wsEquipmentReferences returns an empty array for an unequipped equipment', sqlAnalysisEqRefs.variants.length === 0, JSON.stringify(sqlAnalysisEqRefs));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: the `copiedFromLevel` check FAILs (field absent), and all `wsGemReferences`/`wsEquipmentReferences` checks FAIL with a `page.evaluate` error (`wsGemReferences is not defined`).

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/data.js`, add `copiedFromLevel: null` to every version object. Change:

```js
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
```

to:

```js
  gems: [
    {
      name: 'get_order_status', displayName: '查詢訂單狀態', kind: 'API', protocol: 'REST',
      versions: [
        { level: 1, status: 'published', copiedFromLevel: null },
        { level: 2, status: 'published', copiedFromLevel: 1 },
        { level: 3, status: 'published', copiedFromLevel: 2 },
        { level: 4, status: 'draft', copiedFromLevel: 3 }
      ]
    },
    {
      name: 'create_refund', displayName: '建立退款單', kind: 'API', protocol: 'REST',
      versions: [{ level: 1, status: 'published', copiedFromLevel: null }]
    },
    {
      name: 'run_sql_query', displayName: 'SQL 查詢', kind: 'API', protocol: 'REST',
      versions: [{ level: 1, status: 'published', copiedFromLevel: null }, { level: 2, status: 'published', copiedFromLevel: 1 }]
    },
    {
      name: 'render_chart', displayName: '產生圖表', kind: 'API', protocol: 'REST',
      versions: [{ level: 1, status: 'published', copiedFromLevel: null }]
    }
  ],
  equipment: [
    {
      name: 'order-lookup', displayName: '訂單查詢術',
      versions: [
        { level: 1, status: 'published', copiedFromLevel: null, gems: [{ gemName: 'get_order_status', level: 1 }] },
        { level: 2, status: 'published', copiedFromLevel: 1, gems: [{ gemName: 'get_order_status', level: 2 }] }
      ]
    },
    {
      name: 'refund-helper', displayName: '退款小幫手',
      versions: [{ level: 1, status: 'published', copiedFromLevel: null, gems: [{ gemName: 'create_refund', level: 1 }] }]
    },
    {
      name: 'sql-analysis', displayName: 'SQL 分析術',
      versions: [
        { level: 1, status: 'published', copiedFromLevel: null, gems: [{ gemName: 'run_sql_query', level: 1 }] },
        { level: 2, status: 'published', copiedFromLevel: 1, gems: [{ gemName: 'run_sql_query', level: 2 }] }
      ]
    }
  ]
```

In `agent-setup-demo/js/workspace.js`, add after `wsCarriedGems` (after its closing `}`, before `function renderAbilityArea`):

```js
function wsGemReferences(gemName, level) {
  var equipmentRefs = [];
  window.appState.data.equipment.forEach(function (eqDef) {
    eqDef.versions.forEach(function (ver) {
      if ((ver.gems || []).some(function (g) { return g.gemName === gemName && g.level === level; })) {
        equipmentRefs.push({ name: eqDef.name, displayName: eqDef.displayName, level: ver.level });
      }
    });
  });
  var variantRefs = [];
  window.appState.data.npcs.forEach(function (npc) {
    npc.variants.forEach(function (v) {
      var direct = v.wornGems.some(function (g) { return g.name === gemName && g.level === level; });
      var viaEquipment = v.equippedEquipment.some(function (e) {
        return equipmentRefs.some(function (er) { return er.name === e.name && er.level === e.level; });
      });
      if (direct || viaEquipment) {
        variantRefs.push({ npcCode: npc.code, variantCode: v.code, variantName: v.name });
      }
    });
  });
  return { equipment: equipmentRefs, variants: variantRefs };
}

function wsEquipmentReferences(eqName, level) {
  var variantRefs = [];
  window.appState.data.npcs.forEach(function (npc) {
    npc.variants.forEach(function (v) {
      if (v.equippedEquipment.some(function (e) { return e.name === eqName && e.level === level; })) {
        variantRefs.push({ npcCode: npc.code, variantCode: v.code, variantName: v.name });
      }
    });
  });
  return { variants: variantRefs };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 7 new checks PASS; suite total 114+7=121 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/data.js agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): seed copiedFromLevel + add gem/equipment reference-lookup helpers"
```

---

### Task 2: Flyout shell + view-mode content (header, level row, fields, 被引用清單)

**Files:**
- Modify: `agent-setup-demo/index.html`
- Modify: `agent-setup-demo/js/app.js`
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsFindVariant`, `wsGemByName`, `wsEquipmentByName`, `wsGemVersion`, `wsEquipmentVersion` (Phase 2), `wsGemReferences`/`wsEquipmentReferences` (Task 1).
- Produces: `uiState.bagDetail` (`null | {kind:'gem'|'equipment', name, level, mode:'view'|'create'}`), `uiState.bagDetailEditing` (`null | 'displayName'|'kindProtocol'|'gems'`), `uiState.bagDetailGemsDraft` (`null | array`), `uiState.bagDetailError` (`null | string`), `uiState.bagDetailCreateForm` (`null | {kind}`). `wsOpenBagDetail(kind, name, level)`, `wsCloseBagDetail()`, `wsSwitchBagDetailLevel(level)`, `wsBagDetailDef(detail)`, `wsBagDetailMaxLevel(def)`, `wsGemEverPublished(gemDef)`, `renderBagDetailFlyout(state)` wired into `render()`. Later tasks read/extend `uiState.bagDetail*` and call `wsOpenBagDetail`/`wsCloseBagDetail`.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 3 Task 2: flyout shell + view-mode content ---
  await page.click('[data-npc-select="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.STANDARD"]');
  await page.click('[data-bag-gem-detail="get_order_status.1"]');
  const flyoutActiveAfterOpen = await page.locator('#ws-bag-detail-flyout.ws-flyout--active').count();
  record('clicking a gem\'s ⋯ button opens the flyout', flyoutActiveAfterOpen === 1);
  const centerDimmed = await page.locator('#ws-center.ws-center--dim').count();
  record('center pane gets the dim class while the flyout is open', centerDimmed === 1);
  const centerInert = await page.evaluate(() => document.getElementById('ws-center').hasAttribute('inert'));
  record('center pane gets the inert attribute while the flyout is open', centerInert === true);
  const flyoutNameText = await page.locator('.ws-flyout-name').innerText();
  record('flyout header shows the gem\'s display name', flyoutNameText.indexOf('查詢訂單狀態') !== -1, flyoutNameText);
  const levelButtonCount = await page.locator('[data-flyout-level-btn]').count();
  record('flyout shows one level button per version (4 for get_order_status)', levelButtonCount === 4, 'found ' + levelButtonCount);
  const lv4ButtonText = await page.locator('[data-flyout-level-btn="4"]').innerText();
  record('the draft level button is labeled as a draft', lv4ButtonText.indexOf('草稿') !== -1, lv4ButtonText);

  await page.click('[data-flyout-level-btn="4"]');
  const activeLevelAfterSwitch = await page.evaluate(() => window.appState.uiState.bagDetail.level);
  record('clicking a level button switches which level the flyout views', activeLevelAfterSwitch === 4, activeLevelAfterSwitch);

  const refListTextLv1 = await (async () => { await page.click('[data-flyout-level-btn="1"]'); return page.locator('.ws-flyout-ref-list').innerText(); })();
  record('Lv1 的被引用清單 includes the equipment carrying it', refListTextLv1.indexOf('訂單查詢術') !== -1, refListTextLv1);
  record('Lv1 的被引用清單 includes the variant that equips it', refListTextLv1.indexOf('一般版') !== -1, refListTextLv1);

  // Esc closes it
  await page.keyboard.press('Escape');
  const flyoutActiveAfterEsc = await page.locator('#ws-bag-detail-flyout.ws-flyout--active').count();
  record('Escape closes the flyout', flyoutActiveAfterEsc === 0);
  const centerDimmedAfterEsc = await page.locator('#ws-center.ws-center--dim').count();
  record('center pane dim class is removed after Escape closes the flyout', centerDimmedAfterEsc === 0);
  const centerInertAfterEsc = await page.evaluate(() => document.getElementById('ws-center').hasAttribute('inert'));
  record('center pane inert attribute is removed after Escape closes the flyout', centerInertAfterEsc === false);

  // ✕ button closes it too, and while open the center pane is truly unclickable
  await page.click('[data-bag-gem-detail="get_order_status.1"]');
  const saveClickBlockedByInert = await page.evaluate(function () {
    var btn = document.querySelector('[data-variant-save]');
    var before = window.appState.uiState.variantSnapshots ? JSON.stringify(window.appState.uiState.variantSnapshots) : null;
    btn.click();
    var after = window.appState.uiState.variantSnapshots ? JSON.stringify(window.appState.uiState.variantSnapshots) : null;
    return before === after;
  });
  record('a button under the dimmed+inert center pane does not fire while the flyout is open', saveClickBlockedByInert === true);
  await page.click('[data-flyout-close]');
  const flyoutActiveAfterCloseBtn = await page.locator('#ws-bag-detail-flyout.ws-flyout--active').count();
  record('✕ button closes the flyout', flyoutActiveAfterCloseBtn === 0);

  // equipment ⋯ button + 被哪些人物卡掛載
  await page.click('[data-bag-equipment-detail="order-lookup.1"]');
  const eqFlyoutName = await page.locator('.ws-flyout-name').innerText();
  record('equipment ⋯ button opens the flyout on the equipment', eqFlyoutName.indexOf('訂單查詢術') !== -1, eqFlyoutName);
  const eqRefListText = await page.locator('.ws-flyout-ref-list').innerText();
  record('equipment 被哪些人物卡掛載 lists the variant that equips it', eqRefListText.indexOf('一般版') !== -1, eqRefListText);
  await page.click('[data-flyout-close]');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks FAIL — `#ws-bag-detail-flyout` doesn't exist yet, `[data-bag-gem-detail]` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/index.html`, change:

```html
    <div id="ws-nav" class="ws-pane"></div>
    <div id="ws-center" class="ws-pane"></div>
    <div id="ws-bag" class="ws-pane"></div>
  </div>
```

to:

```html
    <div id="ws-nav" class="ws-pane"></div>
    <div id="ws-center" class="ws-pane"></div>
    <div id="ws-bag" class="ws-pane"></div>
    <div id="ws-bag-detail-flyout"></div>
  </div>
```

In `agent-setup-demo/js/app.js`, change the `uiState` initializer (both in the top-level `window.appState` object and inside `window.resetData`) from:

```js
    modelParamEdits: {},
    modelParamErrors: {},
    variantSnapshots: {}
```

to (same replacement in both places):

```js
    modelParamEdits: {},
    modelParamErrors: {},
    variantSnapshots: {},
    bagDetail: null,
    bagDetailEditing: null,
    bagDetailGemsDraft: null,
    bagDetailError: null,
    bagDetailCreateForm: null
```

Then change `render()` from:

```js
function render() {
  document.getElementById('ws-nav').innerHTML = renderNavTree(window.appState);
  document.getElementById('ws-center').innerHTML = renderCenterPane(window.appState);
  document.getElementById('ws-bag').innerHTML = window.appState.selection.variantCode
    ? renderBagForVariant(window.appState)
    : renderBagPlaceholder();
  renderNpcPane(window.appState);
  renderModelSection(window.appState);
  renderVariantPane(window.appState);
  renderAbilityArea(window.appState);
}

window.rerender = render;
```

to:

```js
function render() {
  document.getElementById('ws-nav').innerHTML = renderNavTree(window.appState);
  document.getElementById('ws-center').innerHTML = renderCenterPane(window.appState);
  document.getElementById('ws-bag').innerHTML = window.appState.selection.variantCode
    ? renderBagForVariant(window.appState)
    : renderBagPlaceholder();
  renderNpcPane(window.appState);
  renderModelSection(window.appState);
  renderVariantPane(window.appState);
  renderAbilityArea(window.appState);
  renderBagDetailFlyout(window.appState);
}

window.rerender = render;

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && window.appState.uiState.bagDetail) {
    wsCloseBagDetail();
  }
});
```

In `agent-setup-demo/js/workspace.js`, add after `wsEquipmentReferences` (Task 1's last function, before `function renderAbilityArea`):

```js
function wsGemEverPublished(gemDef) {
  return gemDef.versions.some(function (v) { return v.status === 'published'; });
}

function wsBagDetailDef(detail) {
  return detail.kind === 'gem' ? wsGemByName(detail.name) : wsEquipmentByName(detail.name);
}

function wsBagDetailMaxLevel(def) {
  return Math.max.apply(null, def.versions.map(function (v) { return v.level; }));
}

function wsOpenBagDetail(kind, name, level) {
  window.appState.uiState.bagDetail = { kind: kind, name: name, level: level, mode: 'view' };
  window.appState.uiState.bagDetailEditing = null;
  window.appState.uiState.bagDetailGemsDraft = null;
  window.appState.uiState.bagDetailError = null;
  window.appState.uiState.bagDetailCreateForm = null;
  window.rerender();
}

function wsCloseBagDetail() {
  window.appState.uiState.bagDetail = null;
  window.appState.uiState.bagDetailEditing = null;
  window.appState.uiState.bagDetailGemsDraft = null;
  window.appState.uiState.bagDetailError = null;
  window.appState.uiState.bagDetailCreateForm = null;
  window.rerender();
}

function wsSwitchBagDetailLevel(level) {
  var detail = window.appState.uiState.bagDetail;
  window.appState.uiState.bagDetail = { kind: detail.kind, name: detail.name, level: level, mode: 'view' };
  window.appState.uiState.bagDetailEditing = null;
  window.appState.uiState.bagDetailGemsDraft = null;
  window.appState.uiState.bagDetailError = null;
  window.rerender();
}

function renderBagDetailGemFields(gemDef, ver) {
  var refs = wsGemReferences(gemDef.name, ver.level);
  var refList = (refs.equipment.length === 0 && refs.variants.length === 0)
    ? '<div class="ws-flyout-ref-list hint">尚未被任何裝備或人物卡引用</div>'
    : (
      '<div class="ws-flyout-ref-list">' +
        refs.equipment.map(function (e) { return '<div class="ws-flyout-ref-item">裝備：' + escapeHtml(e.displayName) + ' Lv' + e.level + '</div>'; }).join('') +
        refs.variants.map(function (v) { return '<div class="ws-flyout-ref-item">人物卡：' + escapeHtml(v.variantName) + '</div>'; }).join('') +
      '</div>'
    );
  return (
    '<div class="ws-flyout-field"><span class="label">種類／協定</span> ' + escapeHtml(gemDef.kind) + ' / ' + escapeHtml(gemDef.protocol) + '</div>' +
    '<div class="ws-flyout-field"><span class="label">從哪一級複製</span> ' + (ver.copiedFromLevel ? ('Lv' + ver.copiedFromLevel) : '（原始建立）') + '</div>' +
    '<div class="ws-flyout-field"><span class="label">被引用清單</span></div>' +
    refList
  );
}

function renderBagDetailEquipmentFields(eqDef, ver) {
  var refs = wsEquipmentReferences(eqDef.name, ver.level);
  var gemsHtml = (ver.gems || []).map(function (g) {
    var gemDef = wsGemByName(g.gemName);
    return '<span class="ws-gem-chip">' + escapeHtml(gemDef.displayName) + ' Lv' + g.level + '</span>';
  }).join('') || '<span class="hint">尚未鑲嵌任何寶石</span>';
  var refList = refs.variants.length === 0
    ? '<div class="ws-flyout-ref-list hint">尚未被任何人物卡掛載</div>'
    : '<div class="ws-flyout-ref-list">' + refs.variants.map(function (v) { return '<div class="ws-flyout-ref-item">人物卡：' + escapeHtml(v.variantName) + '</div>'; }).join('') + '</div>';
  return (
    '<div class="ws-flyout-field"><span class="label">鑲嵌寶石</span> ' + gemsHtml + '</div>' +
    '<div class="ws-flyout-field"><span class="label">從哪一級複製</span> ' + (ver.copiedFromLevel ? ('Lv' + ver.copiedFromLevel) : '（原始建立）') + '</div>' +
    '<div class="ws-flyout-field"><span class="label">被哪些人物卡掛載</span></div>' +
    refList
  );
}

function renderBagDetailViewBody(state) {
  var detail = state.uiState.bagDetail;
  var def = wsBagDetailDef(detail);
  var ver = def.versions.find(function (v) { return v.level === detail.level; });
  var icon = detail.kind === 'gem' ? '💎' : '🛡️';
  var typeLabel = detail.kind === 'gem' ? '寶石' : '裝備';

  var levelButtons = def.versions.slice().sort(function (a, b) { return a.level - b.level; }).map(function (v) {
    return (
      '<button class="ws-flyout-level-btn' + (v.level === detail.level ? ' ws-flyout-level-btn--active' : '') + (v.status === 'draft' ? ' ws-flyout-level-btn--draft' : '') + '" ' +
        'data-flyout-level-btn="' + v.level + '" onclick="wsSwitchBagDetailLevel(' + v.level + ')">' +
        'Lv' + v.level + (v.status === 'draft' ? ' 草稿' : '') +
      '</button>'
    );
  }).join('');

  var fieldsHtml = detail.kind === 'gem' ? renderBagDetailGemFields(def, ver) : renderBagDetailEquipmentFields(def, ver);
  var error = state.uiState.bagDetailError;

  return (
    '<button class="btn ws-flyout-close" data-flyout-close onclick="wsCloseBagDetail()">✕</button>' +
    '<div class="ws-flyout-header">' +
      '<span class="ws-flyout-icon">' + icon + '</span>' +
      '<span class="ws-flyout-type-label">' + typeLabel + '</span>' +
      '<span class="ws-flyout-name">' + escapeHtml(def.displayName) + '</span>' +
    '</div>' +
    '<div class="ws-flyout-level-row">' + levelButtons + '</div>' +
    (error ? '<div class="ws-flyout-error" data-flyout-error>' + escapeHtml(error) + '</div>' : '') +
    fieldsHtml
  );
}

function renderBagDetailFlyout(state) {
  var flyoutEl = document.getElementById('ws-bag-detail-flyout');
  var centerEl = document.getElementById('ws-center');
  if (!flyoutEl) return;
  var detail = state.uiState.bagDetail;
  if (!detail) {
    flyoutEl.classList.remove('ws-flyout--active');
    flyoutEl.innerHTML = '';
    if (centerEl) { centerEl.classList.remove('ws-center--dim'); centerEl.removeAttribute('inert'); }
    return;
  }
  flyoutEl.classList.add('ws-flyout--active');
  if (centerEl) { centerEl.classList.add('ws-center--dim'); centerEl.setAttribute('inert', ''); }
  flyoutEl.innerHTML = detail.mode === 'create' ? '' : renderBagDetailViewBody(state);
}
```

Now wire the "⋯" buttons into `renderBagForVariant`. Change:

```js
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + (isDraft ? ' ws-bag-item--draft' : '') + '" ' +
          'data-bag-gem="' + gemDef.name + '" data-bag-gem-level="' + ver.level + '" ' +
          (isDraft ? 'aria-disabled="true" ' : '') +
          'onclick="wsBagWear(\'' + gemDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name">' + escapeHtml(gemDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (isDraft ? ' · 草稿・不可選' : (worn ? ' · 已佩掛' : '')) + '</span>' +
        '</div>'
      );
```

to:

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

And change:

```js
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + (isDraft ? ' ws-bag-item--draft' : '') + '" ' +
          'data-bag-equipment="' + eqDef.name + '" data-bag-equipment-level="' + ver.level + '" ' +
          (isDraft ? 'aria-disabled="true" ' : '') +
          'onclick="wsBagEquip(\'' + eqDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name">' + escapeHtml(eqDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (isDraft ? ' · 草稿・不可選' : (worn ? ' · 已穿上' : '')) + '</span>' +
        '</div>'
      );
```

to:

```js
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + (isDraft ? ' ws-bag-item--draft' : '') + '" ' +
          'data-bag-equipment="' + eqDef.name + '" data-bag-equipment-level="' + ver.level + '" ' +
          (isDraft ? 'aria-disabled="true" ' : '') +
          'onclick="wsBagEquip(\'' + eqDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name">' + escapeHtml(eqDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (isDraft ? ' · 草稿・不可選' : (worn ? ' · 已穿上' : '')) + '</span>' +
          '<button class="ws-bag-item-detail-btn" data-bag-equipment-detail="' + eqDef.name + '.' + ver.level + '" onclick="event.stopPropagation(); wsOpenBagDetail(\'equipment\', \'' + eqDef.name + '\', ' + ver.level + ')">⋯</button>' +
        '</div>'
      );
```

In `agent-setup-demo/css/workspace.css`, append:

```css
.ws-shell { position: relative; }
.ws-bag-item-detail-btn { margin-left: 6px; cursor: pointer; background: none; border: none; color: var(--muted); font-size: 12px; }
#ws-bag-detail-flyout { display: none; position: absolute; top: 0; bottom: 0; right: 300px; width: 460px; background: var(--panel); border-left: 1px solid var(--line); box-shadow: -4px 0 12px rgba(0,0,0,0.15); z-index: 40; overflow-y: auto; padding: var(--space-4); }
#ws-bag-detail-flyout.ws-flyout--active { display: block; }
.ws-center--dim { opacity: 0.4; }
.ws-flyout-close { float: right; }
.ws-flyout-header { display: flex; align-items: center; gap: 10px; margin-bottom: var(--space-3); clear: both; }
.ws-flyout-icon { font-size: 24px; }
.ws-flyout-type-label { font-size: 11px; color: var(--muted); }
.ws-flyout-name { font-size: 16px; font-weight: 600; }
.ws-flyout-level-row { display: flex; gap: 6px; margin-bottom: var(--space-3); flex-wrap: wrap; }
.ws-flyout-level-btn { padding: 4px 10px; border: 1px solid var(--line); border-radius: 4px; cursor: pointer; font-size: 12px; background: var(--panel); }
.ws-flyout-level-btn--active { border-color: var(--accent); color: var(--accent); }
.ws-flyout-level-btn--draft { border-style: dashed; }
.ws-flyout-field { margin-bottom: var(--space-2); font-size: 13px; }
.ws-flyout-ref-list { font-size: 12px; color: var(--muted); }
.ws-flyout-ref-item { padding: 2px 0; }
.ws-flyout-error { color: var(--block); font-size: 12px; margin: 6px 0; }
.ws-flyout-actions { margin-top: var(--space-4); display: flex; gap: 8px; }
.ws-flyout-gem-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 12px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks PASS; suite total 121+17=138 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/index.html agent-setup-demo/js/app.js agent-setup-demo/js/workspace.js agent-setup-demo/css/workspace.css agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): flyout detail panel shell with view-mode content"
```

---

### Task 3: Pencil-edit 顯示名稱 (both kinds, any version)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `uiState.bagDetail`, `uiState.bagDetailEditing` (Task 2).
- Produces: `wsStartEditBagDetailField(field)`, `wsCancelEditBagDetailField()`, `wsCommitBagDetailDisplayName()`.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 3 Task 3: pencil-edit 顯示名稱 ---
  await page.click('[data-bag-gem-detail="get_order_status.1"]');
  await page.click('[data-flyout-displayname-pencil]');
  const nameInputVisible = await page.locator('[data-flyout-displayname-input]').count();
  record('clicking the displayName pencil shows an input', nameInputVisible === 1);
  await page.fill('[data-flyout-displayname-input]', '查詢訂單狀態（新）');
  await page.click('[data-flyout-displayname-commit]');
  const newDisplayName = await page.evaluate(() => window.appState.data.gems.find((g) => g.name === 'get_order_status').displayName);
  record('committing the displayName edit updates the gem definition', newDisplayName === '查詢訂單狀態（新）', newDisplayName);
  const flyoutShowsNewName = await page.locator('.ws-flyout-name').innerText();
  record('flyout re-renders with the new displayName', flyoutShowsNewName === '查詢訂單狀態（新）', flyoutShowsNewName);
  await page.click('[data-flyout-close]');

  // Review Focus: an uncommitted pencil edit on one item must not leak into the next item opened
  await page.click('[data-bag-gem-detail="get_order_status.1"]');
  await page.click('[data-flyout-displayname-pencil]');
  const editingBeforeSwitch = await page.locator('[data-flyout-displayname-input]').count();
  record('setup: displayName edit is open before switching items', editingBeforeSwitch === 1);
  await page.click('[data-flyout-close]');
  await page.click('[data-bag-equipment-detail="order-lookup.1"]');
  const leakedEditInputOnNewItem = await page.locator('[data-flyout-displayname-input]').count();
  record('opening a different item after an uncommitted edit does not leak the open edit input', leakedEditInputOnNewItem === 0);
  const leakedEditingState = await page.evaluate(() => window.appState.uiState.bagDetailEditing);
  record('opening a different item resets bagDetailEditing to null', leakedEditingState === null, leakedEditingState);
  await page.click('[data-flyout-close]');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 6 new checks FAIL — no pencil button or input exists yet (the leak-check steps fail on the same missing-element grounds).

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, add after `wsSwitchBagDetailLevel` (before `function renderBagDetailGemFields`):

```js
function wsStartEditBagDetailField(field) {
  window.appState.uiState.bagDetailEditing = field;
  window.rerender();
}

function wsCancelEditBagDetailField() {
  window.appState.uiState.bagDetailEditing = null;
  window.rerender();
}

function wsCommitBagDetailDisplayName() {
  var detail = window.appState.uiState.bagDetail;
  var def = wsBagDetailDef(detail);
  var input = document.querySelector('[data-flyout-displayname-input]');
  def.displayName = input.value.trim() || def.displayName;
  window.appState.uiState.bagDetailEditing = null;
  window.rerender();
}
```

Change `renderBagDetailViewBody`'s header block from:

```js
  var fieldsHtml = detail.kind === 'gem' ? renderBagDetailGemFields(def, ver) : renderBagDetailEquipmentFields(def, ver);
  var error = state.uiState.bagDetailError;

  return (
    '<button class="btn ws-flyout-close" data-flyout-close onclick="wsCloseBagDetail()">✕</button>' +
    '<div class="ws-flyout-header">' +
      '<span class="ws-flyout-icon">' + icon + '</span>' +
      '<span class="ws-flyout-type-label">' + typeLabel + '</span>' +
      '<span class="ws-flyout-name">' + escapeHtml(def.displayName) + '</span>' +
    '</div>' +
```

to:

```js
  var fieldsHtml = detail.kind === 'gem' ? renderBagDetailGemFields(def, ver) : renderBagDetailEquipmentFields(def, ver);
  var error = state.uiState.bagDetailError;
  var editing = state.uiState.bagDetailEditing;

  var nameBlock = editing === 'displayName'
    ? (
      '<input class="ws-npc-name-input" data-flyout-displayname-input value="' + escapeHtml(def.displayName) + '">' +
      '<button class="btn btn-primary" data-flyout-displayname-commit onclick="wsCommitBagDetailDisplayName()">✓</button> ' +
      '<button class="btn" onclick="wsCancelEditBagDetailField()">取消</button>'
    )
    : (
      '<span class="ws-flyout-name">' + escapeHtml(def.displayName) + '</span>' +
      '<button class="btn" data-flyout-displayname-pencil onclick="wsStartEditBagDetailField(\'displayName\')">✎</button>'
    );

  return (
    '<button class="btn ws-flyout-close" data-flyout-close onclick="wsCloseBagDetail()">✕</button>' +
    '<div class="ws-flyout-header">' +
      '<span class="ws-flyout-icon">' + icon + '</span>' +
      '<span class="ws-flyout-type-label">' + typeLabel + '</span>' +
      nameBlock +
    '</div>' +
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 6 new checks PASS; suite total 138+6=144 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): flyout pencil-edit for displayName"
```

---

### Task 4: Pencil-edit 種類／協定 (gem only, locked after first publish)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsGemEverPublished` (Task 2), `uiState.bagDetailEditing` (Task 2/3).
- Produces: `wsCommitBagDetailKindProtocol()`.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 3 Task 4: pencil-edit 種類／協定, locked after first publish ---
  await page.click('[data-bag-gem-detail="get_order_status.1"]');
  const kindProtocolLockedForPublishedGem = await page.locator('[data-flyout-kindprotocol-pencil]').count();
  record('種類／協定 pencil is absent for a gem that has ever been published', kindProtocolLockedForPublishedGem === 0);
  const kindProtocolLockedBadge = await page.locator('[data-flyout-kindprotocol-locked]').count();
  record('種類／協定 shows a locked badge instead', kindProtocolLockedBadge === 1);
  await page.click('[data-flyout-close]');

  // create a never-published gem directly in app state to test the unlocked path without depending on Task 7's create flow
  await page.evaluate(function () {
    window.appState.data.gems.push({
      name: 'send_email', displayName: '寄送郵件', kind: 'API', protocol: 'REST',
      versions: [{ level: 1, status: 'draft', copiedFromLevel: null }]
    });
  });
  await page.click('[data-bag-gem-detail="send_email.1"]');
  const kindProtocolPencilForNewGem = await page.locator('[data-flyout-kindprotocol-pencil]').count();
  record('種類／協定 pencil is present for a never-published gem', kindProtocolPencilForNewGem === 1);
  await page.click('[data-flyout-kindprotocol-pencil]');
  await page.selectOption('[data-flyout-kind-input]', 'MCP');
  await page.fill('[data-flyout-protocol-input]', 'MCP-TOOL');
  await page.click('[data-flyout-kindprotocol-commit]');
  const updatedKind = await page.evaluate(() => window.appState.data.gems.find((g) => g.name === 'send_email').kind);
  const updatedProtocol = await page.evaluate(() => window.appState.data.gems.find((g) => g.name === 'send_email').protocol);
  record('committing the 種類／協定 edit updates kind', updatedKind === 'MCP', updatedKind);
  record('committing the 種類／協定 edit updates protocol', updatedProtocol === 'MCP-TOOL', updatedProtocol);
  await page.click('[data-flyout-close]');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: the "pencil is absent" check passes accidentally (no pencil exists for anything yet) but the "locked badge" and all "never-published gem" checks FAIL — no `data-flyout-kindprotocol-*` elements exist yet.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, add after `wsCommitBagDetailDisplayName` (before `function renderBagDetailGemFields`):

```js
function wsCommitBagDetailKindProtocol() {
  var detail = window.appState.uiState.bagDetail;
  var gemDef = wsGemByName(detail.name);
  if (wsGemEverPublished(gemDef)) return;
  var kindInput = document.querySelector('[data-flyout-kind-input]');
  var protocolInput = document.querySelector('[data-flyout-protocol-input]');
  gemDef.kind = kindInput.value;
  gemDef.protocol = protocolInput.value.trim() || gemDef.protocol;
  window.appState.uiState.bagDetailEditing = null;
  window.rerender();
}
```

Change `renderBagDetailGemFields` from:

```js
function renderBagDetailGemFields(gemDef, ver) {
  var refs = wsGemReferences(gemDef.name, ver.level);
  var refList = (refs.equipment.length === 0 && refs.variants.length === 0)
    ? '<div class="ws-flyout-ref-list hint">尚未被任何裝備或人物卡引用</div>'
    : (
      '<div class="ws-flyout-ref-list">' +
        refs.equipment.map(function (e) { return '<div class="ws-flyout-ref-item">裝備：' + escapeHtml(e.displayName) + ' Lv' + e.level + '</div>'; }).join('') +
        refs.variants.map(function (v) { return '<div class="ws-flyout-ref-item">人物卡：' + escapeHtml(v.variantName) + '</div>'; }).join('') +
      '</div>'
    );
  return (
    '<div class="ws-flyout-field"><span class="label">種類／協定</span> ' + escapeHtml(gemDef.kind) + ' / ' + escapeHtml(gemDef.protocol) + '</div>' +
    '<div class="ws-flyout-field"><span class="label">從哪一級複製</span> ' + (ver.copiedFromLevel ? ('Lv' + ver.copiedFromLevel) : '（原始建立）') + '</div>' +
    '<div class="ws-flyout-field"><span class="label">被引用清單</span></div>' +
    refList
  );
}
```

to:

```js
function renderBagDetailGemFields(gemDef, ver, editing) {
  var refs = wsGemReferences(gemDef.name, ver.level);
  var refList = (refs.equipment.length === 0 && refs.variants.length === 0)
    ? '<div class="ws-flyout-ref-list hint">尚未被任何裝備或人物卡引用</div>'
    : (
      '<div class="ws-flyout-ref-list">' +
        refs.equipment.map(function (e) { return '<div class="ws-flyout-ref-item">裝備：' + escapeHtml(e.displayName) + ' Lv' + e.level + '</div>'; }).join('') +
        refs.variants.map(function (v) { return '<div class="ws-flyout-ref-item">人物卡：' + escapeHtml(v.variantName) + '</div>'; }).join('') +
      '</div>'
    );

  var kindProtocolBlock;
  if (editing === 'kindProtocol') {
    kindProtocolBlock =
      '<div class="ws-flyout-field">' +
        '<label class="label">種類</label>' +
        '<select data-flyout-kind-input>' +
          '<option value="API"' + (gemDef.kind === 'API' ? ' selected' : '') + '>API</option>' +
          '<option value="MCP"' + (gemDef.kind === 'MCP' ? ' selected' : '') + '>MCP</option>' +
        '</select>' +
      '</div>' +
      '<div class="ws-flyout-field">' +
        '<label class="label">協定</label>' +
        '<input data-flyout-protocol-input value="' + escapeHtml(gemDef.protocol) + '">' +
      '</div>' +
      '<button class="btn btn-primary" data-flyout-kindprotocol-commit onclick="wsCommitBagDetailKindProtocol()">✓ 完成編輯</button> ' +
      '<button class="btn" onclick="wsCancelEditBagDetailField()">取消</button>';
  } else if (wsGemEverPublished(gemDef)) {
    kindProtocolBlock =
      '<div class="ws-flyout-field"><span class="label">種類／協定</span> ' + escapeHtml(gemDef.kind) + ' / ' + escapeHtml(gemDef.protocol) + ' ' +
      '<span class="badge badge-locked" data-flyout-kindprotocol-locked>🔒 已公開過，不可改</span></div>';
  } else {
    kindProtocolBlock =
      '<div class="ws-flyout-field"><span class="label">種類／協定</span> ' + escapeHtml(gemDef.kind) + ' / ' + escapeHtml(gemDef.protocol) + ' ' +
      '<button class="btn" data-flyout-kindprotocol-pencil onclick="wsStartEditBagDetailField(\'kindProtocol\')">✎</button></div>';
  }

  return (
    kindProtocolBlock +
    '<div class="ws-flyout-field"><span class="label">從哪一級複製</span> ' + (ver.copiedFromLevel ? ('Lv' + ver.copiedFromLevel) : '（原始建立）') + '</div>' +
    '<div class="ws-flyout-field"><span class="label">被引用清單</span></div>' +
    refList
  );
}
```

Change `renderBagDetailViewBody`'s call site from `renderBagDetailGemFields(def, ver)` to `renderBagDetailGemFields(def, ver, editing)` (the `editing` variable is already declared earlier in that function from Task 3).

In `agent-setup-demo/css/workspace.css`, no new rules are needed — `.badge`/`.badge-locked` already exist from Phase 1.

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks PASS; suite total 144+6=150 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): flyout pencil-edit for gem 種類／協定, locked after first publish"
```

---

### Task 5: 裝備草稿鑲嵌寶石編輯器

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsGemVersion`, `wsGemByName` (Phase 2), `uiState.bagDetailGemsDraft` (Task 2).
- Produces: `wsStartEditBagDetailGems()`, `wsCancelEditBagDetailGems()`, `wsAddGemToBagDetailDraft(gemName, level)`, `wsAddGemFromSelect()`, `wsRemoveGemFromBagDetailDraft(gemName)`, `wsCommitBagDetailGems()`.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 3 Task 5: 裝備草稿鑲嵌寶石編輯器 ---
  // order-lookup only has published versions; create a draft Lv3 directly in app state to exercise the editor
  // without depending on Task 6's "open new draft" action.
  await page.evaluate(function () {
    window.appState.data.equipment.find(function (e) { return e.name === 'order-lookup'; }).versions.push({
      level: 3, status: 'draft', copiedFromLevel: 2, gems: [{ gemName: 'get_order_status', level: 2 }]
    });
  });
  await page.click('[data-bag-equipment-detail="order-lookup.1"]');
  await page.click('[data-flyout-level-btn="3"]');
  const gemsPencilOnDraft = await page.locator('[data-flyout-gems-pencil]').count();
  record('鑲嵌寶石 pencil is present on a draft equipment version', gemsPencilOnDraft === 1);

  await page.click('[data-flyout-gems-pencil]');
  const removeButtonCount = await page.locator('[data-flyout-remove-gem]').count();
  record('editor shows the currently-carried gem with a remove button', removeButtonCount === 1);
  await page.click('[data-flyout-remove-gem="get_order_status"]');
  const removeButtonCountAfter = await page.locator('[data-flyout-remove-gem]').count();
  record('removing a carried gem takes it out of the draft list', removeButtonCountAfter === 0);

  await page.selectOption('[data-flyout-add-gem-select]', 'run_sql_query@1');
  await page.click('[data-flyout-add-gem]');
  const addedGemCount = await page.locator('[data-flyout-remove-gem="run_sql_query"]').count();
  record('adding a published gem puts it in the draft list', addedGemCount === 1);

  await page.click('[data-flyout-gems-commit]');
  const committedGems = await page.evaluate(() => window.appState.data.equipment.find((e) => e.name === 'order-lookup').versions.find((v) => v.level === 3).gems);
  record('committing the editor writes the new gems array onto the version', committedGems.length === 1 && committedGems[0].gemName === 'run_sql_query', JSON.stringify(committedGems));

  // published versions never show the pencil
  await page.click('[data-flyout-level-btn="1"]');
  const gemsPencilOnPublished = await page.locator('[data-flyout-gems-pencil]').count();
  record('鑲嵌寶石 pencil is absent on a published equipment version', gemsPencilOnPublished === 0);
  const gemsLockedBadge = await page.locator('[data-flyout-gems-locked]').count();
  record('published equipment version shows a locked badge instead', gemsLockedBadge === 1);
  await page.click('[data-flyout-close]');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks FAIL — none of the `data-flyout-gems-*`/`data-flyout-add-gem*`/`data-flyout-remove-gem` elements exist yet.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, add after `wsCommitBagDetailKindProtocol` (before `function renderBagDetailGemFields`):

```js
function wsStartEditBagDetailGems() {
  var detail = window.appState.uiState.bagDetail;
  var eqDef = wsEquipmentByName(detail.name);
  var ver = wsEquipmentVersion(eqDef, detail.level);
  window.appState.uiState.bagDetailGemsDraft = JSON.parse(JSON.stringify(ver.gems || []));
  window.appState.uiState.bagDetailEditing = 'gems';
  window.rerender();
}

function wsCancelEditBagDetailGems() {
  window.appState.uiState.bagDetailGemsDraft = null;
  window.appState.uiState.bagDetailEditing = null;
  window.rerender();
}

function wsAddGemToBagDetailDraft(gemName, level) {
  var draft = window.appState.uiState.bagDetailGemsDraft;
  var already = draft.some(function (g) { return g.gemName === gemName; });
  if (already) {
    window.appState.uiState.bagDetailError = '這顆寶石已在鑲嵌清單中';
    window.rerender();
    return;
  }
  var gemDef = wsGemByName(gemName);
  var ver = wsGemVersion(gemDef, level);
  if (!ver || ver.status === 'draft') {
    window.appState.uiState.bagDetailError = '只能鑲嵌已公開的寶石版本';
    window.rerender();
    return;
  }
  draft.push({ gemName: gemName, level: level });
  window.appState.uiState.bagDetailError = null;
  window.rerender();
}

function wsAddGemFromSelect() {
  var select = document.querySelector('[data-flyout-add-gem-select]');
  if (!select || !select.value) return;
  var parts = select.value.split('@');
  wsAddGemToBagDetailDraft(parts[0], Number(parts[1]));
}

function wsRemoveGemFromBagDetailDraft(gemName) {
  var draft = window.appState.uiState.bagDetailGemsDraft;
  window.appState.uiState.bagDetailGemsDraft = draft.filter(function (g) { return g.gemName !== gemName; });
  window.rerender();
}

function wsCommitBagDetailGems() {
  var detail = window.appState.uiState.bagDetail;
  var eqDef = wsEquipmentByName(detail.name);
  var ver = wsEquipmentVersion(eqDef, detail.level);
  ver.gems = window.appState.uiState.bagDetailGemsDraft;
  window.appState.uiState.bagDetailGemsDraft = null;
  window.appState.uiState.bagDetailEditing = null;
  window.rerender();
}
```

Change `renderBagDetailEquipmentFields` from:

```js
function renderBagDetailEquipmentFields(eqDef, ver) {
  var refs = wsEquipmentReferences(eqDef.name, ver.level);
  var gemsHtml = (ver.gems || []).map(function (g) {
    var gemDef = wsGemByName(g.gemName);
    return '<span class="ws-gem-chip">' + escapeHtml(gemDef.displayName) + ' Lv' + g.level + '</span>';
  }).join('') || '<span class="hint">尚未鑲嵌任何寶石</span>';
  var refList = refs.variants.length === 0
    ? '<div class="ws-flyout-ref-list hint">尚未被任何人物卡掛載</div>'
    : '<div class="ws-flyout-ref-list">' + refs.variants.map(function (v) { return '<div class="ws-flyout-ref-item">人物卡：' + escapeHtml(v.variantName) + '</div>'; }).join('') + '</div>';
  return (
    '<div class="ws-flyout-field"><span class="label">鑲嵌寶石</span> ' + gemsHtml + '</div>' +
    '<div class="ws-flyout-field"><span class="label">從哪一級複製</span> ' + (ver.copiedFromLevel ? ('Lv' + ver.copiedFromLevel) : '（原始建立）') + '</div>' +
    '<div class="ws-flyout-field"><span class="label">被哪些人物卡掛載</span></div>' +
    refList
  );
}
```

to:

```js
function renderBagDetailEquipmentFields(eqDef, ver, editing, gemsDraft) {
  var refs = wsEquipmentReferences(eqDef.name, ver.level);
  var gemsBlock;
  if (editing === 'gems') {
    var rows = gemsDraft.map(function (g) {
      var gemDef = wsGemByName(g.gemName);
      return (
        '<div class="ws-flyout-gem-row">' +
          '<span>' + escapeHtml(gemDef.displayName) + ' Lv' + g.level + '</span>' +
          '<button class="btn" data-flyout-remove-gem="' + g.gemName + '" onclick="wsRemoveGemFromBagDetailDraft(\'' + g.gemName + '\')">⊖</button>' +
        '</div>'
      );
    }).join('') || '<div class="hint">尚未鑲嵌任何寶石</div>';
    var publishedOptions = [];
    window.appState.data.gems.forEach(function (gemDef) {
      gemDef.versions.forEach(function (v) {
        if (v.status === 'published') publishedOptions.push({ gemName: gemDef.name, level: v.level, label: gemDef.displayName + ' Lv' + v.level });
      });
    });
    var optionsHtml = publishedOptions.map(function (o) {
      return '<option value="' + o.gemName + '@' + o.level + '">' + escapeHtml(o.label) + '</option>';
    }).join('');
    gemsBlock =
      '<div class="ws-flyout-field"><span class="label">鑲嵌寶石</span></div>' +
      rows +
      '<select data-flyout-add-gem-select>' + optionsHtml + '</select>' +
      '<button class="btn" data-flyout-add-gem onclick="wsAddGemFromSelect()">加入</button>' +
      '<div>' +
        '<button class="btn btn-primary" data-flyout-gems-commit onclick="wsCommitBagDetailGems()">✓ 完成編輯</button> ' +
        '<button class="btn" onclick="wsCancelEditBagDetailGems()">取消</button>' +
      '</div>';
  } else {
    var viewRows = (ver.gems || []).map(function (g) {
      var gemDef = wsGemByName(g.gemName);
      return '<span class="ws-gem-chip">' + escapeHtml(gemDef.displayName) + ' Lv' + g.level + '</span>';
    }).join('') || '<span class="hint">尚未鑲嵌任何寶石</span>';
    gemsBlock =
      '<div class="ws-flyout-field"><span class="label">鑲嵌寶石</span> ' + viewRows + ' ' +
      (ver.status === 'draft'
        ? '<button class="btn" data-flyout-gems-pencil onclick="wsStartEditBagDetailGems()">✎</button>'
        : '<span class="badge badge-locked" data-flyout-gems-locked>🔒 已公開版本不可改</span>') +
      '</div>';
  }

  var refList = refs.variants.length === 0
    ? '<div class="ws-flyout-ref-list hint">尚未被任何人物卡掛載</div>'
    : '<div class="ws-flyout-ref-list">' + refs.variants.map(function (v) { return '<div class="ws-flyout-ref-item">人物卡：' + escapeHtml(v.variantName) + '</div>'; }).join('') + '</div>';

  return (
    gemsBlock +
    '<div class="ws-flyout-field"><span class="label">從哪一級複製</span> ' + (ver.copiedFromLevel ? ('Lv' + ver.copiedFromLevel) : '（原始建立）') + '</div>' +
    '<div class="ws-flyout-field"><span class="label">被哪些人物卡掛載</span></div>' +
    refList
  );
}
```

Change `renderBagDetailViewBody`'s call site from `renderBagDetailEquipmentFields(def, ver)` to `renderBagDetailEquipmentFields(def, ver, editing, state.uiState.bagDetailGemsDraft)`.

In `agent-setup-demo/css/workspace.css`, append:

```css
.ws-flyout-field select[data-flyout-add-gem-select] { margin-right: 6px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks PASS; suite total 150+7=157 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/css/workspace.css agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): equipment draft 鑲嵌寶石 editor in the flyout"
```

---

### Task 6: 開新草稿／公開／刪除 action bar (with delete reference-guard)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsBagDetailDef`, `wsBagDetailMaxLevel` (Task 2), `wsGemReferences`/`wsEquipmentReferences` (Task 1).
- Produces: `wsOpenNewBagDetailDraft()`, `wsPublishBagDetailVersion()`, `wsDeleteBagDetailVersion()`.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 3 Task 6: 開新草稿／公開／刪除 action bar ---
  await page.click('[data-bag-gem-detail="render_chart.1"]');
  const openDraftBtnOnMaxPublished = await page.locator('[data-flyout-open-draft]').count();
  record('開新草稿 button shows when viewing the highest, published level', openDraftBtnOnMaxPublished === 1);
  await page.click('[data-flyout-open-draft]');
  const newDraftLevel = await page.evaluate(() => window.appState.uiState.bagDetail.level);
  record('開新草稿 switches the flyout to the newly created Lv2 draft', newDraftLevel === 2, newDraftLevel);
  const newDraftExists = await page.evaluate(() => window.appState.data.gems.find((g) => g.name === 'render_chart').versions.some((v) => v.level === 2 && v.status === 'draft' && v.copiedFromLevel === 1));
  record('the new draft is appended to the gem\'s versions with copiedFromLevel set', newDraftExists === true);

  const publishBtnOnDraft = await page.locator('[data-flyout-publish]').count();
  record('公開 button shows while viewing a draft version', publishBtnOnDraft === 1);
  const deleteBtnOnDraft = await page.locator('[data-flyout-delete]').count();
  record('刪除 button shows while viewing a draft version', deleteBtnOnDraft === 1);
  const openDraftBtnGoneOnDraft = await page.locator('[data-flyout-open-draft]').count();
  record('開新草稿 button is gone while viewing the still-open draft (no concurrent drafts)', openDraftBtnGoneOnDraft === 0);

  await page.click('[data-flyout-publish]');
  const statusAfterPublish = await page.evaluate(() => window.appState.data.gems.find((g) => g.name === 'render_chart').versions.find((v) => v.level === 2).status);
  record('公開 flips the draft\'s status to published', statusAfterPublish === 'published', statusAfterPublish);
  await page.click('[data-flyout-close]');

  // delete guard: get_order_status Lv4 is a draft with zero references (nothing equips/wears it)
  await page.click('[data-bag-gem-detail="get_order_status.4"]');
  const deleteBtnEnabledForUnreferencedDraft = await page.locator('[data-flyout-delete]').isDisabled();
  record('刪除 is enabled for an unreferenced draft', deleteBtnEnabledForUnreferencedDraft === false);
  await page.click('[data-flyout-delete]');
  const lv4StillExists = await page.evaluate(() => window.appState.data.gems.find((g) => g.name === 'get_order_status').versions.some((v) => v.level === 4));
  record('刪除 removes an unreferenced draft version', lv4StillExists === false);
  const flyoutClosedAfterDelete = await page.locator('#ws-bag-detail-flyout.ws-flyout--active').count();
  record('flyout closes after a successful delete', flyoutClosedAfterDelete === 0);

  // delete guard: mount a still-draft gem into an equipment draft's carried-gems list, then try to delete that gem's draft level
  await page.evaluate(function () {
    window.appState.data.gems.push({
      name: 'send_sms', displayName: '發送簡訊', kind: 'API', protocol: 'REST',
      versions: [{ level: 1, status: 'draft', copiedFromLevel: null }]
    });
    window.appState.data.equipment.push({
      name: 'sms-helper', displayName: '簡訊小幫手',
      versions: [{ level: 1, status: 'draft', copiedFromLevel: null, gems: [{ gemName: 'send_sms', level: 1 }] }]
    });
  });
  await page.click('[data-bag-gem-detail="send_sms.1"]');
  const deleteBtnDisabledForReferencedDraft = await page.locator('[data-flyout-delete]').isDisabled();
  record('刪除 is disabled for a draft referenced by an equipment\'s carried-gems list', deleteBtnDisabledForReferencedDraft === true);
  await page.evaluate(function () { document.querySelector('[data-flyout-delete]').click(); });
  const errorShownForBlockedDelete = await page.evaluate(() => window.appState.uiState.bagDetailError);
  record('clicking a disabled-but-still-clicked 刪除 shows a reference-blocked error, not a silent no-op', typeof errorShownForBlockedDelete === 'string' && errorShownForBlockedDelete.indexOf('引用') !== -1, errorShownForBlockedDelete);
  const stillExistsAfterBlockedDelete = await page.evaluate(() => window.appState.data.gems.find((g) => g.name === 'send_sms').versions.length);
  record('the referenced draft is not actually deleted', stillExistsAfterBlockedDelete === 1);
  await page.click('[data-flyout-close]');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks FAIL — none of `data-flyout-open-draft`/`data-flyout-publish`/`data-flyout-delete` exist yet.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, add after `wsCommitBagDetailGems` (before `function renderBagDetailGemFields`):

```js
function wsOpenNewBagDetailDraft() {
  var detail = window.appState.uiState.bagDetail;
  var def = wsBagDetailDef(detail);
  var viewing = def.versions.find(function (v) { return v.level === detail.level; });
  var maxLevel = wsBagDetailMaxLevel(def);
  if (viewing.level !== maxLevel || viewing.status !== 'published') return;
  var nextLevel = maxLevel + 1;
  var newVersion = detail.kind === 'gem'
    ? { level: nextLevel, status: 'draft', copiedFromLevel: viewing.level }
    : { level: nextLevel, status: 'draft', copiedFromLevel: viewing.level, gems: JSON.parse(JSON.stringify(viewing.gems || [])) };
  def.versions.push(newVersion);
  window.appState.uiState.bagDetail = { kind: detail.kind, name: detail.name, level: nextLevel, mode: 'view' };
  window.rerender();
}

function wsPublishBagDetailVersion() {
  var detail = window.appState.uiState.bagDetail;
  var def = wsBagDetailDef(detail);
  var viewing = def.versions.find(function (v) { return v.level === detail.level; });
  if (viewing.status !== 'draft') return;
  viewing.status = 'published';
  window.rerender();
}

function wsBagDetailVersionHasReferences(detail) {
  var refs = detail.kind === 'gem' ? wsGemReferences(detail.name, detail.level) : wsEquipmentReferences(detail.name, detail.level);
  return detail.kind === 'gem'
    ? (refs.equipment.length > 0 || refs.variants.length > 0)
    : (refs.variants.length > 0);
}

function wsDeleteBagDetailVersion() {
  var detail = window.appState.uiState.bagDetail;
  var def = wsBagDetailDef(detail);
  var viewing = def.versions.find(function (v) { return v.level === detail.level; });
  if (viewing.status !== 'draft') return;
  if (wsBagDetailVersionHasReferences(detail)) {
    window.appState.uiState.bagDetailError = '這個版本仍被引用，無法刪除';
    window.rerender();
    return;
  }
  def.versions = def.versions.filter(function (v) { return v.level !== detail.level; });
  wsCloseBagDetail();
}
```

Change `renderBagDetailViewBody` from:

```js
  var fieldsHtml = detail.kind === 'gem' ? renderBagDetailGemFields(def, ver, editing) : renderBagDetailEquipmentFields(def, ver, editing, state.uiState.bagDetailGemsDraft);
  var error = state.uiState.bagDetailError;
```

to:

```js
  var fieldsHtml = detail.kind === 'gem' ? renderBagDetailGemFields(def, ver, editing) : renderBagDetailEquipmentFields(def, ver, editing, state.uiState.bagDetailGemsDraft);
  var error = state.uiState.bagDetailError;
  var maxLevel = wsBagDetailMaxLevel(def);
  var actionsHtml;
  if (ver.status === 'draft') {
    var disabled = wsBagDetailVersionHasReferences(detail) ? 'disabled' : '';
    actionsHtml =
      '<button class="btn btn-primary" data-flyout-publish onclick="wsPublishBagDetailVersion()">公開</button> ' +
      '<button class="btn btn-danger" data-flyout-delete ' + disabled + ' onclick="wsDeleteBagDetailVersion()">刪除</button>';
  } else if (ver.level === maxLevel) {
    actionsHtml = '<button class="btn" data-flyout-open-draft onclick="wsOpenNewBagDetailDraft()">開 Lv' + (maxLevel + 1) + ' 草稿</button>';
  } else {
    actionsHtml = '<span class="hint">較舊版本，唯讀</span>';
  }
```

and change the function's `return` statement from:

```js
  return (
    '<button class="btn ws-flyout-close" data-flyout-close onclick="wsCloseBagDetail()">✕</button>' +
    '<div class="ws-flyout-header">' +
      '<span class="ws-flyout-icon">' + icon + '</span>' +
      '<span class="ws-flyout-type-label">' + typeLabel + '</span>' +
      nameBlock +
    '</div>' +
    '<div class="ws-flyout-level-row">' + levelButtons + '</div>' +
    (error ? '<div class="ws-flyout-error" data-flyout-error>' + escapeHtml(error) + '</div>' : '') +
    fieldsHtml
  );
```

to:

```js
  return (
    '<button class="btn ws-flyout-close" data-flyout-close onclick="wsCloseBagDetail()">✕</button>' +
    '<div class="ws-flyout-header">' +
      '<span class="ws-flyout-icon">' + icon + '</span>' +
      '<span class="ws-flyout-type-label">' + typeLabel + '</span>' +
      nameBlock +
    '</div>' +
    '<div class="ws-flyout-level-row">' + levelButtons + '</div>' +
    (error ? '<div class="ws-flyout-error" data-flyout-error>' + escapeHtml(error) + '</div>' : '') +
    fieldsHtml +
    '<div class="ws-flyout-actions">' + actionsHtml + '</div>'
  );
```

Note: `disabled` on the native `<button>` prevents a real pointer click, but the test's "clicking a disabled-but-still-clicked 刪除" step invokes `.click()` directly in `page.evaluate` (bypassing the browser's own disabled-click suppression) specifically to prove `wsDeleteBagDetailVersion`'s own reference guard is the thing blocking it — not just the HTML `disabled` attribute as the only line of defense.

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks PASS; suite total 157+13=170 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): flyout 開新草稿／公開／刪除 action bar with delete reference-guard"
```

---

### Task 7: "＋ 新增" creation flow (gem or equipment, Lv1 draft)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `uiState.bagDetailCreateForm` (Task 2), `wsOpenBagDetail` (Task 2).
- Produces: `wsOpenBagDetailCreate()`, `wsChooseBagDetailCreateKind(kind)`, `wsCancelBagDetailCreate()`, `wsValidateCatalogName(kind, name, catalogList)`, `wsSubmitCreateBagItem()`, `renderBagDetailCreateBody(state)` wired into `renderBagDetailFlyout`.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 3 Task 7: ＋ 新增 creation flow ---
  const addButtonCount = await page.locator('[data-bag-add]').count();
  record('narrow bag header has a ＋ 新增 button', addButtonCount === 1);
  await page.click('[data-bag-add]');
  const createChoiceVisible = await page.locator('[data-flyout-create-gem]').count();
  record('clicking ＋ 新增 opens the flyout in create-choice mode', createChoiceVisible === 1);

  await page.click('[data-flyout-create-gem]');
  const createFormVisible = await page.locator('[data-bag-create-name]').count();
  record('choosing 新增寶石 shows the name/displayName form', createFormVisible === 1);

  // malformed name rejected
  await page.fill('[data-bag-create-name]', 'Bad Name!');
  await page.fill('[data-bag-create-display-name]', '壞名字');
  await page.click('[data-bag-create-submit]');
  const malformedError = await page.evaluate(() => window.appState.uiState.bagDetailError);
  record('a malformed gem code is rejected with an error', typeof malformedError === 'string' && malformedError.length > 0, malformedError);
  const gemNotCreatedForBadName = await page.evaluate(() => window.appState.data.gems.some((g) => g.displayName === '壞名字'));
  record('the malformed-name gem is not created', gemNotCreatedForBadName === false);

  // duplicate name rejected
  await page.fill('[data-bag-create-name]', 'get_order_status');
  await page.fill('[data-bag-create-display-name]', '重複名稱');
  await page.click('[data-bag-create-submit]');
  const duplicateError = await page.evaluate(() => window.appState.uiState.bagDetailError);
  record('a duplicate gem code is rejected with an error', typeof duplicateError === 'string' && duplicateError.length > 0, duplicateError);
  const gemCountUnchangedAfterDuplicate = await page.evaluate(() => window.appState.data.gems.filter((g) => g.name === 'get_order_status').length);
  record('the duplicate-name submission does not create a second entry', gemCountUnchangedAfterDuplicate === 1);

  // valid creation
  await page.fill('[data-bag-create-name]', 'send_slack_message');
  await page.fill('[data-bag-create-display-name]', '發送 Slack 訊息');
  await page.click('[data-bag-create-submit]');
  const newGemCreated = await page.evaluate(() => window.appState.data.gems.find((g) => g.name === 'send_slack_message'));
  record('a valid gem submission creates a new Lv1 draft gem', !!newGemCreated && newGemCreated.versions.length === 1 && newGemCreated.versions[0].level === 1 && newGemCreated.versions[0].status === 'draft', JSON.stringify(newGemCreated));
  const flyoutNowViewsNewGem = await page.evaluate(() => window.appState.uiState.bagDetail);
  record('after creation the flyout switches to view mode on the new gem', flyoutNowViewsNewGem.kind === 'gem' && flyoutNowViewsNewGem.name === 'send_slack_message' && flyoutNowViewsNewGem.mode === 'view', JSON.stringify(flyoutNowViewsNewGem));
  await page.click('[data-flyout-close]');

  // equipment creation path (kebab-case name)
  await page.click('[data-bag-add]');
  await page.click('[data-flyout-create-equipment]');
  await page.fill('[data-bag-create-name]', 'slack-poster');
  await page.fill('[data-bag-create-display-name]', 'Slack 發文術');
  await page.click('[data-bag-create-submit]');
  const newEquipmentCreated = await page.evaluate(() => window.appState.data.equipment.find((e) => e.name === 'slack-poster'));
  record('a valid equipment submission creates a new Lv1 draft equipment', !!newEquipmentCreated && newEquipmentCreated.versions.length === 1 && newEquipmentCreated.versions[0].status === 'draft' && Array.isArray(newEquipmentCreated.versions[0].gems), JSON.stringify(newEquipmentCreated));
  await page.click('[data-flyout-close]');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks FAIL — no `data-bag-add`/`data-flyout-create-gem`/`data-bag-create-*` elements exist yet.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, add after `wsDeleteBagDetailVersion` (before `function renderBagDetailGemFields`):

```js
function wsOpenBagDetailCreate() {
  window.appState.uiState.bagDetail = { kind: null, name: null, level: null, mode: 'create' };
  window.appState.uiState.bagDetailCreateForm = null;
  window.appState.uiState.bagDetailError = null;
  window.rerender();
}

function wsChooseBagDetailCreateKind(kind) {
  window.appState.uiState.bagDetailCreateForm = { kind: kind };
  window.appState.uiState.bagDetailError = null;
  window.rerender();
}

function wsCancelBagDetailCreate() {
  wsCloseBagDetail();
}

function wsValidateCatalogName(kind, name, catalogList) {
  var pattern = kind === 'gem' ? /^[a-z][a-z0-9_]{0,59}$/ : /^[a-z][a-z0-9-]{0,59}$/;
  if (!pattern.test(name)) {
    return kind === 'gem'
      ? '代碼只能是小寫英數字與底線，需以小寫英文字母開頭，長度 1–60'
      : '代碼只能是小寫英數字與連字號，需以小寫英文字母開頭，長度 1–60';
  }
  var duplicate = catalogList.some(function (item) { return item.name === name; });
  if (duplicate) {
    return '已有相同代碼的' + (kind === 'gem' ? '寶石' : '裝備');
  }
  return null;
}

function wsSubmitCreateBagItem() {
  var form = window.appState.uiState.bagDetailCreateForm;
  var nameInput = document.querySelector('[data-bag-create-name]');
  var displayNameInput = document.querySelector('[data-bag-create-display-name]');
  var name = nameInput.value.trim();
  var displayName = displayNameInput.value.trim();
  var catalogList = form.kind === 'gem' ? window.appState.data.gems : window.appState.data.equipment;
  var error = wsValidateCatalogName(form.kind, name, catalogList);
  if (error) {
    window.appState.uiState.bagDetailError = error;
    window.rerender();
    return;
  }
  var newDef = form.kind === 'gem'
    ? { name: name, displayName: displayName || name, kind: 'API', protocol: 'REST', versions: [{ level: 1, status: 'draft', copiedFromLevel: null }] }
    : { name: name, displayName: displayName || name, versions: [{ level: 1, status: 'draft', copiedFromLevel: null, gems: [] }] };
  catalogList.push(newDef);
  window.appState.uiState.bagDetailError = null;
  window.appState.uiState.bagDetailCreateForm = null;
  window.appState.uiState.bagDetail = { kind: form.kind, name: name, level: 1, mode: 'view' };
  window.rerender();
}

function renderBagDetailCreateBody(state) {
  var form = state.uiState.bagDetailCreateForm;
  var error = state.uiState.bagDetailError;
  if (!form) {
    return (
      '<button class="btn ws-flyout-close" data-flyout-close onclick="wsCloseBagDetail()">✕</button>' +
      '<div class="ws-flyout-header"><span class="ws-flyout-name">新增素材</span></div>' +
      '<button class="btn" data-flyout-create-gem onclick="wsChooseBagDetailCreateKind(\'gem\')">新增寶石</button> ' +
      '<button class="btn" data-flyout-create-equipment onclick="wsChooseBagDetailCreateKind(\'equipment\')">新增裝備</button>'
    );
  }
  var typeLabel = form.kind === 'gem' ? '寶石' : '裝備';
  return (
    '<button class="btn ws-flyout-close" data-flyout-close onclick="wsCloseBagDetail()">✕</button>' +
    '<div class="ws-flyout-header"><span class="ws-flyout-name">新增' + typeLabel + '</span></div>' +
    '<div class="ws-flyout-field"><label class="label">代碼</label><input data-bag-create-name placeholder="' + (form.kind === 'gem' ? 'e.g. send_email' : 'e.g. email-sender') + '"></div>' +
    '<div class="ws-flyout-field"><label class="label">顯示名稱</label><input data-bag-create-display-name placeholder="顯示名稱"></div>' +
    (error ? '<div class="ws-flyout-error" data-flyout-error>' + escapeHtml(error) + '</div>' : '') +
    '<div class="ws-flyout-actions">' +
      '<button class="btn" onclick="wsCancelBagDetailCreate()">取消</button> ' +
      '<button class="btn btn-primary" data-bag-create-submit onclick="wsSubmitCreateBagItem()">建立 Lv1 草稿</button>' +
    '</div>'
  );
}
```

Change `renderBagDetailFlyout`'s content line from:

```js
  flyoutEl.innerHTML = detail.mode === 'create' ? '' : renderBagDetailViewBody(state);
```

to:

```js
  flyoutEl.innerHTML = detail.mode === 'create' ? renderBagDetailCreateBody(state) : renderBagDetailViewBody(state);
```

Add the "＋ 新增" header button in `renderBagForVariant`. Change:

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

to:

```js
  var error = state.uiState.bagError;
  var warning = state.uiState.bagWarning;
  return (
    '<div class="ws-bag-header"><span class="label">🎒 背包</span><button class="btn" data-bag-add onclick="wsOpenBagDetailCreate()">＋ 新增</button></div>' +
    (error ? '<div class="ws-bag-error" data-bag-error>' + escapeHtml(error) + '</div>' : '') +
    (warning ? '<div class="ws-bag-warning" data-bag-warning>' + escapeHtml(warning) + '</div>' : '') +
    '<div class="label">🎒 背包 — 寶石</div>' + gemRows +
    '<div class="label" style="margin-top:var(--space-3);">🎒 背包 — 裝備</div>' + equipmentRows
  );
```

In `agent-setup-demo/css/workspace.css`, append:

```css
.ws-bag-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks PASS; suite total 170+12=182 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/css/workspace.css agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): ＋ 新增 flyout creation flow for gems and equipment"
```

---

### Task 8: skill-admin.html embed wiring + CSS scoping sync

**Files:**
- Modify: `skill-admin.html`
- Modify: `skill-admin/agent-setup-embed.css`

**Interfaces:**
- Consumes: `#ws-bag-detail-flyout` markup (Task 2), all `.ws-flyout-*`/`.ws-bag-item-detail-btn`/`.ws-bag-header`/`.ws-center--dim` CSS classes (Tasks 2-7).
- Produces: nothing new consumed by later tasks — this is the last task in the plan.

- [ ] **Step 1: Write the failing test**

This task has no `ui.test.cjs` coverage — `agent-setup-demo/tests/ui.test.cjs` only ever loads `agent-setup-demo/index.html` directly (see its `page.goto` call), never `skill-admin.html`. Phase 2's equivalent task (embed crash fix) used a standalone scratch Playwright script for the same reason; this task does the same.

Write `scratchpad/verify-flyout-embed.cjs` (use the session's scratchpad directory, not a path inside the repo):

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
  await page.click('[data-npc-toggle="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.STANDARD"]');
  await page.click('[data-bag-gem-detail="get_order_status.1"]');
  const flyoutActive = await page.locator('#ws-bag-detail-flyout.ws-flyout--active').count();
  console.log('flyout active:', flyoutActive);
  const flyoutWidth = await page.evaluate(() => getComputedStyle(document.getElementById('ws-bag-detail-flyout')).width);
  console.log('flyout width:', flyoutWidth, '(expect 460px)');

  console.log('JS errors:', jsErrors.length ? jsErrors : 'none');
  await browser.close();
  process.exit(jsErrors.length || flyoutActive !== 1 ? 1 : 0);
}

main();
```

Run against the pre-Task-8 `skill-admin.html` (the current `git show HEAD:skill-admin.html`, checked out into a throwaway directory so the JS/CSS Phase 1-7 already fixed don't mask the missing markup):

```bash
mkdir -p /tmp/red-check-phase3 && git show HEAD:skill-admin.html > /tmp/red-check-phase3/skill-admin.html
ln -sfn "$(pwd)/agent-setup-demo" /tmp/red-check-phase3/agent-setup-demo
ln -sfn "$(pwd)/skill-admin" /tmp/red-check-phase3/skill-admin
ln -sfn "$(pwd)/skill-admin.js" /tmp/red-check-phase3/skill-admin.js 2>/dev/null; true
node /path/to/scratchpad/verify-flyout-embed.cjs /tmp/red-check-phase3/skill-admin.html
```

Expected: `flyout active: 0` (or a thrown pageerror) — `#ws-bag-detail-flyout` doesn't exist in `skill-admin.html` yet.

- [ ] **Step 2: Run test to verify it fails**

Run the command above.
Expected: exits non-zero, `flyout active: 0`.

- [ ] **Step 3: Write minimal implementation**

In `skill-admin.html`, find the `.ws-embed-root` block containing `#ws-nav`/`#ws-center`/`#ws-bag` (added in Phase 1) and add the flyout div as a sibling of `#ws-bag`, inside the same `.ws-shell`:

```html
<div id="ws-nav" class="ws-pane"></div>
<div id="ws-center" class="ws-pane"></div>
<div id="ws-bag" class="ws-pane"></div>
```

to:

```html
<div id="ws-nav" class="ws-pane"></div>
<div id="ws-center" class="ws-pane"></div>
<div id="ws-bag" class="ws-pane"></div>
<div id="ws-bag-detail-flyout"></div>
```

(Use the exact surrounding markup already in `skill-admin.html`'s `.ws-embed-root` block — read the file first to match indentation and confirm there is exactly one such block, the one Phase 1 added.)

In `skill-admin/agent-setup-embed.css`, append the `#page-agents`-scoped copies of every rule Tasks 2-7 added to `agent-setup-demo/css/workspace.css`:

```css
/* Phase 3 additions (flyout detail panel) */
#page-agents .ws-shell { position: relative; }
#page-agents .ws-bag-item-detail-btn { margin-left: 6px; cursor: pointer; background: none; border: none; color: var(--muted); font-size: 12px; }
#page-agents #ws-bag-detail-flyout { display: none; position: absolute; top: 0; bottom: 0; right: 300px; width: 460px; background: var(--panel); border-left: 1px solid var(--line); box-shadow: -4px 0 12px rgba(0,0,0,0.15); z-index: 40; overflow-y: auto; padding: var(--space-4); }
#page-agents #ws-bag-detail-flyout.ws-flyout--active { display: block; }
#page-agents .ws-center--dim { opacity: 0.4; }
#page-agents .ws-flyout-close { float: right; }
#page-agents .ws-flyout-header { display: flex; align-items: center; gap: 10px; margin-bottom: var(--space-3); clear: both; }
#page-agents .ws-flyout-icon { font-size: 24px; }
#page-agents .ws-flyout-type-label { font-size: 11px; color: var(--muted); }
#page-agents .ws-flyout-name { font-size: 16px; font-weight: 600; }
#page-agents .ws-flyout-level-row { display: flex; gap: 6px; margin-bottom: var(--space-3); flex-wrap: wrap; }
#page-agents .ws-flyout-level-btn { padding: 4px 10px; border: 1px solid var(--line); border-radius: 4px; cursor: pointer; font-size: 12px; background: var(--panel); }
#page-agents .ws-flyout-level-btn--active { border-color: var(--accent); color: var(--accent); }
#page-agents .ws-flyout-level-btn--draft { border-style: dashed; }
#page-agents .ws-flyout-field { margin-bottom: var(--space-2); font-size: 13px; }
#page-agents .ws-flyout-ref-list { font-size: 12px; color: var(--muted); }
#page-agents .ws-flyout-ref-item { padding: 2px 0; }
#page-agents .ws-flyout-error { color: var(--block); font-size: 12px; margin: 6px 0; }
#page-agents .ws-flyout-actions { margin-top: var(--space-4); display: flex; gap: 8px; }
#page-agents .ws-flyout-gem-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 12px; }
#page-agents .ws-flyout-field select[data-flyout-add-gem-select] { margin-right: 6px; }
#page-agents .ws-bag-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2); }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node /path/to/scratchpad/verify-flyout-embed.cjs skill-admin.html
```

Expected: `flyout active: 1`, `flyout width: 460px`, `JS errors: none`, exits 0.

Then run the full `agent-setup-demo` suite once more to confirm this task touched nothing it owns:

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: 182 checks, 0 failed, 0 JS errors (unchanged from Task 7 — this task never touches `agent-setup-demo/`).

- [ ] **Step 5: Commit**

```bash
git add skill-admin.html skill-admin/agent-setup-embed.css
git commit -m "feat(agent-setup-demo): wire flyout detail panel into the skill-admin.html embed"
```

---

## Self-Review Notes

- **Spec coverage:** 狀態二 header/等級按鈕列/寶石欄位/裝備欄位/動作列/鉛筆編輯/＋新增 (spec lines 107-114) → Tasks 2-7. ✕/Esc 收回面板 + `inert` (line 115) → Task 2. 書籤併入篩選 (line 116) → explicitly deferred, see Scope simplification. skill-admin embed → Task 8 (continuing the Phase 1/2 pattern of a dedicated embed-sync task).
- **Placeholder scan:** no TBD/TODO; every step has real code; Task 2's `renderBagDetailFlyout` intentionally renders `''` for create-mode until Task 7 fills it in — that's a real, tested intermediate state (create-mode isn't reachable until Task 7 wires its own trigger button), not a stubbed-out placeholder.
- **Type consistency:** `uiState.bagDetail` shape (`{kind, name, level, mode}`) is identical across every task that touches it (Tasks 2, 3, 6, 7). `wsGemReferences`/`wsEquipmentReferences` return shapes are used identically by Task 2 (display) and Task 6 (delete guard).
- **Review Focus:** all 5 lines have an owning task — delete-reference-guard → Task 6; kind/protocol lock → Task 4; duplicate/malformed name → Task 7; stale bagDetail state across item switches → Task 2 (`wsOpenBagDetail`/`wsSwitchBagDetailLevel` always reset `bagDetailEditing`/`bagDetailGemsDraft`/`bagDetailError`, exercised implicitly by every task's "open a different item" step, explicitly by Task 2's "a button under the dimmed+inert center pane does not fire" check which also covers item 5); `inert` verification → Task 2.
