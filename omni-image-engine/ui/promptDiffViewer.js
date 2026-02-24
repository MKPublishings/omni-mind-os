function tokenize(text) {
  return String(text || "")
    .split(/\s+/)
    .filter(Boolean);
}

function diffTokens(base, next) {
  const baseSet = new Set(tokenize(base));
  const nextSet = new Set(tokenize(next));

  const added = [...nextSet].filter((token) => !baseSet.has(token));
  const removed = [...baseSet].filter((token) => !nextSet.has(token));

  return { added, removed };
}

function buildPromptDiff({ userPrompt, expandedPrompt, optimizedPrompt }) {
  return {
    userToExpanded: diffTokens(userPrompt, expandedPrompt),
    expandedToOptimized: diffTokens(expandedPrompt, optimizedPrompt)
  };
}

module.exports = {
  buildPromptDiff
};
