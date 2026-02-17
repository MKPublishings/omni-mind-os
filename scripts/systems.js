console.log("system.js loaded");

const latencySpan = document.getElementById("latency");
const pingBtn = document.getElementById("ping-worker");

pingBtn?.addEventListener("click", async () => {
  const start = performance.now();
  try {
    const res = await fetch("/api/omni", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "ping" })
    });
    const end = performance.now();
    if (!res.ok) throw new Error(res.status);
    latencySpan.textContent = Math.round(end - start);
  } catch (err) {
    console.error("Ping error:", err);
    latencySpan.textContent = "ERR";
  }
});