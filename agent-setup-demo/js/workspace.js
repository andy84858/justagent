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
    }

    return '<div class="ws-nav-group">' + npcRow + variantRows + '</div>';
  }).join('');

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
}

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

function wsFindNpc(state) {
  return state.data.npcs.find(function (n) { return n.code === state.selection.npcCode; });
}

function renderNpcPane(state) {
  var container = document.getElementById('ws-npc-pane');
  if (!container) return;
  var npc = wsFindNpc(state);
  if (!npc) { container.innerHTML = ''; return; }

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
