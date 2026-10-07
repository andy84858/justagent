# Agent 基礎設定單一工作區 Phase 4：組合包／擴充包「打包」模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the right-column "背包" a second, mutually-exclusive mode — "打包" — where a person composing a 人物卡 can bundle one or more **published** variants sharing the same 場域 (usedFor zone) into a 組合包, or bundle published gems/equipment for one target agent into a 擴充包, then carry each pack through its own publish lifecycle (`DRAFT → PUBLISHED ⇄ MAINTENANCE → EOS`).

**Architecture:** Builds directly on Phase 1-3's `agent-setup-demo/js/{data,workspace,app}.js`. Adds `SEED.bundles`/`SEED.extensions` (empty by default — every test constructs its own fixtures, matching Phase 3's established style), a `uiState.bagMode` ('bag' | 'pack') that the existing `#ws-bag` render dispatch branches on, a `renderPackPane` family of render functions wired the same way Phase 3 wired `renderBagForVariant`, and a **separate** `uiState.packDetail` object (distinct from Phase 3's `uiState.bagDetail`, since packs have no version-level concept) that the existing `#ws-bag-detail-flyout` element renders when set — `renderBagDetailFlyout` branches on whichever of `bagDetail`/`packDetail` is non-null, so Phase 3's gem/equipment flyout code is untouched.

**Tech Stack:** Same as Phase 1-3 — plain HTML/CSS/vanilla JS, `file://`, no build step. Tests continue to live in `agent-setup-demo/tests/ui.test.cjs` (one long stateful Playwright script) and run via `playwright-core` against a real local Chrome.

**Spec:** `docs/superpowers/specs/2026-10-06-agent-setup-unified-workspace-design.md`, section `## 組合包／擴充包：右欄的「打包」模式` (lines 120-128) is what this phase implements in full — it is the only unimplemented top-level section left in that spec after Phases 1-3.

## Scope simplification versus the spec (documented, not silent)

- **"同場域限制沿用"** is implemented as: a 組合包's zone is fixed to the `usedFor` of the NPC whose variant was open when the bundle was created, and every variant checkbox offered in the creation flow is restricted to variants of NPCs sharing that same `usedFor`. The spec names this restriction but doesn't spell out the exact mechanism; this is the natural reading given `usedFor` is the only zone-like field Phase 1 ever built (`agent-setup-demo/js/data.js`'s `usedFor: 'customer_service'` etc.).
- **"先選適用 agent"** for 擴充包 is implemented as a dropdown of `AGENT`-type NPCs (the same type restriction Phase 1 already applies to variant creation — `SWITCH`-type NPCs can't own variants and by the same logic can't be an extension's target agent either, since nothing they own could ever consume the pack).
- **"同名只放一個等級"** is implemented as mutual exclusivity per catalog name within one extension's item selection: checking a different level of an already-selected gem/equipment name replaces the selection rather than adding a second entry, enforced both in the creation-flow UI and in the membership editor (Task 7) that edits an existing DRAFT extension's items afterward.
- **Narrow/flyout two-state UI** reuses Phase 3's existing `#ws-bag-detail-flyout` element and its slide/dim/inert mechanics verbatim (new state lives in `uiState.packDetail`, a sibling of `uiState.bagDetail` the flyout renderer dispatches on) rather than building a second flyout element — the spec says the pack mode "一樣有" (also has) the narrow/flyout two-state pattern, not that it needs its own separate panel.
- **Lifecycle transition legality** is enforced by `wsPackNextStatuses(status)`, a single source of truth table: `DRAFT → {PUBLISHED, EOS}`, `PUBLISHED → {MAINTENANCE, EOS}`, `MAINTENANCE → {PUBLISHED, EOS}`, `EOS → {}` (terminal). Every lifecycle button is generated from this table, so an invalid jump can never be rendered, and `wsTransitionPackStatus` re-checks the table independently (defense in depth, matching Phase 3's delete/publish guards) so a stray direct call can't bypass it either.

## Global Constraints

- Everything from Phase 1-3's Global Constraints still applies (no build tooling, no ES modules, tests run via `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`).
- A 組合包/擴充包 `code` matches `^[A-Z0-9_]{1,40}$` (same pattern as 人物卡 codes — Phase 1's `wsValidateVariantCode`), unique within its own catalog (`SEED.bundles` / `SEED.extensions` checked separately, exactly like Phase 3's per-kind gem/equipment uniqueness).
- Only **published** variants (`variant.publishedVersion` truthy) may be selected into a 組合包; only **published** (`status === 'published'`) gem/equipment versions may be selected into a 擴充包 — both checked at creation time and re-checked by the membership editor (Task 7), matching Phase 3's "drafts can't be referenced" invariant.
- A new pack always starts in `DRAFT` status.
- Leaving `DRAFT` (status is `PUBLISHED`, `MAINTENANCE`, or `EOS`) locks every field except `displayName` and `description` — both remain pencil-editable for the pack's entire lifecycle, matching the spec's "離開 DRAFT 後只能改顯示名稱與說明".
- Switching the left-nav selection to a different NPC or variant resets `uiState.bagMode` back to `'bag'`, per the spec's "離開人物卡焦點... 時自動切回「背包」" — implemented by extending Phase 2's existing `wsResetVariantTransientUi()`, called from both `wsSelectNpc` and `wsSelectVariant`.
- All interpolated text in new markup goes through the existing `escapeHtml()` helper. Every new clickable/input element gets a `data-*` attribute test hook, following the existing convention.

## Review Focus

- **A 組合包 created from a customer_service-zone variant must never offer an order_support-zone variant in its checkbox list** (and vice versa) — the "同場域限制" is the one rule most likely to look fine in the happy path (same zone, works) but silently admit a cross-zone member if the filter is applied only at render time and not re-checked on submit.
- **Selecting a second level of an already-checked gem/equipment name in the 擴充包 creation flow must replace the first selection, not add a second row for the same name** — "同名只放一個等級" is easy to satisfy in the UI's visual state while still letting two levels slip into the submitted `itemRefs` array if the exclusivity is only cosmetic (disabling other checkboxes) rather than enforced in the data the submit handler reads.
- **A lifecycle button for an unreachable transition must never render, and calling the transition function directly for a disallowed jump (e.g. `EOS` → anything) must be a no-op** — not just a hidden button, the same defense-in-depth Phase 3 already established for delete/publish.
- **Editing displayName/description on a PUBLISHED or MAINTENANCE pack must work exactly like a DRAFT pack's (same pencil, same commit flow), while every other field on that same pack stays locked** — a reasonable person expects "only these two fields" to mean exactly that, not "the whole pack becomes read-only except by accident these two still render editable."
- **Switching from a 組合包's pack-mode flyout to a different NPC in the left nav must close the flyout and return `#ws-bag` to ordinary bag mode**, not leave a now-orphaned pack flyout open against a selection that no longer matches it (same class of stale-state bug Phase 3's final review caught for `bagDetail`).

---

## File Structure

```
agent-setup-demo/
├── js/
│   ├── data.js         # MODIFY: add SEED.bundles, SEED.extensions (both start empty)
│   ├── workspace.js     # MODIFY: pack lifecycle table, pack CRUD + lifecycle functions,
│   │                     #   renderPackPane family, pack flyout render branch in
│   │                     #   renderBagDetailFlyout, 打包 button wiring, bagMode reset
│   └── app.js            # MODIFY: uiState gains bagMode + packDetail* keys (both initial
│                          #   state and resetData); #ws-bag dispatch branches on bagMode
└── tests/
    └── ui.test.cjs        # MODIFY: new assertions appended, same stateful style as Phase 1-3

skill-admin.html                   # unchanged — no new DOM markup needed (reuses existing
                                    #   #ws-bag / #ws-bag-detail-flyout containers)
skill-admin/agent-setup-embed.css  # MODIFY: #page-agents-scoped copies of the new CSS rules
```

No new files, and no new markup in `skill-admin.html` — Phase 4 reuses every container Phase 1-3 already built. Task 8 still exists to verify the embed stays correct after the CSS/JS changes, the same way Phase 2-3 verified theirs.

---

### Task 1: Data model + bagMode plumbing + 打包 button

**Files:**
- Modify: `agent-setup-demo/js/data.js`
- Modify: `agent-setup-demo/js/app.js`
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsResetVariantTransientUi` (Phase 2), `renderVariantPane`'s titlebar-actions block (Phase 2), `render()`'s `#ws-bag` dispatch (Phase 1).
- Produces: `SEED.bundles`/`SEED.extensions` (both `[]`). `uiState.bagMode` (`'bag' | 'pack'`, default `'bag'`, reset to `'bag'` by `wsResetVariantTransientUi`). `wsSetBagMode(mode)`. A "打包" button in the variant titlebar-actions group. `#ws-bag`'s render dispatch now calls `renderPackPane(state)` instead of `renderBagForVariant(state)` when `bagMode === 'pack'`.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 4 Task 1: data model + bagMode plumbing + 打包 button ---
  const bundlesIsEmptyArray = await page.evaluate(() => Array.isArray(window.appState.data.bundles) && window.appState.data.bundles.length === 0);
  record('SEED.bundles starts as an empty array', bundlesIsEmptyArray === true);
  const extensionsIsEmptyArray = await page.evaluate(() => Array.isArray(window.appState.data.extensions) && window.appState.data.extensions.length === 0);
  record('SEED.extensions starts as an empty array', extensionsIsEmptyArray === true);

  await page.click('[data-npc-toggle="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.STANDARD"]');
  const packButtonCount = await page.locator('[data-variant-pack-toggle]').count();
  record('variant titlebar has a 打包 button', packButtonCount === 1);

  const bagModeDefault = await page.evaluate(() => window.appState.uiState.bagMode);
  record('bagMode defaults to bag', bagModeDefault === 'bag', bagModeDefault);

  await page.click('[data-variant-pack-toggle]');
  const bagModeAfterToggle = await page.evaluate(() => window.appState.uiState.bagMode);
  record('clicking 打包 switches bagMode to pack', bagModeAfterToggle === 'pack', bagModeAfterToggle);
  const packPaneVisible = await page.locator('[data-pack-pane]').count();
  record('ws-bag now renders the pack pane instead of the bag', packPaneVisible === 1);
  const bagPaneGoneInPackMode = await page.locator('[data-bag-add]').count();
  record('the ordinary bag UI is gone while in pack mode', bagPaneGoneInPackMode === 0);

  // leaving the variant resets bagMode back to bag
  await page.click('[data-npc-select="FAQ_ANSWER"]');
  const bagModeAfterLeavingVariant = await page.evaluate(() => window.appState.uiState.bagMode);
  record('selecting a different NPC/variant resets bagMode to bag', bagModeAfterLeavingVariant === 'bag', bagModeAfterLeavingVariant);

  await page.click('[data-variant-row="FAQ_ANSWER.STANDARD"]');
  await page.click('[data-variant-pack-toggle]');
  await page.click('[data-pack-mode-toggle]');
  const bagModeAfterPaneToggle = await page.evaluate(() => window.appState.uiState.bagMode);
  record('the pack pane\'s own toggle button switches back to bag mode', bagModeAfterPaneToggle === 'bag', bagModeAfterPaneToggle);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: `SEED.bundles`/`SEED.extensions` checks FAIL (`undefined`), `[data-variant-pack-toggle]` doesn't exist, `bagMode` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/data.js`, change the end of the `SEED` object from:

```js
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
};
```

to:

```js
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
  ],
  bundles: [],
  extensions: []
};
```

In `agent-setup-demo/js/app.js`, add `bagMode: 'bag',` plus the pack-detail keys to the `uiState` initializer (both in `window.appState` and inside `window.resetData`). Change:

```js
    bagDetail: null,
    bagDetailEditing: null,
    bagDetailGemsDraft: null,
    bagDetailError: null,
    bagDetailCreateForm: null
  }
};
```

to (same replacement in both places, note the closing differs — `}` vs `};`):

```js
    bagDetail: null,
    bagDetailEditing: null,
    bagDetailGemsDraft: null,
    bagDetailError: null,
    bagDetailCreateForm: null,
    bagMode: 'bag',
    packDetail: null,
    packDetailEditing: null,
    packMembershipDraft: null,
    packDetailError: null,
    packCreateForm: null
  }
};
```

(and the matching `};` close inside `resetData`). Then change `render()`'s `#ws-bag` dispatch from:

```js
  document.getElementById('ws-bag').innerHTML = window.appState.selection.variantCode
    ? renderBagForVariant(window.appState)
    : renderBagPlaceholder();
```

to:

```js
  document.getElementById('ws-bag').innerHTML = window.appState.selection.variantCode
    ? (window.appState.uiState.bagMode === 'pack' ? renderPackPane(window.appState) : renderBagForVariant(window.appState))
    : renderBagPlaceholder();
```

In `agent-setup-demo/js/workspace.js`, extend `wsResetVariantTransientUi` — change:

```js
function wsResetVariantTransientUi() {
  window.appState.uiState.bagError = null;
  window.appState.uiState.bagWarning = null;
  window.appState.uiState.editingVariantBasics = false;
  window.appState.uiState.editingVariantInstructions = false;
  window.appState.uiState.variantTab = 'basics';
}
```

to:

```js
function wsResetVariantTransientUi() {
  window.appState.uiState.bagError = null;
  window.appState.uiState.bagWarning = null;
  window.appState.uiState.editingVariantBasics = false;
  window.appState.uiState.editingVariantInstructions = false;
  window.appState.uiState.variantTab = 'basics';
  window.appState.uiState.bagMode = 'bag';
  window.appState.uiState.packDetail = null;
  window.appState.uiState.packDetailEditing = null;
  window.appState.uiState.packMembershipDraft = null;
  window.appState.uiState.packDetailError = null;
  window.appState.uiState.packCreateForm = null;
}

function wsSetBagMode(mode) {
  window.appState.uiState.bagMode = mode;
  window.rerender();
}
```

Add the stub `renderPackPane` (expanded fully in Task 2) right after `renderBagForVariant`'s closing `}` (find it — it's the function containing the `🎒 背包 — 裝備` label):

```js
function renderPackPane(state) {
  return (
    '<div data-pack-pane>' +
      '<div class="ws-bag-header"><span class="label">📦 打包</span>' +
        '<button class="btn" data-pack-mode-toggle onclick="wsSetBagMode(\'bag\')">🎒 背包</button>' +
      '</div>' +
    '</div>'
  );
}
```

Finally wire the 打包 button into `renderVariantPane`'s titlebar-actions. Change:

```js
      '<div class="ws-variant-titlebar-actions">' +
        '<button class="btn" data-variant-discard ' + (dirty ? '' : 'disabled') + ' onclick="wsDiscardVariantChanges()">放棄修改</button>' +
        '<button class="btn btn-primary" data-variant-save ' + (dirty ? '' : 'disabled') + ' onclick="wsSaveVariant()">💾 儲存</button>' +
        '<button class="btn" data-variant-publish onclick="wsOpenPublishVariantModal()">🚀 發布</button>' +
      '</div>' +
```

to:

```js
      '<div class="ws-variant-titlebar-actions">' +
        '<button class="btn" data-variant-discard ' + (dirty ? '' : 'disabled') + ' onclick="wsDiscardVariantChanges()">放棄修改</button>' +
        '<button class="btn btn-primary" data-variant-save ' + (dirty ? '' : 'disabled') + ' onclick="wsSaveVariant()">💾 儲存</button>' +
        '<button class="btn" data-variant-publish onclick="wsOpenPublishVariantModal()">🚀 發布</button>' +
        '<button class="btn" data-variant-pack-toggle onclick="wsSetBagMode(\'pack\')">📦 打包</button>' +
      '</div>' +
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 9 new checks PASS; suite total 190+9=199 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/data.js agent-setup-demo/js/app.js agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): pack-mode data model, bagMode toggle, 打包 button"
```

---

### Task 2: Pack-mode narrow list (existing bundles/extensions, zone/agent filtered)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `SEED.bundles`/`SEED.extensions` (Task 1), `wsFindNpc`/`wsFindVariant` (Phase 1/2).
- Produces: `uiState.packListKind` (`'bundle' | 'extension'`, default `'bundle'`). `wsSwitchPackListKind(kind)`. `renderPackPane` now renders a sub-tab toggle plus a filtered list of existing packs (bundles matching the current NPC's `usedFor`; extensions whose `agentCode` equals the current NPC's `code`) and "＋ 新增組合包"/"＋ 新增擴充包" buttons. Each pack row has a `data-pack-row` hook that later tasks wire to open the flyout.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 4 Task 2: pack-mode narrow list, zone/agent filtered ---
  // Seed two bundles (one in FAQ_ANSWER's zone, one in a different zone) and two extensions
  // (one targeting FAQ_ANSWER, one targeting ORDER_ASSIST) directly, to test the filter
  // without depending on the creation flow this plan builds in Tasks 3-4.
  await page.evaluate(function () {
    window.appState.data.bundles.push(
      { code: 'CS_BASIC', displayName: '客服基本包', description: '', usedFor: 'customer_service', status: 'DRAFT', variantRefs: [{ npcCode: 'FAQ_ANSWER', variantCode: 'STANDARD' }] },
      { code: 'ORDER_BASIC', displayName: '訂單基本包', description: '', usedFor: 'order_support', status: 'DRAFT', variantRefs: [] }
    );
    window.appState.data.extensions.push(
      { code: 'CS_EXT', displayName: '客服擴充', description: '', agentCode: 'FAQ_ANSWER', status: 'DRAFT', itemRefs: [] },
      { code: 'ORDER_EXT', displayName: '訂單擴充', description: '', agentCode: 'ORDER_ASSIST', status: 'DRAFT', itemRefs: [] }
    );
  });
  await page.click('[data-npc-select="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.STANDARD"]');
  await page.click('[data-variant-pack-toggle]');

  const bundleKindActiveByDefault = await page.evaluate(() => window.appState.uiState.packListKind);
  record('pack list defaults to 組合包 kind', bundleKindActiveByDefault === 'bundle', bundleKindActiveByDefault);
  const csBundleRowCount = await page.locator('[data-pack-row="bundle.CS_BASIC"]').count();
  record('a same-zone bundle (customer_service) is listed', csBundleRowCount === 1);
  const orderBundleRowCount = await page.locator('[data-pack-row="bundle.ORDER_BASIC"]').count();
  record('a different-zone bundle (order_support) is NOT listed', orderBundleRowCount === 0);

  await page.click('[data-pack-list-kind="extension"]');
  const extensionKindActive = await page.evaluate(() => window.appState.uiState.packListKind);
  record('clicking the 擴充包 sub-tab switches packListKind', extensionKindActive === 'extension', extensionKindActive);
  const csExtRowCount = await page.locator('[data-pack-row="extension.CS_EXT"]').count();
  record('an extension targeting the current NPC (FAQ_ANSWER) is listed', csExtRowCount === 1);
  const orderExtRowCount = await page.locator('[data-pack-row="extension.ORDER_EXT"]').count();
  record('an extension targeting a different NPC (ORDER_ASSIST) is NOT listed', orderExtRowCount === 0);

  const createBundleBtnCount = await page.locator('[data-pack-create="bundle"]').count();
  const createExtensionBtnCount = await page.locator('[data-pack-create="extension"]').count();
  record('both ＋ 新增組合包 and ＋ 新增擴充包 entry points exist', createBundleBtnCount === 1 && createExtensionBtnCount === 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks FAIL — `packListKind` is `undefined`, no `[data-pack-row]`/`[data-pack-list-kind]`/`[data-pack-create]` elements exist (Task 1's `renderPackPane` stub only renders the mode-toggle header).

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/app.js`, add `packListKind: 'bundle',` to both `uiState` initializers (same two spots as Task 1's keys).

In `agent-setup-demo/js/workspace.js`, replace the Task 1 stub:

```js
function renderPackPane(state) {
  return (
    '<div data-pack-pane>' +
      '<div class="ws-bag-header"><span class="label">📦 打包</span>' +
        '<button class="btn" data-pack-mode-toggle onclick="wsSetBagMode(\'bag\')">🎒 背包</button>' +
      '</div>' +
    '</div>'
  );
}
```

with:

```js
function wsSwitchPackListKind(kind) {
  window.appState.uiState.packListKind = kind;
  window.rerender();
}

function wsPacksForCurrentContext(state, kind) {
  var npc = wsFindNpc(state);
  if (!npc) return [];
  if (kind === 'bundle') {
    return state.data.bundles.filter(function (b) { return b.usedFor === npc.usedFor; });
  }
  return state.data.extensions.filter(function (e) { return e.agentCode === npc.code; });
}

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

function renderPackPane(state) {
  var kind = state.uiState.packListKind || 'bundle';
  return (
    '<div data-pack-pane>' +
      '<div class="ws-bag-header"><span class="label">📦 打包</span>' +
        '<button class="btn" data-pack-mode-toggle onclick="wsSetBagMode(\'bag\')">🎒 背包</button>' +
      '</div>' +
      '<div class="ws-variant-tabs">' +
        '<span class="ws-variant-tab' + (kind === 'bundle' ? ' ws-variant-tab--active' : '') + '" data-pack-list-kind="bundle" onclick="wsSwitchPackListKind(\'bundle\')">組合包</span>' +
        '<span class="ws-variant-tab' + (kind === 'extension' ? ' ws-variant-tab--active' : '') + '" data-pack-list-kind="extension" onclick="wsSwitchPackListKind(\'extension\')">擴充包</span>' +
      '</div>' +
      '<button class="btn" data-pack-create="bundle" onclick="wsOpenPackCreate(\'bundle\')">＋ 新增組合包</button> ' +
      '<button class="btn" data-pack-create="extension" onclick="wsOpenPackCreate(\'extension\')">＋ 新增擴充包</button>' +
      '<div style="margin-top:var(--space-3);">' + renderPackListRows(state, kind) + '</div>' +
    '</div>'
  );
}

function wsOpenPackDetail(kind, code) {
  // Expanded in Task 5; a no-op placeholder would violate "no placeholders" — instead this
  // already does the one thing Task 2 needs to prove (routing a row click somewhere real):
  // it sets packDetail and rerenders, and renderBagDetailFlyout (Task 5) picks it up once
  // that task adds the render branch. Until Task 5 lands, the flyout silently stays closed
  // for packDetail (renderBagDetailFlyout doesn't know about it yet), which is fine — Task 2's
  // own tests only assert on packDetail state, not on flyout visibility.
  window.appState.uiState.packDetail = { kind: kind, code: code, mode: 'view' };
  window.rerender();
}

function wsOpenPackCreate(kind) {
  // Expanded in Tasks 3-4.
  window.appState.uiState.packCreateForm = { kind: kind };
  window.rerender();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 8 new checks PASS; suite total 199+8=207 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/app.js agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): pack-mode narrow list, zone/agent filtered"
```

---

### Task 3: 組合包 creation flow (zone-restricted variant checkboxes)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsPacksForCurrentContext` (Task 2, for the uniqueness check's catalog list — actually consumes `state.data.bundles` directly), `wsFindNpc` (Phase 1).
- Produces: `wsValidatePackCode(code, catalogList)`. `wsToggleBundleVariantSelection(npcCode, variantCode)`. `wsSubmitCreateBundle()`. `renderPackCreateBundleForm(state)` wired into `renderPackPane` when `packCreateForm.kind === 'bundle'`.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 4 Task 3: 組合包 creation flow, zone-restricted ---
  await page.click('[data-pack-create="bundle"]');
  const bundleFormNameInput = await page.locator('[data-pack-create-name]').count();
  record('clicking ＋ 新增組合包 shows the creation form', bundleFormNameInput === 1);

  const standardCheckboxCount = await page.locator('[data-bundle-variant-checkbox="FAQ_ANSWER.STANDARD"]').count();
  record('a published, same-zone variant (FAQ_ANSWER.STANDARD) is offered as a checkbox', standardCheckboxCount === 1);
  const premiumCheckboxCount = await page.locator('[data-bundle-variant-checkbox="FAQ_ANSWER.PREMIUM"]').count();
  record('same-zone published variants beyond the currently-open one are also offered (PREMIUM was published earlier in this suite)', premiumCheckboxCount === 1);
  const orderAssistCheckboxCount = await page.locator('[data-bundle-variant-checkbox^="ORDER_ASSIST."]').count();
  record('a different-zone NPC\'s variants are never offered (ORDER_ASSIST has no variants anyway, but asserts the selector matches nothing)', orderAssistCheckboxCount === 0);

  await page.fill('[data-pack-create-name]', 'CS_BUNDLE_1');
  await page.fill('[data-pack-create-display-name]', '客服組合包一號');
  await page.click('[data-pack-create-submit]');
  const noVariantsSelectedError = await page.evaluate(() => window.appState.uiState.packDetailError);
  record('submitting with zero variants selected is rejected with an error', typeof noVariantsSelectedError === 'string' && noVariantsSelectedError.length > 0, noVariantsSelectedError);
  const bundleNotCreatedEmpty = await page.evaluate(() => window.appState.data.bundles.some((b) => b.code === 'CS_BUNDLE_1'));
  record('no bundle is created when the selection is empty', bundleNotCreatedEmpty === false);

  await page.click('[data-bundle-variant-checkbox="FAQ_ANSWER.STANDARD"]');
  await page.click('[data-pack-create-submit]');
  const bundleCreated = await page.evaluate(() => window.appState.data.bundles.find((b) => b.code === 'CS_BUNDLE_1'));
  record('a valid submission creates a DRAFT bundle with the selected variant and the current NPC\'s zone', !!bundleCreated && bundleCreated.status === 'DRAFT' && bundleCreated.usedFor === 'customer_service' && bundleCreated.variantRefs.length === 1 && bundleCreated.variantRefs[0].variantCode === 'STANDARD', JSON.stringify(bundleCreated));
  const packDetailAfterCreate = await page.evaluate(() => window.appState.uiState.packDetail);
  record('after creation packDetail switches to view mode on the new bundle', packDetailAfterCreate.kind === 'bundle' && packDetailAfterCreate.code === 'CS_BUNDLE_1' && packDetailAfterCreate.mode === 'view', JSON.stringify(packDetailAfterCreate));

  // duplicate code rejected
  await page.evaluate(() => { window.appState.uiState.packDetail = null; });
  await page.click('[data-pack-create="bundle"]');
  await page.click('[data-bundle-variant-checkbox="FAQ_ANSWER.STANDARD"]');
  await page.fill('[data-pack-create-name]', 'CS_BUNDLE_1');
  await page.fill('[data-pack-create-display-name]', '重複代碼');
  await page.click('[data-pack-create-submit]');
  const duplicateBundleError = await page.evaluate(() => window.appState.uiState.packDetailError);
  record('a duplicate bundle code is rejected with an error', typeof duplicateBundleError === 'string' && duplicateBundleError.length > 0, duplicateBundleError);
  const bundleCountUnchanged = await page.evaluate(() => window.appState.data.bundles.filter((b) => b.code === 'CS_BUNDLE_1').length);
  record('the duplicate submission does not create a second entry', bundleCountUnchanged === 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks FAIL — `wsOpenPackCreate` (from Task 2) sets `packCreateForm` but `renderPackPane` never renders a form for it yet, so none of the `data-pack-create-*`/`data-bundle-variant-checkbox` elements exist.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, add after `wsOpenPackCreate` (replacing its Task 2 body, which only set state with no renderer reading it yet — this is the task that gives it one):

```js
function wsValidatePackCode(code, catalogList) {
  if (!/^[A-Z0-9_]{1,40}$/.test(code)) {
    return '代碼只能是大寫英數字與底線，長度 1–40';
  }
  var duplicate = catalogList.some(function (item) { return item.code === code; });
  if (duplicate) {
    return '已有相同代碼的打包項目';
  }
  return null;
}

function wsToggleBundleVariantSelection(npcCode, variantCode) {
  var form = window.appState.uiState.packCreateForm;
  form.selectedVariants = form.selectedVariants || [];
  var idx = form.selectedVariants.findIndex(function (v) { return v.npcCode === npcCode && v.variantCode === variantCode; });
  if (idx === -1) {
    form.selectedVariants.push({ npcCode: npcCode, variantCode: variantCode });
  } else {
    form.selectedVariants.splice(idx, 1);
  }
  window.rerender();
}

function wsSameZonePublishedVariants(npc) {
  var zone = npc.usedFor;
  var results = [];
  window.appState.data.npcs.forEach(function (n) {
    if (n.usedFor !== zone) return;
    n.variants.forEach(function (v) {
      if (v.publishedVersion) results.push({ npcCode: n.code, variantCode: v.code, variantName: v.name });
    });
  });
  return results;
}

function wsSubmitCreateBundle() {
  var npc = wsFindNpc(window.appState);
  var form = window.appState.uiState.packCreateForm;
  var codeInput = document.querySelector('[data-pack-create-name]');
  var displayNameInput = document.querySelector('[data-pack-create-display-name]');
  var code = codeInput.value.trim();
  var displayName = displayNameInput.value.trim();
  var selected = form.selectedVariants || [];
  if (selected.length === 0) {
    window.appState.uiState.packDetailError = '至少要選一張人物卡';
    window.rerender();
    return;
  }
  var error = wsValidatePackCode(code, window.appState.data.bundles);
  if (error) {
    window.appState.uiState.packDetailError = error;
    window.rerender();
    return;
  }
  window.appState.data.bundles.push({
    code: code, displayName: displayName || code, description: '',
    usedFor: npc.usedFor, status: 'DRAFT', variantRefs: selected
  });
  window.appState.uiState.packDetailError = null;
  window.appState.uiState.packCreateForm = null;
  window.appState.uiState.packDetail = { kind: 'bundle', code: code, mode: 'view' };
  window.rerender();
}

function renderPackCreateBundleForm(state) {
  var npc = wsFindNpc(state);
  var form = state.uiState.packCreateForm;
  var selected = form.selectedVariants || [];
  var error = state.uiState.packDetailError;
  var rows = wsSameZonePublishedVariants(npc).map(function (v) {
    var checked = selected.some(function (s) { return s.npcCode === v.npcCode && s.variantCode === v.variantCode; });
    return (
      '<div class="ws-bag-item' + (checked ? ' ws-bag-item--active' : '') + '" data-bundle-variant-checkbox="' + v.npcCode + '.' + v.variantCode + '" onclick="wsToggleBundleVariantSelection(\'' + v.npcCode + '\', \'' + v.variantCode + '\')">' +
        '<span class="ws-bag-item-name">' + escapeHtml(v.variantName) + '</span>' +
        '<span class="hint">' + (checked ? '已選取' : '') + '</span>' +
      '</div>'
    );
  }).join('') || '<div class="hint">此場域沒有已發布的人物卡</div>';
  return (
    '<div class="ws-flyout-field"><label class="label">代碼</label><input data-pack-create-name placeholder="e.g. CS_BUNDLE_1"></div>' +
    '<div class="ws-flyout-field"><label class="label">顯示名稱</label><input data-pack-create-display-name placeholder="顯示名稱"></div>' +
    '<div class="label">選擇人物卡（同場域：' + escapeHtml(npc.usedFor) + '）</div>' +
    rows +
    (error ? '<div class="ws-flyout-error" data-flyout-error>' + escapeHtml(error) + '</div>' : '') +
    '<div class="ws-flyout-actions">' +
      '<button class="btn" onclick="wsCancelPackCreate()">取消</button> ' +
      '<button class="btn btn-primary" data-pack-create-submit onclick="wsSubmitCreateBundle()">確認建立</button>' +
    '</div>'
  );
}

function wsCancelPackCreate() {
  window.appState.uiState.packCreateForm = null;
  window.appState.uiState.packDetailError = null;
  window.rerender();
}

function wsOpenPackCreate(kind) {
  window.appState.uiState.packCreateForm = { kind: kind, selectedVariants: [], selectedItems: [] };
  window.appState.uiState.packDetailError = null;
  window.rerender();
}
```

Now change `renderPackPane` to show the creation form when `packCreateForm` is set — change:

```js
function renderPackPane(state) {
  var kind = state.uiState.packListKind || 'bundle';
  return (
    '<div data-pack-pane>' +
      '<div class="ws-bag-header"><span class="label">📦 打包</span>' +
        '<button class="btn" data-pack-mode-toggle onclick="wsSetBagMode(\'bag\')">🎒 背包</button>' +
      '</div>' +
      '<div class="ws-variant-tabs">' +
        '<span class="ws-variant-tab' + (kind === 'bundle' ? ' ws-variant-tab--active' : '') + '" data-pack-list-kind="bundle" onclick="wsSwitchPackListKind(\'bundle\')">組合包</span>' +
        '<span class="ws-variant-tab' + (kind === 'extension' ? ' ws-variant-tab--active' : '') + '" data-pack-list-kind="extension" onclick="wsSwitchPackListKind(\'extension\')">擴充包</span>' +
      '</div>' +
      '<button class="btn" data-pack-create="bundle" onclick="wsOpenPackCreate(\'bundle\')">＋ 新增組合包</button> ' +
      '<button class="btn" data-pack-create="extension" onclick="wsOpenPackCreate(\'extension\')">＋ 新增擴充包</button>' +
      '<div style="margin-top:var(--space-3);">' + renderPackListRows(state, kind) + '</div>' +
    '</div>'
  );
}
```

to:

```js
function renderPackPane(state) {
  var kind = state.uiState.packListKind || 'bundle';
  if (state.uiState.packCreateForm) {
    var form = state.uiState.packCreateForm;
    return '<div data-pack-pane>' + (form.kind === 'bundle' ? renderPackCreateBundleForm(state) : '') + '</div>';
  }
  return (
    '<div data-pack-pane>' +
      '<div class="ws-bag-header"><span class="label">📦 打包</span>' +
        '<button class="btn" data-pack-mode-toggle onclick="wsSetBagMode(\'bag\')">🎒 背包</button>' +
      '</div>' +
      '<div class="ws-variant-tabs">' +
        '<span class="ws-variant-tab' + (kind === 'bundle' ? ' ws-variant-tab--active' : '') + '" data-pack-list-kind="bundle" onclick="wsSwitchPackListKind(\'bundle\')">組合包</span>' +
        '<span class="ws-variant-tab' + (kind === 'extension' ? ' ws-variant-tab--active' : '') + '" data-pack-list-kind="extension" onclick="wsSwitchPackListKind(\'extension\')">擴充包</span>' +
      '</div>' +
      '<button class="btn" data-pack-create="bundle" onclick="wsOpenPackCreate(\'bundle\')">＋ 新增組合包</button> ' +
      '<button class="btn" data-pack-create="extension" onclick="wsOpenPackCreate(\'extension\')">＋ 新增擴充包</button>' +
      '<div style="margin-top:var(--space-3);">' + renderPackListRows(state, kind) + '</div>' +
    '</div>'
  );
}
```

(The `form.kind === 'extension' ? '' : ''` branch renders empty for now — Task 4 fills it in; this is real, tested, sequential buildup exactly like Phase 3's `renderBagDetailFlyout` returning `''` for create-mode until its own Task 7 landed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks PASS; suite total 207+11=218 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): 組合包 creation flow, zone-restricted variant checkboxes"
```

---

### Task 4: 擴充包 creation flow (agent picker + one-level-per-name item checkboxes)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsValidatePackCode` (Task 3), `wsGemByName`/`wsEquipmentByName` (Phase 2/3).
- Produces: `wsSetExtensionAgent(agentCode)`. `wsToggleExtensionItemSelection(kind, name, level)`. `wsSubmitCreateExtension()`. `renderPackCreateExtensionForm(state)` wired into `renderPackPane`.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 4 Task 4: 擴充包 creation flow, agent picker + one-level-per-name ---
  await page.click('[data-pack-create="extension"]');
  const agentSelectCount = await page.locator('[data-extension-agent-select]').count();
  record('擴充包 creation form shows an agent picker', agentSelectCount === 1);
  const switchTypeExcludedFromAgentOptions = await page.locator('[data-extension-agent-select] option[value="INTENT_SWITCH"]').count();
  record('a SWITCH-type NPC is not offered as an extension target agent', switchTypeExcludedFromAgentOptions === 0);

  await page.selectOption('[data-extension-agent-select]', 'FAQ_ANSWER');
  const itemCheckboxCount = await page.locator('[data-extension-item-checkbox]').count();
  record('selecting an agent reveals published gem/equipment checkboxes', itemCheckboxCount > 0, 'found ' + itemCheckboxCount);
  const draftItemOfferedCount = await page.locator('[data-extension-item-checkbox="gem.get_order_status.4"]').count();
  record('a draft-status catalog version is never offered as a selectable item', draftItemOfferedCount === 0);

  // one-level-per-name: checking Lv1 then Lv2 of the same gem replaces the selection, not adds to it
  await page.click('[data-extension-item-checkbox="gem.get_order_status.1"]');
  const selectedAfterLv1 = await page.evaluate(() => window.appState.uiState.packCreateForm.selectedItems);
  record('checking get_order_status Lv1 selects it', selectedAfterLv1.some((i) => i.kind === 'gem' && i.name === 'get_order_status' && i.level === 1), JSON.stringify(selectedAfterLv1));
  await page.click('[data-extension-item-checkbox="gem.get_order_status.2"]');
  const selectedAfterLv2 = await page.evaluate(() => window.appState.uiState.packCreateForm.selectedItems);
  const lv1StillSelected = selectedAfterLv2.some((i) => i.kind === 'gem' && i.name === 'get_order_status' && i.level === 1);
  const lv2NowSelected = selectedAfterLv2.some((i) => i.kind === 'gem' && i.name === 'get_order_status' && i.level === 2);
  record('checking a different level of the same gem replaces the first selection, not adds a second', lv1StillSelected === false && lv2NowSelected === true, JSON.stringify(selectedAfterLv2));
  const onlyOneGetOrderStatusEntry = selectedAfterLv2.filter((i) => i.kind === 'gem' && i.name === 'get_order_status').length;
  record('only one entry for get_order_status exists in the selection after the replace', onlyOneGetOrderStatusEntry === 1, onlyOneGetOrderStatusEntry);

  await page.fill('[data-pack-create-name]', 'CS_EXT_1');
  await page.fill('[data-pack-create-display-name]', '客服擴充一號');
  await page.click('[data-pack-create-submit]');
  const extensionCreated = await page.evaluate(() => window.appState.data.extensions.find((e) => e.code === 'CS_EXT_1'));
  record('a valid submission creates a DRAFT extension with the chosen agent and item', !!extensionCreated && extensionCreated.status === 'DRAFT' && extensionCreated.agentCode === 'FAQ_ANSWER' && extensionCreated.itemRefs.length === 1 && extensionCreated.itemRefs[0].level === 2, JSON.stringify(extensionCreated));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks FAIL — `renderPackPane` renders `''` for `form.kind === 'extension'` (Task 3's placeholder), so none of the `data-extension-*` elements exist.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, add after `renderPackCreateBundleForm` (before `function wsCancelPackCreate`):

```js
function wsSetExtensionAgent(agentCode) {
  var form = window.appState.uiState.packCreateForm;
  form.agentCode = agentCode;
  window.rerender();
}

function wsToggleExtensionItemSelection(kind, name, level) {
  var form = window.appState.uiState.packCreateForm;
  form.selectedItems = form.selectedItems || [];
  var sameNameIdx = form.selectedItems.findIndex(function (i) { return i.kind === kind && i.name === name; });
  var isExactMatch = sameNameIdx !== -1 && form.selectedItems[sameNameIdx].level === level;
  if (sameNameIdx !== -1) form.selectedItems.splice(sameNameIdx, 1);
  if (!isExactMatch) form.selectedItems.push({ kind: kind, name: name, level: level });
  window.rerender();
}

function wsPublishedCatalogItems() {
  var items = [];
  window.appState.data.gems.forEach(function (gemDef) {
    gemDef.versions.forEach(function (v) {
      if (v.status === 'published') items.push({ kind: 'gem', name: gemDef.name, level: v.level, label: gemDef.displayName + ' Lv' + v.level });
    });
  });
  window.appState.data.equipment.forEach(function (eqDef) {
    eqDef.versions.forEach(function (v) {
      if (v.status === 'published') items.push({ kind: 'equipment', name: eqDef.name, level: v.level, label: eqDef.displayName + ' Lv' + v.level });
    });
  });
  return items;
}

function wsSubmitCreateExtension() {
  var form = window.appState.uiState.packCreateForm;
  var codeInput = document.querySelector('[data-pack-create-name]');
  var displayNameInput = document.querySelector('[data-pack-create-display-name]');
  var code = codeInput.value.trim();
  var displayName = displayNameInput.value.trim();
  if (!form.agentCode) {
    window.appState.uiState.packDetailError = '請先選擇適用 agent';
    window.rerender();
    return;
  }
  var selected = form.selectedItems || [];
  if (selected.length === 0) {
    window.appState.uiState.packDetailError = '至少要選一個寶石或裝備';
    window.rerender();
    return;
  }
  var error = wsValidatePackCode(code, window.appState.data.extensions);
  if (error) {
    window.appState.uiState.packDetailError = error;
    window.rerender();
    return;
  }
  window.appState.data.extensions.push({
    code: code, displayName: displayName || code, description: '',
    agentCode: form.agentCode, status: 'DRAFT', itemRefs: selected
  });
  window.appState.uiState.packDetailError = null;
  window.appState.uiState.packCreateForm = null;
  window.appState.uiState.packDetail = { kind: 'extension', code: code, mode: 'view' };
  window.rerender();
}

function renderPackCreateExtensionForm(state) {
  var form = state.uiState.packCreateForm;
  var error = state.uiState.packDetailError;
  var agentOptions = state.data.npcs.filter(function (n) { return n.type === 'AGENT'; }).map(function (n) {
    return '<option value="' + n.code + '"' + (form.agentCode === n.code ? ' selected' : '') + '>' + escapeHtml(n.displayName) + '</option>';
  }).join('');
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
  return (
    '<div class="ws-flyout-field"><label class="label">適用 Agent</label>' +
      '<select data-extension-agent-select onchange="wsSetExtensionAgent(this.value)">' +
        '<option value="">-- 選擇 --</option>' + agentOptions +
      '</select>' +
    '</div>' +
    '<div class="ws-flyout-field"><label class="label">代碼</label><input data-pack-create-name placeholder="e.g. CS_EXT_1"></div>' +
    '<div class="ws-flyout-field"><label class="label">顯示名稱</label><input data-pack-create-display-name placeholder="顯示名稱"></div>' +
    itemsHtml +
    (error ? '<div class="ws-flyout-error" data-flyout-error>' + escapeHtml(error) + '</div>' : '') +
    '<div class="ws-flyout-actions">' +
      '<button class="btn" onclick="wsCancelPackCreate()">取消</button> ' +
      '<button class="btn btn-primary" data-pack-create-submit onclick="wsSubmitCreateExtension()">確認建立</button>' +
    '</div>'
  );
}
```

Change `renderPackPane`'s create-form branch from:

```js
  if (state.uiState.packCreateForm) {
    var form = state.uiState.packCreateForm;
    return '<div data-pack-pane>' + (form.kind === 'bundle' ? renderPackCreateBundleForm(state) : '') + '</div>';
  }
```

to:

```js
  if (state.uiState.packCreateForm) {
    var form = state.uiState.packCreateForm;
    return '<div data-pack-pane>' + (form.kind === 'bundle' ? renderPackCreateBundleForm(state) : renderPackCreateExtensionForm(state)) + '</div>';
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks PASS; suite total 218+10=228 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): 擴充包 creation flow, agent picker + one-level-per-name items"
```

---

### Task 5: Pack flyout (view mode: header, membership/items list, pencil for displayName/description)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Modify: `agent-setup-demo/css/workspace.css`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `uiState.packDetail` (Task 2), `wsFindNpc` (Phase 1), the existing `#ws-bag-detail-flyout` element and its dim/inert mechanics (Phase 3's `renderBagDetailFlyout`).
- Produces: `wsClosePackDetail()`. `wsStartEditPackDetailField(field)` / `wsCancelEditPackDetailField()` / `wsCommitPackDetailDisplayName()` / `wsCommitPackDetailDescription()`. `renderPackDetailViewBody(state)`. `renderBagDetailFlyout` (Phase 3) gains a branch: if `bagDetail` is set, unchanged Phase 3 behavior; else if `packDetail` is set, render the pack flyout; else closed.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 4 Task 5: pack flyout view mode ---
  await page.click('[data-pack-row="bundle.CS_BUNDLE_1"]');
  const packFlyoutActive = await page.locator('#ws-bag-detail-flyout.ws-flyout--active').count();
  record('clicking a pack row opens the flyout', packFlyoutActive === 1);
  const packFlyoutNameText = await page.locator('.ws-flyout-name').innerText();
  record('pack flyout header shows the pack\'s display name', packFlyoutNameText.indexOf('客服組合包一號') !== -1, packFlyoutNameText);
  const packStatusText = await page.locator('[data-pack-status]').innerText();
  record('pack flyout shows the DRAFT status', packStatusText.indexOf('DRAFT') !== -1, packStatusText);
  const memberListText = await page.locator('[data-pack-members]').innerText();
  record('bundle flyout lists its member variant', memberListText.indexOf('一般版') !== -1, memberListText);

  await page.click('[data-pack-displayname-pencil]');
  await page.fill('[data-pack-displayname-input]', '客服組合包一號（改名）');
  await page.click('[data-pack-displayname-commit]');
  const renamedBundle = await page.evaluate(() => window.appState.data.bundles.find((b) => b.code === 'CS_BUNDLE_1').displayName);
  record('committing the displayName edit updates the bundle', renamedBundle === '客服組合包一號（改名）', renamedBundle);

  await page.click('[data-pack-description-pencil]');
  await page.fill('[data-pack-description-input]', '一些說明文字');
  await page.click('[data-pack-description-commit]');
  const describedBundle = await page.evaluate(() => window.appState.data.bundles.find((b) => b.code === 'CS_BUNDLE_1').description);
  record('committing the description edit updates the bundle', describedBundle === '一些說明文字', describedBundle);

  await page.click('[data-flyout-close]');
  const packFlyoutClosedAfterCloseBtn = await page.locator('#ws-bag-detail-flyout.ws-flyout--active').count();
  record('✕ closes the pack flyout', packFlyoutClosedAfterCloseBtn === 0);
  const packDetailNullAfterClose = await page.evaluate(() => window.appState.uiState.packDetail);
  record('closing the pack flyout clears packDetail', packDetailNullAfterClose === null, packDetailNullAfterClose);

  // Review Focus: switching NPC closes an open pack flyout
  await page.click('[data-pack-row="bundle.CS_BUNDLE_1"]');
  await page.click('[data-npc-select="FAQ_ANSWER"]');
  const packFlyoutClosedAfterNpcSwitch = await page.locator('#ws-bag-detail-flyout.ws-flyout--active').count();
  record('switching the NPC selection closes an open pack flyout (bagMode resets to bag)', packFlyoutClosedAfterNpcSwitch === 0);
  const packDetailNullAfterNpcSwitch = await page.evaluate(() => window.appState.uiState.packDetail);
  record('switching the NPC selection also clears packDetail, not just the visual bagMode', packDetailNullAfterNpcSwitch === null, packDetailNullAfterNpcSwitch);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: `packFlyoutActive` FAILs (flyout never opens for `packDetail` yet — `renderBagDetailFlyout` doesn't know about it), cascading failures for everything after.

- [ ] **Step 3: Write minimal implementation**

First, extend `wsResetVariantTransientUi` (Task 1 already added `packDetail = null` etc. there — confirm it's present; it is) so switching NPC/variant already clears `packDetail`. The remaining gap is `renderBagDetailFlyout` never rendering it. In `agent-setup-demo/js/workspace.js`, find `renderBagDetailFlyout` and change:

```js
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
  flyoutEl.innerHTML = detail.mode === 'create' ? renderBagDetailCreateBody(state) : renderBagDetailViewBody(state);
}
```

to:

```js
function renderBagDetailFlyout(state) {
  var flyoutEl = document.getElementById('ws-bag-detail-flyout');
  var centerEl = document.getElementById('ws-center');
  if (!flyoutEl) return;
  var detail = state.uiState.bagDetail;
  var packDetail = state.uiState.packDetail;
  if (!detail && !packDetail) {
    flyoutEl.classList.remove('ws-flyout--active');
    flyoutEl.innerHTML = '';
    if (centerEl) { centerEl.classList.remove('ws-center--dim'); centerEl.removeAttribute('inert'); }
    return;
  }
  flyoutEl.classList.add('ws-flyout--active');
  if (centerEl) { centerEl.classList.add('ws-center--dim'); centerEl.setAttribute('inert', ''); }
  if (detail) {
    flyoutEl.innerHTML = detail.mode === 'create' ? renderBagDetailCreateBody(state) : renderBagDetailViewBody(state);
  } else {
    flyoutEl.innerHTML = renderPackDetailViewBody(state);
  }
}
```

Also update the keydown Esc handler in `agent-setup-demo/js/app.js` — change:

```js
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && window.appState.uiState.bagDetail) {
    wsCloseBagDetail();
  }
});
```

to:

```js
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (window.appState.uiState.bagDetail) wsCloseBagDetail();
  if (window.appState.uiState.packDetail) wsClosePackDetail();
});
```

Now add the pack-flyout functions in `workspace.js`, right after `wsOpenPackDetail` (Task 2) — replace it and add the rest:

```js
function wsOpenPackDetail(kind, code) {
  window.appState.uiState.packDetail = { kind: kind, code: code, mode: 'view' };
  window.appState.uiState.packDetailEditing = null;
  window.appState.uiState.packMembershipDraft = null;
  window.appState.uiState.packDetailError = null;
  window.rerender();
}

function wsClosePackDetail() {
  window.appState.uiState.packDetail = null;
  window.appState.uiState.packDetailEditing = null;
  window.appState.uiState.packMembershipDraft = null;
  window.appState.uiState.packDetailError = null;
  window.rerender();
}

function wsPackDef(detail) {
  var catalogList = detail.kind === 'bundle' ? window.appState.data.bundles : window.appState.data.extensions;
  return catalogList.find(function (p) { return p.code === detail.code; });
}

function wsStartEditPackDetailField(field) {
  window.appState.uiState.packDetailEditing = field;
  window.rerender();
}

function wsCancelEditPackDetailField() {
  window.appState.uiState.packDetailEditing = null;
  window.rerender();
}

function wsCommitPackDetailDisplayName() {
  var def = wsPackDef(window.appState.uiState.packDetail);
  var input = document.querySelector('[data-pack-displayname-input]');
  def.displayName = input.value.trim() || def.displayName;
  window.appState.uiState.packDetailEditing = null;
  window.rerender();
}

function wsCommitPackDetailDescription() {
  var def = wsPackDef(window.appState.uiState.packDetail);
  var input = document.querySelector('[data-pack-description-input]');
  def.description = input.value;
  window.appState.uiState.packDetailEditing = null;
  window.rerender();
}

function renderPackMembersList(detail, def) {
  if (detail.kind === 'bundle') {
    var rows = def.variantRefs.map(function (ref) {
      var npc = window.appState.data.npcs.find(function (n) { return n.code === ref.npcCode; });
      var variant = npc.variants.find(function (v) { return v.code === ref.variantCode; });
      return '<div class="ws-flyout-ref-item">' + escapeHtml(npc.displayName) + ' — ' + escapeHtml(variant.name) + '</div>';
    }).join('') || '<div class="hint">沒有成員</div>';
    return '<div data-pack-members>' + rows + '</div>';
  }
  var itemRows = def.itemRefs.map(function (ref) {
    var itemDef = ref.kind === 'gem' ? wsGemByName(ref.name) : wsEquipmentByName(ref.name);
    return '<div class="ws-flyout-ref-item">' + escapeHtml(itemDef.displayName) + ' Lv' + ref.level + '</div>';
  }).join('') || '<div class="hint">沒有項目</div>';
  return '<div data-pack-members>' + itemRows + '</div>';
}

function renderPackDetailViewBody(state) {
  var detail = state.uiState.packDetail;
  var def = wsPackDef(detail);
  var editing = state.uiState.packDetailEditing;
  var typeLabel = detail.kind === 'bundle' ? '組合包' : '擴充包';

  var nameBlock = editing === 'displayName'
    ? (
      '<input class="ws-npc-name-input" data-pack-displayname-input value="' + escapeHtml(def.displayName) + '">' +
      '<button class="btn btn-primary" data-pack-displayname-commit onclick="wsCommitPackDetailDisplayName()">✓</button> ' +
      '<button class="btn" onclick="wsCancelEditPackDetailField()">取消</button>'
    )
    : (
      '<span class="ws-flyout-name">' + escapeHtml(def.displayName) + '</span>' +
      '<button class="btn" data-pack-displayname-pencil onclick="wsStartEditPackDetailField(\'displayName\')">✎</button>'
    );

  var descriptionBlock = editing === 'description'
    ? (
      '<textarea data-pack-description-input rows="3" style="width:100%;">' + escapeHtml(def.description) + '</textarea>' +
      '<button class="btn btn-primary" data-pack-description-commit onclick="wsCommitPackDetailDescription()">✓</button> ' +
      '<button class="btn" onclick="wsCancelEditPackDetailField()">取消</button>'
    )
    : (
      '<div class="ws-flyout-field">' + escapeHtml(def.description) + ' ' +
      '<button class="btn" data-pack-description-pencil onclick="wsStartEditPackDetailField(\'description\')">✎</button></div>'
    );

  return (
    '<button class="btn ws-flyout-close" data-flyout-close onclick="wsClosePackDetail()">✕</button>' +
    '<div class="ws-flyout-header">' +
      '<span class="ws-flyout-type-label">' + typeLabel + '</span>' +
      nameBlock +
    '</div>' +
    '<div class="ws-flyout-field"><span class="label">狀態</span> <span data-pack-status>' + escapeHtml(def.status) + '</span></div>' +
    '<div class="ws-flyout-field"><span class="label">說明</span></div>' +
    descriptionBlock +
    '<div class="ws-flyout-field"><span class="label">' + (detail.kind === 'bundle' ? '成員人物卡' : '成員能力') + '</span></div>' +
    renderPackMembersList(detail, def)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 10 new checks PASS; suite total 228+10=238 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/js/app.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): pack flyout view mode with displayName/description pencil-edit"
```

---

### Task 6: Lifecycle action bar (DRAFT → PUBLISHED ⇄ MAINTENANCE → EOS)

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `wsPackDef` (Task 5).
- Produces: `wsPackNextStatuses(status)` (the single source-of-truth transition table). `wsTransitionPackStatus(newStatus)`. Lifecycle action bar appended to `renderPackDetailViewBody`'s returned markup, and field-locking (every field except displayName/description) once `status !== 'DRAFT'`.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 4 Task 6: lifecycle action bar ---
  await page.click('[data-pack-row="bundle.CS_BUNDLE_1"]');
  const publishBtnOnDraftPack = await page.locator('[data-pack-transition="PUBLISHED"]').count();
  record('DRAFT pack shows a 發布 (→PUBLISHED) button', publishBtnOnDraftPack === 1);
  const eosBtnOnDraftPack = await page.locator('[data-pack-transition="EOS"]').count();
  record('DRAFT pack shows an 結束(EOS) button (DRAFT can jump straight to EOS)', eosBtnOnDraftPack === 1);
  const maintenanceBtnOnDraftPack = await page.locator('[data-pack-transition="MAINTENANCE"]').count();
  record('DRAFT pack does NOT show a 進入維護 button (not a legal jump from DRAFT)', maintenanceBtnOnDraftPack === 0);

  await page.click('[data-pack-transition="PUBLISHED"]');
  const statusAfterPublish = await page.evaluate(() => window.appState.data.bundles.find((b) => b.code === 'CS_BUNDLE_1').status);
  record('publishing a DRAFT pack sets status to PUBLISHED', statusAfterPublish === 'PUBLISHED', statusAfterPublish);
  const maintenanceBtnOnPublished = await page.locator('[data-pack-transition="MAINTENANCE"]').count();
  record('PUBLISHED pack shows a 進入維護 button', maintenanceBtnOnPublished === 1);
  const publishBtnGoneOnPublished = await page.locator('[data-pack-transition="PUBLISHED"]').count();
  record('PUBLISHED pack no longer shows a 發布 button (can\'t publish an already-published pack)', publishBtnGoneOnPublished === 0);

  await page.click('[data-pack-transition="MAINTENANCE"]');
  const statusAfterMaintenance = await page.evaluate(() => window.appState.data.bundles.find((b) => b.code === 'CS_BUNDLE_1').status);
  record('entering maintenance sets status to MAINTENANCE', statusAfterMaintenance === 'MAINTENANCE', statusAfterMaintenance);
  const resumePublishBtnOnMaintenance = await page.locator('[data-pack-transition="PUBLISHED"]').count();
  record('MAINTENANCE pack can resume to PUBLISHED', resumePublishBtnOnMaintenance === 1);

  await page.click('[data-pack-transition="EOS"]');
  const statusAfterEos = await page.evaluate(() => window.appState.data.bundles.find((b) => b.code === 'CS_BUNDLE_1').status);
  record('ending a pack sets status to EOS', statusAfterEos === 'EOS', statusAfterEos);
  const noButtonsOnEos = await page.locator('[data-pack-transition]').count();
  record('EOS is terminal — no lifecycle buttons render', noButtonsOnEos === 0);

  // defense in depth: calling the transition function directly for a disallowed jump is a no-op
  await page.evaluate(() => { wsTransitionPackStatus('PUBLISHED'); });
  const statusStillEos = await page.evaluate(() => window.appState.data.bundles.find((b) => b.code === 'CS_BUNDLE_1').status);
  record('wsTransitionPackStatus refuses an illegal jump (EOS → PUBLISHED) even when called directly', statusStillEos === 'EOS', statusStillEos);

  // fields other than displayName/description are locked once a pack leaves DRAFT
  const membershipEditorPencilGone = await page.locator('[data-pack-members-pencil]').count();
  record('the membership editor pencil is gone for a non-DRAFT pack', membershipEditorPencilGone === 0);
  const displayNamePencilStillThere = await page.locator('[data-pack-displayname-pencil]').count();
  record('displayName pencil remains available even on an EOS pack', displayNamePencilStillThere === 1);
  await page.click('[data-flyout-close]');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks FAIL — no `[data-pack-transition]` buttons exist yet, `wsTransitionPackStatus` is not defined.

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, add after `wsPackDef` (before `function wsStartEditPackDetailField`):

```js
function wsPackNextStatuses(status) {
  var table = {
    DRAFT: ['PUBLISHED', 'EOS'],
    PUBLISHED: ['MAINTENANCE', 'EOS'],
    MAINTENANCE: ['PUBLISHED', 'EOS'],
    EOS: []
  };
  return table[status] || [];
}

function wsTransitionPackStatus(newStatus) {
  var detail = window.appState.uiState.packDetail;
  var def = wsPackDef(detail);
  if (wsPackNextStatuses(def.status).indexOf(newStatus) === -1) return;
  def.status = newStatus;
  window.rerender();
}

var WS_PACK_TRANSITION_LABELS = {
  PUBLISHED: '🚀 發布',
  MAINTENANCE: '🛠 進入維護',
  EOS: '⏹ 結束'
};
```

(`wsTransitionPackStatus`'s one exception: `MAINTENANCE → PUBLISHED` should read "恢復發布" rather than "🚀 發布" for clarity, since it's resuming, not first-publishing — handle that directly in the action-bar renderer below rather than over-generalizing the label table for one case.)

Change `renderPackDetailViewBody`'s return statement — find:

```js
    '<div class="ws-flyout-field"><span class="label">' + (detail.kind === 'bundle' ? '成員人物卡' : '成員能力') + '</span></div>' +
    renderPackMembersList(detail, def)
  );
}
```

and replace with:

```js
    '<div class="ws-flyout-field"><span class="label">' + (detail.kind === 'bundle' ? '成員人物卡' : '成員能力') + '</span>' +
      (def.status === 'DRAFT' ? '<button class="btn" data-pack-members-pencil onclick="wsStartEditPackDetailField(\'members\')">✎</button>' : '') +
    '</div>' +
    renderPackMembersList(detail, def) +
    '<div class="ws-flyout-actions">' +
      wsPackNextStatuses(def.status).map(function (next) {
        var label = (next === 'PUBLISHED' && def.status === 'MAINTENANCE') ? '▶ 恢復發布' : WS_PACK_TRANSITION_LABELS[next];
        return '<button class="btn' + (next === 'EOS' ? ' btn-danger' : ' btn-primary') + '" data-pack-transition="' + next + '" onclick="wsTransitionPackStatus(\'' + next + '\')">' + label + '</button>';
      }).join(' ') +
    '</div>'
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 12 new checks PASS; suite total 238+12=250 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): pack lifecycle action bar (DRAFT→PUBLISHED⇄MAINTENANCE→EOS)"
```

---

### Task 7: Membership editor for DRAFT packs

**Files:**
- Modify: `agent-setup-demo/js/workspace.js`
- Test: `agent-setup-demo/tests/ui.test.cjs`

**Interfaces:**
- Consumes: `uiState.packDetailEditing`/`packMembershipDraft` (Task 1), `wsSameZonePublishedVariants` (Task 3), `wsPublishedCatalogItems` (Task 4).
- Produces: `wsStartEditPackMembers()`, `wsCancelEditPackMembers()`, `wsToggleMembershipDraftVariant(npcCode, variantCode)` (bundle), `wsToggleMembershipDraftItem(kind, name, level)` (extension, one-level-per-name like Task 4), `wsCommitPackMembers()`.

- [ ] **Step 1: Write the failing test**

Add to `agent-setup-demo/tests/ui.test.cjs`, right before `await browser.close();`:

```js
  // --- Phase 4 Task 7: membership editor for DRAFT packs ---
  // CS_BUNDLE_1 is EOS by now (Task 6 drove it there); create a fresh DRAFT bundle to edit.
  await page.click('[data-pack-create="bundle"]');
  await page.click('[data-bundle-variant-checkbox="FAQ_ANSWER.STANDARD"]');
  await page.fill('[data-pack-create-name]', 'CS_BUNDLE_2');
  await page.fill('[data-pack-create-display-name]', '客服組合包二號');
  await page.click('[data-pack-create-submit]');

  await page.click('[data-pack-members-pencil]');
  const memberCheckboxCount = await page.locator('[data-membership-variant-checkbox]').count();
  record('membership editor shows same-zone published variant checkboxes', memberCheckboxCount > 0, 'found ' + memberCheckboxCount);
  const standardPreChecked = await page.evaluate(function () {
    var el = document.querySelector('[data-membership-variant-checkbox="FAQ_ANSWER.STANDARD"]');
    return el ? el.classList.contains('ws-bag-item--active') : false;
  });
  record('the already-included variant starts checked', standardPreChecked === true);

  await page.click('[data-membership-variant-checkbox="FAQ_ANSWER.PREMIUM"]');
  await page.click('[data-membership-commit]');
  const membersAfterCommit = await page.evaluate(() => window.appState.data.bundles.find((b) => b.code === 'CS_BUNDLE_2').variantRefs);
  record('committing the membership editor adds the newly-checked variant', membersAfterCommit.some((v) => v.variantCode === 'PREMIUM') && membersAfterCommit.some((v) => v.variantCode === 'STANDARD'), JSON.stringify(membersAfterCommit));

  await page.click('[data-flyout-close]');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all new checks FAIL — `[data-pack-members-pencil]` exists (Task 6) but clicking it does nothing yet (`wsStartEditPackDetailField('members')` sets `packDetailEditing` but `renderPackMembersList` never reads it).

- [ ] **Step 3: Write minimal implementation**

In `agent-setup-demo/js/workspace.js`, add after `wsCancelEditPackDetailField` (before `function wsCommitPackDetailDisplayName`):

```js
function wsStartEditPackMembers() {
  var detail = window.appState.uiState.packDetail;
  var def = wsPackDef(detail);
  window.appState.uiState.packMembershipDraft = detail.kind === 'bundle'
    ? JSON.parse(JSON.stringify(def.variantRefs))
    : JSON.parse(JSON.stringify(def.itemRefs));
  window.appState.uiState.packDetailEditing = 'members';
  window.rerender();
}

function wsCancelEditPackMembers() {
  window.appState.uiState.packMembershipDraft = null;
  window.appState.uiState.packDetailEditing = null;
  window.rerender();
}

function wsToggleMembershipDraftVariant(npcCode, variantCode) {
  var draft = window.appState.uiState.packMembershipDraft;
  var idx = draft.findIndex(function (v) { return v.npcCode === npcCode && v.variantCode === variantCode; });
  if (idx === -1) draft.push({ npcCode: npcCode, variantCode: variantCode });
  else draft.splice(idx, 1);
  window.rerender();
}

function wsToggleMembershipDraftItem(kind, name, level) {
  var draft = window.appState.uiState.packMembershipDraft;
  var sameNameIdx = draft.findIndex(function (i) { return i.kind === kind && i.name === name; });
  var isExactMatch = sameNameIdx !== -1 && draft[sameNameIdx].level === level;
  if (sameNameIdx !== -1) draft.splice(sameNameIdx, 1);
  if (!isExactMatch) draft.push({ kind: kind, name: name, level: level });
  window.rerender();
}

function wsCommitPackMembers() {
  var detail = window.appState.uiState.packDetail;
  var def = wsPackDef(detail);
  if (detail.kind === 'bundle') def.variantRefs = window.appState.uiState.packMembershipDraft;
  else def.itemRefs = window.appState.uiState.packMembershipDraft;
  window.appState.uiState.packMembershipDraft = null;
  window.appState.uiState.packDetailEditing = null;
  window.rerender();
}

function renderPackMembershipEditor(detail, def) {
  var draft = window.appState.uiState.packMembershipDraft;
  var rows;
  if (detail.kind === 'bundle') {
    var zoneNpc = window.appState.data.npcs.find(function (n) { return n.usedFor === def.usedFor; });
    rows = wsSameZonePublishedVariants(zoneNpc).map(function (v) {
      var checked = draft.some(function (s) { return s.npcCode === v.npcCode && s.variantCode === v.variantCode; });
      return (
        '<div class="ws-bag-item' + (checked ? ' ws-bag-item--active' : '') + '" data-membership-variant-checkbox="' + v.npcCode + '.' + v.variantCode + '" onclick="wsToggleMembershipDraftVariant(\'' + v.npcCode + '\', \'' + v.variantCode + '\')">' +
          '<span class="ws-bag-item-name">' + escapeHtml(v.variantName) + '</span>' +
          '<span class="hint">' + (checked ? '已選取' : '') + '</span>' +
        '</div>'
      );
    }).join('');
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
  return (
    rows +
    '<div class="ws-flyout-actions">' +
      '<button class="btn btn-primary" data-membership-commit onclick="wsCommitPackMembers()">✓ 完成編輯</button> ' +
      '<button class="btn" onclick="wsCancelEditPackMembers()">取消</button>' +
    '</div>'
  );
}
```

Change `renderPackMembersList`'s call site in `renderPackDetailViewBody` from:

```js
    '<div class="ws-flyout-field"><span class="label">' + (detail.kind === 'bundle' ? '成員人物卡' : '成員能力') + '</span>' +
      (def.status === 'DRAFT' ? '<button class="btn" data-pack-members-pencil onclick="wsStartEditPackDetailField(\'members\')">✎</button>' : '') +
    '</div>' +
    renderPackMembersList(detail, def) +
```

to:

```js
    '<div class="ws-flyout-field"><span class="label">' + (detail.kind === 'bundle' ? '成員人物卡' : '成員能力') + '</span>' +
      (def.status === 'DRAFT' && editing !== 'members' ? '<button class="btn" data-pack-members-pencil onclick="wsStartEditPackMembers()">✎</button>' : '') +
    '</div>' +
    (editing === 'members' ? renderPackMembershipEditor(detail, def) : renderPackMembersList(detail, def)) +
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: all 3 new checks PASS; suite total 250+3=253 checks, 0 failed, 0 JS errors.

- [ ] **Step 5: Commit**

```bash
git add agent-setup-demo/js/workspace.js agent-setup-demo/tests/ui.test.cjs
git commit -m "feat(agent-setup-demo): membership editor for DRAFT packs"
```

---

### Task 8: skill-admin.html embed verification + CSS scoping sync

**Files:**
- Modify: `skill-admin/agent-setup-embed.css`

**Interfaces:**
- Consumes: every new class this phase introduced (`ws-bag-item` reuse needs no new scoping — already scoped; new classes are limited to what's listed below).
- Produces: nothing new consumed by later tasks — last task in the plan.

- [ ] **Step 1: Write the failing test**

This task reuses Phase 3's standalone embed-verification script pattern (`agent-setup-demo/tests/ui.test.cjs` only ever loads `agent-setup-demo/index.html` directly). Write `scratchpad/verify-pack-embed.cjs` (use the session's scratchpad directory):

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
  await page.click('[data-variant-pack-toggle]');
  const packPaneVisible = await page.locator('[data-pack-pane]').count();
  console.log('pack pane visible:', packPaneVisible);
  await page.click('[data-pack-create="bundle"]');
  const createFormVisible = await page.locator('[data-pack-create-name]').count();
  console.log('create form visible:', createFormVisible);

  console.log('JS errors:', jsErrors.length ? jsErrors : 'none');
  await browser.close();
  process.exit(jsErrors.length || packPaneVisible !== 1 || createFormVisible !== 1 ? 1 : 0);
}

main();
```

Run against the current (pre-Task-8) `skill-admin/agent-setup-embed.css` — since this task adds no new DOM markup, the JS/HTML already work; only *visual* scoping could be missing for any genuinely new classes. Check which classes this phase actually introduced that aren't already covered by Phase 1-3's `#page-agents`-scoped rules: `renderPackPane`/`renderPackCreateBundleForm`/`renderPackCreateExtensionForm`/`renderPackDetailViewBody`/`renderPackMembershipEditor` reuse `.ws-bag-item`, `.ws-bag-header`, `.ws-variant-tabs`/`.ws-variant-tab`/`.ws-variant-tab--active`, `.ws-flyout-field`/`.ws-flyout-error`/`.ws-flyout-actions`/`.ws-flyout-header`/`.ws-flyout-type-label`/`.ws-flyout-name`/`.ws-flyout-close`/`.ws-flyout-ref-item`, `.ws-npc-name-input`, `.btn`/`.btn-primary`/`.btn-danger` — **every single one of these already has a `#page-agents`-scoped copy from Phase 1-3.** This phase introduces zero new CSS class names.

Expected: running the script above against the *current* `skill-admin.html`/`skill-admin/agent-setup-embed.css` (no Task 8 changes yet) should already pass — confirming there is nothing to fix. This is the task's actual finding, not a failure to engineer around.

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node /path/to/scratchpad/verify-pack-embed.cjs skill-admin.html`
Expected (per the finding above): it already PASSES. Record this explicitly rather than forcing an artificial RED — Phase 2 and 3's Task 8 both needed real fixes because they added new DOM markup or CSS classes; this phase added neither, so there is nothing to verify-as-broken-then-fixed. Confirm by also diffing this phase's commits for any `ws-` class name not already in `skill-admin/agent-setup-embed.css`:

```bash
git log --oneline -8  # this phase's 7 feature commits (Tasks 1-7)
grep -oE '"ws-[a-z-]+"' agent-setup-demo/js/workspace.js | sort -u > /tmp/phase4-classes-used.txt
grep -oE '\.ws-[a-z-]+' skill-admin/agent-setup-embed.css | sort -u > /tmp/phase4-classes-scoped.txt
# manually confirm every class in the first file appears (as .classname) in the second
```

- [ ] **Step 3: Write minimal implementation**

None needed in `skill-admin/agent-setup-embed.css` — Step 1's enumeration confirms full coverage already exists. This task's deliverable is the verification itself, run and recorded, so a future reader doesn't have to re-derive "did Phase 4 need an embed-sync commit?" from scratch.

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node /path/to/scratchpad/verify-pack-embed.cjs skill-admin.html`
Expected: `pack pane visible: 1`, `create form visible: 1`, `JS errors: none`, exits 0.

Then run the full `agent-setup-demo` suite once more to confirm this task touched nothing it owns:

Run: `NODE_PATH=/Users/jocelyn/.nvm/versions/node/v22.22.2/lib/node_modules node agent-setup-demo/tests/ui.test.cjs`
Expected: 253 checks, 0 failed, 0 JS errors (unchanged from Task 7).

- [ ] **Step 5: Commit**

Since no file changes result from this task, there is nothing to commit — the ledger entry alone (`Task 8: complete (commits <BASE>..<BASE>, tests: ... → 253/253, embed verified with no changes needed)`) is the record. Do not create an empty commit.

---

## Self-Review Notes

- **Spec coverage:** every bullet in spec lines 120-128 maps to a task — 打包 button (Task 1), mutual-exclusion with 背包 + auto-revert (Task 1), 組合包 creation + 同場域 (Task 3), 擴充包 creation + 同名一級 (Task 4), 窄／滑出兩態 (narrow = Task 2, flyout = Task 5, reusing Phase 3's element), lifecycle (Task 6), "離開 DRAFT 後只能改顯示名稱與說明" (Task 6 locks membership editing via Task 7's pencil only appearing in DRAFT; displayName/description pencils from Task 5 are never gated by status).
- **Placeholder scan:** no TBD/TODO; `renderPackPane`'s extension-form branch returning `''` until Task 4, and `renderBagDetailFlyout`'s pre-Task-5 behavior, are both real intermediate states with their own tests, matching the sequential-buildup pattern Phase 3 already established and had reviewed clean.
- **Type consistency:** `packDetail` shape (`{kind, code, mode}`) is identical everywhere it's touched (Tasks 2, 5, 6, 7). `wsPackDef` is the one lookup function every later task uses instead of re-deriving `bundles`/`extensions` access inline.
- **Review Focus:** zone-restriction cross-check → Task 3's `orderBundleRowCount`/`orderAssistCheckboxCount` assertions and Task 2's zone filter. One-level-per-name → Task 4's explicit replace-not-add test, reused by Task 7's membership editor. Lifecycle defense-in-depth → Task 6's direct `wsTransitionPackStatus` call against a disallowed jump. displayName/description-stay-editable → Task 6's post-EOS pencil check. Stale pack flyout on NPC switch → Task 5's dedicated test, using the same `wsResetVariantTransientUi` extension Task 1 already wired (no new reset logic needed — Phase 2's existing mechanism already covers `packDetail` once Task 1 added it to that function).
