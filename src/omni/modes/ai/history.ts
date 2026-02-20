export class ModeHistory {
  private history: string[] = [];

  add(mode: string) {
    this.history.push(mode);
    if (this.history.length > 20) this.history.shift();
  }

  last(): string {
    return this.history[this.history.length - 1] || "Architect";
  }
}