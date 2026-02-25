import dataset from "./laws.json";

export type LawDomain = "quantum" | "cognitive" | "physiological";

export type Law = {
  id: string;
  name: string;
  equation: string;
  domain: LawDomain;
  tags: string[];
};

export type LawDataset = {
  quantum_laws: Law[];
  cognitive_physiological_laws: Law[];
};

export type LawRegistry = {
  byId: Map<string, Law>;
  byTag: Map<string, Law[]>;
  byDomain: Map<LawDomain, Law[]>;
};

function normalizeTag(tag: string): string {
  return String(tag || "").trim().toLowerCase();
}

function normalizeLaw(law: Law): Law {
  return {
    ...law,
    tags: Array.isArray(law.tags)
      ? [...new Set(law.tags.map((tag) => normalizeTag(tag)).filter(Boolean))]
      : []
  };
}

export function buildLawRegistry(inputDataset: LawDataset): LawRegistry {
  const byId = new Map<string, Law>();
  const byTag = new Map<string, Law[]>();
  const byDomain = new Map<LawDomain, Law[]>([
    ["quantum", []],
    ["cognitive", []],
    ["physiological", []]
  ]);

  const allLaws = [...inputDataset.quantum_laws, ...inputDataset.cognitive_physiological_laws].map(normalizeLaw);

  for (const law of allLaws) {
    byId.set(law.id, law);
    byDomain.get(law.domain)?.push(law);

    for (const tag of law.tags) {
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)?.push(law);
    }
  }

  return { byId, byTag, byDomain };
}

const registry = buildLawRegistry(dataset as LawDataset);

export const Laws = {
  getById(id: string): Law | undefined {
    return registry.byId.get(String(id || "").trim());
  },
  getByTag(tag: string): Law[] {
    return registry.byTag.get(normalizeTag(tag)) || [];
  },
  getByDomain(domain: LawDomain): Law[] {
    return registry.byDomain.get(domain) || [];
  },
  listAll(): Law[] {
    return [...registry.byId.values()];
  },
  stats(): { total: number; byDomain: Record<LawDomain, number> } {
    return {
      total: registry.byId.size,
      byDomain: {
        quantum: registry.byDomain.get("quantum")?.length || 0,
        cognitive: registry.byDomain.get("cognitive")?.length || 0,
        physiological: registry.byDomain.get("physiological")?.length || 0
      }
    };
  }
};

export const lawRegistry = registry;
