# Omni Ai Video Engine – Phase 1-3 Implementation Spec

## Scope

Current implementation delivers:

- Phase 1: keyframe-driven micro-clips optimized for strict size budgets (`<= 2 MB`).
- Phase 2: physics-aware conditioning maps (gravity, velocity, collision hints).
- Phase 3: context/entity continuity, dialogue timing alignment, and storyboard metadata.
- Phase 4: adaptive optimization planning + runtime keyframe cache reuse.
- Phase 5: contract validation and deterministic smoke testing.
- Phase 6: release-readiness validator CLI for module/config integrity and optional ffmpeg diagnostics.

## Public API

```js
generateVideoClip(prompt, mode = "balanced", options = {})
```

### Parameters

- `prompt: string` – base scene intent.
- `mode: "crisp-short" | "balanced" | "long-soft"` – quality profile.
- `options`:
  - `maxSizeMB?: number` (default `2`)
  - `format?: "mp4" | "gif"` (default `mp4`)
  - `enableEncoding?: boolean` (default `false`, can also be enabled via `OMNI_VIDEO_ENABLE_ENCODING=1`)
  - `strictSize?: boolean` (default `true`)
  - `dialogue?: Array<{ speaker?: string, text: string, durationSec?: number, emotion?: string }>`
  - `referenceImages?: string[]`
  - `styleHints?: string[]`
  - `imageOptions?: object` (forwarded to image engine)

## Data Contracts

### SceneGraph

```ts
type SceneGraph = {
  summary: string;
  entities: Array<{ id: string; label: string }>;
  mood: string;
  lighting: string;
  physics: { gravity: [number, number, number] };
};
```

### Shot

```ts
type Shot = {
  id: string;
  description: string;
  durationSec: number;
  camera: "static" | "pan" | "zoom";
  dialogueWindow?: { startSec: number; endSec: number; emotion?: string };
};
```

### VideoPlan

```ts
type VideoPlan = {
  mode: "crisp-short" | "balanced" | "long-soft";
  format: "mp4" | "gif";
  budget: {
    maxSizeMB: number;
    width: number;
    height: number;
    fps: number;
    durationSec: number;
    estimatedSizeMB: number;
  };
  context: {
    theme: string;
    mood: string;
    location: string;
    timeOfDay: "day" | "night";
    durationSec: number;
    styleHints: string[];
  };
  sceneGraph: SceneGraph;
  entityTracks: Array<{
    entityId: string;
    label: string;
    states: Array<{ shotId: string; position: { x: number; y: number; z: number }; state: string }>;
  }>;
  shots: Shot[];
  physicsChannels: Array<{
    shotId: string;
    gravity: [number, number, number];
    velocity: [number, number, number];
    collisionHint: string;
    motionField: { mode: string; intensity: number };
  }>;
  dialogueTimeline: Array<{
    lineId: string;
    shotId: string;
    speaker: string;
    emotion: string;
    text: string;
    timing: { startSec: number; endSec: number; reactionBeforeSec: number; reactionAfterSec: number };
    visemeHints: Array<{ token: string; startSec: number; endSec: number; viseme: string }>;
  }>;
  storyboard: Array<{
    shotId: string;
    durationSec: number;
    description: string;
    transitionIn: string;
    cameraPath: { type: string; from: [number, number, number]; to: [number, number, number]; fov: number };
    keyframes: Array<{ index: number; timestampSec: number; filePath: string }>;
  }>;
  optimization: {
    targetMaxSizeMB: number;
    strictSize: boolean;
    runtimeCache: { enabled: boolean; scope: "process" };
    modelHints: { distillationTarget: string; quantizationTarget: string };
    adaptiveTiers: Array<{
      name: string;
      width: number;
      height: number;
      fps: number;
      durationSec: number;
    }>;
  };
  keyframes: Array<{
    shotId: string;
    index: number;
    timestampSec: number;
    prompt: string;
    filePath: string;
    cached?: boolean;
  }>;
  output:
    | { type: "manifest"; filePath: string }
    | { type: "mp4" | "gif"; filePath: string; manifestPath: string };
  encoder: {
    used: boolean;
    reason: string;
    sizeMB?: number;
    budgetMB?: number;
  };
};
```

## Runtime Flow (Phases 1-3)

1. Normalize request and enforce defaults.
2. Parse prompt into a minimal `sceneGraph + shots` structure.
3. Compute budget profile and auto-adjust to stay under `maxSizeMB`.
4. Build continuity context and entity tracks.
5. Build physics channels per shot.
6. Align dialogue and coarse viseme windows to shots.
7. Plan keyframes per shot (`start`, `mid`, `end`).
8. Generate keyframes through existing Omni image pipeline.
9. Build storyboard metadata (camera path + transitions + keyframe map).
10. Build adaptive optimization tiers and runtime hints.
11. Attempt ffmpeg encoding when enabled; otherwise emit manifest-only output.
12. Always emit a manifest; encoded output is optional and must remain within budget.

## Encoding Behavior (Feature-Flagged)

- Encoding is opt-in for Phase 1 and never blocks generation.
- If encoding is disabled, ffmpeg is missing, encoding fails, or encoded size exceeds budget, output falls back to manifest-only mode.
- This preserves deterministic planning artifacts while allowing incremental rollout of real media export.

## Phase 5 Hardening

- Added strict result-contract validation for generated video payloads.
- Added deterministic smoke test using a mock image generator to avoid external model dependency.
- Smoke test coverage includes:
  - Prompt guard rejections.
  - Valid payload shape and required fields.
  - Optimization tier presence.
  - Manifest fallback behavior when encoding is disabled.

## Phase 6 Release Readiness

- Added `omni-image-engine/video/utils/validator.js` for video module integrity checks.
- Upgraded `omni-image-engine/utils/validator.js` to validate both image and video engine surfaces.
- Validation now checks:
  - Required files and module exports.
  - `videoConfig.json` profile/default shape.
  - Optional `ffmpeg` availability (warning only; no hard failure).
- Added CLI scripts:
  - `npm run validate:engine`
  - `npm run validate:video`

## Why Manifest Output in Phase 1

Phase 1 focuses on deterministic planning and Omni-native style continuity. The generated manifest captures everything needed for Phase 2 interpolation/encoding workers without coupling current runtime to heavy codec dependencies.

## Phase 2 Upgrade Path

- Swap manifest export with interpolation + encoder implementation.
- Add optional ffmpeg worker or external job queue.
- Add physics channels and temporal consistency refinement.