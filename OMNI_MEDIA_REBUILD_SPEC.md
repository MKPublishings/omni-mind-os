# Omni Ai Media Rebuild Spec (Omni-Native)

## Goal
Rebuild image/video/GIF generation as an Omni-native subsystem where Omni is the single execution engine for diffusion workloads and all orchestration is modular, observable, and safety-governed.

## Scope
- Image: text->image, image->image, inpaint/outpaint, optional upscaling.
- Video: text->video, image->video, optional video editing pass.
- GIF: video->GIF post-process (default), optional direct short-loop profile.

## Product Constraints (Initial Targets)
- Latency:
  - Image: p95 <= 8s at default profile.
  - Video short clips: p95 <= 30s at default profile.
- Quality defaults:
  - Image: 1024x1024, guidance + steps configurable.
  - Video: 768x432, 24 frames, 12 fps default.
- Throughput:
  - API and worker tiers scale independently.
  - GPU workers keep warm Omni model instances.
- Cost envelope:
  - Hard limits on resolution/frames/steps.
  - Batch by compatible model/profile.
- Safety:
  - Prompt pre-filter and output post-filter.
  - Watermarking and request-level audit metadata.

## Omni Model Registry (Canonical IDs)
- image_default
- image_hd
- video_default
- video_long

Each entry stores:
- omni_model_id
- precision
- max_resolution
- max_frames
- scheduler profile
- optional LoRA/fine-tune hooks

## Logical Pipeline Stages
1. Input normalization
2. Routing (model/profile selection)
3. Omni diffusion forward pass
4. Post-processing (encode/watermark/convert)
5. Safety validation
6. Packaging (URLs/data + metadata)

## Serving Architecture
- API layer validates requests and enqueues jobs.
- Worker layer performs Omni generation with pre-loaded model clients.
- Storage layer persists artifacts in object storage under structured prefixes.
- Response returns request id + typed outputs + metadata.

## API Surface (v1)
- POST /v1/generate/image
- POST /v1/generate/video
- POST /v1/generate/gif

Common request fields:
- prompt, negative_prompt
- mode
- params (resolution/frames/fps/steps/guidance/seed)
- safety_level, watermark, return_format

Common response fields:
- id
- status
- outputs[] (type, url/data, metadata)

## Observability and Governance
- Metrics: total latency + per-stage latency, GPU utilization, OOM count.
- Logging: prompt hash, model id, seed, params, duration, errors.
- Traceability: correlate all events by request id.

## Rollout Plan
1. Offline engine + golden prompts
2. Internal API and worker validation
3. Shadow mode comparison (if reference exists)
4. Gradual traffic by modality (image -> video -> GIF)
5. Full cutover to Omni-native path

## Deliverables in this repo (initial scaffold)
- Python Omni-native offline engine interfaces for image/video/GIF
- Stage-based pipeline abstraction
- Unified API contracts
- Queue/worker skeleton
- Registry-driven model routing
