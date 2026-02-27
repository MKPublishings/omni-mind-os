const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const CODEX_DIR = path.join(ROOT, "codex");
const INDEX_PATH = path.join(CODEX_DIR, "index.json");
const SCHEMA_REL = "./index.schema.json";

const CHAMBER_ROOTS = [
  "laws",
  "systems",
  "mythic",
  "visual-dialect",
  "equations",
  "glossary"
];

const LEGACY_FILES = [
  "00-index.md",
  "10-architecture.md",
  "20-protocols.md",
  "30-patterns.md",
  "50-mind-path-map.md",
  "60-internal-mind-contracts.md"
];

function normalizeRel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function toIsoMs(ms) {
  return new Date(ms).toISOString();
}

function tryReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

function parseYamlValue(raw) {
  const value = raw.trim();
  if (!value.length) return "";
  if ((value.startsWith("[") && value.endsWith("]")) || (value.startsWith("{") && value.endsWith("}"))) {
    try {
      return JSON.parse(value.replace(/'/g, '"'));
    } catch (_error) {
      return value;
    }
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (!Number.isNaN(Number(value)) && /^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  return value;
}

function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) {
    return { data: {}, body: content };
  }

  const endIndex = content.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return { data: {}, body: content };
  }

  const rawBlock = content.slice(4, endIndex);
  const body = content.slice(endIndex + 5);
  const data = {};

  for (const line of rawBlock.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sepIndex = trimmed.indexOf(":");
    if (sepIndex < 1) continue;
    const key = trimmed.slice(0, sepIndex).trim();
    const rawValue = trimmed.slice(sepIndex + 1).trim();
    data[key] = parseYamlValue(rawValue);
  }

  return { data, body };
}

function listFilesRecursive(dirPath) {
  const output = [];
  if (!fs.existsSync(dirPath)) {
    return output;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      output.push(...listFilesRecursive(full));
      continue;
    }
    output.push(full);
  }

  return output;
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === "string" && value.length) {
    return [value];
  }
  return [];
}

