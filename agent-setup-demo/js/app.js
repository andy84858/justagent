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
    modelParamErrors: {},
    variantSnapshots: {},
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
    packCreateForm: null,
    packListKind: 'bundle'
  }
};

function render() {
  document.getElementById('ws-nav').innerHTML = renderNavTree(window.appState);
  document.getElementById('ws-center').innerHTML = renderCenterPane(window.appState);
  document.getElementById('ws-bag').innerHTML = window.appState.selection.variantCode
    ? (window.appState.uiState.bagMode === 'pack' ? renderPackPane(window.appState) : renderBagForVariant(window.appState))
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

window.resetData = function resetData() {
  window.appState.data = cloneSeed();
  window.appState.selection = { npcCode: null, variantCode: null };
  window.appState.uiState = {
    expandedNpcs: {},
    creatingNpc: false,
    npcFormError: null,
    creatingVariantFor: null,
    variantFormError: null,
    editingNpcBasics: false,
    addingModelKind: null,
    modelParamEdits: {},
    modelParamErrors: {},
    variantSnapshots: {},
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
    packCreateForm: null,
    packListKind: 'bundle'
  };
  render();
};

render();
