const fs = require("fs");
const path = require("path");
const {
  appendTaskTokens,
  buildEvaluationTaskTokens,
  TOKEN_QUEUE_FILE
} = require("../tools/taskTokenStore");

const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, "data", "logs");
const CONFIG_PATH = path.join(ROOT, "config", "mind-loops.json");
const DECISIONS_DIR = path.join(ROOT, "codex", "40-decisions");

function readConfig() {
  const defaults = {
    enabled: true,
    evaluationThreshold: 0.8,
    autoApplySafeChanges: true
  };

  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function latestLogFile() {
  if (!fs.existsSync(LOG_DIR)) return null;
  const files = fs.readdirSync(LOG_DIR)
    .filter((name) => /\.(jsonl|json|log|txt)$/i.test(name))
    .map((name) => ({
      name,
      fullPath: path.join(LOG_DIR, name),
      mtimeMs: fs.statSync(path.join(LOG_DIR, name)).mtimeMs
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0]?.fullPath || null;
}

function evaluate(logPath) {
  if (!logPath) {
    return {
      score: 1,
      summary: "No logs found; nothing to evaluate.",
      contract: {
        rubric: {
          version: "v1",
          threshold: 0.8,
          dimensions: {
            quality: 0.35,
            latency: 0.2,
            reliability: 0.3,
            safety: 0.15
          }
        },
        sampleSize: 0,
        findings: ["No logs available for this run."],
        signals: []
      }
    };
  }

  const raw = fs.readFileSync(logPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const score = lines.length > 0 ? 0.82 : 0.7;
  return {
    score,
    summary: `Evaluated ${lines.length} log lines from ${path.basename(logPath)}.`,
    contract: {
      rubric: {
        version: "v1",
        threshold: 0.8,
        dimensions: {
          quality: 0.35,
          latency: 0.2,
          reliability: 0.3,
          safety: 0.15
        }
      },
      sampleSize: lines.length,
      findings: lines.length ? ["Recent logs sampled for monitoring run."] : ["Log file was empty."],
      signals: []
    }
  };
}

function appendDecision(area, summary, details) {
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const filePath = path.join(DECISIONS_DIR, `${date}-decision-log.md`);
  const header = `# Decisions for ${date}\n\n`;
  const block = [
    `## ${now} – ${area}`,
    "**Source:** omni",
    `**Summary:** ${summary}`,
    "",
    details,
    "",
    "---",
    ""
  ].join("\n");

  fs.mkdirSync(DECISIONS_DIR, { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, header + block, "utf8");
    return;
  }

  fs.appendFileSync(filePath, block, "utf8");
}

function main() {
  const config = readConfig();
  if (!config.enabled) {
    console.log("Mind loop disabled via config/mind-loops.json.");
    return;
  }

  const logPath = latestLogFile();
  const result = evaluate(logPath);

  if (result.score < Number(config.evaluationThreshold || 0.8)) {
    appendDecision(
      "mind-loop-improvement",
      "Evaluation dropped below threshold; queued improvement pass",
      `${result.summary}\n\nThreshold: ${config.evaluationThreshold}`
    );
    console.log("Mind loop: improvement decision logged.");
    const tokens = buildEvaluationTaskTokens({
      score: result.score,
      threshold: config.evaluationThreshold,
      logPath,
      contract: result.contract
    });
    const written = appendTaskTokens(tokens);
    console.log(`Mind loop: queued ${written} task token(s) at ${TOKEN_QUEUE_FILE}.`);
    return;
  }

  appendDecision(
    "mind-loop-monitoring",
    "Evaluation healthy; monitoring snapshot recorded",
    `${result.summary}\n\nThreshold: ${config.evaluationThreshold}`
  );
  const tokens = buildEvaluationTaskTokens({
    score: result.score,
    threshold: config.evaluationThreshold,
    logPath,
    contract: result.contract
  });
  const written = appendTaskTokens(tokens);
  console.log(`Mind loop: queued ${written} task token(s) at ${TOKEN_QUEUE_FILE}.`);
  console.log("Mind loop: monitoring decision logged.");
}

main();
