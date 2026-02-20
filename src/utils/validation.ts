// src/utils/validation.ts

import { OmniRequest } from "../api/omni/index";

export function validateMessages(body: OmniRequest): string | null {
  if (!body) return "Missing request body";

  if (!Array.isArray(body.messages)) {
    return "Invalid messages array";
  }

  if (body.messages.length === 0) {
    return "Messages cannot be empty";
  }

  for (const msg of body.messages) {
    if (!msg.role || !msg.content) {
      return "Each message must include role and content";
    }
  }

  if (!body.model) return "Missing model";
  if (!body.mode) return "Missing mode";

  return null;
}