const fs = require("fs");

function hasExecutable(value) {
    const candidate = String(value || "").trim();
    if (!candidate) return false;
    try {
        return fs.existsSync(candidate);
    } catch (_error) {
        return false;
    }
}

function resolveFfmpegCommand() {
    const envOverride = String(process.env.OMNI_VIDEO_FFMPEG_PATH || "").trim();
    if (hasExecutable(envOverride)) {
        return envOverride;
    }

    try {
        const installer = require("@ffmpeg-installer/ffmpeg");
        if (hasExecutable(installer?.path)) {
            return installer.path;
        }
    } catch (_error) {
    }

    return "ffmpeg";
}

module.exports = {
    resolveFfmpegCommand
};