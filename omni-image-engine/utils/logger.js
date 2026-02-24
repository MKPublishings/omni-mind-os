function info(...args) {
    console.log("[OMNI-IMAGE-ENGINE]", ...args);
}

function error(...args) {
    console.error("[OMNI-IMAGE-ENGINE][ERROR]", ...args);
}

module.exports = {
    info,
    error
};
