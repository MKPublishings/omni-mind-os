export async function listModes() {
  return new Response(
    JSON.stringify([
      "Auto",
      "Architect",
      "Analyst",
      "Visual",
      "Lore",
      "Reasoning",
      "Coding",
      "Knowledge",
      "System Knowledge",
      "Simulation"
    ]),
    { headers: { "Content-Type": "application/json" } }
  );
}