async function run() {
  const endpoint = String(process.env.OMNI_VIDEO_SMOKE_URL || "http://127.0.0.1:8787/api/video/generate").trim();
  const timeoutMs = 45000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "generate a video of a crow",
        mode: "default",
        params: {
          width: 768,
          height: 432,
          num_frames: 24,
          fps: 12,
          num_inference_steps: 30,
          guidance_scale: 7.5
        },
        safety_level: "strict",
        watermark: true,
        return_format: "url",
        safetyProfile: {
          ageTier: "adult",
          humanVerified: true,
          nsfwAccess: false,
          explicitAllowed: false,
          illegalBlocked: true
        }
      }),
      signal: controller.signal
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const reason = String(payload?.error || payload?.detail || payload?.message || `HTTP ${response.status}`).trim();
      throw new Error(`Video route returned error: ${reason}`);
    }

    const status = String(payload?.status || "").trim().toLowerCase();
    const outputs = Array.isArray(payload?.outputs) ? payload.outputs : [];
    const video = outputs.find((item) => String(item?.type || "").toLowerCase() === "video") || outputs[0] || null;
    const url = String(video?.url || "").trim();

    if (status !== "completed") {
      throw new Error(`Unexpected response status: ${status || "<empty>"}`);
    }

    if (!url) {
      throw new Error("Video route completed but no video URL was returned");
    }

    const isFallback = Boolean(video?.metadata?.fallback);
    if (isFallback) {
      console.log(`✓ Video route smoke test passed (fallback mode): ${url}`);
      return;
    }

    console.log(`✓ Video route smoke test passed: ${url}`);
  } finally {
    clearTimeout(timeout);
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Video route smoke test failed: ${message}`);
  process.exitCode = 1;
});
