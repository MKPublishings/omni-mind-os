export class OmniLogger {
  env: any;

  constructor(env: any) {
    this.env = env;
  }

  log(event: string, data: any = {}) {
    const payload = {
      event,
      data,
      timestamp: Date.now()
    };

    console.log("[OMNI LOG]", JSON.stringify(payload));
  }

  error(event: string, error: any) {
    const payload = {
      event,
      error: error?.message || error,
      timestamp: Date.now()
    };

    console.error("[OMNI ERROR]", JSON.stringify(payload));
  }
}