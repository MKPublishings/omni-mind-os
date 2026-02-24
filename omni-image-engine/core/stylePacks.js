const path = require("path");
const fs = require("fs");

const STYLE_CONFIG_PATH = path.join(__dirname, "..", "config", "styleConfig.json");

function loadStyleConfig() {
  const raw = fs.readFileSync(STYLE_CONFIG_PATH, "utf8");
  return JSON.parse(raw);
}

function getStylePack(styleName = "OS-Cinematic") {
  const config = loadStyleConfig();
  const packs = config?.stylePacks || {};
  const selected = packs[styleName] || packs[config.defaultStyle] || packs["OS-Cinematic"];

  return {
    name: styleName in packs ? styleName : config.defaultStyle,
    ...(selected || {
      lightingRules: [],
      colorRules: [],
      compositionRules: [],
      textureRules: [],
      emotionalSignatures: []
    })
  };
}

function listStylePacks() {
  const config = loadStyleConfig();
  return Object.keys(config?.stylePacks || {});
}

module.exports = {
  loadStyleConfig,
  getStylePack,
  listStylePacks
};
