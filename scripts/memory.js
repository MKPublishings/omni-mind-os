console.log("memory.js loaded");

const memoryList = document.getElementById("memory-list");
const refreshMemoriesBtn = document.getElementById("refresh-memories");
const clearMemoriesBtn = document.getElementById("clear-memories");

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