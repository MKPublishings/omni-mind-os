async function isEndpointReachable(baseUrl, method = "OPTIONS") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(baseUrl, {
      method,
      signal: controller.signal
    });
    return response.ok || response.status === 204 || response.status === 405;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function run() {
  const endpoint = String(process.env.OMNI_VIDEO_SMOKE_URL || "http://127.0.0.1:8787/api/video/generate").trim();
  const mediaHealthEndpoint = String(process.env.OMNI_MEDIA_HEALTH_URL || "http://127.0.0.1:8788/v1/health").trim();

  const workerReachable = await isEndpointReachable(endpoint, "OPTIONS");
  const mediaReachable = await isEndpointReachable(mediaHealthEndpoint, "GET");

  if (!workerReachable || !mediaReachable) {
    console.log(`- Video smoke skipped (worker/media unavailable): worker=${workerReachable}, media=${mediaReachable}`);
    return;
  }

  const { spawn } = await import("node:child_process");
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["./scripts/smoke/videoRouteSmoke.js"], {
      stdio: "inherit",
      env: process.env
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`video smoke exited with code ${code}`));
    });

    child.on("error", (error) => reject(error));
  });
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Conditional video smoke failed: ${message}`);
  process.exitCode = 1;
});
