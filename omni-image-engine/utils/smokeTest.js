const { omniImageGenerate } = require("../index");

async function expectReject(label, value) {
    let failedAsExpected = false;

    try {
        await omniImageGenerate(value);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("non-empty prompt string")) {
            failedAsExpected = true;
            console.log(`✓ ${label}: rejected with guard message`);
        } else {
            throw new Error(`${label}: rejected with unexpected message: ${message}`);
        }
    }

    if (!failedAsExpected) {
        throw new Error(`${label}: expected rejection but call succeeded`);
    }
}

async function run() {
    await expectReject("null prompt", null);
    await expectReject("empty string prompt", "");
    await expectReject("object prompt", { text: "castle at dawn" });

    console.log("Image engine smoke test passed.");
}

run().catch((error) => {
    console.error("Image engine smoke test failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
