console.log("modes.js loaded");

const modeButtons = document.querySelectorAll(".mode-btn");
const modeIndicatorEl = document.getElementById("mode-indicator");

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;
    if (modeIndicatorEl) {
      modeIndicatorEl.textContent = `Mode: ${mode}`;
    }
  });
});