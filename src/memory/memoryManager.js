import fs from "node:fs";
import path from "node:path";

const memoryFilePath = path.resolve(process.cwd(), "src/memory/memory.json");
let memoryCache = null;

function loadMemoryFile() {
  try {
    const raw = fs.readFileSync(memoryFilePath, "utf8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function persistMemory(data) {
  try {
    fs.writeFileSync(memoryFilePath, JSON.stringify(data, null, 2), "utf8");
  } catch {
    // ignore write failures in non-node environments
  }
}

function getStore() {
  if (!memoryCache) {
    memoryCache = loadMemoryFile();
  }
  return memoryCache;
}

export function get(key, fallback = null) {
  const store = getStore();
  if (!key) return store;
  return key in store ? store[key] : fallback;
}

export function set(key, value) {
  if (!key) return null;
  const store = getStore();
  store[key] = value;
  persistMemory(store);
  return store[key];
}

export function clear() {
  memoryCache = {};
  persistMemory(memoryCache);
  return memoryCache;
}
