const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const ROOT = process.cwd();
const SESSIONS_DIR = path.join(ROOT, "data", "sessions");
const TOKEN_QUEUE_FILE = path.join(SESSIONS_DIR, "task-tokens.jsonl");
const TOKEN_MAX_ENTRIES = 400;
const LOW_PRIORITY_MAX_AGE_HOURS = 72;
const DEDUPE_WINDOW_HOURS = 24;
const RESOLVED_MAX_AGE_HOURS = 24;
const IN_PROGRESS_TIMEOUT_HOURS = 6;
const ESCALATION_REOPEN_THRESHOLD = 2;
const TOKEN_STATUSES = ["open", "in-progress", "resolved"];
const PRIORITY_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1
};

function ensureTokenQueue() {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  if (!fs.existsSync(TOKEN_QUEUE_FILE)) {
    fs.writeFileSync(TOKEN_QUEUE_FILE, "", "utf8");
  }
}

function createTaskToken(input) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    type: input.type,
    contextFiles: Array.isArray(input.contextFiles) ? input.contextFiles : [],
    summary: String(input.summary || "").trim(),
    acceptanceCriteria: Array.isArray(input.acceptanceCriteria) ? input.acceptanceCriteria : [],
    priority: input.priority || "medium",
    createdBy: input.createdBy || "omni",
    status: normalizeStatus(input.status || "open"),
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    metadata: input.metadata || {}
  };
}

function appendTaskTokens(tokens) {
  ensureTokenQueue();
  const queue = compactQueue(loadTaskQueue());
  const now = new Date();
  const dedupeWindowMs = DEDUPE_WINDOW_HOURS * 60 * 60 * 1000;
  let appended = 0;

  for (const candidate of tokens || []) {
    if (!candidate || !candidate.summary) continue;

    const incoming = normalizeToken(candidate);
    const fingerprint = tokenFingerprint(incoming);
    const existingIndex = queue.findIndex((entry) => tokenFingerprint(entry) === fingerprint);

    if (existingIndex >= 0) {
      const existing = queue[existingIndex];
      if (existing.status === "resolved") {
        queue.push(incoming);
        appended += 1;
        continue;
      }

      const existingTime = Date.parse(existing.createdAt || "");
      if (Number.isFinite(existingTime) && now.getTime() - existingTime <= dedupeWindowMs) {
        const existingOccurrences = Number(existing?.metadata?.occurrences || 1);
        existing.updatedAt = now.toISOString();
        existing.metadata = {
          ...(existing.metadata || {}),
          lastSeenAt: now.toISOString(),
          occurrences: existingOccurrences + 1
        };
        queue[existingIndex] = existing;
        continue;
      }
    }

    queue.push(incoming);
    appended += 1;
  }

  saveTaskQueue(compactQueue(queue));
  return appended;
}

function normalizeToken(token) {
  const status = normalizeStatus(token.status || "open");
  const createdAt = token.createdAt || new Date().toISOString();
  const updatedAt = token.updatedAt || createdAt;
  const resolvedAt = status === "resolved"
    ? token.resolvedAt || updatedAt || createdAt
    : null;

  return {
    ...token,
    status,
    createdAt,
    updatedAt,
    resolvedAt,
    metadata: {
      ...(token.metadata || {}),
      occurrences: Number(token?.metadata?.occurrences || 1)
    }
  };
}

function normalizeStatus(status) {
  const value = String(status || "open").trim().toLowerCase();
  return TOKEN_STATUSES.includes(value) ? value : "open";
}

function tokenFingerprint(token) {
  const source = String(token?.metadata?.source || "").trim().toLowerCase();
  const command = String(token?.metadata?.command || "").trim().toLowerCase();
  return [
    String(token.type || "").trim().toLowerCase(),
    String(token.priority || "").trim().toLowerCase(),
    String(token.summary || "").trim().toLowerCase(),
    source,
    command
  ].join("|");
}

