import { mountModesPanel } from "../src/ui/modesPanel.js";
import { mountMemoryPanel } from "../src/ui/memoryPanel.js";
import { mountRouterInspector } from "../src/ui/routerInspector.js";
import { mountSettingsPanel } from "../src/ui/settingsPanel.js";
import { mountConfidenceMeter } from "../src/ui/confidenceMeter.js";

function ensurePanel(id, title) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("section");
    el.id = id;
    el.style.margin = "12px 0";
    el.setAttribute("aria-label", title);
    document.body.appendChild(el);
  }
  return el;
}

export function mountOmniPanels() {
  mountModesPanel(ensurePanel("omni-modes-panel", "Modes"));
  mountMemoryPanel(ensurePanel("omni-memory-panel", "Memory"));
  mountRouterInspector(ensurePanel("omni-router-panel", "Router Inspector"));
  mountConfidenceMeter(ensurePanel("omni-confidence-panel", "Confidence"));
  mountSettingsPanel(ensurePanel("omni-settings-panel", "Settings"));
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", mountOmniPanels);
}
