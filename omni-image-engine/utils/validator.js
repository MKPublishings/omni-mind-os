module.exports = {
    ensureString(value, fallback = "") {
        if (typeof value === "string") return value;
        return fallback;
    }
};
