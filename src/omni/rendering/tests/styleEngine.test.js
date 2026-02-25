import test from "node:test";
import assert from "node:assert/strict";
import { assemblePrompt } from "../engine/promptAssembler.js";

test("Assembles prompt with 3D style", () => {
  const result = assemblePrompt("A warrior", "3d");
  assert.equal(result.includes("3D render"), true);
});
