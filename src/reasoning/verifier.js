const CONTRADICTION_PATTERNS = [
  /\b(always)\b[\s\S]{0,80}\b(except|unless)\b/i,
  /\b(can(?:not|'t)? both|mutually exclusive)\b/i
];

export function verifyReasoning(draftText = "") {
  const text = String(draftText || "").trim();
  const issues = [];

  if (!text) {
    issues.push("empty-draft");
  }

  for (const pattern of CONTRADICTION_PATTERNS) {
    if (pattern.test(text)) {
      issues.push("possible-contradiction");
      break;
    }
  }

  if (!/[.!?]/.test(text)) {
    issues.push("low-structure");
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
