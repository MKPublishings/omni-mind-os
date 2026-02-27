export async function ping() {
  return new Response(
    JSON.stringify({
      status: "ok",
      service: "omni-mind-os",
      timestamp: new Date().toISOString(),
      runtime: "cloudflare-workers"
    }),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
}