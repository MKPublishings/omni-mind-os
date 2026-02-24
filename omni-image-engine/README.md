# Omni Image Engine

Upgrade scaffold for `slizzai-imagegen v2.1` into a multi-pass, style-pack, model-adapted prompt engine.

## Core Flow

```js
const { buildOmniImagePrompt } = require("./core/engine");

const result = buildOmniImagePrompt({
  prompt: "my prompt",
  styleName: "OS-Cinematic",
  qualityLevel: "ultra",
  targetModel: "slizzai-imagegen-v2.1"
});

// send result.finalPrompt into your generator
```

## Requested Integration Pattern

```js
const { orchestratePrompt } = require("./core/promptOrchestrator");
const { refinePrompt } = require("./core/multiPassRefiner");
const { toSlizzai } = require("./core/modelAdapters");

const orchestrated = orchestratePrompt({ userPrompt: prompt });
const refined = refinePrompt(orchestrated, { targetModel: "slizzai-imagegen-v2.1" });
const finalPrompt = toSlizzai(refined.final);

generateImage(finalPrompt);
```
