async function run() {
  const healthUrl = String(process.env.OMNI_VIDEO_HEALTH_URL || "http://127.0.0.1:8787/api/video/health").trim();
  const videoUrl = String(process.env.OMNI_VIDEO_GENERATE_URL || "http://127.0.0.1:8787/api/video/generate").trim();
  const prompt = String(process.env.OMNI_VIDEO_SMOKE_PROMPT || "a video of a forest in the rain").trim();

  const healthRes = await fetch(healthUrl, { method: "GET" });
  const health = await healthRes.json().catch(() => ({}));

  if (!healthRes.ok) {
    throw new Error(`Health endpoint failed (${healthRes.status})`);
  }

  const ready = Boolean(health?.real_video_backend_ready);
  if (!ready) {
    throw new Error(
      `Real video backend not ready. Health: ${JSON.stringify(health)}`
    );
  }

  const payload = {
    prompt,
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
  };

  const generateRes = await fetch(videoUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await generateRes.json().catch(() => ({}));
  if (!generateRes.ok) {
    throw new Error(`Generation endpoint failed (${generateRes.status}): ${JSON.stringify(result)}`);
  }

  if (String(result?.status || "").toLowerCase() !== "completed") {
    throw new Error(`Generation status is not completed: ${JSON.stringify(result)}`);
  }

  const outputs = Array.isArray(result?.outputs) ? result.outputs : [];
  const video = outputs.find((item) => String(item?.type || "").toLowerCase() === "video") || outputs[0] || null;
  const outputUrl = String(video?.url || "").trim();

  if (!outputUrl) {
    throw new Error(`No video URL in generation output: ${JSON.stringify(result)}`);
  }

  if (Boolean(video?.metadata?.fallback)) {
    throw new Error(`Fallback output detected; expected real backend output: ${JSON.stringify(video?.metadata || {})}`);
  }

  if (!Boolean(video?.metadata?.prompt_aware)) {
    throw new Error(`Output is missing prompt_aware metadata: ${JSON.stringify(video?.metadata || {})}`);
  }

  console.log(`✓ Provider video smoke passed: ${outputUrl}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Provider video smoke failed: ${message}`);
  process.exitCode = 1;
});
