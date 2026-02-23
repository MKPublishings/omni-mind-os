// @ts-check
import fs from "node:fs";
import path from "node:path";

/** @typedef {import("../types/omni").MemoryState} MemoryState */

const memoryFilePath = path.resolve(process.cwd(), "src/memory/memory.json");
/** @type {MemoryState | undefined} */
let memoryCache;
const MAX_TOPIC_COUNT = 3;
const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;
/** @type {MemoryState} */
const DEFAULT_MEMORY = {
  preferredMode: "architect",
  tone: "concise",
  structure: "sectioned",
  memoryInfluenceLevel: "medium",
  lastTopics: [],
  lastUsedSettings: {
    knowledgeMode: false,
    reasoningMode: false,
    codingMode: false,
    deepKnowledgeMode: false,
    stabilityMode: true
  },
  updatedAt: 0
};

function loadMemoryFile() {
  try {
    const raw = fs.readFileSync(memoryFilePath, "utf8");
    return { ...DEFAULT_MEMORY, ...(JSON.parse(raw || "{}") || {}) };
  } catch {
    return { ...DEFAULT_MEMORY };
  }
}

/** @param {MemoryState} data */
function persistMemory(data) {
  try {
    fs.writeFileSync(memoryFilePath, JSON.stringify(data, null, 2), "utf8");
  } catch {
    // ignore write failures in non-node environments
  }
}

function getStore() {
  if (!memoryCache) {
    const loaded = loadMemoryFile();
    maybeCleanup(loaded);
    memoryCache = loaded;
  }
  return /** @type {MemoryState} */ (memoryCache);
}

/** @param {unknown} topic */
function summarizeTopic(topic) {
  const text = String(topic || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

/** @param {MemoryState} store */
function compressStore(store) {
  const next = { ...(store || {}) };
  next.lastTopics = Array.isArray(next.lastTopics)
    ? next.lastTopics.map(summarizeTopic).filter(Boolean).slice(-MAX_TOPIC_COUNT)
    : [];
  next.updatedAt = Date.now();
  return next;
}

/** @param {MemoryState} store */
function maybeCleanup(store) {
  const updatedAt = Number(store?.updatedAt || 0);
  if (!updatedAt) return;

  if (Date.now() - updatedAt > MEMORY_TTL_MS) {
    store.lastTopics = [];
    store.lastUsedSettings = {
      knowledgeMode: false,
      reasoningMode: false,
      codingMode: false,
      deepKnowledgeMode: false,
      stabilityMode: true
    };
    store.updatedAt = Date.now();
    persistMemory(store);
  }
}

/** @param {string | null} key @param {any} fallback */
export function get(key, fallback = null) {
  const store = getStore();
  if (!key) return store;
  return key in store ? store[key] : fallback;
}

/** @param {string} key @param {any} value */
export function set(key, value) {
  if (!key) return null;
  const store = getStore();
  store[key] = value;
  const compressed = compressStore(store);
  memoryCache = compressed;
  persistMemory(compressed);
  return store[key];
}

/** @param {unknown} topic */
export function pushTopic(topic) {
  const store = getStore();
  const topics = Array.isArray(store.lastTopics) ? store.lastTopics : [];
  topics.push(summarizeTopic(topic));
  store.lastTopics = topics.slice(-MAX_TOPIC_COUNT);
  const compressed = compressStore(store);
  memoryCache = compressed;
  persistMemory(compressed);
  return compressed.lastTopics;
}

export function clear() {
  memoryCache = { ...DEFAULT_MEMORY, updatedAt: Date.now() };
  persistMemory(memoryCache);
  return memoryCache;
}
