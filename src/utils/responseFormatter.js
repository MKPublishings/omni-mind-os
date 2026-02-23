function ensureFencedCode(text) {
  if (!/```[\s\S]*?```/.test(text)) {
    return `${text}\n\n\`\`\`txt\n(no code block provided)\n\`\`\``;
  }
  return text;
}

export function formatResponse(text, options = {}) {
  const raw = String(text || "").trim();
  if (!raw) return "No response generated.";

  if (options.mode === "coding") {
    return ensureFencedCode(raw);
  }

  return raw;
}

export function toHtmlWithBasicHighlight(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) => {
      const language = lang || "code";
      return `<pre class=\"code-block\" data-lang=\"${language}\"><code>${code}</code></pre>`;
    });
}
