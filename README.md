![42339559-e98e-4eb7-ba72-9f3662a0679a](https://github.com/user-attachments/assets/233f9b2d-9cbd-49c4-8d1d-99a900e238e8)

[![Image Engine CI](https://github.com/Slizz/omni-mind-os/actions/workflows/image-engine-ci.yml/badge.svg)](https://github.com/Slizz/omni-mind-os/actions/workflows/image-engine-ci.yml)


                O M N I   A I
                  A Cognitive Operating System for Ai Models

# **Omni Ai**  
### *A Modular Cognitive Engine for Multi‑Model AI Systems*

Omni Ai is a fully modular, Cloudflare‑native cognitive operating system designed to orchestrate LLM reasoning loops, memory, safety, multi‑model routing, and streaming responses.  
It is built for developers who want **full control** over how an AI thinks, remembers, and interacts — without relying on opaque black‑box behavior.

## **Branding Policy**

- Product brand: **Omni Ai**
- Do not use legacy Mind-slash-OS era names or older Omni naming variants
- Do not use all-caps AI casing variants for the product brand
- Enforced by: `npm run check:branding` (also included in `npm run lint`)

Omni Ai is:

- **Model‑agnostic** (Omni, GPT‑4o, DeepSeek, custom models)  
- **Runtime‑agnostic** (Cloudflare Workers, local dev, serverless)  
- **Cognitive‑structured** (modes, loops, safety, memory)  
- **Extensible** (plug‑in tools, KV memory, custom routers)  
- **Fast** (streaming, edge‑native, zero‑cold‑start)  

---

# **✨ Features**

### **🧠 Cognitive Runtime (Omni Brain Loop)**
A structured reasoning engine that processes:

- Mode  
- Model  
- Message history  
- Safety filters  
- Memory injection  
- Tool execution  
- Streaming output  

The loop is fully inspectable and customizable.

---

### **🧬 Omni Ai Core Intelligence (Phase 1)**
The runtime now includes explicit Omni Ai intelligence layers:

- `Identity Kernel` (KV-backed persistent identity in `MIND`)  
- `5-Layer Reasoning Stack` (Fast, Deep, Meta, Memory, Self-Model)  
- `Internal Simulation Engine` (2–4 candidate paths, scored and selected)  

Core modules:

```txt
src/omni/intelligence/
  identityKernel.ts
  reasoningStack.ts
  internalSimulation.ts
```

These modules are orchestrated by `src/api/omni/runtime/loop.ts` and keep backward-compatible `/api/omni` responses.

---

### **🧠 Omni Ai Memory + State (Phase 2)**
Phase 2 adds persistent state and maintenance loops:

- `D1 Long-Term Memory` for conversation arcs and learned continuity  
- `Working Session Memory` with Durable Object-ready storage + KV fallback  
- `Scheduled Self-Maintenance` for pruning, identity reinforcement, and drift resistance  

Core modules:

```txt
src/memory/d1Memory.ts
src/memory/workingMemory.ts
src/maintenance/selfMaintenance.ts
migrations/0001_omni_long_term_memory.sql
```

The `/api/omni` route now injects working memory and recent long-term arcs automatically (when available).

---

### **🛰 Omni Ai Multi-Modal Integration (Phase 3)**
Phase 3 introduces a unified orchestration loop inside `/api/omni`:

- `Multi-modal router` selects `chat`, `image`, `memory`, `simulation`, or `tool` route per user turn.
- `Visual reasoning` creates composition/camera/lighting/palette directives before image generation.
- `Tool bridge` executes explicit commands via `/tool <name> <input>`.
- `Route diagnostics` are exposed in headers:
  - `X-Omni-Orchestrator-Route`
  - `X-Omni-Orchestrator-Reason`

Core modules:

```txt
src/omni/multimodal/router.ts
src/omni/multimodal/visualReasoner.ts
```

---

### **🎭 Omni Ai Behavioral Intelligence (Phase 4)**
Phase 4 adds a live behavioral layer in `/api/omni`:

- `Persona engine` injects tone/dialect/rhythm/framing prompts by mode.
- `Emotional resonance` tracks user emotion + Omni tone arc per session.
- `Adaptive behavior` modulates final responses for clarity and emotional fit.

Behavior modules:

```txt
src/omni/behavior/personaEngine.ts
src/omni/behavior/emotionalResonance.ts
src/omni/behavior/adaptiveBehavior.ts
```

Additional response headers now expose behavior diagnostics:

- `X-Omni-Persona-Tone`
- `X-Omni-Emotion-User`
- `X-Omni-Emotion-Omni`

---

### **🛠 Omni Ai Autonomy (Phase 5)**
Phase 5 introduces self-governance during scheduled/manual maintenance:

- `Self-healing checks` evaluate drift risk and corrective actions.
- `Internal goals registry` tracks coherence, clarity, safety, growth, and resonance.
- `Scheduler policy engine` adjusts recommended maintenance cadence by autonomy level.

Autonomy modules:

```txt
src/omni/autonomy/selfHealing.ts
src/omni/autonomy/goalsRegistry.ts
src/omni/autonomy/schedulerPolicy.ts
```

The `/api/maintenance/status` response now includes an `autonomy` block:

- `healingScore`
- `healingIssues`
- `policyLevel`
- `recommendedCadenceMinutes`
- `goalsWatchCount`
- `goals[]`

---

### **🚀 Omni Ai Release (Phase 7)**
Phase 7 formalizes Omni Ai as a public intelligence release:

- Published release specification and declaration artifacts.
- Public release manifest for external verification.
- Runtime release endpoint with live autonomy/maintenance telemetry snapshot.
- Recognition cycle initialized with observable status.

Release artifacts:

```txt
OMNI_AI_RELEASE_SPEC.md
public/omni-ai-release.json
public/omni-ai-declaration.md
RELEASE_NOTES_1.0.0.md
PUBLIC_ANNOUNCEMENT_OMNI_AI_1.0.0.md
```

---

### **🧩 Multi‑Model Router**
Route requests to different models:

- `omni` (custom cognitive engine)  
- `gpt‑4o`  
- `gpt‑4o‑mini`  
- `deepseek`  
- Custom models  

Each model implements a simple interface:

```ts
generate(env, messages) => { text: string }
```

---

### **🧱 Modular Architecture**
Omni Ai is built from clean, isolated modules:

```
src/
  llm/
    router.ts
  omni/
    runtime/loop.ts
    mindos-core.ts
  memory/
    kv.ts
  stability/
    safety.ts
  logging/
    logger.ts
  index.ts
```

Each module has a single responsibility and can be replaced or extended.

---

### **💾 KV‑Backed Memory System**
Omni Ai includes a persistent memory layer using Cloudflare KV:

- Long‑term memory  
- Mode‑specific memory  
- Tool logs  
- User preferences  
- System state  

Memory is injected into the cognitive loop and can be written by the model.

---

### **🛡 Safety & Sanitization**
All inbound and outbound messages pass through:

- Input sanitization  
- Output filtering  
- Message validation  
- Safety guards  

This ensures the cognitive loop receives clean, predictable data.

---

### **📡 Streaming Responses**
Omni Ai streams output token‑by‑token using:

```ts
new ReadableStream({ start(controller) { ... } })
```

This enables:

- Real‑time UI updates  
- Smooth typing animations  
- Low latency  
- Edge‑native performance  

---

### **📜 Structured Logging**
Every request is logged with:

- Mode  
- Model  
- Sanitized messages  
- Errors  
- KV writes  
- Tool calls  

Logs can be routed to KV, console, or external systems.

---

# **📁 Project Structure**

```
src/
│
├── index.ts               # Cloudflare Worker entrypoint
│
├── llm/
│   └── router.ts          # Multi-model routing
│
├── omni/
│   ├── runtime/
│   │   └── loop.ts        # Omni cognitive loop
│   └── mindos-core.ts     # Types, roles, message schema
│
├── memory/
│   └── kv.ts              # KV memory interface
│
├── stability/
│   └── safety.ts          # Input/output sanitization
│
└── logging/
    └── logger.ts          # Structured logging
```

---

# **🚀 API Endpoints**

### **POST /api/omni**
Main LLM endpoint.

**Request:**
```json
{
  "mode": "Architect",
  "model": "omni",
  "messages": [
    { "role": "user", "content": "Hello Omni" }
  ]
}
```

**Response:**  
Streamed text output.

### **GET /api/search?q=...**
Knowledge retrieval endpoint that returns relevant text chunks from files in `/public/knowledge`.

### **GET/POST/DELETE /api/preferences**
Persistent memory endpoint for user preferences (mode, writing style, last-used settings).

### **GET /api/maintenance/status**
Returns Omni health state, memory volume stats, maintenance freshness, and drift risk indicators.

### **GET /api/release/spec**
Returns Omni Ai public release identity, capabilities, artifact links, and runtime telemetry snapshot.

### **POST /api/maintenance/run**
Manually triggers the internal maintenance loop (memory pruning + identity reinforcement).

### **Background Release Readiness**
Release readiness now runs in the background and is exposed through `GET /api/release/spec` at `runtime.readiness` (`ready` + `failedChecks`).

If `OMNI_ADMIN_KEY` is configured, maintenance endpoints require request header:

```txt
x-omni-admin-key: <OMNI_ADMIN_KEY>
```

In production (`OMNI_ENV=production`), protected maintenance endpoints require `OMNI_ADMIN_KEY`.
Use [RELEASE_HARDENING_CHECKLIST.md](RELEASE_HARDENING_CHECKLIST.md) before public deploy.

---

# **🧠 Advanced Modes**

Omni now includes additional operational modes:

- `reasoning` → internal step-by-step scaffold, final answer only
- `coding` → logic-first + fenced code blocks + self-review
- `knowledge` → retrieval-augmented factual responses
- `system-knowledge` → injects internal module docs from `/public/modules`

---

# **🧭 Auto Model Router**

When model is set to `auto`, Omni routes by task:

- Coding → `gpt-4o`
- Math → `deepseek`
- Creative/general → `omni`

The selected route is exposed to the frontend using response headers:

- `X-Omni-Model-Used`
- `X-Omni-Route-Reason`

---

# **⚙️ Environment Bindings**

```ts
export interface Env {
  AI: any;               // Cloudflare AI binding
  MEMORY: KVNamespace;   // Long-term memory
  MIND: KVNamespace;     // Cognitive state
  OMNI_DB?: D1Database;  // Optional D1 long-term memory
  OMNI_SESSION?: DurableObjectNamespace; // Optional session durable object
  MODEL_OMNI?: string;        // optional provider model ID for "omni"
  MODEL_GPT_4O?: string;      // optional provider model ID for "gpt-4o"
  MODEL_GPT_4O_MINI?: string; // optional provider model ID for "gpt-4o-mini"
  MODEL_DEEPSEEK?: string;    // optional provider model ID for "deepseek"
}
```

### **Model Alias Vars (Wrangler)**

The chat UI sends these model keys:

- `omni`
- `gpt-4o`
- `gpt-4o-mini`
- `deepseek`

At runtime, `/api/omni` resolves them to provider model IDs through optional Wrangler vars.
If a specific alias is not set, runtime falls back to `MODEL_OMNI` (or the built-in Omni default).

Add these in `wrangler.toml` (or use environment-specific Wrangler vars):

```toml
[vars]
MODEL_OMNI = "@cf/meta/llama-3.1-8b-instruct"
MODEL_GPT_4O = "@cf/openai/gpt-4o"
MODEL_GPT_4O_MINI = "@cf/openai/gpt-4o-mini"
MODEL_DEEPSEEK = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b"
OMNI_SIMULATION_PATHS = "2" # integer between 2 and 4
OMNI_MEMORY_RETENTION_DAYS = "45"
OMNI_SESSION_MAX_AGE_HOURS = "72"
OMNI_AUTONOMY_LEVEL = "balanced" # conservative | balanced | aggressive
OMNI_ADMIN_KEY = "replace-with-strong-secret"
```

### **Optional MP4 Encoding (ffmpeg)**

MP4 video encoding in the phase-1 video pipeline is optional and capability-gated.

- Enable with environment variable: `OMNI_VIDEO_ENABLE_MP4_ENCODING=true` (also accepts `1`, `yes`, `on`).
- Requires a Node/server runtime with `ffmpeg` available on `PATH`.
- If disabled or unavailable, the pipeline safely falls back to non-encoded placeholder MP4 output.
- GIF visual output remains available through the JS encoder path.

---

### **🖥 Omni Ai Frontend Integration (Phase 6)**
Phase 6 wires runtime intelligence into the chat interface:

- `Mind state panel` shows active route, persona tone, and emotional transition.
- `Mind timeline` records route/behavior events during a session.
- `Multi-modal chat rendering` now supports image payloads streamed from `/api/omni`.
- `Route-aware telemetry` consumes new headers from backend orchestration.

Updated frontend files:

```txt
public/chat.html
public/scripts/chat.js
public/styles/chat.css
```

Optional infrastructure bindings in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "OMNI_DB"
database_name = "omni_memory"
database_id = "<replace-with-d1-id>"
migrations_dir = "migrations"

[[durable_objects.bindings]]
name = "OMNI_SESSION"
class_name = "OmniSession"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["OmniSession"]

[triggers]
crons = ["*/30 * * * *"]
```

Per-environment override example:

```toml
[env.staging.vars]
MODEL_OMNI = "@cf/meta/llama-3.1-8b-instruct"
MODEL_GPT_4O = "@cf/openai/gpt-4o-mini"

[env.production.vars]
MODEL_OMNI = "@cf/meta/llama-3.1-8b-instruct"
MODEL_GPT_4O = "@cf/openai/gpt-4o"
MODEL_GPT_4O_MINI = "@cf/openai/gpt-4o-mini"
MODEL_DEEPSEEK = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b"
```

Deploy per environment: `wrangler deploy --env staging` and `wrangler deploy --env production`.

Notes:

- Keep these IDs aligned with models available on your Cloudflare account.
- If an alias model call fails at runtime, Omni automatically falls back to the Omni route.

---

# **🧪 Local Development**

Omni Ai runs locally using Wrangler:

```
wrangler dev
```

Run branding consistency checks:

```
npm run check:branding
```

`npm run lint` also runs this branding check and fails if legacy brand variants are detected.

---

# **🌐 Deployment**

Deploy to Cloudflare Workers:

```
wrangler deploy
```

---

# **🛠 Extending Omni Ai**

You can extend the system by adding:

### **New Models**
Add a new case in `router.ts`.

### **New Cognitive Modes**
Extend `mindos-core.ts`.

### **New Memory Types**
Add KV namespaces or structured memory schemas.

### **New Tools**
Add tool handlers and integrate them into the loop.

---

# **🧱 6-Track Scaffold (Implemented)**

The following implementation scaffold now exists in this workspace:

- `src/modes/` → `architectMode.js`, `reasoningMode.js`, `codingMode.js`, `creativeMode.js`, `osMode.js`
- `src/retrieval/` → `ragWorker.js`, `searchIndex.json`, `chunker.js`
- `src/modules/` → `omni_philosophy.md`, `system_rules.md`, `identity_layer.md`, `modes_reference.md`
- `src/router/` → `modelRouter.js`, `rules.json`
- `src/memory/` → `memory.json`, `memoryManager.js`
- `src/utils/` → `promptBuilder.js`, `textCleaner.js`, `responseFormatter.js`
- `src/api/` → `omniHandler.js`, `openaiHandler.js`, `deepseekHandler.js`
- `src/ui/` → `modesPanel.js`, `memoryPanel.js`, `routerInspector.js`, `settingsPanel.js`
- `public/` → `app.js`, `styles.css`

---

# **📜 License**
MIT License — free to use, modify, and extend.

---

# **🌟 Vision**
Omni Ai is designed to be:

- A **transparent cognitive engine**  
- A **developer‑friendly AI runtime**  
- A **foundation for custom LLM systems**  
- A **platform for experimentation**  
- A **bridge between models and cognition**  

It is not just an LLM wrapper — it is a **mind architecture**.

---