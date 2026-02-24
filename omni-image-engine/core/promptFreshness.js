module.exports = function applyFreshness(options = {}) {
    return {
        ...options,
        seed: options.seed || Math.floor(Math.random() * 999999999),
        fresh: true
    };
};
