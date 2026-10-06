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
