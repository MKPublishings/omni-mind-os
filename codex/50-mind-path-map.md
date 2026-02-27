# Mind Path Map

## Runtime Entry Points

- `src/index.ts`
  - `resolveInternalMindMode(value)`
  - `buildInternalMindImprovementResponse(payload)`
  - `buildInternalMindPatchResponse(payload)`
  - `buildInternalMindTasksResponse(payload)`
  - Route handler: `POST /internal/mind`

## Mind Layer Modules

- `src/mind/self_improvement/mindLoop.ts`
  - `runMindLoop(sessionLogPath)`
- `src/mind/self_improvement/updateCodex.ts`
  - `appendDecision(entry)`
- `src/mind/evaluators/sessionEvaluator.ts`
  - `evaluateSession(sessionLogPath)`
- `src/mind/evaluators/improvementProposer.ts`
  - `proposeImprovements(evaluation)`
- `src/mind/evaluators/omniPromptContracts.ts`
  - `buildImprovementPromptContract(evaluation)`
  - `buildPatchPromptContract(input)`

## Token and Debug Loop Modules

- `src/tools/auto_debugger/autoDebugger.ts`
  - `runAutoDebugger(testCommand)`
- `src/tools/auto_tokenizer/taskToken.ts`
  - `createTaskToken(input)`
- `scripts/tools/taskTokenStore.js`
  - `appendTaskTokens(tokens)`
  - `setTaskTokenStatus(tokenId, status)`
  - `getNextActionableTaskToken()`
  - `runTaskTokenMaintenance()`
