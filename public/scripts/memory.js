console.log("memory.js loaded");

const memoryList = document.getElementById("memory-list");
const refreshMemoriesBtn = document.getElementById("refresh-memories");
const clearMemoriesBtn = document.getElementById("clear-memories");
const persistSimulationMemoryToggle = document.getElementById("persist-simulation-memory");
const clearSimulationMemoryBtn = document.getElementById("clear-simulation-memory");
const SIM_MEMORY_PERSIST_KEY = "omni-simulation-persist-memory";
const CHAT_SESSIONS_KEY = "omni_chat_sessions_v1";

async function loadMemories() {
  if (!memoryList) return;
  memoryList.innerHTML = "<p>Loading memories…</p>";

  try {
    // Placeholder: replace with real endpoint when ready
    const res = await fetch("/api/memory");
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();

    if (!data || !data.items || data.items.length === 0) {
      memoryList.innerHTML = "<p>No memories stored yet.</p>";
      return;
    }

    memoryList.innerHTML = "";
    data.items.forEach((m) => {
      const div = document.createElement("div");
      div.className = "feature-card";
      div.innerHTML = `<strong>${m.key}</strong><p>${m.value}</p>`;
      memoryList.appendChild(div);
    });
  } catch (err) {
    console.error("Memory load error:", err);
    memoryList.innerHTML = "<p>Failed to load memories.</p>";
  }
}

refreshMemoriesBtn?.addEventListener("click", loadMemories);

clearMemoriesBtn?.addEventListener("click", async () => {
  if (!confirm("Clear all memories?")) return;
  try {
    await fetch("/api/memory", { method: "DELETE" });
    memoryList.innerHTML = "<p>All memories cleared.</p>";
  } catch (err) {
    console.error("Clear memories error:", err);
  }
});

loadMemories();

if (persistSimulationMemoryToggle) {
  persistSimulationMemoryToggle.checked = localStorage.getItem(SIM_MEMORY_PERSIST_KEY) === "true";
  persistSimulationMemoryToggle.addEventListener("change", () => {
    localStorage.setItem(SIM_MEMORY_PERSIST_KEY, persistSimulationMemoryToggle.checked ? "true" : "false");
  });
}

clearSimulationMemoryBtn?.addEventListener("click", () => {
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const sessions = parsed?.sessions || {};

    for (const id of Object.keys(sessions)) {
      if (sessions[id]?.simulation) {
        sessions[id].simulation.logs = [];
        sessions[id].simulation.steps = 0;
        sessions[id].simulation.status = "inactive";
      }
    }

    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(parsed));
    alert("Simulation memory cleared.");
  } catch (err) {
    console.error("Clear simulation memory error:", err);
  }
});