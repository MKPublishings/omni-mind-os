// @ts-check
const CONFIDENCE_KEY = "omni-last-confidence";

/** @param {{ score?: number, band?: string, model?: string }} payload */
export function setLastConfidence(payload) {
  localStorage.setItem(CONFIDENCE_KEY, JSON.stringify(payload || {}));
}

export function getLastConfidence() {
  try {
    return JSON.parse(localStorage.getItem(CONFIDENCE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

/** @param {HTMLElement | null} containerEl */
export function mountConfidenceMeter(containerEl) {
  if (!containerEl) return;
  const confidence = getLastConfidence();
  const score = Number(confidence.score || 0);
  const percent = Math.round(score * 100);

  containerEl.innerHTML = `
    <div class="ui-panel">
      <h4>Confidence Meter</h4>
      <div style="height:10px;background:rgba(255,255,255,0.16);border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${percent}%;background:linear-gradient(135deg,#0F52BA,#ffffff);"></div>
      </div>
      <p><strong>Score:</strong> ${score.toFixed(2)} (${confidence.band || "n/a"})</p>
      <p><strong>Routed Model:</strong> ${confidence.model || "n/a"}</p>
    </div>
  `;
}
