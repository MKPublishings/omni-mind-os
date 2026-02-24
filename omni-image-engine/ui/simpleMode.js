const { omniImageGenerate } = require("../index");

async function simpleMode(prompt) {
    return omniImageGenerate(prompt, { mode: "simple" });
}

module.exports = simpleMode;
