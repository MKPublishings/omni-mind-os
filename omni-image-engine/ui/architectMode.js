const { omniImageGenerate } = require("../index");

async function architectMode(prompt, options = {}) {
    const merged = {
        mode: "architect",
        stylePack: options.stylePack || "mythic_cinematic",
        ...options
    };
    return omniImageGenerate(prompt, merged);
}

module.exports = architectMode;
