export type OmniEmotion = "neutral" | "apologetic" | "frustrated" | "positive" | "confused";

export interface EmotionDetectionResult {
  emotion: OmniEmotion;
  confidence: number;
  signals: string[];
}

const EMOTION_PATTERNS: Array<{ emotion: OmniEmotion; patterns: RegExp[] }> = [
  {
    emotion: "frustrated",
    patterns: [
      /\b(angry|frustrated|annoyed|irritated|this sucks|wtf|why is this broken)\b/i,
      /\b(not working|still broken|keeps failing|useless)\b/i
    ]
  },
  {
    emotion: "confused",
    patterns: [/\b(confused|unclear|lost|not sure|i don't get it|what does this mean)\b/i]
  },
  {
    emotion: "apologetic",
    patterns: [/\b(sorry|apologize|my bad|i was wrong)\b/i]
  },
  {
    emotion: "positive",
    patterns: [/\b(happy|glad|awesome|great|perfect|thanks|thank you|nice)\b/i]
  }
];

function normalizeText(value: unknown): string {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectEmotionDetailed(text: string): EmotionDetectionResult {
  const lower = normalizeText(text);
  if (!lower) {
    return { emotion: "neutral", confidence: 0.5, signals: ["empty-input"] };
  }

  const matches: Array<{ emotion: OmniEmotion; hits: number; samples: string[] }> = [];

  for (const entry of EMOTION_PATTERNS) {
    const samples: string[] = [];
    let hits = 0;

    for (const pattern of entry.patterns) {
      if (pattern.test(lower)) {
        hits += 1;
        samples.push(pattern.source);
      }
    }

    if (hits > 0) {
      matches.push({ emotion: entry.emotion, hits, samples });
    }
  }

  if (!matches.length) {
    return { emotion: "neutral", confidence: 0.62, signals: ["no-emotion-keywords"] };
  }

  const best = matches.sort((a, b) => b.hits - a.hits)[0];
  const confidence = Math.min(0.95, 0.64 + best.hits * 0.14);

  return {
    emotion: best.emotion,
    confidence,
    signals: best.samples.slice(0, 3)
  };
}

export function detectEmotion(text: string): OmniEmotion {
  return detectEmotionDetailed(text).emotion;
}