import * as UPNG from "upng-js";
import { GIFEncoder, applyPalette, quantize } from "gifenc";

export type VideoQualityMode = "CRISP_SHORT" | "BALANCED" | "LONG_SOFT";
export type VideoFormat = "mp4" | "gif" | "both";

export interface GenerateVideoClipRequest {
  prompt: string;
  dialogueScript?: DialogueScript;
  referenceImages?: string[];
  durationSec?: number;
  qualityMode?: VideoQualityMode;
  maxSizeMB?: number;
  format?: VideoFormat;
}

export interface GenerateVideoClipResponse {
  id: string;
  mp4Url?: string;
  gifUrl?: string;
  sizeMB: {
    mp4?: number;
    gif?: number;
  };
  meta: {
    durationSec: number;
    resolution: { width: number; height: number };
    fps: number;
    sceneGraph: SceneGraph;
    shots: Shot[];
  };
}

export interface OmniVideoEngine {
  generateVideoClip(request: GenerateVideoClipRequest): Promise<GenerateVideoClipResponse>;
}

export type EntityType = "character" | "prop" | "environment" | "effect";

export interface SceneGraph {
  id: string;
  globalContext: GlobalContext;
  entities: Entity[];
}

export interface GlobalContext {
  location: string;
  timeOfDay?: string;
  weather?: string;
  mood?: string;
  styleTags?: string[];
  styleTokenIds?: string[];
  contextTokenIds?: string[];
}

export interface Entity {
  id: string;
  name?: string;
  type: EntityType;
  role?: string;
  appearance: Appearance;
  physicsProfile?: PhysicsProfile;
}

export interface Appearance {
  description: string;
  referenceImageId?: string;
  styleTokens?: string[];
  identityTokenId?: string;
}

export interface PhysicsProfile {
  massHint?: "light" | "medium" | "heavy";
  rigidity?: "rigid" | "flexible" | "fluid";
  gravityAffect?: boolean;
  motionStyle?: "realistic" | "exaggerated" | "floaty";
}

export interface Shot {
  id: string;
  order: number;
  durationSec: number;
  description: string;
  camera: CameraSpec;
  activeEntities: string[];
  physicsHints?: PhysicsHints;
  dialogueTiming?: DialogueTiming;
  keyframes?: KeyframeSpec[];
}

export interface CameraSpec {
  type: "static" | "pan" | "tilt" | "dolly" | "zoom" | "orbit";
  framing: "wide" | "medium" | "closeup" | "extreme_closeup";
  positionHint?: string;
  motionPathHint?: string;
}

