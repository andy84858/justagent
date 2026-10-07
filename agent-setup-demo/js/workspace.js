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
  // Every lookup in this app (wsFindNpc, nav selection, expand state, model-param
  // scoping) keys on `code` alone, so uniqueness must be checked on `code` alone too
  // — scoping the check to `usedFor` let two NPCs share a code and both render under
  // the same [data-npc-row], with clicks on either opening whichever was created first.
  var duplicate = npcs.some(function (n) { return n.code === code; });
  if (duplicate) {
    return '已有相同代碼的 NPC';
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

function wsResetVariantTransientUi() {
  window.appState.uiState.bagError = null;
  window.appState.uiState.bagWarning = null;
  window.appState.uiState.editingVariantBasics = false;
  window.appState.uiState.editingVariantInstructions = false;
  window.appState.uiState.variantTab = 'basics';
}

function wsSelectNpc(code) {
  window.appState.selection = { npcCode: code, variantCode: null };
  wsResetVariantTransientUi();
  window.rerender();
}

function wsSelectVariant(npcCode, variantCode) {
  window.appState.selection = { npcCode: npcCode, variantCode: variantCode };
  wsResetVariantTransientUi();
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
  npc.variants.push({
    code: code,
    name: name || code,
    publishedVersion: null,
    description: '',
    baseInstructions: '',
    equippedEquipment: [],
    wornGems: []
  });
  window.appState.uiState.creatingVariantFor = null;
  window.appState.uiState.variantFormError = null;
  window.appState.selection = { npcCode: npcCode, variantCode: code };
  window.rerender();
}

function wsFindNpc(state) {
  return state.data.npcs.find(function (n) { return n.code === state.selection.npcCode; });
}

function wsFindVariant(state) {
  var npc = wsFindNpc(state);
  if (!npc) return undefined;
  return npc.variants.find(function (v) { return v.code === state.selection.variantCode; });
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

function wsModelKindLabel(kind) {
  return kind === 'chatModel' ? '對話模型' : '向量模型';
}

function wsTemplatesForKind(kind) {
  var templates = window.appState.data.modelTemplates;
  var wantType = kind === 'chatModel' ? 'chat' : 'vector';
  return Object.keys(templates).filter(function (key) { return templates[key].type === wantType; });
}

function wsParamStateKey(npcCode, kind, paramKey) {
  return npcCode + '.' + kind + '.' + paramKey;
}

function wsParamErrorStateKey(npcCode, kind) {
  return npcCode + '.' + kind;
}

function renderModelBlock(npc, kind) {
  var model = npc[kind];
  var label = wsModelKindLabel(kind);
  var adding = window.appState.uiState.addingModelKind === kind;

  if (model) {
    var template = window.appState.data.modelTemplates[model.key];
    var paramsHtml = (template ? template.params : []).map(function (p) {
      var domKey = kind + '.' + p.key;
      var stateKey = wsParamStateKey(npc.code, kind, p.key);
      var currentValue = window.appState.uiState.modelParamEdits[stateKey] !== undefined
        ? window.appState.uiState.modelParamEdits[stateKey]
        : model.params[p.key];
      if (p.kind === 'enum') {
        var opts = p.enumValues.map(function (v) {
          return '<option value="' + v + '"' + (String(v) === String(currentValue) ? ' selected' : '') + '>' + v + '</option>';
        }).join('');
        return (
          '<div class="ws-param-row">' +
            '<span class="label">' + escapeHtml(p.label) + '</span>' +
            '<select data-model-param-input="' + domKey + '" onchange="wsEditModelParam(\'' + kind + '\', \'' + p.key + '\', this.value)">' + opts + '</select>' +
          '</div>'
        );
      }
      return (
        '<div class="ws-param-row">' +
          '<span class="label">' + escapeHtml(p.label) + '</span>' +
          '<input data-model-param-input="' + domKey + '" value="' + escapeHtml(currentValue) + '" ' +
            'oninput="wsEditModelParam(\'' + kind + '\', \'' + p.key + '\', this.value)">' +
        '</div>'
      );
    }).join('');

    var paramError = window.appState.uiState.modelParamErrors[wsParamErrorStateKey(npc.code, kind)];

    return (
      '<div class="ws-model-block">' +
        '<div class="label">' + label + '</div>' +
        '<div>' + escapeHtml(template ? template.label : model.key) + ' <span class="hint">v' + model.version + '</span></div>' +
        paramsHtml +
        (paramError ? '<div class="ws-param-error" data-model-param-error="' + kind + '">' + escapeHtml(paramError) + '</div>' : '') +
        '<button class="btn btn-primary" data-model-param-save="' + kind + '" onclick="wsSaveModelParams(\'' + kind + '\')">儲存參數</button>' +
        '<button class="btn" data-model-publish="' + kind + '" onclick="wsPublishModel(\'' + kind + '\')">🚀 發布</button>' +
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

function wsEditModelParam(kind, paramKey, rawValue) {
  var npc = wsFindNpc(window.appState);
  window.appState.uiState.modelParamEdits[wsParamStateKey(npc.code, kind, paramKey)] = rawValue;
}

function wsSaveModelParams(kind) {
  var npc = wsFindNpc(window.appState);
  var model = npc[kind];
  var template = window.appState.data.modelTemplates[model.key];
  var newParams = {};
  for (var i = 0; i < template.params.length; i++) {
    var p = template.params[i];
    var stateKey = wsParamStateKey(npc.code, kind, p.key);
    var raw = window.appState.uiState.modelParamEdits[stateKey];
    var rawValue = raw !== undefined ? raw : model.params[p.key];
    var result = wsValidateParamValue(p, rawValue);
    if (!result.ok) {
      window.appState.uiState.modelParamErrors[wsParamErrorStateKey(npc.code, kind)] = result.message;
      window.rerender();
      return;
    }
    newParams[p.key] = result.value;
  }
  model.params = newParams;
  window.appState.uiState.modelParamErrors[wsParamErrorStateKey(npc.code, kind)] = null;
  template.params.forEach(function (p) { delete window.appState.uiState.modelParamEdits[wsParamStateKey(npc.code, kind, p.key)]; });
  window.rerender();
}

function wsHasUnsavedModelEdits(npcCode, kind) {
  var npc = window.appState.data.npcs.find(function (n) { return n.code === npcCode; });
  var template = window.appState.data.modelTemplates[npc[kind].key];
  return template.params.some(function (p) {
    return window.appState.uiState.modelParamEdits[wsParamStateKey(npcCode, kind, p.key)] !== undefined;
  });
}

function wsPublishModelErrors(npc, kind) {
  var model = npc[kind];
  var errors = [];
  if (wsHasUnsavedModelEdits(npc.code, kind)) {
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
    window.appState.uiState.modelParamErrors[wsParamErrorStateKey(npc.code, kind)] = errors.join('；');
    window.rerender();
    return;
  }
  npc[kind].version += 1;
  window.appState.uiState.modelParamErrors[wsParamErrorStateKey(npc.code, kind)] = null;
  window.rerender();
}

function renderBagPlaceholder() {
  return '<div class="hint">背包功能將於 Phase 2／3 開發，這裡先保留版位。</div>';
}

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
  var hasHistory = variant.publishedVersion || (variant.publishHistory && variant.publishHistory.length > 0);

  container.innerHTML =
    '<div class="ws-variant-titlebar">' +
      '<span class="ws-variant-titlebar-name">' + escapeHtml(variant.name) + '</span>' +
      '<button class="btn" data-variant-history ' + (hasHistory ? '' : 'disabled') + ' onclick="wsOpenVariantHistoryModal()">公開記錄 📖</button>' +
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

function renderBagForVariant(state) {
  var variant = wsFindVariant(state);
  var gemRows = state.data.gems.map(function (gemDef) {
    return gemDef.versions.map(function (ver) {
      var isDraft = ver.status === 'draft';
      var worn = variant.wornGems.some(function (g) { return g.name === gemDef.name && g.level === ver.level; });
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + (isDraft ? ' ws-bag-item--draft' : '') + '" ' +
          'data-bag-gem="' + gemDef.name + '" data-bag-gem-level="' + ver.level + '" ' +
          (isDraft ? 'aria-disabled="true" ' : '') +
          'onclick="wsBagWear(\'' + gemDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name">' + escapeHtml(gemDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (isDraft ? ' · 草稿・不可選' : (worn ? ' · 已佩掛' : '')) + '</span>' +
        '</div>'
      );
    }).join('');
  }).join('');

  var equipmentRows = state.data.equipment.map(function (eqDef) {
    return eqDef.versions.map(function (ver) {
      var isDraft = ver.status === 'draft';
      var worn = variant.equippedEquipment.some(function (e) { return e.name === eqDef.name && e.level === ver.level; });
      return (
        '<div class="ws-bag-item' + (worn ? ' ws-bag-item--active' : '') + (isDraft ? ' ws-bag-item--draft' : '') + '" ' +
          'data-bag-equipment="' + eqDef.name + '" data-bag-equipment-level="' + ver.level + '" ' +
          (isDraft ? 'aria-disabled="true" ' : '') +
          'onclick="wsBagEquip(\'' + eqDef.name + '\', ' + ver.level + ')">' +
          '<span class="ws-bag-item-name">' + escapeHtml(eqDef.displayName) + '</span>' +
          '<span class="hint">Lv' + ver.level + (isDraft ? ' · 草稿・不可選' : (worn ? ' · 已穿上' : '')) + '</span>' +
        '</div>'
      );
    }).join('');
  }).join('');

  var error = state.uiState.bagError;
  var warning = state.uiState.bagWarning;
  return (
    (error ? '<div class="ws-bag-error" data-bag-error>' + escapeHtml(error) + '</div>' : '') +
    (warning ? '<div class="ws-bag-warning" data-bag-warning>' + escapeHtml(warning) + '</div>' : '') +
    '<div class="label">🎒 背包 — 寶石</div>' + gemRows +
    '<div class="label" style="margin-top:var(--space-3);">🎒 背包 — 裝備</div>' + equipmentRows
  );
}

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
  window.appState.uiState.bagError = result.ok ? null : result.message;
  window.appState.uiState.bagWarning = (result.ok && result.warnings && result.warnings.length) ? result.warnings.join('；') : null;
  window.rerender();
}

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
  var modal = document.getElementById('modal-publish-variant');
  if (!modal) return;
  modal.classList.add('ws-modal--active');
  renderPublishVariantModalBody();
}

function wsClosePublishVariantModal() {
  var modal = document.getElementById('modal-publish-variant');
  if (!modal) return;
  modal.classList.remove('ws-modal--active');
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
  var modal = document.getElementById('modal-variant-history');
  if (!modal) return;
  renderVariantHistoryModalBody();
  modal.classList.add('ws-modal--active');
}

function wsCloseVariantHistoryModal() {
  var modal = document.getElementById('modal-variant-history');
  if (!modal) return;
  modal.classList.remove('ws-modal--active');
}

function renderCenterPane(state) {
  var sel = state.selection;
  if (!sel.npcCode) {
    return '<div class="hint">請從左側選擇一個 NPC 或人物卡開始編輯。</div>';
  }
  if (sel.variantCode) {
    return '<div id="ws-variant-pane"></div>';
  }
  return '<div id="ws-npc-pane"></div>';
}
