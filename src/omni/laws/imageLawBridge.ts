import { Laws } from "./lawRegistry";

export type LawReferenceMode = "symbolic" | "structural" | "color" | "motion";

export type LawReference = {
  id: string;
  weight?: number;
  mode?: LawReferenceMode;
};

export type LawVisualMapping = {
  id: string;
  palette?: string[];
  geometry?: string[];
  motion?: string[];
  symbols?: string[];
};

export type LawVisualInfluence = {
  ids: string[];
  palette: string[];
  geometry: string[];
  motion: string[];
  symbols: string[];
};

export const LAW_VISUAL_MAP: Record<string, LawVisualMapping> = {
  C22: {
    id: "C22",
    palette: ["warm amber", "soft gold"],
    geometry: ["layered memory bands"],
    symbols: ["book", "neuron"]
  },
  C33: {
    id: "C33",
    palette: ["adaptive gradient", "teal to orange"],
    geometry: ["branching paths", "iterative spiral"],
    motion: ["incremental shift"]
  },
  C36: {
    id: "C36",
    palette: ["deep crimson", "calming cyan"],
    geometry: ["compression arcs", "stabilizing ring"],
    motion: ["pulse", "recovery wave"],
    symbols: ["heartbeat", "balance scale"]
  },
  Q1: {
    id: "Q1",
    palette: ["black", "white", "electric cyan"],
    geometry: ["radiation field", "sphere"],
    symbols: ["equation glyph", "light burst"]
  },
  Q4: {
    id: "Q4",
    palette: ["midnight blue", "neon violet"],
    geometry: ["time bands", "energy contours"],
    motion: ["oscillation", "expansion"]
  }
};

function clampWeight(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.5;
  return Math.min(1, Math.max(0, numeric));
}

function takeWeighted(values: string[], weight: number): string[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  const count = Math.max(1, Math.round(values.length * weight));
  return values.slice(0, count);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function applyLawsToVisualInfluence(laws?: LawReference[]): LawVisualInfluence {
  const refs = Array.isArray(laws) ? laws : [];
  const palette: string[] = [];
  const geometry: string[] = [];
  const motion: string[] = [];
  const symbols: string[] = [];
  const ids: string[] = [];

  for (const ref of refs) {
    const lawId = String(ref?.id || "").trim();
    if (!lawId || !Laws.getById(lawId)) continue;

    const mapping = LAW_VISUAL_MAP[lawId];
    if (!mapping) continue;

    const weight = clampWeight(ref.weight);
    const mode = ref.mode;
    ids.push(lawId);

    if (!mode || mode === "color") {
      palette.push(...takeWeighted(mapping.palette || [], weight));
    }

    if (!mode || mode === "structural") {
      geometry.push(...takeWeighted(mapping.geometry || [], weight));
    }

    if (!mode || mode === "motion") {
      motion.push(...takeWeighted(mapping.motion || [], weight));
    }

    if (!mode || mode === "symbolic") {
      symbols.push(...takeWeighted(mapping.symbols || [], weight));
    }
  }

  return {
    ids: unique(ids),
    palette: unique(palette),
    geometry: unique(geometry),
    motion: unique(motion),
    symbols: unique(symbols)
  };
}

export function buildLawPromptDirectives(laws?: LawReference[]): string[] {
  const influence = applyLawsToVisualInfluence(laws);
  const directives: string[] = [];

  if (influence.palette.length) {
    directives.push(`law color palette: ${influence.palette.join(", ")}`);
  }

  if (influence.geometry.length) {
    directives.push(`law structural geometry: ${influence.geometry.join(", ")}`);
  }

  if (influence.motion.length) {
    directives.push(`law motion dynamics: ${influence.motion.join(", ")}`);
  }

  if (influence.symbols.length) {
    directives.push(`law symbolic motifs: ${influence.symbols.join(", ")}`);
  }

  if (influence.ids.length) {
    directives.push(`law references: ${influence.ids.join(", ")}`);
  }

  return directives;
}
