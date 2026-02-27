const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = process.cwd();
const CODEX_DIR = path.join(ROOT, "codex");
const REINDEX_SCRIPT = path.join(ROOT, "scripts", "codex", "reindex.js");
const DEBOUNCE_MS = 300;

let debounceTimer = null;
let isRunning = false;
let rerunRequested = false;

const watchedExtensions = new Set([".md", ".json"]);

function isCodexArtifact(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  if (!normalized.startsWith(CODEX_DIR.replace(/\\/g, "/"))) {
    return false;
  }

  if (normalized.endsWith("/index.json") || normalized.endsWith("/index.schema.json")) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  return watchedExtensions.has(ext);
}

function runReindex(triggerReason) {
  if (isRunning) {
    rerunRequested = true;
    return;
  }

  isRunning = true;
  const startedAt = new Date().toISOString();
  console.log(`[codex:watch] reindex start (${startedAt}) reason=${triggerReason}`);

  const child = spawn(process.execPath, [REINDEX_SCRIPT], {
    cwd: ROOT,
    stdio: "inherit"
  });

  child.on("exit", (code) => {
    isRunning = false;
    if (code === 0) {
      console.log("[codex:watch] reindex complete");
    } else {
      console.error(`[codex:watch] reindex failed (exit ${code})`);
    }

    if (rerunRequested) {
      rerunRequested = false;
      runReindex("queued-change");
    }
  });
}

function queueReindex(reason) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runReindex(reason);
  }, DEBOUNCE_MS);
}

function watchDirectoryRecursive(dirPath, watchedPaths = new Set()) {
  if (!fs.existsSync(dirPath)) {
    return watchedPaths;
  }

  const register = (targetPath) => {
    if (watchedPaths.has(targetPath)) {
      return;
    }

    try {
      fs.watch(targetPath, (eventType, fileName) => {
        if (!fileName) {
          queueReindex(`event:${eventType}`);
          return;
        }

        const changedPath = path.join(targetPath, fileName.toString());

        if (fs.existsSync(changedPath)) {
          try {
            const stats = fs.statSync(changedPath);
            if (stats.isDirectory()) {
              watchDirectoryRecursive(changedPath, watchedPaths);
              queueReindex(`new-dir:${path.relative(ROOT, changedPath).replace(/\\/g, "/")}`);
              return;
            }
          } catch (_error) {
            queueReindex(`event:${eventType}`);
            return;
          }
        }

        if (isCodexArtifact(changedPath)) {
          queueReindex(`artifact:${path.relative(ROOT, changedPath).replace(/\\/g, "/")}`);
        }
      });

      watchedPaths.add(targetPath);
    } catch (error) {
      console.warn(`[codex:watch] unable to watch ${targetPath}: ${error.message}`);
    }
  };

  register(dirPath);

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const childDir = path.join(dirPath, entry.name);
    register(childDir);
    watchDirectoryRecursive(childDir, watchedPaths);
  }

  return watchedPaths;
}

function main() {
  if (!fs.existsSync(CODEX_DIR)) {
    console.error("[codex:watch] codex directory not found.");
    process.exit(1);
  }

  runReindex("startup");
  const watched = watchDirectoryRecursive(CODEX_DIR);
  console.log(`[codex:watch] watching ${watched.size} directories under codex/`);
  console.log("[codex:watch] press Ctrl+C to stop");
}

main();
