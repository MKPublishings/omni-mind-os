export async function listModes() {
  return new Response(
    JSON.stringify(["Architect", "Lore", "Visual", "Analyst", "Simulation"]),
    { headers: { "Content-Type": "application/json" } }
  );
}