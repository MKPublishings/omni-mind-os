console.log("settings.js loaded");

// ==============================================
// SETTINGS CONFIGURATION
// ==============================================

const SETTINGS_KEYS = {
  AUTO_SCROLL: "omni-auto-scroll",
  FONT_SIZE: "omni-font-size",
  DEFAULT_MODEL: "omni-default-model",
  MODE_SELECTION: "omni-mode-selection",
  DEFAULT_MODE: "omni-default-mode",
  RESPONSE_LENGTH: "omni-response-length",
  ANIMATIONS: "omni-animations",
  SOUND: "omni-sound",
  SHOW_TIMESTAMPS: "omni-show-timestamps",
  COMPACT_MODE: "omni-compact-mode",
  API_ENDPOINT: "omni-endpoint",
  DEBUG_MODE: "omni-debug-mode",
  REQUEST_TIMEOUT: "omni-request-timeout",
  CHAT_HISTORY: "omni-chat-history"
};

// ==============================================
// HELPER FUNCTIONS
// ==============================================

function getSetting(key, defaultValue = null) {
  const value = localStorage.getItem(key);
  return value !== null ? value : defaultValue;
}

function setSetting(key, value) {
  localStorage.setItem(key, value);
  broadcastSettingsChange(key, value);
}

function getSettingBool(key, defaultValue = false) {
  const value = localStorage.getItem(key);
  return value === "true" || (value === null && defaultValue);
}

function setSettingBool(key, value) {
  localStorage.setItem(key, value ? "true" : "false");
  broadcastSettingsChange(key, value);
}

function broadcastSettingsChange(key, value) {
  // Dispatch custom event for same-page listeners
  window.dispatchEvent(new CustomEvent("omni-settings-changed", {
    detail: { key, value }
  }));
  
  // Storage events automatically fire for other tabs/windows
}

