const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = process.cwd();
const CODEX_ROOT = path.join(ROOT, "codex");
const REINDEX_SCRIPT = path.join(ROOT, "scripts", "codex", "reindex.js");

function toCodexRelative(inputPath) {
  const absolute = path.isAbsolute(inputPath) ? inputPath : path.resolve(ROOT, inputPath);
  const relative = path.relative(CODEX_ROOT, absolute).replace(/\\/g, "/");

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Artifact must be inside codex/");
  }

  return `codex/${relative}`;
}

function touchFile(absolutePath) {
  const now = new Date();
  fs.utimesSync(absolutePath, now, now);
}

function main() {
  const artifactArg = process.argv[2];
  if (!artifactArg) {
    console.error("Usage: npm run codex:register -- <path-to-artifact-inside-codex>");
    process.exit(1);
  }

  const absolute = path.isAbsolute(artifactArg) ? artifactArg : path.resolve(ROOT, artifactArg);

  if (!fs.existsSync(absolute)) {
    console.error(`Artifact not found: ${artifactArg}`);
    process.exit(1);
  }

  const rel = toCodexRelative(absolute);
  touchFile(absolute);

  const result = spawnSync(process.execPath, [REINDEX_SCRIPT], {
    stdio: "inherit",
    cwd: ROOT
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  console.log(`Registered artifact: ${rel}`);
}

main();
