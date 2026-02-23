import searchIndex from "./searchIndex.json";

function scoreChunk(query, chunkText) {
  const terms = String(query || "").toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const body = String(chunkText || "").toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (body.includes(term)) score += 1;
  }

  return score;
}

export function searchKnowledge(query, { topK = 4 } = {}) {
  const chunks = Array.isArray(searchIndex?.chunks) ? searchIndex.chunks : [];

  const ranked = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(query, chunk.text) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item) => ({
      ...item.chunk,
      score: item.score,
      source: item.chunk?.source || "index"
    }));

  return ranked;
}

export async function handleRagRequest(request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const topK = Number(url.searchParams.get("topK") || 4);

  const hits = searchKnowledge(query, { topK: Math.max(1, Math.min(10, topK)) });

  return new Response(JSON.stringify({ query, hits }), {
    headers: { "Content-Type": "application/json" }
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    return handleRagRequest(request);
  }
};