export interface PhysicsHints {
  gravityVector?: Vector2D;
  globalMotionField?: MotionFieldHint;
  entityMotions?: EntityMotionHint[];
  collisionMasks?: CollisionMaskHint[];
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface MotionFieldHint {
  description: string;
  intensity: "subtle" | "medium" | "strong";
}

export interface EntityMotionHint {
  entityId: string;
  pathHint: string;
  speed: "slow" | "medium" | "fast";
}

export interface CollisionMaskHint {
  target: "ground" | "wall" | "object";
  description: string;
}

export interface DialogueScript {
  lines: DialogueLine[];
}

export interface DialogueLine {
  id: string;
  speakerEntityId: string;
  text: string;
  emotion?: string;
  approxDurationSec?: number;
  shotIdHint?: string;
}

export interface DialogueTiming {
  lineIds: string[];
  segments: DialogueSegment[];
}

export interface DialogueSegment {
  lineId: string;
  startSec: number;
  endSec: number;
  emphasis?: "normal" | "intense" | "whisper";
  mouthMovementIntensity?: "subtle" | "normal" | "strong";
}

export interface KeyframeSpec {
  id: string;
  timeSec: number;
  description: string;
  imageId?: string;
  imageUrl?: string;
}

export interface GenerateVideoClipPhase1Request extends GenerateVideoClipRequest {}

export interface GenerateVideoClipPhase1Response extends GenerateVideoClipResponse {
  meta: GenerateVideoClipResponse["meta"] & {
    keyframes: KeyframeSpec[];
  };
}

export interface OmniVideoEnginePhase1 {
  generateVideoClipPhase1(request: GenerateVideoClipPhase1Request): Promise<GenerateVideoClipPhase1Response>;
}

export interface GenerateImageRequest {
  prompt: string;
  styleTags?: string[];
  referenceImages?: string[];
  styleTokenIds?: string[];
  identityTokenId?: string;
  contextTokenIds?: string[];
}

export interface GenerateImageResponse {
  id: string;
  url: string;
}

export interface OmniImageEngine {
  generateImage(request: GenerateImageRequest): Promise<GenerateImageResponse>;
}

export interface Frame {
  timeSec: number;
  imageId: string;
  imageUrl: string;
}

export interface FrameInterpolator {
  interpolate(keyframes: Frame[], fps: number, durationSec: number): Promise<Frame[]>;
}

export interface VideoEncodeOptions {
  fps: number;
  width: number;
  height: number;
  maxSizeMB: number;
  format: VideoFormat;
  qualityMode: VideoQualityMode;
}

export interface EncodedVideoResult {
  mp4Url?: string;
  gifUrl?: string;
  sizeMB: {
    mp4?: number;
    gif?: number;
  };
  durationSec: number;
  resolution: { width: number; height: number };
  fps: number;
}

export interface VideoEncoder {
  encode(frames: Frame[], options: VideoEncodeOptions): Promise<EncodedVideoResult>;
}

export interface StyleToken {
  id: string;
  name: string;
  description: string;
  embedding: number[];
}

export interface IdentityToken {
  id: string;
  name: string;
  description: string;
  embedding: number[];
  referenceImageIds: string[];
}

export interface ContextToken {
  id: string;
  description: string;
  embedding: number[];
}

export interface StyleRegistry {
  styles: Record<string, StyleToken>;
  identities: Record<string, IdentityToken>;
  contexts: Record<string, ContextToken>;
}

export type PlannerLLMCall = (input: { systemPrompt: string; userPrompt: string }) => Promise<string>;

export type ScenePlanningOptions = {
  callLLM?: PlannerLLMCall;
};

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function pickTimeOfDay(prompt: string): string | undefined {
  if (/\bnight\b/i.test(prompt)) return "night";
  if (/\bsunset\b|\bdusk\b/i.test(prompt)) return "sunset";
  if (/\bday\b|\bmorning\b|\bnoon\b/i.test(prompt)) return "day";
  return undefined;
}

function pickWeather(prompt: string): string | undefined {
  if (/\brain\b|\braining\b|\bstorm\b/i.test(prompt)) return "rain";
  if (/\bfog\b|\bfoggy\b|\bmist\b/i.test(prompt)) return "fog";
  if (/\bsnow\b|\bsnowing\b/i.test(prompt)) return "snow";
  return undefined;
}

function pickMood(prompt: string): string | undefined {
  if (/\btense\b|\bdanger\b|\bthreat\b/i.test(prompt)) return "tense";
  if (/\bmelancholy\b|\bmelancholic\b|\bsad\b/i.test(prompt)) return "melancholic";
  if (/\bhopeful\b|\bvictory\b|\bwarm\b/i.test(prompt)) return "hopeful";
  return undefined;
}

function inferFraming(prompt: string): CameraSpec["framing"] {
  if (/\bextreme close\b|\becu\b/i.test(prompt)) return "extreme_closeup";
  if (/\bclose[- ]?up\b|\bportrait\b/i.test(prompt)) return "closeup";
  if (/\bwide\b|\bestablishing\b/i.test(prompt)) return "wide";
  return "medium";
}

function inferCameraType(prompt: string): CameraSpec["type"] {
  if (/\bpan\b/i.test(prompt)) return "pan";
  if (/\btilt\b/i.test(prompt)) return "tilt";
  if (/\bdolly\b|\bpush[- ]?in\b|\btrack(?:ing)?\b/i.test(prompt)) return "dolly";
  if (/\bzoom\b/i.test(prompt)) return "zoom";
  if (/\borbit\b/i.test(prompt)) return "orbit";
  return "static";
}

function inferStyleTags(prompt: string): string[] {
  const styleTags: string[] = [];
  if (/\banime\b/i.test(prompt)) styleTags.push("anime-realism");
  if (/\bcinematic\b|\bfilmic\b/i.test(prompt)) styleTags.push("cinematic");
  if (/\bneo[- ]?tokyo\b|\bcyberpunk\b|\bneon\b/i.test(prompt)) styleTags.push("neon-noir");
  return styleTags;
}

function inferPrimaryEntityName(prompt: string): string {
  const named = prompt.match(/\b([A-Z][a-z]{2,})\b/);
  if (named && named[1]) {
    return named[1];
  }
  return "subject";
}

const PLANNER_TYPES_BLOCK = `SceneGraph:
{
  "id": string,
  "globalContext": {
    "location": string,
    "timeOfDay"?: string,
    "weather"?: string,
    "mood"?: string,
    "styleTags"?: string[]
  },
  "entities": {
    "id": string,
    "name"?: string,
    "type": "character" | "prop" | "environment" | "effect",
    "role"?: string,
    "appearance": {
      "description": string,
      "referenceImageId"?: string,
      "styleTokens"?: string[]
    },
    "physicsProfile"?: {
      "massHint"?: "light" | "medium" | "heavy",
      "rigidity"?: "rigid" | "flexible" | "fluid",
      "gravityAffect"?: boolean,
      "motionStyle"?: "realistic" | "exaggerated" | "floaty"
    }
  }[]
}

Shot:
{
  "id": string,
  "order": number,
  "durationSec": number,
  "description": string,
  "camera": {
    "type": "static" | "pan" | "tilt" | "dolly" | "zoom" | "orbit",
    "framing": "wide" | "medium" | "closeup" | "extreme_closeup",
    "positionHint"?: string,
    "motionPathHint"?: string
  },
  "activeEntities": string[],
  "physicsHints"?: {
    "gravityVector"?: { "x": number, "y": number },
    "globalMotionField"?: {
      "description": string,
      "intensity": "subtle" | "medium" | "strong"
    },
    "entityMotions"?: {
      "entityId": string,
      "pathHint": string,
      "speed": "slow" | "medium" | "fast"
    }[],
    "collisionMasks"?: {
      "target": "ground" | "wall" | "object",
      "description": string
    }[]
  },
  "dialogueTiming"?: {
    "lineIds": string[],
    "segments": {
      "lineId": string,
      "startSec": number,
      "endSec": number,
      "emphasis"?: "normal" | "intense" | "whisper",
      "mouthMovementIntensity"?: "subtle" | "normal" | "strong"
    }[]
  }
}

OUTPUT FORMAT:
{
  "sceneGraph": SceneGraph,
  "shots": Shot[]
}

Respond with ONLY this JSON. No comments, no extra text.`;

export function getCinematicPlannerSystemPrompt(): string {
  return [
    "You are Omni’s Cinematic Planner.",
    "",
    "Your job:",
    "1. Take a natural language prompt (and optional dialogue script).",
    "2. Infer:",
    "   - Global context (location, time of day, weather, mood, style tags).",
    "   - A small set of entities (characters, props, environment, effects).",
    "   - 1–3 shots that visually express the prompt.",
    "3. Output ONLY valid JSON matching the provided TypeScript types:",
    "   - SceneGraph",
    "   - Shot[]",
    "",
    "Constraints:",
    "- Prefer 1–2 shots for short clips (1–3 seconds total).",
    "- Keep descriptions concise but specific and visual.",
    "- Use stable IDs (e.g., \"char_aiko\", \"env_city_rooftop\").",
    "- If unsure, choose defaults:",
    "  - timeOfDay: \"night\" or \"sunset\" if neon/city; otherwise \"day\".",
    "  - weather: \"clear\" unless rain/fog/snow is implied.",
    "  - mood: \"calm\", \"tense\", or \"melancholic\" based on tone.",
    "- If no dialogue is provided, omit dialogueTiming.",
    "- PhysicsHints should be simple and high-level, not numeric simulations.",
    "",
    "KNOWN_STYLE_TAGS:",
    "- omni_anime_realism",
    "- omni_cinematic_soft_light",
    "- omni_high_contrast_neon",
    "If the user prompt suggests anime, cinematic, or neon, include the appropriate styleTags in globalContext.styleTags."
  ].join("\n");
}

export function buildPlannerPrompt(prompt: string, dialogueScript?: DialogueScript): string {
  return [
    "USER_PROMPT:",
    '"""',
    String(prompt || ""),
    '"""',
    "",
    "OPTIONAL_DIALOGUE_SCRIPT (may be empty):",
    dialogueScript ? JSON.stringify(dialogueScript, null, 2) : "null",
    "",
    "TYPES (for reference):",
    "",
    PLANNER_TYPES_BLOCK
  ].join("\n");
}

function sanitizePlannedShots(shots: Shot[], fallbackEntityId: string): Shot[] {
  const normalized = Array.isArray(shots) ? shots : [];
  const sliced = normalized.slice(0, 3);
  return sliced.map((shot, index) => ({
    ...shot,
    id: String(shot?.id || `shot_${index + 1}`),
    order: Number.isFinite(Number(shot?.order)) ? Number(shot.order) : index + 1,
    durationSec: Math.min(3, Math.max(0.6, Number(shot?.durationSec || 1.2))),
    description: String(shot?.description || "cinematic shot"),
    camera: {
      type: shot?.camera?.type || "static",
      framing: shot?.camera?.framing || "medium",
      positionHint: shot?.camera?.positionHint,
      motionPathHint: shot?.camera?.motionPathHint
    },
    activeEntities: Array.isArray(shot?.activeEntities) && shot.activeEntities.length
      ? shot.activeEntities.map((entityId) => String(entityId))
      : [fallbackEntityId]
  }));
}

function tryParsePlannerResponse(raw: string): { sceneGraph: SceneGraph; shots: Shot[] } | null {
  const input = String(raw || "").trim();
  if (!input) return null;

  const cleaned = input.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  if (!parsed.sceneGraph || !Array.isArray(parsed.shots)) return null;

  const sceneGraph = parsed.sceneGraph as SceneGraph;
  if (!sceneGraph.globalContext || !Array.isArray(sceneGraph.entities)) return null;

  const fallbackEntityId = String(sceneGraph.entities[0]?.id || "entity_primary");
  return {
    sceneGraph,
    shots: sanitizePlannedShots(parsed.shots as Shot[], fallbackEntityId)
  };
}

export async function planSceneAndShots(
  prompt: string,
  dialogueScript?: DialogueScript,
  options: ScenePlanningOptions = {}
): Promise<{ sceneGraph: SceneGraph; shots: Shot[] }> {
  const normalizedPrompt = String(prompt || "").trim();

  if (typeof options.callLLM === "function") {
    const raw = await options.callLLM({
      systemPrompt: getCinematicPlannerSystemPrompt(),
      userPrompt: buildPlannerPrompt(normalizedPrompt, dialogueScript)
    });
    const parsed = tryParsePlannerResponse(raw);
    if (parsed?.sceneGraph && parsed.shots.length) {
      return parsed;
    }
  }

  const sceneGraphId = makeId("scene");
  const entityId = makeId("entity");
  const weather = pickWeather(normalizedPrompt);
  const shotId = makeId("shot");

  const sceneGraph: SceneGraph = {
    id: sceneGraphId,
    globalContext: {
      location: /\brooftop\b/i.test(normalizedPrompt)
        ? "rooftop"
        : /\bstreet\b/i.test(normalizedPrompt)
          ? "street"
          : /\binterior\b|\bindoor\b/i.test(normalizedPrompt)
            ? "interior scene"
            : "cinematic environment",
      timeOfDay:
        pickTimeOfDay(normalizedPrompt) ||
        (/\bneon\b|\bcity\b|\bcyberpunk\b/i.test(normalizedPrompt) ? "night" : "day"),
      weather: weather || "clear",
      mood: pickMood(normalizedPrompt) || "calm",
      styleTags: inferStyleTags(normalizedPrompt)
    },
    entities: [
      {
        id: entityId,
        name: inferPrimaryEntityName(normalizedPrompt),
        type: "character",
        role: "protagonist",
        appearance: {
          description: normalizedPrompt,
          styleTokens: inferStyleTags(normalizedPrompt)
        },
        physicsProfile: {
          massHint: "medium",
          rigidity: "flexible",
          gravityAffect: true,
          motionStyle: "realistic"
        }
      }
    ]
  };

  const durationSec = dialogueScript?.lines?.length
    ? Math.min(2, Math.max(1, dialogueScript.lines.reduce((sum, line) => sum + Math.max(0.35, Number(line.approxDurationSec || 0.5)), 0)))
    : 1.5;

  const dialogueTiming = dialogueScript?.lines?.length
    ? buildDialogueTiming(shotId, durationSec, dialogueScript)
    : undefined;

  const motionDescription = weather === "rain" ? "rain falling straight down" : "ambient wind drift";

  const shot: Shot = {
    id: shotId,
    order: 1,
    durationSec,
    description: normalizedPrompt,
    camera: {
      type: inferCameraType(normalizedPrompt),
      framing: inferFraming(normalizedPrompt),
      positionHint: /\blow angle\b/i.test(normalizedPrompt)
        ? "low angle"
        : /\bbird'?s[- ]eye\b/i.test(normalizedPrompt)
          ? "bird's-eye"
          : "eye-level",
      motionPathHint: /\bpush[- ]?in\b/i.test(normalizedPrompt)
        ? "slow push-in"
        : /\bleft to right\b/i.test(normalizedPrompt)
          ? "left-to-right pan"
          : "subtle camera drift"
    },
    activeEntities: [entityId],
    physicsHints: {
      gravityVector: { x: 0, y: 1 },
      globalMotionField: {
        description: motionDescription,
        intensity: weather ? "medium" : "subtle"
      },
      entityMotions: [
        {
          entityId,
          pathHint: /\brun\b|\bsprint\b/i.test(normalizedPrompt)
            ? "moves left to right"
            : "holds pose with subtle breathing motion",
          speed: /\brun\b|\bsprint\b/i.test(normalizedPrompt) ? "fast" : "slow"
        }
      ],
      collisionMasks: [
        {
          target: "ground",
          description: weather === "rain" ? "wet pavement floor" : "ground plane"
        }
      ]
    },
    dialogueTiming
  };

  return {
    sceneGraph,
    shots: [shot]
  };
}

function buildDialogueTiming(shotId: string, durationSec: number, dialogueScript: DialogueScript): DialogueTiming {
  const linesForShot = dialogueScript.lines.filter((line) => !line.shotIdHint || line.shotIdHint === shotId);
  const effectiveLines = linesForShot.length ? linesForShot : dialogueScript.lines;
  const totalEstimated = effectiveLines.reduce((sum, line) => sum + Math.max(0.35, Number(line.approxDurationSec || 0.5)), 0);

  let cursor = 0;
  const segments: DialogueSegment[] = effectiveLines.map((line, index) => {
    const base = Math.max(0.35, Number(line.approxDurationSec || 0.5));
    const scaled = totalEstimated > 0 ? (base / totalEstimated) * durationSec : durationSec / Math.max(1, effectiveLines.length);
    const startSec = cursor;
    const endSec = Math.min(durationSec, startSec + scaled);
    cursor = endSec;

    return {
      lineId: line.id,
      startSec,
      endSec: index === effectiveLines.length - 1 ? durationSec : endSec,
      emphasis: line.emotion === "afraid" ? "whisper" : line.emotion === "determined" ? "intense" : "normal",
      mouthMovementIntensity: line.emotion === "intense" ? "strong" : "normal"
    };
  });

  return {
    lineIds: effectiveLines.map((line) => line.id),
    segments
  };
}

export function createKeyframesForShot(shot: Shot): KeyframeSpec[] {
  const duration = Math.max(0.5, Number(shot.durationSec || 1.5));
  const keyframes: KeyframeSpec[] = [];

  keyframes.push({
    id: `${shot.id}-kf-start`,
    timeSec: 0,
    description: `${shot.description}, start of motion`
  });

  if (duration > 1.2) {
    keyframes.push({
      id: `${shot.id}-kf-mid`,
      timeSec: duration / 2,
      description: `${shot.description}, mid-motion`
    });
  }

  keyframes.push({
    id: `${shot.id}-kf-end`,
    timeSec: duration,
    description: `${shot.description}, end of motion`
  });

  return keyframes;
}

export function createKeyframesForShots(shots: Shot[]): KeyframeSpec[] {
  return shots.flatMap(createKeyframesForShot);
}

export function resolveStyleAndIdentityTokens(sceneGraph: SceneGraph, registry: StyleRegistry): SceneGraph {
  const updated: SceneGraph = {
    ...sceneGraph,
    globalContext: {
      ...sceneGraph.globalContext,
      styleTokenIds: [],
      contextTokenIds: []
    },
    entities: [...sceneGraph.entities]
  };

  for (const tag of updated.globalContext.styleTags ?? []) {
    const normalizedTag = String(tag || "").toLowerCase();
    const style = Object.values(registry.styles || {}).find((candidate) => {
      const haystack = `${candidate.name} ${candidate.description}`.toLowerCase();
      return haystack.includes(normalizedTag);
    });
    if (style) {
      updated.globalContext.styleTokenIds?.push(style.id);
    }
  }

  const contextNeedle = [
    updated.globalContext.location,
    updated.globalContext.weather,
    updated.globalContext.mood,
    updated.globalContext.timeOfDay
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const contextToken of Object.values(registry.contexts || {})) {
    const haystack = `${contextToken.id} ${contextToken.description}`.toLowerCase();
    if (contextNeedle && haystack.includes(contextNeedle.split(" ")[0])) {
      updated.globalContext.contextTokenIds?.push(contextToken.id);
    }
  }

  updated.entities = updated.entities.map((entity) => {
    const cloned: Entity = {
      ...entity,
      appearance: {
        ...entity.appearance,
        styleTokens: [...(entity.appearance.styleTokens ?? [])]
      }
    };

    if (cloned.role === "protagonist" || cloned.name) {
      const lookupName = String(cloned.name || "").trim().toLowerCase();
      const identityMatch = Object.values(registry.identities || {}).find((token) => token.name.toLowerCase() === lookupName);
      if (identityMatch) {
        cloned.appearance.identityTokenId = identityMatch.id;
      }
    }

    const inheritedStyleTokens = updated.globalContext.styleTokenIds ?? [];
    cloned.appearance.styleTokens = [...new Set([...(cloned.appearance.styleTokens ?? []), ...inheritedStyleTokens])];

    return cloned;
  });

  return updated;
}

export function buildImageRequestForKeyframe(
  kf: KeyframeSpec,
  sceneGraph: SceneGraph,
  shot: Shot,
  referenceImages: string[] = []
): GenerateImageRequest {
  const global = sceneGraph.globalContext;
  const activeEntity = sceneGraph.entities.find(
    (entity) => shot.activeEntities.includes(entity.id) && entity.type === "character"
  );

  return {
    prompt: kf.description,
    styleTags: global.styleTags,
    referenceImages,
    styleTokenIds: global.styleTokenIds,
    identityTokenId: activeEntity?.appearance.identityTokenId,
    contextTokenIds: global.contextTokenIds
  };
}

export async function renderKeyframes(
  keyframes: KeyframeSpec[],
  sceneGraph: SceneGraph,
  imageEngine: OmniImageEngine,
  referenceImages: string[] = [],
  shot?: Shot,
  registry?: StyleRegistry
): Promise<KeyframeSpec[]> {
  const tokenizedGraph = registry ? resolveStyleAndIdentityTokens(sceneGraph, registry) : sceneGraph;
  const activeShot = shot || {
    id: "shot_default",
    order: 1,
    durationSec: 1.5,
    description: "default shot",
    camera: { type: "static", framing: "medium" },
    activeEntities: tokenizedGraph.entities.slice(0, 1).map((entity) => entity.id)
  };

  const rendered: KeyframeSpec[] = [];
  for (const kf of keyframes) {
    const imageRequest = buildImageRequestForKeyframe(kf, tokenizedGraph, activeShot, referenceImages);
    const res = await imageEngine.generateImage(imageRequest);

    rendered.push({
      ...kf,
      imageId: res.id,
      imageUrl: res.url
    });
  }

  return rendered;
}

export async function buildFramesFromKeyframes(
  keyframes: KeyframeSpec[],
  fps: number,
  durationSec: number,
  interpolator: FrameInterpolator
): Promise<Frame[]> {
  const frames: Frame[] = keyframes
    .filter((kf): kf is KeyframeSpec & { imageId: string; imageUrl: string } => Boolean(kf.imageId && kf.imageUrl))
    .map((kf) => ({
      timeSec: kf.timeSec,
      imageId: kf.imageId,
      imageUrl: kf.imageUrl
    }));

  if (!frames.length) {
    return [];
  }

  return interpolator.interpolate(frames, fps, durationSec);
}

export class LinearHoldFrameInterpolator implements FrameInterpolator {
  async interpolate(keyframes: Frame[], fps: number, durationSec: number): Promise<Frame[]> {
    const sorted = [...keyframes].sort((a, b) => a.timeSec - b.timeSec);
    const frameCount = Math.max(1, Math.ceil(durationSec * fps));
    const out: Frame[] = [];

    let cursor = 0;
    for (let i = 0; i < frameCount; i++) {
      const timeSec = i / fps;
      while (cursor + 1 < sorted.length && sorted[cursor + 1].timeSec <= timeSec) {
        cursor += 1;
      }

      out.push({
        timeSec,
        imageId: sorted[cursor].imageId,
        imageUrl: sorted[cursor].imageUrl
      });
    }

    return out;
  }
}

function estimateMp4SizeMB(width: number, height: number, fps: number, durationSec: number, qualityMode: VideoQualityMode): number {
  const qualityFactor = qualityMode === "CRISP_SHORT" ? 1.15 : qualityMode === "LONG_SOFT" ? 0.8 : 1;
  const pixels = width * height;
  const bitsPerPixelPerFrame = 0.085 * qualityFactor;
  const totalBits = pixels * fps * durationSec * bitsPerPixelPerFrame;
  return totalBits / 8 / 1024 / 1024;
}

function estimateGifSizeMB(width: number, height: number, fps: number, durationSec: number): number {
  const pixels = width * height;
  const colorPaletteFactor = 0.45;
  const bitsPerPixelPerFrame = 1.6 * colorPaletteFactor;
  const totalBits = pixels * fps * durationSec * bitsPerPixelPerFrame;
  return totalBits / 8 / 1024 / 1024;
}

function decodeBase64(input: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(input, "base64"));
  }

  const binary = atob(input);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const value = String(dataUrl || "").trim();
  const match = value.match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match?.[1] || !match?.[2]) return null;
  return {
    mime: String(match[1] || "").toLowerCase(),
    bytes: decodeBase64(match[2])
  };
}

