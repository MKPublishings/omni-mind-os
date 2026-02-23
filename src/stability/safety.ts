export class OmniSafety {
  static readonly DEFAULT_MAX_RESPONSE_CHARS = 20000;

  static sanitizeInput(text: string): string {
    return text.replace(/<script.*?>.*?<\/script>/gi, "[blocked]");
  }

  static safeGuardResponse(text: string, maxChars: number = OmniSafety.DEFAULT_MAX_RESPONSE_CHARS): string {
    const limit = Number.isFinite(maxChars) && maxChars > 0
      ? Math.floor(maxChars)
      : OmniSafety.DEFAULT_MAX_RESPONSE_CHARS;

    if (text.length > limit) {
      return text.slice(0, limit) + "\n\n[Response truncated for safety]";
    }
    return text;
  }

  static validateMessages(messages: any[]): boolean {
    return Array.isArray(messages) && messages.every(m => m.role && m.content);
  }
}