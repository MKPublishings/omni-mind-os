import { OmniKV } from "../memory/kv";

export async function getMemory(env: any) {
  const kv = new OmniKV(env);
  const data = await kv.get("memory");
  return new Response(JSON.stringify(data || {}));
}

export async function setMemory(env: any, body: any) {
  const kv = new OmniKV(env);
  await kv.set("memory", body);
  return new Response("OK");
}