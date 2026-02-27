# Architecture

## Mind Layer

The Mind Layer is Omni Ai's self-improvement and self-reflection system.
It does not change Omni Ai's name or identity; it deepens Omni Ai's capabilities.
Omni Ai remains Omni Ai.

## Core Components

- `src/mind/self_improvement/mindLoop.ts`
- `src/mind/evaluators/sessionEvaluator.ts`
- `src/mind/evaluators/improvementProposer.ts`
- `src/mind/detectors/healthDetector.ts`
- `src/tools/auto_debugger/autoDebugger.ts`
- `src/tools/auto_tokenizer/taskToken.ts`

## Internal Mind Interface

- Route contract: `POST /internal/mind` in `src/index.ts`
- Path map: `codex/50-mind-path-map.md`
- Contract schemas: `codex/60-internal-mind-contracts.md`