function inferCategory(relPath) {
  const rel = relPath.replace(/^codex\//, "");
  const segments = rel.split("/");
  if (segments.length >= 2) {
    return `${segments[0]}/${segments[1]}`;
  }
  return segments[0] || "unknown";
}

function inferTypeFromPath(relPath) {
  const rel = relPath.replace(/^codex\//, "");
  if (rel.startsWith("laws/")) return "law";
  if (rel.startsWith("systems/")) return "system";
  if (rel.startsWith("mythic/checkpoints/")) return "mythic-checkpoint";
  if (rel.startsWith("mythic/archetypes/")) return "archetype";
  if (rel.startsWith("visual-dialect/registers/")) return "visual-register";
  if (rel.startsWith("visual-dialect/motifs/")) return "visual-motif";
  if (rel.startsWith("equations/templates/")) return "equation-template";
  if (rel.startsWith("equations/solved/")) return "equation-solved";
  if (rel.startsWith("glossary/")) return "glossary";
  return "artifact";
}

function inferTitleFromFileName(fileName) {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function hashIdFromPath(relPath) {
  return relPath
    .replace(/^codex\//, "")
    .replace(/\.[^/.]+$/, "")
    .replace(/\//g, ".")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}

function parseMdArtifact(filePath) {
  const relPath = normalizeRel(filePath);
  const stats = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = parseFrontmatter(content);

  const id = String(parsed.data.id || hashIdFromPath(relPath));
  const title = String(parsed.data.title || inferTitleFromFileName(path.basename(filePath)));

  return {
    id,
    path: relPath,
    title,
    type: String(parsed.data.type || inferTypeFromPath(relPath)),
    category: String(parsed.data.category || inferCategory(relPath)),
    symbol: parsed.data.symbol ? String(parsed.data.symbol) : undefined,
    tags: normalizeArray(parsed.data.tags),
    links: normalizeArray(parsed.data.links),
    lineage: normalizeArray(parsed.data.lineage),
    createdAt: toIsoMs(stats.birthtimeMs || stats.ctimeMs),
    updatedAt: toIsoMs(stats.mtimeMs),
    text: parsed.body
  };
}

function parseJsonArtifact(filePath) {
  const relPath = normalizeRel(filePath);
  const stats = fs.statSync(filePath);
  const data = tryReadJson(filePath);
  if (!data) {
    return null;
  }

  if (relPath === "codex/glossary/terms.json" && Array.isArray(data)) {
    return data.map((entry, index) => {
      const id = String(entry.id || `glossary.term.${index + 1}`);
      const title = String(entry.term || entry.title || id);
      return {
        id,
        path: relPath,
        title,
        type: "glossary",
        category: "glossary/terms",
        symbol: entry.symbol ? String(entry.symbol) : undefined,
        tags: normalizeArray(entry.tags),
        links: normalizeArray(entry.links),
        lineage: normalizeArray(entry.lineage),
        createdAt: toIsoMs(stats.birthtimeMs || stats.ctimeMs),
        updatedAt: toIsoMs(stats.mtimeMs),
        text: String(entry.definition || "")
      };
    });
  }

  const id = String(data.id || hashIdFromPath(relPath));
  const title = String(data.title || inferTitleFromFileName(path.basename(filePath)));

  return {
    id,
    path: relPath,
    title,
    type: String(data.type || inferTypeFromPath(relPath)),
    category: String(data.category || inferCategory(relPath)),
    symbol: data.symbol ? String(data.symbol) : undefined,
    tags: normalizeArray(data.tags),
    links: normalizeArray(data.links),
    lineage: normalizeArray(data.lineage),
    createdAt: String(data.createdAt || toIsoMs(stats.birthtimeMs || stats.ctimeMs)),
    updatedAt: String(data.updatedAt || toIsoMs(stats.mtimeMs)),
    text: String(data.equation || data.definition || "")
  };
}

function collectArtifacts() {
  const collected = [];

  for (const chamber of CHAMBER_ROOTS) {
    const chamberPath = path.join(CODEX_DIR, chamber);
    for (const filePath of listFilesRecursive(chamberPath)) {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".md") {
        collected.push(parseMdArtifact(filePath));
        continue;
      }
      if (ext === ".json") {
        const parsed = parseJsonArtifact(filePath);
        if (Array.isArray(parsed)) {
          collected.push(...parsed);
        } else if (parsed) {
          collected.push(parsed);
        }
      }
    }
  }

  for (const legacyFile of LEGACY_FILES) {
    const filePath = path.join(CODEX_DIR, legacyFile);
    if (!fs.existsSync(filePath)) continue;
    const stats = fs.statSync(filePath);
    const relPath = normalizeRel(filePath);
    collected.push({
      id: `legacy.codex.${legacyFile.replace(/\.md$/, "")}`,
      path: relPath,
      title: inferTitleFromFileName(legacyFile),
      type: "legacy",
      category: "legacy",
      tags: ["legacy", "codex"],
      links: [],
      lineage: [],
      createdAt: toIsoMs(stats.birthtimeMs || stats.ctimeMs),
      updatedAt: toIsoMs(stats.mtimeMs),
      text: ""
    });
  }

  return collected;
}

function buildCategorySummary(entries) {
  const map = new Map();
  for (const entry of entries) {
    const key = entry.category || "unknown";
    if (!map.has(key)) {
      map.set(key, { id: key.replace(/\//g, "."), path: key, count: 0 });
    }
    map.get(key).count += 1;
  }
  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function buildCrossLinks(entries) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const links = [];
  const seen = new Set();

  for (const entry of entries) {
    for (const explicitTarget of entry.links || []) {
      if (!byId.has(explicitTarget)) continue;
      const key = `${entry.id}->${explicitTarget}:explicit`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ source: entry.id, target: explicitTarget, reason: "explicit", score: 1 });
    }
  }

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const first = entries[i];
      const second = entries[j];
      const overlap = first.tags.filter((tag) => second.tags.includes(tag));
      if (overlap.length < 2) continue;

      const score = Number((overlap.length / Math.max(first.tags.length, second.tags.length)).toFixed(3));
      const reason = `tag-overlap:${overlap.join(",")}`;

      const keyForward = `${first.id}->${second.id}:${reason}`;
      if (!seen.has(keyForward)) {
        seen.add(keyForward);
        links.push({ source: first.id, target: second.id, reason, score });
      }

      const keyReverse = `${second.id}->${first.id}:${reason}`;
      if (!seen.has(keyReverse)) {
        seen.add(keyReverse);
        links.push({ source: second.id, target: first.id, reason, score });
      }
    }
  }

  return links.sort((a, b) => {
    if (a.source === b.source) return a.target.localeCompare(b.target);
    return a.source.localeCompare(b.source);
  });
}

function applyAutoLinks(entries, crossLinks) {
  const grouped = new Map();
  for (const edge of crossLinks) {
    if (!grouped.has(edge.source)) {
      grouped.set(edge.source, []);
    }
    grouped.get(edge.source).push(edge.target);
  }

  return entries.map((entry) => {
    const autoLinks = [...new Set(grouped.get(entry.id) || [])].filter((target) => !(entry.links || []).includes(target));
    return {
      ...entry,
      autoLinks
    };
  });
}

function sanitizeEntry(entry) {
  const out = {
    id: entry.id,
    path: entry.path,
    title: entry.title,
    type: entry.type,
    category: entry.category,
    tags: entry.tags,
    links: entry.links,
    autoLinks: entry.autoLinks,
    lineage: entry.lineage,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };

  if (entry.symbol) {
    out.symbol = entry.symbol;
  }

  return out;
}

function ensureUniqueIds(entries) {
  const seen = new Map();
  for (const entry of entries) {
    if (!seen.has(entry.id)) {
      seen.set(entry.id, 0);
      continue;
    }

    const nextIndex = seen.get(entry.id) + 1;
    seen.set(entry.id, nextIndex);
    entry.id = `${entry.id}.${nextIndex}`;
  }
}

function buildIndex() {
  const entries = collectArtifacts();
  ensureUniqueIds(entries);

  entries.sort((a, b) => a.path.localeCompare(b.path) || a.id.localeCompare(b.id));

  const crossLinks = buildCrossLinks(entries);
  const entriesWithAuto = applyAutoLinks(entries, crossLinks);
  const categories = buildCategorySummary(entriesWithAuto);

  return {
    $schema: SCHEMA_REL,
    meta: {
      name: "Omni Living Codex",
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      entryCount: entriesWithAuto.length,
      lineage: [
        "legacy.codex.00-index",
        "legacy.codex.10-architecture",
        "legacy.codex.20-protocols",
        "legacy.codex.30-patterns",
        "legacy.codex.40-decisions",
        "legacy.codex.50-mind-path-map",
        "legacy.codex.60-internal-mind-contracts"
      ]
    },
    categories,
    entries: entriesWithAuto.map(sanitizeEntry),
    crossLinks
  };
}

function main() {
  if (!fs.existsSync(CODEX_DIR)) {
    console.error("codex directory not found");
    process.exit(1);
  }

  const index = buildIndex();
  fs.writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  console.log(`Codex indexed: ${index.meta.entryCount} entries, ${index.crossLinks.length} cross-links.`);
}

main();
