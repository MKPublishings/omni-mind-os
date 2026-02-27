const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  appendTaskTokens,
  buildAutoDebugTaskTokens,
  TOKEN_QUEUE_FILE
} = require("./taskTokenStore");

const ROOT = process.cwd();
const DECISIONS_DIR = path.join(ROOT, "codex", "40-decisions");

function appendDecision(summary, details) {
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const filePath = path.join(DECISIONS_DIR, `${date}-decision-log.md`);
  const header = `# Decisions for ${date}\n\n`;
  const block = [
    `## ${now} – auto-debugger`,
    "**Source:** omni",
    `**Summary:** ${summary}`,
    "",
    details,
    "",
    "---",
    ""
  ].join("\n");

  fs.mkdirSync(DECISIONS_DIR, { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, header + block, "utf8");
    return;
  }

  fs.appendFileSync(filePath, block, "utf8");
}

function run(command) {
  return new Promise((resolve) => {
    const proc = spawn(command, { shell: true });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => {
      stdout += d.toString();
      process.stdout.write(d.toString());
    });

    proc.stderr.on("data", (d) => {
      stderr += d.toString();
      process.stderr.write(d.toString());
    });

    proc.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function main() {
  const command = process.argv.slice(2).join(" ") || "npm test";
  const result = await run(command);

  if (result.code === 0) {
    const successTokens = buildAutoDebugTaskTokens({
      success: true,
      command,
      exitCode: result.code
    });
    const written = appendTaskTokens(successTokens);
    console.log(`Auto-debugger: queued ${written} task token(s) at ${TOKEN_QUEUE_FILE}.`);
    console.log("Auto-debugger: no failures detected.");
    return;
  }

  const trace = (result.stderr || result.stdout || "No output captured").slice(0, 6000);
  const patch = "// TODO: replace placeholder with Omni-generated diff";

  appendDecision(
    "Proposed patch for failing test command",
    [
      "### Command",
      `- \`${command}\``,
      "",
      "### Error Trace",
      "```",
      trace,
      "```",
      "",
      "### Proposed Patch",
      "```diff",
      patch,
      "```"
    ].join("\n")
  );

  const failureTokens = buildAutoDebugTaskTokens({
    success: false,
    command,
    exitCode: result.code,
    stderr: result.stderr,
    stdout: result.stdout,
    patch
  });
  const written = appendTaskTokens(failureTokens);
  console.log(`Auto-debugger: queued ${written} task token(s) at ${TOKEN_QUEUE_FILE}.`);

  console.log("Auto-debugger: failure recorded in codex decision log.");
}

main();
