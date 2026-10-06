window.appState = {
  data: cloneSeed(),
  selection: { npcCode: null, variantCode: null }
};

function render() {
  // Expanded in Task 3 (nav tree) and Task 5 (center pane routing).
}

window.rerender = render;

window.resetData = function resetData() {
  window.appState.data = cloneSeed();
  window.appState.selection = { npcCode: null, variantCode: null };
  render();
};

render();
