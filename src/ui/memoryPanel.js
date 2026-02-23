import { get, set, clear } from "../memory/memoryManager.js";

export function mountMemoryPanel(containerEl) {
  if (!containerEl) return;

  containerEl.innerHTML = `
    <div class="ui-panel">
      <h4>Memory Panel</h4>
      <button data-action="save">Save Preferences</button>
      <button data-action="reset">Reset Memory</button>
      <pre data-memory></pre>
    </div>
  `;

  const output = containerEl.querySelector("[data-memory]");
  const render = () => {
    if (!output) return;
    output.textContent = JSON.stringify(get(null, {}), null, 2);
  };

  render();

  containerEl.querySelector("[data-action=save]")?.addEventListener("click", () => {
    set("lastUsedSettings", {
      timestamp: Date.now(),
      source: "memoryPanel"
    });
    render();
  });

  containerEl.querySelector("[data-action=reset]")?.addEventListener("click", () => {
    clear();
    render();
  });
}
