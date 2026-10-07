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
    bagDetailCreateForm: null
  }
};

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
    bagDetailCreateForm: null
  };
  render();
};

render();
