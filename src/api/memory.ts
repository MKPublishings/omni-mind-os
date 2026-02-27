import { OmniKV } from "../memory/kv";

type MemoryEnvelope = {
  ok: boolean;
  key: string;
  value?: unknown;
  error?: string;
};

function jsonResponse(payload: MemoryEnvelope, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function normalizeKey(key?: string): string {
  const value = String(key || "memory").trim();
  return value || "memory";
}

function mergeObjects(existing: unknown, incoming: unknown): unknown {
  if (
    existing &&
    typeof existing === "object" &&
    !Array.isArray(existing) &&
    incoming &&
    typeof incoming === "object" &&
    !Array.isArray(incoming)
  ) {
    return {
      ...(existing as Record<string, unknown>),
      ...(incoming as Record<string, unknown>)
    };
  }
  return incoming;
}

export async function getMemory(env: any, key?: string) {
  try {
    const kv = new OmniKV(env);
    const normalizedKey = normalizeKey(key);
    const data = await kv.get(normalizedKey);
    return jsonResponse({ ok: true, key: normalizedKey, value: data ?? {} });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ ok: false, key: normalizeKey(key), error: message }, 500);
  }
}

export async function setMemory(env: any, body: any, key?: string, options?: { merge?: boolean }) {
  try {
    const kv = new OmniKV(env);
    const normalizedKey = normalizeKey(key);
    const shouldMerge = options?.merge === true;

    let nextValue = body;
    if (shouldMerge) {
      const existing = await kv.get(normalizedKey);
      nextValue = mergeObjects(existing, body);
    }

    await kv.set(normalizedKey, nextValue);
    return jsonResponse({ ok: true, key: normalizedKey, value: nextValue });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ ok: false, key: normalizeKey(key), error: message }, 500);
  }
}

export async function deleteMemory(env: any, key?: string) {
  try {
    const kv = new OmniKV(env);
    const normalizedKey = normalizeKey(key);
    await kv.del(normalizedKey);
    return jsonResponse({ ok: true, key: normalizedKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ ok: false, key: normalizeKey(key), error: message }, 500);
  }
}