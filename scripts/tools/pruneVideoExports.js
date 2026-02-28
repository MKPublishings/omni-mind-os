const fs = require("fs");
const path = require("path");

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readArg(name) {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length).trim();
    }
  }
  return "";
}

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

function getAllFiles(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function cleanupEmptyDirectories(rootDir) {
  const stack = [rootDir];
  const dirs = [];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    dirs.push(current);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        stack.push(path.join(current, entry.name));
      }
    }
  }

  dirs.sort((a, b) => b.length - a.length);

  let removed = 0;
  for (const dir of dirs) {
    if (dir === rootDir) continue;
    try {
      const entries = fs.readdirSync(dir);
      if (entries.length === 0) {
        fs.rmdirSync(dir);
        removed += 1;
      }
    } catch {
      // ignore
    }
  }

  return removed;
}

function main() {
  const projectRoot = process.cwd();
  const defaultDir = process.env.OMNI_VIDEO_EXPORT_DIR || "omni_video_exports";
  const requestedDir = readArg("dir") || defaultDir;
  const exportDir = path.resolve(projectRoot, requestedDir);

  const maxAgeDays = parseInteger(
    readArg("max-age-days") || process.env.OMNI_VIDEO_EXPORT_MAX_AGE_DAYS || "7",
    7
  );
  const maxFiles = parseInteger(
    readArg("max-files") || process.env.OMNI_VIDEO_EXPORT_MAX_FILES || "200",
    200
  );

  const apply = hasFlag("apply");
  const nowMs = Date.now();
  const cutoffMs = nowMs - maxAgeDays * 24 * 60 * 60 * 1000;

  if (!fs.existsSync(exportDir)) {
    console.log(`[video-prune] export directory not found: ${exportDir}`);
    process.exit(0);
  }

  const allFiles = getAllFiles(exportDir)
    .filter((filePath) => /\.(mp4|gif|webm|mov)$/i.test(filePath))
    .map((filePath) => {
      const stats = fs.statSync(filePath);
      return {
        path: filePath,
        mtimeMs: stats.mtimeMs,
        sizeBytes: stats.size,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const byAge = allFiles.filter((file) => file.mtimeMs < cutoffMs);
  const byCount = allFiles.slice(Math.max(0, maxFiles));

  const pruneMap = new Map();
  for (const file of [...byAge, ...byCount]) {
    pruneMap.set(file.path, file);
  }
  const toPrune = Array.from(pruneMap.values()).sort((a, b) => a.mtimeMs - b.mtimeMs);

  const totalBytes = allFiles.reduce((sum, file) => sum + file.sizeBytes, 0);
  const pruneBytes = toPrune.reduce((sum, file) => sum + file.sizeBytes, 0);

  console.log(`[video-prune] directory: ${exportDir}`);
  console.log(`[video-prune] filesFound: ${allFiles.length}`);
  console.log(`[video-prune] totalBytes: ${totalBytes}`);
  console.log(`[video-prune] maxAgeDays: ${maxAgeDays}`);
  console.log(`[video-prune] maxFiles: ${maxFiles}`);
  console.log(`[video-prune] candidates: ${toPrune.length}`);
  console.log(`[video-prune] reclaimableBytes: ${pruneBytes}`);
  console.log(`[video-prune] mode: ${apply ? "apply" : "preview"}`);

  for (const file of toPrune.slice(0, 20)) {
    console.log(`- ${path.relative(projectRoot, file.path)} (${file.sizeBytes} bytes)`);
  }
  if (toPrune.length > 20) {
    console.log(`... and ${toPrune.length - 20} more`);
  }

  if (!apply) {
    console.log("[video-prune] preview only. Re-run with --apply to delete files.");
    process.exit(0);
  }

  let deleted = 0;
  for (const file of toPrune) {
    try {
      fs.unlinkSync(file.path);
      deleted += 1;
    } catch {
      // ignore individual deletion errors
    }
  }

  const removedDirs = cleanupEmptyDirectories(exportDir);
  console.log(`[video-prune] deletedFiles: ${deleted}`);
  console.log(`[video-prune] removedEmptyDirs: ${removedDirs}`);
}

main();
