const styleConfig = require("../config/styleConfig.json");

function getStylePack(name) {
    if (!name) {
        return { name: "none", tags: [] };
    }

    return styleConfig.packs[name] || { name: "none", tags: [] };
}

module.exports = {
    getStylePack
};
