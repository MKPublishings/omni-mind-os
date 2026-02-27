const {
  TOKEN_STATUSES,
  setTaskTokenStatus,
  loadTaskQueue,
  TOKEN_QUEUE_FILE
} = require("./taskTokenStore");

const tokenId = String(process.argv[2] || "").trim();
const nextStatus = String(process.argv[3] || "").trim().toLowerCase();

if (!tokenId || !nextStatus) {
  console.log("Usage: node ./scripts/tools/updateTaskTokenStatus.js <tokenId> <open|in-progress|resolved>");
  process.exit(1);
}

if (!TOKEN_STATUSES.includes(nextStatus)) {
  console.log(`Invalid status '${nextStatus}'. Allowed: ${TOKEN_STATUSES.join(", ")}`);
  process.exit(1);
}

const result = setTaskTokenStatus(tokenId, nextStatus);
if (!result.updated) {
  console.log(`Token not updated (${result.reason}). Queue: ${TOKEN_QUEUE_FILE}`);
  const candidates = loadTaskQueue().slice(-10);
  if (candidates.length) {
    console.log("Recent token IDs:");
    for (const token of candidates) {
      console.log(`- ${token.id} (${token.status}) ${token.summary}`);
    }
  }
  process.exit(1);
}

console.log(`Token updated: ${result.token.id}`);
console.log(`- status: ${result.token.status}`);
console.log(`- summary: ${result.token.summary}`);
console.log(`- queue: ${TOKEN_QUEUE_FILE}`);
