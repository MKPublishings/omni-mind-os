function tokenize(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function countTokens(text) {
  return tokenize(text).length;
}

function truncateByTokenBudget(text, maxTokens = 350) {
  const tokens = tokenize(text);
  if (tokens.length <= maxTokens) return tokens.join(" ");
  return tokens.slice(0, maxTokens).join(" ");
}

module.exports = {
  tokenize,
  countTokens,
  truncateByTokenBudget
};
