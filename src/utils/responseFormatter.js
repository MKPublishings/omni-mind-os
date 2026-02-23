// @ts-check

/** @param {string} text */
function ensureFencedCode(text) {
  if (!/```[\s\S]*?```/.test(text)) {
    return `${text}\n\n\`\`\`txt\n(no code block provided)\n\`\`\``;
  }
  return text;
}

/** @param {string} text @param {{ maxSections?: number, maxParagraphsPerSection?: number }} [options] */
function enforceStability(text, options = {}) {
  const maxSections = Number.isFinite(options.maxSections) ? options.maxSections : 4;
  const maxParagraphsPerSection = Number.isFinite(options.maxParagraphsPerSection)
    ? options.maxParagraphsPerSection
    : 3;

  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const sections = normalized.split(/\n(?=#|\*\*)/g).slice(0, maxSections);
  const clipped = sections.map((section) => {
    const paragraphs = section.split(/\n\n+/).slice(0, maxParagraphsPerSection);
    return paragraphs.join("\n\n");
  });

  return clipped.join("\n\n").trim();
}

/** @param {string} text @param {{ mode?: string, stabilityMode?: boolean }} [options] */
export function formatResponse(text, options = {}) {
  const raw = String(text || "").trim();
  if (!raw) return "No response generated.";

  let output = raw;

  if (options.stabilityMode !== false) {
    output = enforceStability(output, {
      maxSections: 4,
      maxParagraphsPerSection: 3
    });
  }

  if (options.mode === "coding") {
    output = ensureFencedCode(output);
  }

  return output;
}

/** @param {string} text */
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
