const dataset = require("../../src/omni/laws/laws.json");

function normalizeTag(tag) {
    return String(tag || "").trim().toLowerCase();
}

function normalizeLaw(law) {
    return {
        ...law,
        tags: Array.isArray(law.tags)
            ? [...new Set(law.tags.map((tag) => normalizeTag(tag)).filter(Boolean))]
            : []
    };
}

function buildLawRegistry(inputDataset) {
    const byId = new Map();
    const byTag = new Map();
    const byDomain = new Map([
        ["quantum", []],
        ["cognitive", []],
        ["physiological", []]
    ]);

    const all = [
        ...(inputDataset.quantum_laws || []),
        ...(inputDataset.cognitive_physiological_laws || [])
    ].map(normalizeLaw);

    for (const law of all) {
        byId.set(law.id, law);
        if (byDomain.has(law.domain)) {
            byDomain.get(law.domain).push(law);
        }

        for (const tag of law.tags) {
            if (!byTag.has(tag)) byTag.set(tag, []);
            byTag.get(tag).push(law);
        }
    }

    return { byId, byTag, byDomain };
}

const registry = buildLawRegistry(dataset);

const Laws = {
    getById(id) {
        return registry.byId.get(String(id || "").trim());
    },
    getByTag(tag) {
        return registry.byTag.get(normalizeTag(tag)) || [];
    },
    getByDomain(domain) {
        return registry.byDomain.get(domain) || [];
    },
    listAll() {
        return [...registry.byId.values()];
    }
};

module.exports = {
    Laws,
    buildLawRegistry,
    lawRegistry: registry
};
