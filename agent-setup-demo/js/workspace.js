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
  wsResetVariantTransientUi();
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
  window.appState.uiState.bagMode = 'bag';
  window.appState.uiState.packDetail = null;
  window.appState.uiState.packDetailEditing = null;
  window.appState.uiState.packMembershipDraft = null;
  window.appState.uiState.packDetailError = null;
  window.appState.uiState.packCreateForm = null;
}

function wsSetBagMode(mode) {
  window.appState.uiState.bagMode = mode;
  if (mode === 'bag') {
    window.appState.uiState.packDetail = null;
    window.appState.uiState.packDetailEditing = null;
    window.appState.uiState.packMembershipDraft = null;
    window.appState.uiState.packDetailError = null;
    window.appState.uiState.packCreateForm = null;
  } else {
    window.appState.uiState.bagDetail = null;
    window.appState.uiState.bagDetailEditing = null;
    window.appState.uiState.bagDetailGemsDraft = null;
    window.appState.uiState.bagDetailError = null;
    window.appState.uiState.bagDetailCreateForm = null;
  }
  window.rerender();
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
  wsResetVariantTransientUi();
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
  return '<div class="hint">請從左側選擇一張人物卡以檢視工具庫。</div>';
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
        '<button class="btn" data-variant-pack-toggle onclick="wsSetBagMode(\'pack\')">📦 打包</button>' +
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

function wsGemEverPublished(gemDef) {
  return gemDef.versions.some(function (v) { return v.status === 'published'; });
}

function wsBagDetailDef(detail) {
  return detail.kind === 'gem' ? wsGemByName(detail.name) : wsEquipmentByName(detail.name);
}

function wsBagDetailMaxLevel(def) {
  return Math.max.apply(null, def.versions.map(function (v) { return v.level; }));
}

function wsResetBagDetailTransient() {
  window.appState.uiState.bagDetailEditing = null;
  window.appState.uiState.bagDetailGemsDraft = null;
  window.appState.uiState.bagDetailError = null;
  window.appState.uiState.bagDetailCreateForm = null;
}

function wsOpenBagDetail(kind, name, level) {
  window.appState.uiState.bagDetail = { kind: kind, name: name, level: level, mode: 'view' };
  wsResetBagDetailTransient();
  window.rerender();
}

function wsCloseBagDetail() {
  window.appState.uiState.bagDetail = null;
  wsResetBagDetailTransient();
  window.rerender();
}

function wsSwitchBagDetailLevel(level) {
  var detail = window.appState.uiState.bagDetail;
  window.appState.uiState.bagDetail = { kind: detail.kind, name: detail.name, level: level, mode: 'view' };
  wsResetBagDetailTransient();
  window.rerender();
}

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

function wsCommitBagDetailKindProtocol() {
  var detail = window.appState.uiState.bagDetail;
  var gemDef = wsGemByName(detail.name);
  if (wsGemEverPublished(gemDef)) {
    window.appState.uiState.bagDetailEditing = null;
    window.rerender();
    return;
  }
  var kindInput = document.querySelector('[data-flyout-kind-input]');
  var protocolInput = document.querySelector('[data-flyout-protocol-input]');
  gemDef.kind = kindInput.value;
  gemDef.protocol = protocolInput.value.trim() || gemDef.protocol;
  window.appState.uiState.bagDetailEditing = null;
  window.rerender();
}

function renderBagDetailGemFields(gemDef, ver, editing) {
  var refs = wsGemReferences(gemDef.name, ver.level);
  var refList = (refs.equipment.length === 0 && refs.variants.length === 0)
    ? '<div class="ws-flyout-ref-list hint">尚未被任何技能或人物卡引用</div>'
    : (
      '<div class="ws-flyout-ref-list">' +
        refs.equipment.map(function (e) { return '<div class="ws-flyout-ref-item">技能：' + escapeHtml(e.displayName) + ' Lv' + e.level + '</div>'; }).join('') +
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
    window.appState.uiState.bagDetailError = '這個工具已在鑲嵌清單中';
    window.rerender();
    return;
  }
  var gemDef = wsGemByName(gemName);
  var ver = wsGemVersion(gemDef, level);
  if (!ver || ver.status === 'draft') {
    window.appState.uiState.bagDetailError = '只能鑲嵌已公開的工具版本';
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
  if (ver.status === 'draft') {
    ver.gems = window.appState.uiState.bagDetailGemsDraft;
  }
  window.appState.uiState.bagDetailGemsDraft = null;
  window.appState.uiState.bagDetailEditing = null;
  window.rerender();
}

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
    }).join('') || '<div class="hint">尚未鑲嵌任何工具</div>';
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
      '<div class="ws-flyout-field"><span class="label">鑲嵌工具</span></div>' +
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
    }).join('') || '<span class="hint">尚未鑲嵌任何工具</span>';
    gemsBlock =
      '<div class="ws-flyout-field"><span class="label">鑲嵌工具</span> ' + viewRows + ' ' +
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
  window.appState.uiState.bagDetailEditing = null;
  window.appState.uiState.bagDetailGemsDraft = null;
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
  if (def.versions.length === 0) {
    var catalogList = detail.kind === 'gem' ? window.appState.data.gems : window.appState.data.equipment;
    var idx = catalogList.findIndex(function (item) { return item.name === detail.name; });
    if (idx !== -1) catalogList.splice(idx, 1);
  }
  wsCloseBagDetail();
}

