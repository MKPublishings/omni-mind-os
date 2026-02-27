export interface VisualReasoningOutput {
  composition: string;
  cameraIntent: string;
  lightingIntent: string;
  paletteIntent: string;
  moodIntent: string;
  materialIntent: string;
  negativeIntent: string;
  directive: string;
}

function normalizeText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function chooseComposition(text: string): string {
  if (/\b(city|street|architecture|landscape|environment)\b/i.test(text)) return "wide environmental framing";
  if (/\b(portrait|character|face|person|hero)\b/i.test(text)) return "subject-centric portrait framing";
  if (/\b(product|object|item|artifact)\b/i.test(text)) return "clean product composition";
  return "balanced cinematic composition";
}

function chooseCamera(text: string): string {
  if (/\b(macro|close up|close-up|micro)\b/i.test(text)) return "macro";
  if (/\b(wide|landscape|environmental|street)\b/i.test(text)) return "wide-35mm";
  if (/\b(telephoto|compressed)\b/i.test(text)) return "telephoto-135mm";
  return "portrait-85mm";
}

function chooseLighting(text: string): string {
  if (/\b(noir|moody|dramatic|dark)\b/i.test(text)) return "cinematic-lowkey";
  if (/\b(daylight|natural light|outdoor)\b/i.test(text)) return "natural-daylight";
  if (/\b(studio|beauty|softbox)\b/i.test(text)) return "studio-soft";
  return "studio-soft";
}

function choosePalette(text: string): string {
  if (/\b(neon|cyberpunk|vibrant)\b/i.test(text)) return "neon magenta-cyan accents";
  if (/\b(monochrome|black and white|grayscale)\b/i.test(text)) return "monochrome tonal palette";
  if (/\b(warm|sunset|golden)\b/i.test(text)) return "warm amber highlights";
  return "cinematic balanced palette";
}

function chooseMood(text: string): string {
  if (/\b(epic|mythic|legendary)\b/i.test(text)) return "mythic cinematic tension";
  if (/\b(calm|peaceful|soft)\b/i.test(text)) return "calm atmospheric rhythm";
  if (/\b(dark|ominous|intense)\b/i.test(text)) return "high-contrast dramatic tension";
  return "focused narrative clarity";
}

function chooseMaterial(text: string): string {
  if (/\b(metal|chrome|steel|robot|armor)\b/i.test(text)) return "metallic microtexture emphasis";
  if (/\b(cloth|fabric|fashion|garment)\b/i.test(text)) return "fabric weave and fold detail";
  if (/\b(glass|crystal|transparent|bottle)\b/i.test(text)) return "glass refraction and edge clarity";
  if (/\b(skin|portrait|face)\b/i.test(text)) return "natural skin detail with soft microcontrast";
  return "balanced surface realism";
}

function chooseNegativeIntent(text: string): string {
  if (/\b(logo|watermark|text overlay)\b/i.test(text)) return "avoid over-stylized clutter";
  if (/\b(product|ecommerce)\b/i.test(text)) return "avoid background noise and crowding";
  return "avoid artifacts, blur, malformed anatomy, and accidental text";
}

export function runVisualReasoning(inputPrompt: string): VisualReasoningOutput {
  const text = normalizeText(inputPrompt);
  const composition = chooseComposition(text);
  const cameraIntent = chooseCamera(text);
  const lightingIntent = chooseLighting(text);
  const paletteIntent = choosePalette(text);
  const moodIntent = chooseMood(text);
  const materialIntent = chooseMaterial(text);
  const negativeIntent = chooseNegativeIntent(text);

  const directive = [
    `composition: ${composition}`,
    `camera: ${cameraIntent}`,
    `lighting: ${lightingIntent}`,
    `palette: ${paletteIntent}`,
    `mood: ${moodIntent}`,
    `material: ${materialIntent}`,
    `negative: ${negativeIntent}`
  ].join(", ");

  return {
    composition,
    cameraIntent,
    lightingIntent,
    paletteIntent,
    moodIntent,
    materialIntent,
    negativeIntent,
    directive
  };
}
