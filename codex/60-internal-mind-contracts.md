# Internal Mind Contracts

## Endpoint

- `POST /internal/mind`
- Authorization: same admin key policy as maintenance routes (`x-omni-admin-key`)

## Mode: `improvement`

Request shape:

```json
{
  "mode": "improvement",
  "evaluation": {
    "sessionId": "session-123",
    "score": 0.74,
    "qualityScore": 0.71,
    "latencyScore": 0.66,
    "reliabilityScore": 0.83,
    "safetyScore": 0.99,
    "issues": ["example issue"],
    "findings": ["example finding"]
  }
}
```

Response shape:

```json
{
  "mode": "improvement",
  "sessionId": "session-123",
  "score": 0.74,
  "metrics": {
    "qualityScore": 0.71,
    "latencyScore": 0.66,
    "reliabilityScore": 0.83,
    "safetyScore": 0.99
  },
  "issues": ["..."],
  "proposals": [
    {
      "type": "prompt|task-token",
      "area": "response-quality",
      "summary": "...",
      "details": "...",
      "safeToApply": true
    }
  ]
}
```

## Mode: `patch`

Request shape:

```json
{
  "mode": "patch",
  "errorLog": "TypeError: ...",
  "context": {
    "files": [
      { "path": "src/file.ts", "content": "..." }
    ]
  }
}
```

Response shape:

```json
{
  "mode": "patch",
  "explanation": "...",
  "diff": "diff --git ...",
  "traceExcerpt": "..."
}
```

## Mode: `tasks`

Request shape:

```json
{
  "mode": "tasks",
  "issues": ["gap one"],
  "codexGaps": ["gap two"]
}
```

Response shape:

```json
{
  "mode": "tasks",
  "tasks": [
    {
      "type": "feature|codex-update",
      "summary": "...",
      "contextFiles": ["..."],
      "acceptanceCriteria": ["..."]
    }
  ]
}
```

## Identity Rule

The internal mind layer deepens capability and does not rename the product. Omni Ai remains Omni Ai.

## Client Wiring

- `src/mind/evaluators/improvementProposer.ts` calls `/internal/mind` in `improvement` mode first.
- `src/tools/auto_debugger/autoDebugger.ts` calls `/internal/mind` in `patch` mode first.
- Both paths fall back to local placeholder generation if the internal endpoint is unavailable.
