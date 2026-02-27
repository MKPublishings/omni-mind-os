const fs = require("fs");
const path = require("path");
const { formatDateTimeForFilename } = require("../../utils/datetime");

const OUTPUT_DIR = path.join(process.cwd(), "omni_video_exports");

function ensureOutputDir() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
}

async function exportVideoManifest(data) {
    ensureOutputDir();

    const timestamp = formatDateTimeForFilename(new Date());
    const filename = `omni_video_plan_${timestamp}.${data.format}.json`;
    const filePath = path.join(OUTPUT_DIR, filename);

    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
    return filePath;
}

module.exports = {
    exportVideoManifest
};