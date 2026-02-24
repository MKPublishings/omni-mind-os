function promptDiffViewer(orchestrated, refined) {
    return {
        userPrompt: orchestrated.userPrompt,
        semanticExpansion: orchestrated.semanticExpansion,
        finalPrompt: refined.finalPrompt
    };
}

module.exports = promptDiffViewer;
