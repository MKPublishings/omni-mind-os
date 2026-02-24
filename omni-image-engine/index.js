const promptOrchestrator = require("./core/promptOrchestrator");
const multiPassRefiner = require("./core/multiPassRefiner");
const logger = require("./utils/logger");
const path = require("path");
const { spawn } = require("child_process");

function runPythonGenerator(finalPrompt, options = {}) {
    const pythonCmd = process.env.SLIZZAI_IMAGEGEN_PY_CMD || "python";
    const scriptPath = process.env.SLIZZAI_IMAGEGEN_SCRIPT || path.join(__dirname, "..", "slizzai-imagegen.v.2.1.py");
    const userId = options.userId || "omni-user";
    const feedback = options.feedback || "";

    const args = [scriptPath, "--user", String(userId), "--prompt", String(finalPrompt)];
    if (feedback) {
        args.push("--feedback", String(feedback));
    }

    return new Promise((resolve, reject) => {
        const proc = spawn(pythonCmd, args, { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (chunk) => {
            stdout += String(chunk);
        });

        proc.stderr.on("data", (chunk) => {
            stderr += String(chunk);
        });

        proc.on("error", (err) => reject(err));

        proc.on("close", (code) => {
            if (code !== 0) {
                return reject(new Error(`slizzai-imagegen exited with code ${code}: ${stderr || stdout}`));
            }

            try {
                const parsed = JSON.parse(stdout.trim());
                resolve(parsed);
            } catch (err) {
                reject(new Error(`Unable to parse slizzai-imagegen JSON output: ${err.message}`));
            }
        });
    });
}

async function generateImage(finalPrompt, options = {}) {
    logger.info("Calling slizzai-imagegen with prompt:", finalPrompt);

    if (typeof options.generateImage === "function") {
        return options.generateImage(finalPrompt, options);
    }

    const pythonResult = await runPythonGenerator(finalPrompt, options);
    return {
        prompt: finalPrompt,
        options,
        status: "ok",
        backend: "slizzai-imagegen.v2.1",
        pythonResult
    };
}

async function omniImageGenerate(userPrompt, options = {}) {
    logger.info("User prompt:", userPrompt);

    const orchestrated = promptOrchestrator(userPrompt, options);
    const { data, finalOptions } = multiPassRefiner(orchestrated, options);

    const result = await generateImage(data.finalPrompt, finalOptions);

    logger.info("Generation result status:", result.status);
    return { orchestrated, refined: data, result };
}

module.exports = {
    omniImageGenerate
};
