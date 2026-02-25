const ENVIRONMENTS = [
    "bedroom", "room", "forest", "city", "street", "cafe", "office",
    "studio", "kitchen", "mountains", "desert", "classroom",
    "library", "garage", "basement", "attic", "garden", "cathedral"
];

module.exports = function extractEnvironment(prompt) {
    const lower = String(prompt || "").toLowerCase();
    return ENVIRONMENTS.filter(env => lower.includes(env));
};
