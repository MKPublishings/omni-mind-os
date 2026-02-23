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
const CHAT_SESSIONS_KEY = "omni_chat_sessions_v1";

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
// CUSTOM DROPDOWN MANAGER
// ==============================================

function createDropdownManager() {
  const dropdowns = new Map();

  function getDropdownItems(menuEl) {
    if (!menuEl) return [];
    return Array.from(menuEl.querySelectorAll(".settings-dropdown-item[data-value]"));
  }

  function setActiveItem(menuEl, value) {
    const normalized = (value || "").trim().toLowerCase();
    for (const item of getDropdownItems(menuEl)) {
      const isActive = (item.dataset.value || "").toLowerCase() === normalized;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-selected", isActive ? "true" : "false");
    }
  }

  function setOpen(controlEl, btnEl, open) {
    if (!controlEl || !btnEl) return;
    controlEl.classList.toggle("open", !!open);
    btnEl.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closeAllDropdowns() {
    for (const [, handler] of dropdowns) {
      if (handler.close) handler.close();
    }
  }

  function initDropdown(buttonId, menuId, controlId) {
    const btn = document.getElementById(buttonId);
    const menu = document.getElementById(menuId);
    const control = document.getElementById(controlId);

    if (!btn || !menu || !control) return null;

    function open() {
      closeAllDropdowns();
      setOpen(control, btn, true);
    }

    function close() {
      setOpen(control, btn, false);
    }

    function toggle() {
      const isOpen = control.classList.contains("open");
      closeAllDropdowns();
      setOpen(control, btn, !isOpen);
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle();
    });

    menu.addEventListener("click", (e) => {
      const item = e.target.closest(".settings-dropdown-item[data-value]");
      if (!item) return;
      const value = item.dataset.value || "";
      setActiveItem(menu, value);
      close();
      return { value };
    });

    dropdowns.set(controlId, { close, open, toggle, menu, btn, control });

    return { close, open, toggle, setActive: (v) => setActiveItem(menu, v) };
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest(".settings-dropdown-control")) return;
    closeAllDropdowns();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllDropdowns();
  });

  return { initDropdown, closeAll: closeAllDropdowns };
}

const dropdownMgr = createDropdownManager();

// ==============================================
// CHAT SETTINGS
// ==============================================

const autoScrollToggle = document.getElementById("auto-scroll");
const fontSizeBtn = document.getElementById("font-size-btn");
const fontSizeMenu = document.getElementById("font-size-menu");
const fontSizeDropdown = dropdownMgr.initDropdown("font-size-btn", "font-size-menu", "font-size-dropdown");
const clearHistoryBtn = document.getElementById("clear-history");


if (autoScrollToggle) {
  autoScrollToggle.checked = getSettingBool(SETTINGS_KEYS.AUTO_SCROLL, true);
  autoScrollToggle.addEventListener("change", () => {
    setSettingBool(SETTINGS_KEYS.AUTO_SCROLL, autoScrollToggle.checked);
  });
}

if (fontSizeDropdown && fontSizeMenu) {
  fontSizeDropdown.setActive(getSetting(SETTINGS_KEYS.FONT_SIZE, "medium"));
  fontSizeMenu.addEventListener("click", (e) => {
    const item = e.target.closest(".settings-dropdown-item[data-value]");
    if (!item) return;
    setSetting(SETTINGS_KEYS.FONT_SIZE, item.dataset.value);
  });
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all chat history? This cannot be undone.")) {
      localStorage.removeItem(SETTINGS_KEYS.CHAT_HISTORY);
      localStorage.removeItem(CHAT_SESSIONS_KEY);
      broadcastSettingsChange(CHAT_SESSIONS_KEY, null);
      alert("✓ Chat history cleared. A fresh chat will be created.");
    }
  });
}

// ==============================================
// MODEL & MODE SETTINGS
// ==============================================

