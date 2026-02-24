module.exports = {
    inferScene(prompt) {
        const lower = prompt.toLowerCase();
        let description = "";

        if (lower.includes("bedroom") || lower.includes("room")) {
            description = "cozy interior, detailed furniture, realistic lighting";
        } else if (lower.includes("forest")) {
            description = "dense trees, atmospheric fog, grounded natural lighting";
        } else if (lower.includes("city")) {
            description = "urban environment, buildings, street lights, depth and perspective";
        } else if (lower.includes("cathedral")) {
            description = "grand architecture, stained glass, dramatic light shafts";
        } else {
            description = "coherent environment matching the subject and mood";
        }

        return {
            description
        };
    }
};