function isMp4EncodingEnabled(): boolean {
  if (typeof process === "undefined" || !process?.env) return false;
  const raw = String(process.env.OMNI_VIDEO_ENABLE_MP4_ENCODING || process.env.OMNI_VIDEO_ENABLE_ENCODING || "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function isNodeRuntime(): boolean {
  return typeof process !== "undefined" && Boolean(process?.versions?.node);
}

async function importNodeModule(specifier: string): Promise<any> {
  const dynamicImport = Function("s", "return import(s)") as (s: string) => Promise<any>;
  return dynamicImport(specifier);
}

async function encodeMp4WithFfmpeg(frames: Frame[], fps: number): Promise<{ dataUrl: string; sizeMB: number } | null> {
  if (!isMp4EncodingEnabled() || !isNodeRuntime() || !frames.length) {
    return null;
  }

  try {
    const [{ mkdtemp, writeFile, readFile, rm }, { tmpdir }, { join }, { spawn }] = await Promise.all([
      importNodeModule("node:fs/promises"),
      importNodeModule("node:os"),
      importNodeModule("node:path"),
      importNodeModule("node:child_process")
    ]);

    const workingDir = await mkdtemp(join(tmpdir(), "omni-video-"));

    try {
      let written = 0;
      for (const frame of frames) {
        const parsed = parseDataUrl(frame.imageUrl);
        if (!parsed || parsed.mime !== "image/png") {
          continue;
        }

        const filename = `frame_${String(written).padStart(5, "0")}.png`;
        await writeFile(join(workingDir, filename), parsed.bytes);
        written += 1;
      }

      if (written < 2) {
        return null;
      }

      const outputPath = join(workingDir, "output.mp4");
      const args = [
        "-y",
        "-framerate",
        String(Math.max(1, Math.floor(fps))),
        "-i",
        join(workingDir, "frame_%05d.png"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outputPath
      ];

      const exitCode = await new Promise<number>((resolve) => {
        const child = spawn("ffmpeg", args, { stdio: "ignore" });
        child.on("error", () => resolve(-1));
        child.on("close", (code: number | null) => resolve(typeof code === "number" ? code : -1));
      });

      if (exitCode !== 0) {
        return null;
      }

      const mp4Bytes = new Uint8Array(await readFile(outputPath));
      const dataUrl = `data:video/mp4;base64,${encodeBase64(mp4Bytes)}`;
      return {
        dataUrl,
        sizeMB: Number((mp4Bytes.byteLength / 1024 / 1024).toFixed(3))
      };
    } finally {
      await rm(workingDir, { recursive: true, force: true });
    }
  } catch {
    return null;
  }
}

function encodeGifFromFrames(frames: Frame[], fps: number): { dataUrl: string; width: number; height: number } | null {
  const decodedFrames: Uint8Array[] = [];
  let width = 0;
  let height = 0;

  for (const frame of frames) {
    const parsed = parseDataUrl(frame.imageUrl);
    if (!parsed || !parsed.mime.startsWith("image/")) continue;

    try {
      const arrayBuffer = Uint8Array.from(parsed.bytes).buffer;
      const decoded = UPNG.decode(arrayBuffer);
      const rgbaFrames = UPNG.toRGBA8(decoded);
      if (!Array.isArray(rgbaFrames) || !rgbaFrames.length) continue;

      const rgba = new Uint8Array(rgbaFrames[0]);
      const frameWidth = Number(decoded?.width || 0);
      const frameHeight = Number(decoded?.height || 0);
      if (!frameWidth || !frameHeight || rgba.length !== frameWidth * frameHeight * 4) continue;

      if (!width || !height) {
        width = frameWidth;
        height = frameHeight;
      }

      if (frameWidth !== width || frameHeight !== height) {
        continue;
      }

      decodedFrames.push(rgba);
    } catch {
      continue;
    }
  }

  if (!decodedFrames.length || !width || !height) return null;

  const allPixels = new Uint8Array(decodedFrames.length * width * height * 4);
  let offset = 0;
  for (const rgba of decodedFrames) {
    allPixels.set(rgba, offset);
    offset += rgba.length;
  }

  const palette = quantize(allPixels, 256);
  const encoder = GIFEncoder();
  const delay = Math.max(4, Math.round(100 / Math.max(1, fps)));

  for (const rgba of decodedFrames) {
    const indexed = applyPalette(rgba, palette);
    encoder.writeFrame(indexed, width, height, {
      palette,
      delay
    });
  }

  encoder.finish();
  const gifBytes = encoder.bytesView();
  const base64 = encodeBase64(gifBytes);
  return {
    dataUrl: `data:image/gif;base64,${base64}`,
    width,
    height
  };
}

export class BudgetAwareEstimatorEncoder implements VideoEncoder {
  async encode(frames: Frame[], options: VideoEncodeOptions): Promise<EncodedVideoResult> {
    if (!frames.length) {
      return {
        durationSec: 0,
        resolution: { width: options.width, height: options.height },
        fps: options.fps,
        sizeMB: {}
      };
    }

    let fps = options.fps;
    let width = options.width;
    let height = options.height;
    let durationSec = frames.length / Math.max(1, fps);

    const wantsMp4 = options.format === "mp4" || options.format === "both";
    const wantsGif = options.format === "gif" || options.format === "both";

    let mp4Size = wantsMp4 ? estimateMp4SizeMB(width, height, fps, durationSec, options.qualityMode) : undefined;

    const target = Math.max(0.2, options.maxSizeMB || 2);
    const fpsLadder = [fps, 10, 8].filter((value, index, array) => value > 0 && array.indexOf(value) === index);
    const widthLadder = [width, 448, 384].filter((value, index, array) => value > 0 && array.indexOf(value) === index);

    for (const nextFps of fpsLadder) {
      fps = nextFps;
      durationSec = frames.length / Math.max(1, fps);
      mp4Size = wantsMp4 ? estimateMp4SizeMB(width, height, fps, durationSec, options.qualityMode) : undefined;
      if (!wantsMp4 || (mp4Size ?? 0) <= target) {
        break;
      }
    }

    if (wantsMp4 && (mp4Size ?? 0) > target) {
      for (const nextWidth of widthLadder) {
        width = nextWidth;
        height = nextWidth;
        mp4Size = estimateMp4SizeMB(width, height, fps, durationSec, options.qualityMode);
        if ((mp4Size ?? 0) <= target) {
          break;
        }
      }
    }

    if (wantsMp4 && (mp4Size ?? 0) > target) {
      durationSec = Math.max(0.8, durationSec * 0.9);
      mp4Size = estimateMp4SizeMB(width, height, fps, durationSec, options.qualityMode);
    }

    const encodedMp4 = wantsMp4 ? await encodeMp4WithFfmpeg(frames, fps) : null;
    const gifFps = Math.min(8, fps);
    const encodedGif = wantsGif ? encodeGifFromFrames(frames, gifFps) : null;
    const gifWidth = encodedGif?.width || width;
    const gifHeight = encodedGif?.height || height;
    const gifSize = wantsGif ? estimateGifSizeMB(gifWidth, gifHeight, gifFps, durationSec) : undefined;

    const mediaId = makeId("video");

    return {
      mp4Url: wantsMp4 ? encodedMp4?.dataUrl || `omni://video/${mediaId}.mp4` : undefined,
      gifUrl: wantsGif ? encodedGif?.dataUrl || `omni://video/${mediaId}.gif` : undefined,
      sizeMB: {
        mp4: wantsMp4 ? encodedMp4?.sizeMB ?? Number((mp4Size ?? 0).toFixed(3)) : undefined,
        gif: wantsGif ? Number((gifSize ?? 0).toFixed(3)) : undefined
      },
      durationSec: Number(durationSec.toFixed(3)),
      resolution: { width: gifWidth, height: gifHeight },
      fps
    };
  }
}

export class OmniVideoEnginePhase1Impl implements OmniVideoEnginePhase1, OmniVideoEngine {
  constructor(
    private readonly imageEngine: OmniImageEngine,
    private readonly interpolator: FrameInterpolator,
    private readonly encoder: VideoEncoder,
    private readonly options: {
      plannerLLMCall?: PlannerLLMCall;
      styleRegistry?: StyleRegistry;
    } = {}
  ) {}

  async generateVideoClip(request: GenerateVideoClipRequest): Promise<GenerateVideoClipResponse> {
    const result = await this.generateVideoClipPhase1(request);
    return {
      id: result.id,
      mp4Url: result.mp4Url,
      gifUrl: result.gifUrl,
      sizeMB: result.sizeMB,
      meta: {
        durationSec: result.meta.durationSec,
        resolution: result.meta.resolution,
        fps: result.meta.fps,
        sceneGraph: result.meta.sceneGraph,
        shots: result.meta.shots
      }
    };
  }

  async generateVideoClipPhase1(
    request: GenerateVideoClipPhase1Request
  ): Promise<GenerateVideoClipPhase1Response> {
    const {
      prompt,
      dialogueScript,
      referenceImages,
      durationSec: requestedDurationSec,
      qualityMode = "BALANCED",
      maxSizeMB = 2,
      format = "both"
    } = request;

    let planned: { sceneGraph: SceneGraph; shots: Shot[] };
    try {
      planned = await planSceneAndShots(prompt, dialogueScript, {
        callLLM: this.options.plannerLLMCall
      });
    } catch {
      planned = await planSceneAndShots(prompt, dialogueScript);
    }

    const { sceneGraph, shots } = planned;
    const shot = shots[0];
    const plannedDurationSec = Math.max(1, Math.min(8, Number(shot.durationSec || 1.5)));
    const durationSec = Number.isFinite(Number(requestedDurationSec))
      ? Math.max(2, Math.min(8, Number(requestedDurationSec)))
      : Math.max(2, Math.min(8, plannedDurationSec));

    const keyframes = createKeyframesForShot(shot);
    const renderedKeyframes = await renderKeyframes(
      keyframes,
      sceneGraph,
      this.imageEngine,
      referenceImages || [],
      shot,
      this.options.styleRegistry
    );

    const fps = qualityMode === "CRISP_SHORT" ? 16 : qualityMode === "LONG_SOFT" ? 10 : 12;

    const frames = await buildFramesFromKeyframes(renderedKeyframes, fps, durationSec, this.interpolator);

    const encoded = await this.encoder.encode(frames, {
      fps,
      width: 512,
      height: 512,
      maxSizeMB,
      format,
      qualityMode
    });

    return {
      id: makeId("omni-video"),
      mp4Url: encoded.mp4Url,
      gifUrl: encoded.gifUrl,
      sizeMB: encoded.sizeMB,
      meta: {
        durationSec: encoded.durationSec,
        resolution: encoded.resolution,
        fps: encoded.fps,
        sceneGraph,
        shots: [{ ...shot, keyframes: renderedKeyframes }],
        keyframes: renderedKeyframes
      }
    };
  }
}
