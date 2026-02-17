export async function ping() {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json" }
  });
}