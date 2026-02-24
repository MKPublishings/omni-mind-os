const { omniImageGenerate } = require("../index");

async function architectMode(prompt, options = {}) {
    const merged = {
        mode: "architect",
        stylePack: options.stylePack || "mythic_cinematic",
        quality: options.quality || "high",
        width: options.width,
        height: options.height,
        model: options.model,
        ...options
    };

    return omniImageGenerate(prompt, merged);
}

module.exports = architectMode;
