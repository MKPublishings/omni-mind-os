const fs = require("fs");
const path = require("path");

const CONFIG_DIR = path.join(__dirname, "..", "config");
const REQUIRED_FILES = [
  "modelConfig.json",
  "styleConfig.json",
  "qualityTags.json",
  "negativeTags.json"
];

function validate() {
  const issues = [];

  for (const file of REQUIRED_FILES) {
    const full = path.join(CONFIG_DIR, file);
    if (!fs.existsSync(full)) {
      issues.push(`Missing config: ${file}`);
      continue;
    }

    try {
      const raw = fs.readFileSync(full, "utf8");
      JSON.parse(raw);
    } catch (err) {
      issues.push(`Invalid JSON in ${file}: ${err.message}`);
    }
  }

  if (issues.length) {
    console.error("[omni-image-engine] validation failed");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log("[omni-image-engine] config validation passed");
}

if (require.main === module) {
  validate();
}

module.exports = {
  validate
};
