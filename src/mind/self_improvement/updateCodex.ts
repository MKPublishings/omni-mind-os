import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

export interface DecisionEntry {
  timestamp: string;
  source: string;
  area: string;
  summary: string;
  details: string;
}

export async function appendDecision(entry: DecisionEntry): Promise<void> {
  const outDir = path.resolve(process.cwd(), "logs");
  const outFile = path.join(outDir, "codex-decisions.md");

  await mkdir(outDir, { recursive: true });

  const block = [
    `## ${entry.timestamp} | ${entry.source} | ${entry.area}`,
    "",
    `**Summary:** ${entry.summary}`,
    "",
    entry.details,
    "",
    "---",
    ""
  ].join("\n");

  await appendFile(outFile, block, "utf8");
}