function wsOpenBagDetailCreate() {
  window.appState.uiState.bagDetail = { kind: null, name: null, level: null, mode: 'create' };
  wsResetBagDetailTransient();
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
    return '已有相同代碼的' + (kind === 'gem' ? '工具' : '技能');
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
      '<button class="btn" data-flyout-create-gem onclick="wsChooseBagDetailCreateKind(\'gem\')">新增工具</button> ' +
      '<button class="btn" data-flyout-create-equipment onclick="wsChooseBagDetailCreateKind(\'equipment\')">新增技能</button>'
    );
  }
  var typeLabel = form.kind === 'gem' ? '工具' : '技能';
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

function renderBagDetailViewBody(state) {
  var detail = state.uiState.bagDetail;
  var def = wsBagDetailDef(detail);
  var ver = def.versions.find(function (v) { return v.level === detail.level; });
  var icon = detail.kind === 'gem' ? '💎' : '🛡️';
  var typeLabel = detail.kind === 'gem' ? '工具' : '技能';

  var levelButtons = def.versions.slice().sort(function (a, b) { return a.level - b.level; }).map(function (v) {
    return (
      '<button class="ws-flyout-level-btn' + (v.level === detail.level ? ' ws-flyout-level-btn--active' : '') + (v.status === 'draft' ? ' ws-flyout-level-btn--draft' : '') + '" ' +
        'data-flyout-level-btn="' + v.level + '" onclick="wsSwitchBagDetailLevel(' + v.level + ')">' +
        'Lv' + v.level + (v.status === 'draft' ? ' 草稿' : '') +
      '</button>'
    );
  }).join('');

  var fieldsHtml = detail.kind === 'gem' ? renderBagDetailGemFields(def, ver, state.uiState.bagDetailEditing) : renderBagDetailEquipmentFields(def, ver, state.uiState.bagDetailEditing, state.uiState.bagDetailGemsDraft);
  var error = state.uiState.bagDetailError;
  var editing = state.uiState.bagDetailEditing;
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
    '<div class="ws-flyout-level-row">' + levelButtons + '</div>' +
    (error ? '<div class="ws-flyout-error" data-flyout-error>' + escapeHtml(error) + '</div>' : '') +
    fieldsHtml +
    '<div class="ws-flyout-actions">' + actionsHtml + '</div>'
  );
}

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
          '<button class="ws-bag-item-detail-btn" data-bag-gem-detail="' + gemDef.name + '.' + ver.level + '" onclick="event.stopPropagation(); wsOpenBagDetail(\'gem\', \'' + gemDef.name + '\', ' + ver.level + ')">⋯</button>' +
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
          '<span class="hint">Lv' + ver.level + (isDraft ? ' · 草稿・不可選' : (worn ? ' · 已啟用' : '')) + '</span>' +
          '<button class="ws-bag-item-detail-btn" data-bag-equipment-detail="' + eqDef.name + '.' + ver.level + '" onclick="event.stopPropagation(); wsOpenBagDetail(\'equipment\', \'' + eqDef.name + '\', ' + ver.level + ')">⋯</button>' +
        '</div>'
      );
    }).join('');
  }).join('');

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
  if (state.uiState.packCreateForm) {
    var form = state.uiState.packCreateForm;
    return '<div data-pack-pane>' + (form.kind === 'bundle' ? renderPackCreateBundleForm(state) : renderPackCreateExtensionForm(state)) + '</div>';
  }
  return (
    '<div data-pack-pane>' +
      '<div class="ws-bag-header"><span class="label">📦 打包</span>' +
        '<button class="btn" data-pack-mode-toggle onclick="wsSetBagMode(\'bag\')">🧰 工具庫</button>' +
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
  window.appState.uiState.packDetailEditing = null;
  window.appState.uiState.packMembershipDraft = null;
  window.rerender();
}

