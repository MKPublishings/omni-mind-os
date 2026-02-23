console.log("system.js loaded");

const latencySpan = document.getElementById("latency");
const pingBtn = document.getElementById("ping-worker");

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