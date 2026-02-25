![42339559-e98e-4eb7-ba72-9f3662a0679a](https://github.com/user-attachments/assets/233f9b2d-9cbd-49c4-8d1d-99a900e238e8)

[![Image Engine CI](https://github.com/Slizz/omni-mind-os/actions/workflows/image-engine-ci.yml/badge.svg)](https://github.com/Slizz/omni-mind-os/actions/workflows/image-engine-ci.yml)


              O M N I   M I N D / O S
      A Cognitive Operating System for AI Models

# **Omni Mind/OS**  
### *A Modular Cognitive Engine for Multi‑Model AI Systems*

Omni Mind/OS is a fully modular, Cloudflare‑native cognitive operating system designed to orchestrate LLM reasoning loops, memory, safety, multi‑model routing, and streaming responses.  
It is built for developers who want **full control** over how an AI thinks, remembers, and interacts — without relying on opaque black‑box behavior.

Omni Mind/OS is:

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
Omni Mind/OS is built from clean, isolated modules:

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
Omni Mind/OS includes a persistent memory layer using Cloudflare KV:

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
Omni Mind/OS streams output token‑by‑token using:

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

Omni Mind/OS runs locally using Wrangler:

```
wrangler dev
```

---

# **🌐 Deployment**

Deploy to Cloudflare Workers:

```
wrangler deploy
```

---

# **🛠 Extending Omni Mind/OS**

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
Omni Mind/OS is designed to be:

- A **transparent cognitive engine**  
- A **developer‑friendly AI runtime**  
- A **foundation for custom LLM systems**  
- A **platform for experimentation**  
- A **bridge between models and cognition**  

It is not just an LLM wrapper — it is a **mind architecture**.

---