export class OmniKV {
  env: any;

  constructor(env: any) {
    this.env = env;
  }

  async get(key: string) {
    return await this.env.OMNI_KV.get(key, "json");
  }

  async set(key: string, value: any) {
    return await this.env.OMNI_KV.put(key, JSON.stringify(value));
  }

  async del(key: string) {
    return await this.env.OMNI_KV.delete(key);
  }
}