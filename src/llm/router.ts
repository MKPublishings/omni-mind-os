import { omniBrainLoop } from "../api/omni/brain-loop";
import type { OmniContext } from "../api/omni/mindos-core";

export async function omniRouter(env: any, ctx: OmniContext) {
  return await omniBrainLoop(env, ctx);
}