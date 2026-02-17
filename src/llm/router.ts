import { omniBrainLoop } from "../api/omni/runtime/loop";
import type { OmniContext } from "../api/omni/mindos-core";

export async function omniRouter(env: any, ctx: OmniContext) {
  return await omniBrainLoop(env, ctx);
}