export interface Env {
  MODEL: string;
  MEMORY: KVNamespace;
  TOOLS: KVNamespace;
  AI: any; // Cloudflare AI binding
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // -----------------------------
    // ROUTES
    // -----------------------------
    if (url.pathname === "/api/omni" && request.method === "POST") {
      return handleOmni(request, env);
    }

    if (url.pathname === "/api/memory") {
      if (request.method === "GET") return handleMemoryGet(env);
      if (request.method === "DELETE") return handleMemoryClear(env);
    }

    if (url.pathname === "/api/tools" && request.method === "GET") {
      return handleToolsGet(env);
    }

    return new Response("Omni Worker Active", { status: 200 });
  }
};



// ======================================================
//  MEMORY API
// ======================================================

async function handleMemoryGet(env: Env) {
  const list = await env.MEMORY.list();
  const items = [];

  for (const key of list.keys) {
    const value = await env.MEMORY.get(key.name);
    items.push({ key: key.name, value });
  }

  return Response.json({ items });
}

async function handleMemoryClear(env: Env) {
  const list = await env.MEMORY.list();

  for (const key of list.keys) {
    await env.MEMORY.delete(key.name);
  }

  return Response.json({ cleared: true });
}



// ======================================================
//  TOOLS API
// ======================================================

async function handleToolsGet(env: Env) {
  const list = await env.TOOLS.list();
  const tools = [];

  for (const key of list.keys) {
    const value = await env.TOOLS.get(key.name, { type: "json" });
    tools.push({ name: key.name, ...value });
  }

  const last_call = await env.TOOLS.get("last_call", { type: "json" });

  return Response.json({
    tools,
    last_call: last_call || null
  });
}



// ======================================================
//  OMNI STREAMING ENGINE
// ======================================================

async function handleOmni(request: Request, env: Env): Promise<Response> {
  try {
    const { message, mode = "Architect", model = env.MODEL } = await request.json();

    if (!message || typeof message !== "string") {
      return Response.json({ error: "Missing message" }, { status: 400 });
    }

    // -----------------------------
    // LOAD MEMORY
    // -----------------------------
    const memoryList = await env.MEMORY.list();
    const memories: string[] = [];

    for (const key of memoryList.keys) {
      const value = await env.MEMORY.get(key.name);
      if (value) memories.push(`• ${value}`);
    }

    const memoryBlock =
      memories.length > 0
        ? `Here are the user's known memories:\n${memories.join("\n")}\n\nUse them only when relevant.`
        : `The user has no stored memories yet.`;

    // -----------------------------
    // SYSTEM PROMPT
    // -----------------------------
    const systemPrompt = `
You are Omni Mind/OS, a multi‑mode cognitive engine.

Current Mode: **${mode}**

Your responsibilities:
- Respond with clarity, precision, and cinematic intelligence.
- Use the user's stored memories when relevant.
- Maintain continuity across sessions.
- If the user shares a new stable preference, fact, or identity detail, summarize it as a memory.

${memoryBlock}

When you want to save a memory, respond with a JSON block:

<memory>
{ "key": "string", "value": "string" }
</memory>

Otherwise, respond normally.
`;

    // -----------------------------
    // STREAMING RESPONSE
    // -----------------------------
    const ai = env.AI;

    const stream = await ai.run(model, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      stream: true
    });

    // -----------------------------
    // STREAM TRANSFORMER
    // -----------------------------
    const transformer = new TransformStream({
      async transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);

        // Detect memory block
        if (text.includes("<memory>")) {
          try {
            const json = text.match(/<memory>([\s\S]*?)<\/memory>/)?.[1];
            if (json) {
              const mem = JSON.parse(json);
              await env.MEMORY.put(mem.key, mem.value);

              // Log tool-like event
              await env.TOOLS.put(
                "last_call",
                JSON.stringify({
                  tool: "memory.write",
                  payload: mem,
                  timestamp: Date.now()
                })
              );
            }
          } catch (err) {
            console.error("Memory parse error:", err);
          }
          return; // Do not stream memory JSON to user
        }

        controller.enqueue(chunk);
      }
    });

    return new Response(stream.pipeThrough(transformer), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache"
      }
    });

  } catch (err: any) {
    console.error("Omni error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
