// @ts-check
const SETTINGS_KEY = "omni-ui-settings";

export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export function saveSettings(nextSettings = {}) {
  const merged = { ...getSettings(), ...nextSettings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}

/** @param {HTMLElement | null} containerEl */
export function mountSettingsPanel(containerEl) {
  if (!containerEl) return;

  const settings = getSettings();
  containerEl.innerHTML = `
    <div class="ui-panel">
      <h4>Settings Panel</h4>
      <label>Preferred tone <input data-key="tone" value="${settings.tone || "concise"}" /></label>
      <label>Response structure <input data-key="structure" value="${settings.structure || "sectioned"}" /></label>
      <button data-action="save">Save</button>
    </div>
  `;

  containerEl.querySelector("[data-action=save]")?.addEventListener("click", () => {
    const toneInput = /** @type {HTMLInputElement | null} */ (containerEl.querySelector("[data-key=tone]"));
    const structureInput = /** @type {HTMLInputElement | null} */ (containerEl.querySelector("[data-key=structure]"));
    const tone = toneInput?.value || "concise";
    const structure = structureInput?.value || "sectioned";
    saveSettings({ tone, structure });
  });
}
