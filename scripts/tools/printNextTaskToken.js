const {
  getNextActionableTaskToken,
  setTaskTokenStatus,
  TOKEN_QUEUE_FILE
} = require("./taskTokenStore");

const shouldClaim = process.argv.includes("--claim");
const nextToken = getNextActionableTaskToken();

if (!nextToken) {
  console.log(`No actionable task token found in ${TOKEN_QUEUE_FILE}.`);
  process.exit(0);
}

let outputToken = nextToken;
if (shouldClaim && String(nextToken.status || "open").toLowerCase() === "open") {
  const updateResult = setTaskTokenStatus(nextToken.id, "in-progress");
  if (updateResult.updated && updateResult.token) {
    outputToken = updateResult.token;
  }
}

console.log("Next actionable task token:");
console.log(`- id: ${outputToken.id}`);
console.log(`- status: ${outputToken.status}`);
console.log(`- priority: ${outputToken.priority}`);
console.log(`- type: ${outputToken.type}`);
console.log(`- summary: ${outputToken.summary}`);
console.log(`- source: ${String(outputToken?.metadata?.source || "unknown")}`);
console.log(`- updatedAt: ${outputToken.updatedAt || outputToken.createdAt}`);
if (Array.isArray(outputToken.acceptanceCriteria) && outputToken.acceptanceCriteria.length) {
  console.log("- acceptanceCriteria:");
  for (const item of outputToken.acceptanceCriteria) {
    console.log(`  - ${item}`);
  }
}
if (shouldClaim) {
  console.log("- claim: enabled");
}
