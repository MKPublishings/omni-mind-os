export function estimateTokens(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.33);
}

export function chunkText(text, { minTokens = 300, maxTokens = 500 } = {}) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const targetWords = Math.max(minTokens, Math.min(maxTokens, 420));
  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(words.length, start + targetWords);
    const slice = words.slice(start, end).join(" ").trim();
    if (slice) {
      chunks.push({
        text: slice,
        tokens: estimateTokens(slice)
      });
    }
    start = end;
  }

  return chunks;
}

export function buildChunksFromDocuments(documents = []) {
  const output = [];

  for (const doc of documents) {
    const content = String(doc?.content || "").trim();
    const source = String(doc?.source || "unknown");
    if (!content) continue;

    const chunks = chunkText(content);
    chunks.forEach((chunk, index) => {
      output.push({
        id: `${source}#${index + 1}`,
        source,
        text: chunk.text,
        tokens: chunk.tokens
      });
    });
  }

  return output;
}
