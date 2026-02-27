const {
  getActiveTaskTokensSorted,
  TOKEN_QUEUE_FILE
} = require("./taskTokenStore");

const active = getActiveTaskTokensSorted();

if (!active.length) {
  console.log(`No active task tokens in ${TOKEN_QUEUE_FILE}.`);
  process.exit(0);
}

console.log(`Active task tokens: ${active.length}`);
for (const token of active) {
  const shortId = String(token?.id || "").slice(0, 8);
  const status = String(token?.status || "open");
  const priority = String(token?.priority || "low");
  const type = String(token?.type || "unknown");
  const summary = String(token?.summary || "");
  const source = String(token?.metadata?.source || "unknown");
  const updatedAt = String(token?.updatedAt || token?.createdAt || "");
  console.log(`- ${shortId} [${status}] [${priority}] (${type}) ${summary}`);
  console.log(`  source=${source} updatedAt=${updatedAt}`);
}
