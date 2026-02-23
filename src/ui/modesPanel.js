// @ts-check
import { get as getMemory, set as setMemory } from "../memory/memoryManager.js";

const MODE_STATE_KEY = "omni-ui-modes";

export function getModesState() {
  try {
    return JSON.parse(localStorage.getItem(MODE_STATE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

/** @param {string} name @param {boolean} enabled */
export function setModeState(name, enabled) {
  const state = getModesState();
  state[name] = !!enabled;
  localStorage.setItem(MODE_STATE_KEY, JSON.stringify(state));
  syncMemorySettings(state);
  return state;
}

/** @param {Record<string, boolean>} state */
function syncMemorySettings(state) {
  const current = getMemory("lastUsedSettings", {}) || {};
  setMemory("lastUsedSettings", {
    ...current,
    knowledgeMode: Boolean(state.knowledge),
    reasoningMode: Boolean(state.reasoning),
    codingMode: Boolean(state.coding),
    deepKnowledgeMode: Boolean(state.deepKnowledgeMode),
    stabilityMode: state.stabilityMode !== false,
    source: "modesPanel"
  });
}

/** @param {HTMLElement | null} containerEl */
export function mountModesPanel(containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = `
    <div class="ui-panel">
      <h4>Modes Panel</h4>
      <label><input type="checkbox" data-mode="knowledge" /> Knowledge Mode</label>
      <label><input type="checkbox" data-mode="reasoning" /> Reasoning Mode</label>
      <label><input type="checkbox" data-mode="coding" /> Coding Mode</label>
      <label><input type="checkbox" data-mode="deepKnowledgeMode" /> Deep Knowledge Mode</label>
      <label><input type="checkbox" data-mode="stabilityMode" /> Stability Mode</label>
      <label><input type="checkbox" data-mode="system-knowledge" /> System Knowledge Mode</label>
    </div>
  `;

  const current = getModesState();
  containerEl.querySelectorAll("input[data-mode]").forEach((input) => {
    const checkbox = /** @type {HTMLInputElement} */ (input);
    const mode = checkbox.getAttribute("data-mode");
    if (!mode) return;
    checkbox.checked = Boolean(current[mode]);
    checkbox.addEventListener("change", () => setModeState(mode, checkbox.checked));
  });
}
