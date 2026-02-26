export class OmniSession {
  state: any;

  constructor(state: any) {
    this.state = state;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/get") {
      const data = await this.state.storage.get("session");
      return new Response(JSON.stringify(data || {}));
    }

    if (url.pathname === "/set") {
      const body = await request.json();
      await this.state.storage.put("session", body);
      return new Response("OK");
    }

    if (url.pathname === "/delete") {
      await this.state.storage.delete("session");
      return new Response("OK");
    }

    return new Response("Omni Session Active");
  }
}