# Protocols

## Self-Improvement Loop v1

1. Capture interaction + system logs.
2. Run evaluators on quality, latency, and anomalies.
3. Generate improvement proposals (prompts, configs, code patches).
4. Apply safe changes when enabled.
5. Log decisions in `codex/40-decisions`.

## Auto-Debugger Loop v1

1. Run configured test command.
2. If command fails, collect stderr/stdout traces.
3. Generate a patch proposal payload.
4. Append decision entry for review or application.

## Prompt Contracts v1

- `ImprovementPromptContract` is generated from session evaluation and rubric signals.
- `PatchPromptContract` is generated from failing command + stderr/stdout traces.
- Contracts enforce minimal-scope fixes, Omni Ai naming continuity, and safety policy retention.

## Task Token Queue v1

- Evaluation runs and auto-debug runs append task tokens to `data/sessions/task-tokens.jsonl`.
- Tokens carry acceptance criteria and metadata needed for scheduling and review.
- Queue can be inspected with `npm run mind:tokens` or the VS Code task `Omni: View Task Tokens`.
- Repeated equivalent tokens are deduplicated within a rolling 24-hour window.
- Low-priority tokens age out after 72 hours.
- Queue is bounded to the most recent 400 active entries.

## Task Token Lifecycle v1

- Tokens support `open`, `in-progress`, and `resolved` statuses.
- Status transitions are updated via `npm run mind:tokens:set -- <tokenId> <status>`.
- Resolved tokens are automatically pruned after 24 hours to keep the queue operationally focused.
- Active queue can be viewed via `npm run mind:tokens:active`, sorted by priority and freshness.
- Next actionable token can be selected via `npm run mind:tokens:next`.
- Use `npm run mind:tokens:next:claim` to atomically move the selected open token to `in-progress`.
- Stale `in-progress` tokens are automatically reopened to `open` after 6 hours of inactivity.
- Reopened tokens are marked with escalation metadata after repeated stale reopen cycles.
- When reopen count crosses threshold, a high-priority escalation token is auto-created.
- Escalation creation is deduplicated so only one active escalation token exists per base token.
- Run lifecycle maintenance on demand with `npm run mind:tokens:maintain`.
