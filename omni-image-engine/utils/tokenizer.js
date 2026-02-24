module.exports = function tokenizer(text) {
    if (!text) return [];
    return text
        .split(/\s+/)
        .map(t => t.trim())
        .filter(Boolean);
};
