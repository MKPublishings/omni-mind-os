const styleConfig = require("../config/styleConfig.json");

function getStylePack(name) {
    return styleConfig.packs[name] || styleConfig.packs["mythic_cinematic"];
}

module.exports = {
    getStylePack
};
