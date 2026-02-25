import test from "node:test";
import assert from "node:assert/strict";
import { assembleHyperRealPrompt } from "../hyperreal/hyperrealAssembler.js";

test("Hyper-real prompt includes camera and lighting", () => {
  const result = assembleHyperRealPrompt("A warrior", "portrait-85mm", "studio-soft");
  assert.equal(result.includes("85mm lens"), true);
  assert.equal(result.includes("soft studio lighting"), true);
});
