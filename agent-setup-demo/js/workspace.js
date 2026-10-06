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