function showToast(message, type = "success") {
  const existingToast = document.getElementById("settings-toast");
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement("div");
  toast.id = "settings-toast";
  toast.className = `settings-toast settings-toast-${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add("show"), 10);
  
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function calculateStorageUsage() {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  return total;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

// ==============================================
// SAVE SETTINGS BUTTON
// ==============================================

const saveSettingsBtn = document.getElementById("save-settings-btn");

if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener("click", () => {
    // Trigger a manual save event (settings already auto-save)
    window.dispatchEvent(new CustomEvent("omni-settings-saved"));
    
    // Visual feedback
    const originalText = saveSettingsBtn.innerHTML;
    saveSettingsBtn.innerHTML = '<span class="btn-icon">✓</span> Saved!';
    saveSettingsBtn.style.background = "linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(74, 222, 128, 0.88))";
    
    showToast("✓ Settings saved and applied across all pages", "success");
    
    setTimeout(() => {
      saveSettingsBtn.innerHTML = originalText;
      saveSettingsBtn.style.background = "";
    }, 2000);
  });
}

// ==============================================
// CHAT SETTINGS
// ==============================================

const autoScrollToggle = document.getElementById("auto-scroll");
const fontSizeSelect = document.getElementById("font-size");
const clearHistoryBtn = document.getElementById("clear-history");

if (autoScrollToggle) {
  autoScrollToggle.checked = getSettingBool(SETTINGS_KEYS.AUTO_SCROLL, true);
  autoScrollToggle.addEventListener("change", () => {
    setSettingBool(SETTINGS_KEYS.AUTO_SCROLL, autoScrollToggle.checked);
  });
}

if (fontSizeSelect) {
  fontSizeSelect.value = getSetting(SETTINGS_KEYS.FONT_SIZE, "medium");
  fontSizeSelect.addEventListener("change", () => {
    setSetting(SETTINGS_KEYS.FONT_SIZE, fontSizeSelect.value);
  });
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all chat history? This cannot be undone.")) {
      localStorage.removeItem(SETTINGS_KEYS.CHAT_HISTORY);
      alert("✓ Chat history cleared successfully.");
    }
  });
}

// ==============================================
// MODEL & MODE SETTINGS
// ==============================================

const defaultModelSelect = document.getElementById("default-model");
const modeSelectionSelect = document.getElementById("mode-selection");
const defaultModeSelect = document.getElementById("default-mode");
const defaultModeSetting = document.getElementById("default-mode-setting");
const responseLengthSelect = document.getElementById("response-length");

if (defaultModelSelect) {
  defaultModelSelect.value = getSetting(SETTINGS_KEYS.DEFAULT_MODEL, "omni");
  defaultModelSelect.addEventListener("change", () => {
    setSetting(SETTINGS_KEYS.DEFAULT_MODEL, defaultModelSelect.value);
  });
}

if (modeSelectionSelect) {
  modeSelectionSelect.value = getSetting(SETTINGS_KEYS.MODE_SELECTION, "automatic");
  
  // Show/hide default mode setting based on selection
  function updateModeSettingVisibility() {
    if (defaultModeSetting) {
      defaultModeSetting.style.display = 
        modeSelectionSelect.value === "manual" ? "flex" : "none";
    }
  }
  
  updateModeSettingVisibility();
  
  modeSelectionSelect.addEventListener("change", () => {
    setSetting(SETTINGS_KEYS.MODE_SELECTION, modeSelectionSelect.value);
    updateModeSettingVisibility();
  });
}

if (defaultModeSelect) {
  defaultModeSelect.value = getSetting(SETTINGS_KEYS.DEFAULT_MODE, "architect");
  defaultModeSelect.addEventListener("change", () => {
    setSetting(SETTINGS_KEYS.DEFAULT_MODE, defaultModeSelect.value);
  });
}

if (responseLengthSelect) {
  responseLengthSelect.value = getSetting(SETTINGS_KEYS.RESPONSE_LENGTH, "balanced");
  responseLengthSelect.addEventListener("change", () => {
    setSetting(SETTINGS_KEYS.RESPONSE_LENGTH, responseLengthSelect.value);
  });
}

// ==============================================
// INTERFACE SETTINGS
// ==============================================

const animationsToggle = document.getElementById("toggle-animations");
const soundToggle = document.getElementById("toggle-sound");
const showTimestampsToggle = document.getElementById("show-timestamps");
const compactModeToggle = document.getElementById("compact-mode");

if (animationsToggle) {
  animationsToggle.checked = getSettingBool(SETTINGS_KEYS.ANIMATIONS, true);
  animationsToggle.addEventListener("change", () => {
    setSettingBool(SETTINGS_KEYS.ANIMATIONS, animationsToggle.checked);
  });
}

if (soundToggle) {
  soundToggle.checked = getSettingBool(SETTINGS_KEYS.SOUND, false);
  soundToggle.addEventListener("change", () => {
    setSettingBool(SETTINGS_KEYS.SOUND, soundToggle.checked);
  });
}

if (showTimestampsToggle) {
  showTimestampsToggle.checked = getSettingBool(SETTINGS_KEYS.SHOW_TIMESTAMPS, false);
  showTimestampsToggle.addEventListener("change", () => {
    setSettingBool(SETTINGS_KEYS.SHOW_TIMESTAMPS, showTimestampsToggle.checked);
  });
}

if (compactModeToggle) {
  compactModeToggle.checked = getSettingBool(SETTINGS_KEYS.COMPACT_MODE, false);
  compactModeToggle.addEventListener("change", () => {
    setSettingBool(SETTINGS_KEYS.COMPACT_MODE, compactModeToggle.checked);
  });
}

// ==============================================
// API CONFIGURATION
// ==============================================

const apiEndpointInput = document.getElementById("api-endpoint");
const debugModeToggle = document.getElementById("debug-mode");
const requestTimeoutInput = document.getElementById("request-timeout");

if (apiEndpointInput) {
  apiEndpointInput.value = getSetting(SETTINGS_KEYS.API_ENDPOINT, "");
  apiEndpointInput.placeholder = "/api/omni/stream";
  
  apiEndpointInput.addEventListener("change", () => {
    setSetting(SETTINGS_KEYS.API_ENDPOINT, apiEndpointInput.value.trim());
  });
}

if (debugModeToggle) {
  debugModeToggle.checked = getSettingBool(SETTINGS_KEYS.DEBUG_MODE, false);
  debugModeToggle.addEventListener("change", () => {
    setSettingBool(SETTINGS_KEYS.DEBUG_MODE, debugModeToggle.checked);
  });
}

if (requestTimeoutInput) {
  requestTimeoutInput.value = getSetting(SETTINGS_KEYS.REQUEST_TIMEOUT, "60");
  requestTimeoutInput.addEventListener("change", () => {
    const value = parseInt(requestTimeoutInput.value);
    if (value >= 10 && value <= 300) {
      setSetting(SETTINGS_KEYS.REQUEST_TIMEOUT, value.toString());
    } else {
      alert("Timeout must be between 10 and 300 seconds.");
      requestTimeoutInput.value = getSetting(SETTINGS_KEYS.REQUEST_TIMEOUT, "60");
    }
  });
}

// ==============================================
// DATA MANAGEMENT
// ==============================================

const exportHistoryBtn = document.getElementById("export-history");
const importHistoryBtn = document.getElementById("import-history-btn");
const importHistoryInput = document.getElementById("import-history");
const storageInfo = document.getElementById("storage-info");
const storageBadge = document.getElementById("storage-badge");
const resetSettingsBtn = document.getElementById("reset-settings");

// Export chat history
if (exportHistoryBtn) {
  exportHistoryBtn.addEventListener("click", () => {
    const history = localStorage.getItem(SETTINGS_KEYS.CHAT_HISTORY);
    
    if (!history) {
      alert("No chat history to export.");
      return;
    }
    
    const blob = new Blob([history], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `omni-chat-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert("✓ Chat history exported successfully.");
  });
}

