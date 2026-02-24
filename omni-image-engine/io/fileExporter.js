const fs = require("fs");
const path = require("path");
const { formatDateTimeForFilename } = require("../utils/datetime");
const logger = require("../utils/logger");

const OUTPUT_DIR = path.join(process.cwd(), "omni_image_exports");

function ensureOutputDir() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
}

async function exportImage(buffer, format = "png") {
    ensureOutputDir();

    const timestamp = formatDateTimeForFilename(new Date());
    const filename = `omni_image_${timestamp}.${format}`;
    const filePath = path.join(OUTPUT_DIR, filename);

    await fs.promises.writeFile(filePath, buffer);

    logger.info("Image exported:", filePath);
    return filePath;
}

module.exports = {
    exportImage
};