const defaultModelDropdown = dropdownMgr.initDropdown("default-model-btn", "default-model-menu", "default-model-dropdown");
const defaultModelMenu = document.getElementById("default-model-menu");
const modeSelectionDropdown = dropdownMgr.initDropdown("mode-selection-btn", "mode-selection-menu", "mode-selection-dropdown");
const modeSelectionMenu = document.getElementById("mode-selection-menu");
const defaultModeDropdown = dropdownMgr.initDropdown("default-mode-btn", "default-mode-menu", "default-mode-dropdown");
const defaultModeMenu = document.getElementById("default-mode-menu");
const defaultModeSetting = document.getElementById("default-mode-setting");
const responseLengthDropdown = dropdownMgr.initDropdown("response-length-btn", "response-length-menu", "response-length-dropdown");
const responseLengthMenu = document.getElementById("response-length-menu");

function updateModeSettingVisibility() {
  if (!defaultModeSetting) return;
  const modeSelectionBtn = document.getElementById("mode-selection-btn");
  const isManual = modeSelectionBtn && modeSelectionBtn.textContent.trim().toLowerCase() === "manual";
  defaultModeSetting.style.display = isManual ? "flex" : "none";
}

if (defaultModelDropdown && defaultModelMenu) {
  defaultModelDropdown.setActive(getSetting(SETTINGS_KEYS.DEFAULT_MODEL, "omni"));
  defaultModelMenu.addEventListener("click", (e) => {
    const item = e.target.closest(".settings-dropdown-item[data-value]");
    if (!item) return;
    setSetting(SETTINGS_KEYS.DEFAULT_MODEL, item.dataset.value);
  });
}

if (modeSelectionDropdown && modeSelectionMenu) {
  modeSelectionDropdown.setActive(getSetting(SETTINGS_KEYS.MODE_SELECTION, "automatic"));
  updateModeSettingVisibility();

  modeSelectionMenu.addEventListener("click", (e) => {
    const item = e.target.closest(".settings-dropdown-item[data-value]");
    if (!item) return;
    setSetting(SETTINGS_KEYS.MODE_SELECTION, item.dataset.value);
    updateModeSettingVisibility();
  });
}

if (defaultModeDropdown && defaultModeMenu) {
  defaultModeDropdown.setActive(getSetting(SETTINGS_KEYS.DEFAULT_MODE, "architect"));
  defaultModeMenu.addEventListener("click", (e) => {
    const item = e.target.closest(".settings-dropdown-item[data-value]");
    if (!item) return;
    setSetting(SETTINGS_KEYS.DEFAULT_MODE, item.dataset.value);
  });
}

if (responseLengthDropdown && responseLengthMenu) {
  responseLengthDropdown.setActive(getSetting(SETTINGS_KEYS.RESPONSE_LENGTH, "balanced"));
  responseLengthMenu.addEventListener("click", (e) => {
    const item = e.target.closest(".settings-dropdown-item[data-value]");
    if (!item) return;
    setSetting(SETTINGS_KEYS.RESPONSE_LENGTH, item.dataset.value);
  });
}

window.addEventListener("storage", (e) => {
  const defaultModelBtn = document.getElementById("default-model-btn");
  const modeSelectionBtn = document.getElementById("mode-selection-btn");
  const defaultModeBtn = document.getElementById("default-mode-btn");

  if (e.key === SETTINGS_KEYS.MODE_SELECTION) {
    const val = getSetting(SETTINGS_KEYS.MODE_SELECTION, "automatic");
    if (modeSelectionDropdown) modeSelectionDropdown.setActive(val);
    if (modeSelectionBtn) modeSelectionBtn.textContent = val.charAt(0).toUpperCase() + val.slice(1);
    updateModeSettingVisibility();
  }

  if (e.key === SETTINGS_KEYS.DEFAULT_MODE) {
    const val = getSetting(SETTINGS_KEYS.DEFAULT_MODE, "architect");
    if (defaultModeDropdown) defaultModeDropdown.setActive(val);
    if (defaultModeBtn) defaultModeBtn.textContent = val.charAt(0).toUpperCase() + val.slice(1);
  }

  if (e.key === SETTINGS_KEYS.DEFAULT_MODEL) {
    const val = getSetting(SETTINGS_KEYS.DEFAULT_MODEL, "omni");
    if (defaultModelDropdown) defaultModelDropdown.setActive(val);
    if (defaultModelBtn) defaultModelBtn.textContent = val === "gpt-4o-mini" ? "GPT‑4o Mini" : val === "gpt-4o" ? "GPT‑4o" : val === "deepseek" ? "DeepSeek" : "Omni";
  }
});

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
