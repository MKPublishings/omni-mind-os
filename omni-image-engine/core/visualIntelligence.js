class VisualIntelligence {
  constructor({ memorySize = 12 } = {}) {
    this.memorySize = memorySize;
    this.history = [];
  }

  inferSpatialLayout(prompt) {
    const lower = String(prompt || "").toLowerCase();
    if (lower.includes("close-up")) return "tight portrait framing";
    if (lower.includes("wide")) return "wide environmental framing";
    if (lower.includes("top-down")) return "top-down layered composition";
    return "balanced cinematic composition";
  }

  inferLightingDirection(prompt) {
    const lower = String(prompt || "").toLowerCase();
    if (lower.includes("sunset") || lower.includes("golden hour")) return "side-lit warm key light";
    if (lower.includes("neon")) return "multi-directional neon practicals";
    if (lower.includes("moonlight")) return "cool top-left moon key with soft fill";
    return "motivated key light with atmospheric fill";
  }

  inferCharacterPosture(prompt) {
    const lower = String(prompt || "").toLowerCase();
    if (lower.includes("hero") || lower.includes("warrior")) return "grounded heroic stance";
    if (lower.includes("calm") || lower.includes("meditative")) return "relaxed, centered posture";
    return "natural expressive pose";
  }

  inferEmotionalTone(prompt) {
    const lower = String(prompt || "").toLowerCase();
    if (lower.includes("dark")) return "ominous, high-contrast tension";
    if (lower.includes("joy") || lower.includes("happy")) return "uplifted and radiant";
    if (lower.includes("mythic")) return "sacred mythic grandeur";
    return "cinematic emotional clarity";
  }

  buildInsights(prompt) {
    return {
      spatialLayout: this.inferSpatialLayout(prompt),
      lightingDirection: this.inferLightingDirection(prompt),
      characterPosture: this.inferCharacterPosture(prompt),
      emotionalTone: this.inferEmotionalTone(prompt)
    };
  }

  registerGeneration(entry) {
    this.history.push({
      ...entry,
      timestamp: Date.now()
    });

    if (this.history.length > this.memorySize) {
      this.history.shift();
    }
  }

  getRecentGenerations() {
    return [...this.history];
  }

  inferConsistencyHints(characterId) {
    const relevant = this.history.filter((item) => item.characterId && item.characterId === characterId);
    if (!relevant.length) return [];

    const latest = relevant[relevant.length - 1];
    return [
      latest.stylePack ? `maintain style:${latest.stylePack}` : null,
      latest.lighting ? `maintain lighting:${latest.lighting}` : null,
      latest.palette ? `maintain palette:${latest.palette}` : null
    ].filter(Boolean);
  }
}

module.exports = {
  VisualIntelligence
};
