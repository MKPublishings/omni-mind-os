console.log("tools.js loaded");

const toolList = document.getElementById("tool-list");
const lastToolLog = document.getElementById("last-tool-log");
const refreshToolsBtn = document.getElementById("refresh-tools");

async function loadTools() {
  if (!toolList) return;
  toolList.innerHTML = "<p>Loading tools…</p>";

  try {
    // Placeholder: replace with real endpoint when ready
    const res = await fetch("/api/tools");
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();

    toolList.innerHTML = "";
    (data.tools || []).forEach((t) => {
      const div = document.createElement("div");
      div.className = "feature-card";
      div.innerHTML = `<strong>${t.name}</strong><p>${t.description}</p>`;
      toolList.appendChild(div);
    });

    if (data.last_call) {
      lastToolLog.innerHTML = `<pre>${JSON.stringify(data.last_call, null, 2)}</pre>`;
    }
  } catch (err) {
    console.error("Tools load error:", err);
    toolList.innerHTML = "<p>Failed to load tools.</p>";
  }
}

refreshToolsBtn?.addEventListener("click", loadTools);

loadTools();

document.querySelectorAll("[data-send-chat]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const prompt = btn.getAttribute("data-send-chat") || "";
    if (!prompt) return;
    localStorage.setItem("omni-tools-prompt", prompt);
    window.location.href = "/chat.html";
  });
});