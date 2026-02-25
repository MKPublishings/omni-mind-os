const { Laws } = require("./lawRegistry");

const LAW_VISUAL_MAP = {
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

function clampWeight(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0.5;
    return Math.min(1, Math.max(0, n));
}

function takeWeighted(values, weight) {
    if (!Array.isArray(values) || values.length === 0) return [];
    const count = Math.max(1, Math.round(values.length * weight));
    return values.slice(0, count);
}

function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
}

function applyLawsToVisualInfluence(laws) {
    const refs = Array.isArray(laws) ? laws : [];
    const ids = [];
    const palette = [];
    const geometry = [];
    const motion = [];
    const symbols = [];

    for (const ref of refs) {
        const lawId = String(ref && ref.id || "").trim();
        if (!lawId || !Laws.getById(lawId)) continue;

        const mapping = LAW_VISUAL_MAP[lawId];
        if (!mapping) continue;

        const weight = clampWeight(ref && ref.weight);
        const mode = ref && ref.mode;
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

function buildLawPromptDirectives(laws) {
    const influence = applyLawsToVisualInfluence(laws);
    const directives = [];

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

module.exports = {
    LAW_VISUAL_MAP,
    applyLawsToVisualInfluence,
    buildLawPromptDirectives
};
