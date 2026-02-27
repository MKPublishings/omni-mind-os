type ModeInfo = {
  id: string;
  label: string;
  summary: string;
  aliases: string[];
};

const MODE_INFOS: ModeInfo[] = [
  { id: "auto", label: "Auto", summary: "Automatically routes by task and confidence.", aliases: ["default"] },
  { id: "architect", label: "Architect", summary: "Structured design and systems planning.", aliases: ["design"] },
  { id: "analyst", label: "Analyst", summary: "Comparative analysis and trade-off evaluation.", aliases: ["analysis"] },
  { id: "visual", label: "Visual", summary: "Image/video prompt and visual reasoning support.", aliases: ["render"] },
  { id: "lore", label: "Lore", summary: "Narrative continuity and world-building context.", aliases: ["story"] },
  { id: "reasoning", label: "Reasoning", summary: "Step-wise logic and explanation-focused outputs.", aliases: ["logic"] },
  { id: "coding", label: "Coding", summary: "Implementation, refactor, and debugging assistance.", aliases: ["dev", "programming"] },
  { id: "knowledge", label: "Knowledge", summary: "Reference-driven responses from indexed sources.", aliases: ["retrieval"] },
  { id: "system-knowledge", label: "System Knowledge", summary: "Internal module/protocol-aware responses.", aliases: ["system knowledge"] },
  { id: "simulation", label: "Simulation", summary: "Stateful simulation and controlled scenario exploration.", aliases: ["sim"] }
];

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function listModes() {
  return json(MODE_INFOS.map((mode) => mode.label));
}

export async function listModeDetails() {
  return json({ ok: true, count: MODE_INFOS.length, modes: MODE_INFOS });
}

export async function getModeDetails(modeId: string) {
  const value = String(modeId || "").trim().toLowerCase();
  const mode = MODE_INFOS.find((entry) => entry.id === value || entry.aliases.includes(value));
  if (!mode) {
    return json({ ok: false, error: `Unknown mode '${value}'` }, 404);
  }
  return json({ ok: true, mode });
}