var WS_PACK_TRANSITION_LABELS = {
  PUBLISHED: '🚀 發布',
  MAINTENANCE: '🛠 進入維護',
  EOS: '⏹ 結束'
};

function wsStartEditPackDetailField(field) {
  window.appState.uiState.packDetailEditing = field;
  window.rerender();
}

function wsCancelEditPackDetailField() {
  window.appState.uiState.packDetailEditing = null;
  window.rerender();
}

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
  if (def.status !== 'DRAFT') {
    window.appState.uiState.packMembershipDraft = null;
    window.appState.uiState.packDetailEditing = null;
    window.rerender();
    return;
  }
  var draft = window.appState.uiState.packMembershipDraft;
  if (draft.length === 0) {
    window.appState.uiState.packDetailError = detail.kind === 'bundle' ? '至少要選一張人物卡' : '至少要選一個工具或技能';
    window.rerender();
    return;
  }
  if (detail.kind === 'bundle') def.variantRefs = draft;
  else def.itemRefs = draft;
  window.appState.uiState.packMembershipDraft = null;
  window.appState.uiState.packDetailEditing = null;
  window.appState.uiState.packDetailError = null;
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
    '<div class="ws-flyout-field"><span class="label">' + (detail.kind === 'bundle' ? '成員人物卡' : '成員能力') + '</span>' +
      (def.status === 'DRAFT' && editing !== 'members' ? '<button class="btn" data-pack-members-pencil onclick="wsStartEditPackMembers()">✎</button>' : '') +
    '</div>' +
    (editing === 'members' ? renderPackMembershipEditor(detail, def) : renderPackMembersList(detail, def)) +
    (state.uiState.packDetailError ? '<div class="ws-flyout-error" data-flyout-error>' + escapeHtml(state.uiState.packDetailError) + '</div>' : '') +
    '<div class="ws-flyout-actions">' +
      wsPackNextStatuses(def.status).map(function (next) {
        var label = (next === 'PUBLISHED' && def.status === 'MAINTENANCE') ? '▶ 恢復發布' : WS_PACK_TRANSITION_LABELS[next];
        return '<button class="btn' + (next === 'EOS' ? ' btn-danger' : ' btn-primary') + '" data-pack-transition="' + next + '" onclick="wsTransitionPackStatus(\'' + next + '\')">' + label + '</button>';
      }).join(' ') +
    '</div>'
  );
}

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

function wsUpdatePackCreateField(field, value) {
  window.appState.uiState.packCreateForm[field] = value;
}

function wsSubmitCreateBundle() {
  var npc = wsFindNpc(window.appState);
  var form = window.appState.uiState.packCreateForm;
  var code = (form.code || '').trim();
  var displayName = (form.displayName || '').trim();
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
  var code = (form.code || '').trim();
  var displayName = (form.displayName || '').trim();
  if (!form.agentCode) {
    window.appState.uiState.packDetailError = '請先選擇適用 agent';
    window.rerender();
    return;
  }
  var selected = form.selectedItems || [];
  if (selected.length === 0) {
    window.appState.uiState.packDetailError = '至少要選一個工具或技能';
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

function wsWearGem(variant, gemName, level) {
  var already = variant.wornGems.find(function (g) { return g.name === gemName; });
  if (already) {
    return { ok: false, message: '這個工具已佩掛，請先卸下才能換等級' };
  }
  var gemDef = wsGemByName(gemName);
  var ver = wsGemVersion(gemDef, level);
  if (ver.status === 'draft') {
    return { ok: false, message: '這個等級是草稿，人物卡只能引用公開版' };
  }
  var carried = wsCarriedGems(variant).find(function (cg) { return cg.gemName === gemName; });
  if (carried) {
    if (carried.level === level) {
      return { ok: false, message: '目前啟用的技能已鑲嵌同名同級工具，無需另外佩掛' };
    }
    return { ok: false, message: '目前啟用的技能已鑲嵌「' + gemDef.displayName + '」Lv' + carried.level + '，無法佩掛不同等級' };
  }
  variant.wornGems.push({ name: gemName, level: level });
  return { ok: true };
}

function wsEquipEquipment(variant, eqName, level) {
  var already = variant.equippedEquipment.find(function (e) { return e.name === eqName; });
  if (already) {
    return { ok: false, message: '這個技能已啟用，請先卸下才能換等級' };
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
      return { ok: false, message: '另一個技能已鑲嵌「' + conflictGemDef.displayName + '」不同等級，請先卸下其中一個' };
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
