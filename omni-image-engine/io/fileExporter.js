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

function sanitizeRatioLabel(ratio) {
    const raw = String(ratio || "").trim();
    if (!raw) return "";
    return raw.replace(/\s+/g, "").replace(/:/g, "x").replace(/[^a-zA-Z0-9x_-]/g, "");
}

async function exportImageWithMeta(buffer, options = {}) {
    ensureOutputDir();

    const format = String(options.format || "png").toLowerCase();
    const timestamp = formatDateTimeForFilename(new Date());
    const width = Number(options.width) || 0;
    const height = Number(options.height) || 0;
    const ratioLabel = sanitizeRatioLabel(options.ratio || options.aspectRatio || (width > 0 && height > 0 ? `${width}:${height}` : ""));
    const resolutionLabel = width > 0 && height > 0 ? `${width}x${height}` : "";

    const parts = ["omni_image", timestamp];
    if (ratioLabel) parts.push(ratioLabel);
    if (resolutionLabel) parts.push(resolutionLabel);

    const filename = `${parts.join("_")}.${format}`;
    const filePath = path.join(OUTPUT_DIR, filename);

    await fs.promises.writeFile(filePath, buffer);
    logger.info("Image exported:", filePath);
    return filePath;
}

module.exports = {
    exportImage,
    exportImageWithMeta
};
