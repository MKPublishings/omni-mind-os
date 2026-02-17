export async function listModes() {
  return new Response(
    JSON.stringify(["Architect", "Lore", "Visual", "Analyst"]),
    { headers: { "Content-Type": "application/json" } }
  );
}