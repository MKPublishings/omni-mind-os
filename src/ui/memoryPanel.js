import { get, set, clear } from "../memory/memoryManager.js";

export function mountMemoryPanel(containerEl) {
  if (!containerEl) return;

  const memory = get(null, {});
  const currentInfluence = memory?.memoryInfluenceLevel || "medium";

  containerEl.innerHTML = `
    <div class="ui-panel">
      <h4>Memory Panel</h4>
      <label>
        Influence
        <select data-key="memoryInfluenceLevel">
          <option value="low" ${currentInfluence === "low" ? "selected" : ""}>Low</option>
          <option value="medium" ${currentInfluence === "medium" ? "selected" : ""}>Medium</option>
          <option value="high" ${currentInfluence === "high" ? "selected" : ""}>High</option>
        </select>
      </label>
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
    const memoryInfluenceLevel = containerEl.querySelector("[data-key=memoryInfluenceLevel]")?.value || "medium";
    set("memoryInfluenceLevel", memoryInfluenceLevel);
    set("lastUsedSettings", {
      ...(get("lastUsedSettings", {}) || {}),
      deepKnowledgeMode: Boolean(get("lastUsedSettings", {})?.deepKnowledgeMode),
      stabilityMode: get("lastUsedSettings", {})?.stabilityMode !== false,
      source: "memoryPanel"
    });
    render();
  });

  containerEl.querySelector("[data-action=reset]")?.addEventListener("click", () => {
    clear();
    render();
  });
}
