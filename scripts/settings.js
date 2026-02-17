console.log("settings.js loaded");

const animationsToggle = document.getElementById("toggle-animations");
const soundToggle = document.getElementById("toggle-sound");
const clearHistoryBtn = document.getElementById("clear-history");
const apiEndpointInput = document.getElementById("api-endpoint");

if (animationsToggle) {
  const saved = localStorage.getItem("omni-animations") === "on";
  animationsToggle.checked = saved;
  animationsToggle.addEventListener("change", () => {
    localStorage.setItem("omni-animations", animationsToggle.checked ? "on" : "off");
  });
}

if (soundToggle) {
  const saved = localStorage.getItem("omni-sound") === "on";
  soundToggle.checked = saved;
  soundToggle.addEventListener("change", () => {
    localStorage.setItem("omni-sound", soundToggle.checked ? "on" : "off");
  });
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    localStorage.removeItem("omni-chat-history");
    alert("Chat history cleared.");
  });
}

if (apiEndpointInput) {
  const saved = localStorage.getItem("omni-endpoint");
  if (saved) apiEndpointInput.value = saved;

  apiEndpointInput.addEventListener("change", () => {
    localStorage.setItem("omni-endpoint", apiEndpointInput.value.trim());
  });
}