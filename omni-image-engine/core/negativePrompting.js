const fs = require("fs");
const path = require("path");

const NEGATIVE_PATH = path.join(__dirname, "..", "config", "negativeTags.json");

function getNegativeTags() {
  const raw = fs.readFileSync(NEGATIVE_PATH, "utf8");
  const json = JSON.parse(raw);
  return Array.isArray(json?.negativeTags) ? json.negativeTags : [];
}

module.exports = {
  getNegativeTags
};
