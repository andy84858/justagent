window.appState = {
  data: cloneSeed(),
  selection: { npcCode: null, variantCode: null },
  uiState: { expandedNpcs: {} }
};

function render() {
  document.getElementById('ws-nav').innerHTML = renderNavTree(window.appState);
  document.getElementById('ws-center').innerHTML = renderCenterPane(window.appState);
  renderNpcPane(window.appState);
}

window.rerender = render;

window.resetData = function resetData() {
  window.appState.data = cloneSeed();
  window.appState.selection = { npcCode: null, variantCode: null };
  window.appState.uiState = { expandedNpcs: {} };
  render();
};

render();
