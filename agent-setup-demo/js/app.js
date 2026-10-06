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
    modelParamErrors: {}
  }
};

function render() {
  document.getElementById('ws-nav').innerHTML = renderNavTree(window.appState);
  document.getElementById('ws-center').innerHTML = renderCenterPane(window.appState);
  document.getElementById('ws-bag').innerHTML = renderBagPlaceholder();
  renderNpcPane(window.appState);
  renderModelSection(window.appState);
}

window.rerender = render;

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
    modelParamErrors: {}
  };
  render();
};

render();
