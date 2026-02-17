export class OmniSafety {
  static sanitizeInput(text: string): string {
    return text.replace(/<script.*?>.*?<\/script>/gi, "[blocked]");
  }

  static safeGuardResponse(text: string): string {
    if (text.length > 5000) {
      return text.slice(0, 5000) + "\n\n[Response truncated for safety]";
    }
    return text;
  }

  static validateMessages(messages: any[]): boolean {
    return Array.isArray(messages) && messages.every(m => m.role && m.content);
  }
}