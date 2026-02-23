const MODE_STATE_KEY = "omni-ui-modes";

export function getModesState() {
  try {
    return JSON.parse(localStorage.getItem(MODE_STATE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export function setModeState(name, enabled) {
  const state = getModesState();
  state[name] = !!enabled;
  localStorage.setItem(MODE_STATE_KEY, JSON.stringify(state));
  return state;
}

export function mountModesPanel(containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = `
    <div class="ui-panel">
      <h4>Modes Panel</h4>
      <label><input type="checkbox" data-mode="knowledge" /> Knowledge Mode</label>
      <label><input type="checkbox" data-mode="reasoning" /> Reasoning Mode</label>
      <label><input type="checkbox" data-mode="coding" /> Coding Mode</label>
      <label><input type="checkbox" data-mode="system-knowledge" /> System Knowledge Mode</label>
    </div>
  `;

  const current = getModesState();
  containerEl.querySelectorAll("input[data-mode]").forEach((input) => {
    const mode = input.getAttribute("data-mode");
    input.checked = !!current[mode];
    input.addEventListener("change", () => setModeState(mode, input.checked));
  });
}
