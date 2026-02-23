import fs from "node:fs";
import path from "node:path";
import { searchKnowledge } from "./ragWorker.js";
import { get as getMemory } from "../memory/memoryManager.js";

const retrievalCache = [];
const MAX_CACHE_ITEMS = 10;

function readModule(name) {
  try {
    const filePath = path.resolve(process.cwd(), `src/modules/${name}`);
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function moduleCandidates(query = "") {
  const text = String(query || "").toLowerCase();
  const picks = [];

  if (/\b(identity|omni|who are you)\b/.test(text)) picks.push("identity_layer.md");
  if (/\b(rule|policy|system)\b/.test(text)) picks.push("system_rules.md");
  if (/\b(mode|architect|reasoning|coding|creative)\b/.test(text)) picks.push("modes_reference.md");
  if (!picks.length) picks.push("omni_philosophy.md");

  return picks;
}

function rankSources(query = "", sources = []) {
  const q = String(query || "").toLowerCase();

  return sources
    .map((item) => {
      const text = String(item?.text || "").toLowerCase();
      let score = 0;
      for (const term of q.split(/\s+/).filter((t) => t.length > 2)) {
        if (text.includes(term)) score += 1;
      }
      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score);
}

export function runTieredRetrieval({ query = "", deepKnowledgeMode = false } = {}) {
  const moduleSource = moduleCandidates(query)
    .map((name) => ({ source: `module:${name}`, text: readModule(name) }))
    .filter((item) => item.text.trim().length > 0);

  const ragSource = searchKnowledge(query, { topK: deepKnowledgeMode ? 6 : 3 }).map((hit) => ({
    source: `rag:${hit.source || "index"}`,
    text: hit.text || ""
  }));

  const memory = getMemory(null, {});
  const memorySource = [{
    source: "memory:preferences",
    text: JSON.stringify(memory, null, 2)
  }];

  const fallbackSource = [{
    source: "fallback:heuristic",
    text: `No direct match found for: ${String(query || "")}`
  }];

  const ranked = rankSources(query, [...moduleSource, ...ragSource, ...memorySource, ...fallbackSource]);
  const top = ranked.filter((item) => item.score > 0).slice(0, deepKnowledgeMode ? 3 : 2);
  const selected = top.length ? top : ranked.slice(0, 1);

  retrievalCache.unshift({
    query,
    at: Date.now(),
    results: selected
  });

  if (retrievalCache.length > MAX_CACHE_ITEMS) {
    retrievalCache.splice(MAX_CACHE_ITEMS);
  }

  return {
    selected,
    cacheSize: retrievalCache.length,
    sourcePriority: ["Modules", "RAG", "Memory", "Fallback"]
  };
}

export function getRetrievalCache() {
  return [...retrievalCache];
}
