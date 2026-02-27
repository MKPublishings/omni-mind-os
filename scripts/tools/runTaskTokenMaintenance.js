const {
  runTaskTokenMaintenance,
  TOKEN_QUEUE_FILE,
  IN_PROGRESS_TIMEOUT_HOURS,
  ESCALATION_REOPEN_THRESHOLD
} = require("./taskTokenStore");

const result = runTaskTokenMaintenance();
console.log(`Task token maintenance complete.`);
console.log(`- queue: ${TOKEN_QUEUE_FILE}`);
console.log(`- total: ${result.total}`);
console.log(`- reopenedFromTimeout: ${result.reopened}`);
console.log(`- escalationsCreated: ${result.escalationsCreated}`);
console.log(`- inProgressTimeoutHours: ${IN_PROGRESS_TIMEOUT_HOURS}`);
console.log(`- escalationReopenThreshold: ${ESCALATION_REOPEN_THRESHOLD}`);
