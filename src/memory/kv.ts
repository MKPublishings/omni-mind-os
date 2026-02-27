export class OmniKV {
  env: any;
  binding: any;

  constructor(env: any) {
    this.env = env;
    this.binding = env?.OMNI_KV || env?.MEMORY || null;
  }

  async get(key: string) {
    if (!this.binding?.get) return null;
    return await this.binding.get(key, "json");
  }

  async set(key: string, value: any) {
    if (!this.binding?.put) {
      throw new Error("KV binding is not configured");
    }
    return await this.binding.put(key, JSON.stringify(value));
  }

  async del(key: string) {
    if (!this.binding?.delete) {
      throw new Error("KV binding is not configured");
    }
    return await this.binding.delete(key);
  }
}