function loadTaskQueue() {
  if (!fs.existsSync(TOKEN_QUEUE_FILE)) {
    return [];
  }

  const raw = fs.readFileSync(TOKEN_QUEUE_FILE, "utf8");
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map(normalizeToken);
}

function saveTaskQueue(tokens) {
  const lines = tokens.map((token) => JSON.stringify(token));
  const payload = lines.length ? `${lines.join("\n")}\n` : "";
  fs.writeFileSync(TOKEN_QUEUE_FILE, payload, "utf8");
}

function compactQueue(tokens) {
  const now = Date.now();
  const maxAgeMs = LOW_PRIORITY_MAX_AGE_HOURS * 60 * 60 * 1000;
  const resolvedMaxAgeMs = RESOLVED_MAX_AGE_HOURS * 60 * 60 * 1000;
  const { tokens: timeoutAdjusted } = applyInProgressTimeouts(tokens || []);
  const active = timeoutAdjusted.filter((token) => {
    if (!token || !token.summary) return false;

    const status = normalizeStatus(token.status || "open");
    if (status === "resolved") {
      const resolvedAtMs = Date.parse(token.resolvedAt || token.updatedAt || token.createdAt || "");
      if (!Number.isFinite(resolvedAtMs)) return false;
      return now - resolvedAtMs <= resolvedMaxAgeMs;
    }

    if (String(token.priority || "").toLowerCase() !== "low") return true;

    const createdAtMs = Date.parse(token.createdAt || "");
    if (!Number.isFinite(createdAtMs)) return true;
    return now - createdAtMs <= maxAgeMs;
  });

  const byKey = new Map();
  for (const token of active) {
    const key = tokenFingerprint(token);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, token);
      continue;
    }

    const existingTime = Date.parse(existing.createdAt || "") || 0;
    const candidateTime = Date.parse(token.createdAt || "") || 0;
    if (candidateTime >= existingTime) {
      const existingOccurrences = Number(existing?.metadata?.occurrences || 1);
      const candidateOccurrences = Number(token?.metadata?.occurrences || 1);
      token.metadata = {
        ...(token.metadata || {}),
        occurrences: existingOccurrences + candidateOccurrences,
        lastSeenAt: token?.metadata?.lastSeenAt || new Date(candidateTime || Date.now()).toISOString()
      };
      byKey.set(key, token);
    } else {
      existing.metadata = {
        ...(existing.metadata || {}),
        occurrences: Number(existing?.metadata?.occurrences || 1) + Number(token?.metadata?.occurrences || 1),
        lastSeenAt: existing?.metadata?.lastSeenAt || new Date(existingTime || Date.now()).toISOString()
      };
      byKey.set(key, existing);
    }
  }

  const deduped = Array.from(byKey.values()).sort((a, b) => {
    const aTime = Date.parse(a.createdAt || "") || 0;
    const bTime = Date.parse(b.createdAt || "") || 0;
    return aTime - bTime;
  });

  if (deduped.length <= TOKEN_MAX_ENTRIES) {
    return deduped;
  }

  return deduped.slice(deduped.length - TOKEN_MAX_ENTRIES);
}

function applyInProgressTimeouts(tokens) {
  const nowIso = new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const timeoutMs = IN_PROGRESS_TIMEOUT_HOURS * 60 * 60 * 1000;
  const normalized = (tokens || []).map((token) => normalizeToken(token));
  const escalationAppends = [];
  let reopened = 0;
  let escalationsCreated = 0;

  const adjusted = normalized.map((token) => {
    if (token.status !== "in-progress") return token;

    const lastTouchedMs = Date.parse(token.updatedAt || token.createdAt || "");
    if (!Number.isFinite(lastTouchedMs)) return token;
    if (nowMs - lastTouchedMs <= timeoutMs) return token;

    reopened += 1;
    const reopenCount = Number(token?.metadata?.reopenCount || 0) + 1;
    const escalated = reopenCount >= ESCALATION_REOPEN_THRESHOLD;
    token.status = "open";
    token.updatedAt = nowIso;
    token.resolvedAt = null;
    token.metadata = {
      ...(token.metadata || {}),
      reopenCount,
      escalated,
      staleTimeoutHours: IN_PROGRESS_TIMEOUT_HOURS,
      statusHistory: [
        ...Array.isArray(token?.metadata?.statusHistory) ? token.metadata.statusHistory : [],
        {
          at: nowIso,
          status: "open",
          reason: "stale-in-progress-timeout"
        }
      ]
    };

    if (escalated && !hasActiveEscalationToken(normalized, token.id) && !hasActiveEscalationToken(escalationAppends, token.id)) {
      escalationAppends.push(createEscalationTokenFromBaseToken(token, nowIso));
      escalationsCreated += 1;
    }

    return token;
  });

  return {
    tokens: [...adjusted, ...escalationAppends],
    reopened,
    escalationsCreated
  };
}