// Import chat history
if (importHistoryBtn && importHistoryInput) {
  importHistoryBtn.addEventListener("click", () => {
    importHistoryInput.click();
  });
  
  importHistoryInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        // Validate JSON
        JSON.parse(content);
        
        if (confirm("This will replace your current chat history. Continue?")) {
          localStorage.setItem(SETTINGS_KEYS.CHAT_HISTORY, content);
          alert("✓ Chat history imported successfully.");
        }
      } catch (error) {
        alert("❌ Invalid file format. Please select a valid JSON file.");
      }
      
      // Reset input
      importHistoryInput.value = "";
    };
    
    reader.readAsText(file);
  });
}

// Calculate and display storage usage
function updateStorageInfo() {
  if (storageInfo && storageBadge) {
    const usage = calculateStorageUsage();
    const formatted = formatBytes(usage);
    
    storageInfo.textContent = `Using approximately ${formatted} of local storage`;
    storageBadge.textContent = formatted;
    
    // Color code based on usage
    if (usage > 5 * 1024 * 1024) { // Over 5MB
      storageBadge.style.background = "rgba(255, 76, 76, 0.12)";
      storageBadge.style.borderColor = "rgba(255, 76, 76, 0.32)";
      storageBadge.style.color = "#ff4c4c";
    } else if (usage > 2 * 1024 * 1024) { // Over 2MB
      storageBadge.style.background = "rgba(244, 208, 161, 0.12)";
      storageBadge.style.borderColor = "rgba(244, 208, 161, 0.32)";
      storageBadge.style.color = "#f4d0a1";
    } else {
      storageBadge.style.background = "rgba(255, 115, 115, 0.12)";
      storageBadge.style.borderColor = "rgba(255, 115, 115, 0.32)";
      storageBadge.style.color = "#ff7373";
    }
  }
}

updateStorageInfo();

// Reset all settings
if (resetSettingsBtn) {
  resetSettingsBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to reset ALL settings to defaults? This cannot be undone.")) {
      // Clear all omni-related settings but preserve chat history
      const historyBackup = localStorage.getItem(SETTINGS_KEYS.CHAT_HISTORY);
      
      Object.values(SETTINGS_KEYS).forEach(key => {
        if (key !== SETTINGS_KEYS.CHAT_HISTORY) {
          localStorage.removeItem(key);
        }
      });
      
      alert("✓ All settings reset to defaults.");
      location.reload();
    }
  });
}
