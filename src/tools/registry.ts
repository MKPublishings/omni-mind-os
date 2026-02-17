import { now } from "../utils/time";

export const OmniTools = {
  time: {
    name: "time",
    description: "Returns the current ISO timestamp.",
    run: async () => now()
  },

  echo: {
    name: "echo",
    description: "Returns the same text back.",
    run: async (input: string) => input
  }
};

export function getTool(name: string) {
  return OmniTools[name as keyof typeof OmniTools] || null;
}