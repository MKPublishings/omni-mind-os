const fs = require("fs");
const path = require("path");
const {
  TOKEN_QUEUE_FILE,
  TOKEN_MAX_ENTRIES,
  LOW_PRIORITY_MAX_AGE_HOURS,
  DEDUPE_WINDOW_HOURS,
  loadTaskQueue
} = require("./taskTokenStore");

const queuePath = TOKEN_QUEUE_FILE;

if (!fs.existsSync(queuePath)) {
  console.log("Task token queue not found.");
  process.exit(0);
}

const tokens = loadTaskQueue();
if (!tokens.length) {
  console.log("Task token queue is empty.");
  process.exit(0);
}

console.log(`Task token queue entries: ${tokens.length}`);
console.log(`Queue policy: max=${TOKEN_MAX_ENTRIES}, low-priority-age=${LOW_PRIORITY_MAX_AGE_HOURS}h, dedupe-window=${DEDUPE_WINDOW_HOURS}h`);
for (const token of tokens.slice(-10)) {
  const source = String(token?.metadata?.source || "unknown");
  const occurrences = Number(token?.metadata?.occurrences || 1);
  const status = String(token?.status || "open");
  const shortId = String(token?.id || "").slice(0, 8);
  console.log(`- ${shortId} [${status}] [${token.priority}] (${token.type}) ${token.summary} | source=${source} | occurrences=${occurrences}`);
}