function hasActiveEscalationToken(tokens, baseTokenId) {
  return (tokens || []).some((token) => {
    const status = normalizeStatus(token?.status || "open");
    if (status === "resolved") return false;
    return String(token?.metadata?.escalationForTokenId || "") === String(baseTokenId || "");
  });
}

function createEscalationTokenFromBaseToken(baseToken, nowIso) {
  const reopenCount = Number(baseToken?.metadata?.reopenCount || 0);
  const summary = String(baseToken?.summary || "Recurring stalled task").trim();
  const source = String(baseToken?.metadata?.source || "unknown");
  return createTaskToken({
    type: "bug",
    summary: `Escalation: repeated stale in-progress task (${summary})`,
    contextFiles: Array.isArray(baseToken?.contextFiles) ? baseToken.contextFiles : [],
    acceptanceCriteria: [
      "Identify blocker causing repeated in-progress timeout.",
      "Apply corrective action and prevent recurrence.",
      "Resolve both base task and escalation task once stable."
    ],
    priority: "high",
    createdBy: "omni",
    metadata: {
      source: "token-maintenance-escalation",
      escalationForTokenId: String(baseToken?.id || ""),
      escalationSource: source,
      escalationReason: "repeated-stale-reopen",
      reopenCount,
      escalatedAt: nowIso
    }
  });
}

function setTaskTokenStatus(tokenId, status) {
  ensureTokenQueue();
  const nextStatus = normalizeStatus(status);
  const queue = compactQueue(loadTaskQueue());
  const targetIndex = queue.findIndex((token) => String(token.id || "").trim() === String(tokenId || "").trim());
  if (targetIndex < 0) {
    return { updated: false, reason: "not-found", token: null };
  }

  const nowIso = new Date().toISOString();
  const token = normalizeToken(queue[targetIndex]);
  token.status = nextStatus;
  token.updatedAt = nowIso;
  token.resolvedAt = nextStatus === "resolved" ? nowIso : null;
  token.metadata = {
    ...(token.metadata || {}),
    statusHistory: [
      ...Array.isArray(token?.metadata?.statusHistory) ? token.metadata.statusHistory : [],
      {
        at: nowIso,
        status: nextStatus
      }
    ]
  };

  queue[targetIndex] = token;
  saveTaskQueue(compactQueue(queue));
  return { updated: true, reason: "ok", token };
}

function getActiveTaskTokensSorted() {
  const queue = compactQueue(loadTaskQueue());
  return queue
    .filter((token) => {
      const status = normalizeStatus(token?.status || "open");
      return status === "open" || status === "in-progress";
    })
    .sort((a, b) => {
      const aPriority = PRIORITY_WEIGHT[String(a?.priority || "low").toLowerCase()] || 1;
      const bPriority = PRIORITY_WEIGHT[String(b?.priority || "low").toLowerCase()] || 1;
      if (aPriority !== bPriority) return bPriority - aPriority;

      const aUpdated = Date.parse(String(a?.updatedAt || a?.createdAt || "")) || 0;
      const bUpdated = Date.parse(String(b?.updatedAt || b?.createdAt || "")) || 0;
      return bUpdated - aUpdated;
    });
}

