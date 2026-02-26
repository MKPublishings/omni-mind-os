console.log("system.js loaded");

const latencySpan = document.getElementById("latency");
const pingBtn = document.getElementById("ping-worker");
const simStatusEl = document.getElementById("sim-status");
const simIdEl = document.getElementById("sim-id");
const simStepsEl = document.getElementById("sim-steps");
const simMemoryEl = document.getElementById("sim-memory");
const terminateSimulationBtn = document.getElementById("terminate-simulation");
const CHAT_SESSIONS_KEY = "omni_chat_sessions_v1";

function getApiEndpoint() {
  try {
    const saved = localStorage.getItem("omni-endpoint") || "";
    return saved.trim() || "/api/omni";
  } catch {
    return "/api/omni";
  }
}

pingBtn?.addEventListener("click", async () => {
  const start = performance.now();
  pingBtn.disabled = true;
  if (latencySpan) latencySpan.textContent = "...";

  try {
    const res = await fetch(getApiEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "omni",
        mode: "chat",
        messages: [{ role: "user", content: "ping" }]
      })
    });

    const end = performance.now();
    if (!res.ok) throw new Error(res.status);

    if (latencySpan) latencySpan.textContent = String(Math.round(end - start));
  } catch (err) {
    console.error("Ping error:", err);
    if (latencySpan) latencySpan.textContent = "ERR";
  } finally {
    pingBtn.disabled = false;
  }
});

function readSimulationSnapshot() {
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const activeSessionId = parsed?.activeSessionId;
    const session = activeSessionId ? parsed?.sessions?.[activeSessionId] : null;
    if (!session?.simulation) return null;
    return session.simulation;
  } catch {
    return null;
  }
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 KB";
  return `${(value / 1024).toFixed(2)} KB`;
}

function estimateSimMemory(snapshot) {
  try {
    return new TextEncoder().encode(JSON.stringify(snapshot || {})).length;
  } catch {
    return JSON.stringify(snapshot || {}).length;
  }
}

function renderSimulationStatus() {
  const simulation = readSimulationSnapshot();
  const status = simulation?.status || "inactive";
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  if (simStatusEl) simStatusEl.textContent = statusLabel;
  if (simIdEl) simIdEl.textContent = simulation?.id || "--";
  if (simStepsEl) simStepsEl.textContent = String(Number(simulation?.steps || 0));
  if (simMemoryEl) simMemoryEl.textContent = formatBytes(estimateSimMemory(simulation));
}

terminateSimulationBtn?.addEventListener("click", () => {
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const session = parsed?.sessions?.[parsed?.activeSessionId];
    if (!session?.simulation) return;

    session.simulation.status = "inactive";
    session.simulation.logs = Array.isArray(session.simulation.logs) ? session.simulation.logs : [];
    session.simulation.logs.push({ ts: Date.now(), message: "Simulation terminated from System page." });
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(parsed));
    renderSimulationStatus();
  } catch (err) {
    console.error("Terminate simulation error:", err);
  }
});

renderSimulationStatus();