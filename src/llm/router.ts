import { omniBrainLoop } from "../omni/brain-loop";
import type { OmniContext } from "../omni/mindos-core";

export async function omniRouter(env: any, ctx: OmniContext) {
  return await omniBrainLoop(env, ctx);
}