function runTaskTokenMaintenance() {
  ensureTokenQueue();
  const loaded = loadTaskQueue();
  const timeoutAdjusted = applyInProgressTimeouts(loaded);
  const compacted = compactQueue(timeoutAdjusted.tokens);
  saveTaskQueue(compacted);

  return {
    total: compacted.length,
    reopened: timeoutAdjusted.reopened,
    escalationsCreated: timeoutAdjusted.escalationsCreated
  };
}

function getNextActionableTaskToken() {
  const active = getActiveTaskTokensSorted();
  return active[0] || null;
}

function buildEvaluationTaskTokens(input) {
  const tokens = [];
  const threshold = Number(input.threshold || 0.8);
  const score = Number(input.score || 0);

  if (score < threshold) {
    tokens.push(createTaskToken({
      type: "refactor",
      summary: "Run targeted quality and reliability hardening pass",
      contextFiles: ["src/mind/evaluators/sessionEvaluator.ts", "src/mind/evaluators/improvementProposer.ts"],
      acceptanceCriteria: [
        "Evaluation score returns above threshold for recent logs",
        "Findings list shrinks for recurring reliability issues"
      ],
      priority: "high",
      createdBy: "omni",
      metadata: {
        source: "mind-loop",
        score,
        threshold,
        logPath: input.logPath || null,
        contract: input.contract || null
      }
    }));
  } else {
    tokens.push(createTaskToken({
      type: "codex-update",
      summary: "Record healthy evaluation snapshot and monitor trend stability",
      contextFiles: ["codex/40-decisions"],
      acceptanceCriteria: [
        "Monitoring snapshot logged with threshold and score",
        "No unresolved high-priority tokens remain from previous cycle"
      ],
      priority: "low",
      createdBy: "omni",
      metadata: {
        source: "mind-loop",
        score,
        threshold,
        logPath: input.logPath || null,
        contract: input.contract || null
      }
    }));
  }

  return tokens;
}

function buildAutoDebugTaskTokens(input) {
  if (input.success) {
    return [
      createTaskToken({
        type: "codex-update",
        summary: "Auto-debug pass clean; no patch required",
        contextFiles: ["scripts/tools/runAutoDebug.js"],
        acceptanceCriteria: [
          "Latest debug command exits successfully",
          "No unresolved high-priority debug token remains"
        ],
        priority: "low",
        createdBy: "omni",
        metadata: {
          source: "auto-debugger",
          command: input.command,
          exitCode: input.exitCode
        }
      })
    ];
  }

  return [
    createTaskToken({
      type: "bug",
      summary: "Investigate failing test/debug command and apply minimal patch",
      contextFiles: ["scripts/tools/runAutoDebug.js", "src/tools/auto_debugger/autoDebugger.ts"],
      acceptanceCriteria: [
        "Failing command exits 0 after fix",
        "Typecheck and smoke tests remain green"
      ],
      priority: "high",
      createdBy: "omni",
      metadata: {
        source: "auto-debugger",
        command: input.command,
        exitCode: input.exitCode,
        stderr: String(input.stderr || "").slice(0, 2000),
        stdout: String(input.stdout || "").slice(0, 2000),
        proposedPatch: input.patch || null
      }
    })
  ];
}

module.exports = {
  TOKEN_QUEUE_FILE,
  TOKEN_MAX_ENTRIES,
  LOW_PRIORITY_MAX_AGE_HOURS,
  DEDUPE_WINDOW_HOURS,
  RESOLVED_MAX_AGE_HOURS,
  IN_PROGRESS_TIMEOUT_HOURS,
  ESCALATION_REOPEN_THRESHOLD,
  TOKEN_STATUSES,
  createTaskToken,
  appendTaskTokens,
  buildEvaluationTaskTokens,
  buildAutoDebugTaskTokens,
  loadTaskQueue,
  setTaskTokenStatus,
  getActiveTaskTokensSorted,
  getNextActionableTaskToken,
  runTaskTokenMaintenance
};
