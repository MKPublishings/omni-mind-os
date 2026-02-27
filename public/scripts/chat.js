// omni chat.js — Style C (Full Omni Ai)
// Features:
// - SSE streaming with [DONE] sentinel
// - No early cutoffs, robust parsing
// - Token spacing + punctuation handling
// - Full Markdown rendering
// - Smooth text reveal (non-token flicker)
// - Multi-session with sidebar + hover previews
// - LocalStorage persistence
// - Model + mode selection hooks

(() => {
  // =========================
  // 1. DOM SELECTORS
  // =========================
  const messagesEl = document.getElementById("chat-messages") || document.getElementById("chat-container");
  const inputEl = document.getElementById("chat-input") || document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const modelDropdown = document.getElementById("model-dropdown");
  const modelBtn = document.getElementById("model-btn");
  const modelMenu = document.getElementById("model-menu");
  const modeDropdown = document.getElementById("mode-dropdown");
  const modeBtn = document.getElementById("mode-btn");
  const modeMenu = document.getElementById("mode-menu");
  const modeLabelEl = document.getElementById("mode-label");
  const chatAreaEl = document.getElementById("chat-area");
  const modelInspectorEl = document.getElementById("model-inspector");
  const apiStatusEl = document.getElementById("api-status");
  const simulationBadgeEl = document.getElementById("simulation-badge");
  const simulationPanelEl = document.getElementById("simulation-panel");
  const simulationStartBtn = document.getElementById("simulation-start-btn");
  const simulationPauseBtn = document.getElementById("simulation-pause-btn");
  const simulationResetBtn = document.getElementById("simulation-reset-btn");
  const simulationExportBtn = document.getElementById("simulation-export-btn");
  const simulationRulesEditorEl = document.getElementById("simulation-rules-editor");
  const simulationLogEl = document.getElementById("simulation-log");
  const mindRouteEl = document.getElementById("mind-route");
  const mindPersonaEl = document.getElementById("mind-persona");
  const mindEmotionEl = document.getElementById("mind-emotion");
  const mindTimelineEl = document.getElementById("mind-timeline");
  const internetModeEl = document.getElementById("internet-mode");
  const internetProfileEl = document.getElementById("internet-profile");
  const internetCountEl = document.getElementById("internet-count");
  const internetQueryEl = document.getElementById("internet-query");
  const internetSourcesEl = document.getElementById("internet-sources");
  const savePreferencesBtn = document.getElementById("save-preferences-btn");
  const resetMemoryBtn = document.getElementById("reset-memory-btn");

  const sessionsSidebarEl = document.getElementById("sessions-sidebar");
  const newSessionBtn = document.getElementById("new-session-btn");

  // Optional typing indicator
  const typingIndicatorEl = document.getElementById("typing-indicator");

  // =========================
  // 2. STATE ENGINE
  // =========================
  const STORAGE_KEY = "omni_chat_sessions_v1";
  const SETTINGS_KEYS = {
    AUTO_SCROLL: "omni-auto-scroll",
    FONT_SIZE: "omni-font-size",
    DEFAULT_MODEL: "omni-default-model",
    MODE_SELECTION: "omni-mode-selection",
    DEFAULT_MODE: "omni-default-mode",
    SIMULATION_DEFAULT_RULES: "omni-simulation-default-rules",
    SIMULATION_MAX_DEPTH: "omni-simulation-max-depth",
    SIMULATION_MAX_STEPS: "omni-simulation-max-steps",
    SIMULATION_AUTO_RESET: "omni-simulation-auto-reset",
    SIMULATION_LOG_VERBOSITY: "omni-simulation-log-verbosity",
    SOUND: "omni-sound",
    SHOW_TIMESTAMPS: "omni-show-timestamps",
    COMPACT_MODE: "omni-compact-mode",
    SEND_WITH_ENTER: "omni-send-with-enter",
    SHOW_ASSISTANT_BADGES: "omni-show-assistant-badges",
    AUTO_DETECT_MODE: "omni-auto-detect-mode",
    PERSIST_MANUAL_MODE: "omni-persist-manual-mode",
    REQUEST_TIMEOUT: "omni-request-timeout",
    API_HEALTH_INTERVAL: "omni-api-health-interval",
    API_RETRIES: "omni-api-retries"
  };
  const KNOWN_MODELS = ["auto", "omni", "gpt-4o-mini", "gpt-4o", "deepseek"];
  const KNOWN_MODES = ["auto", "architect", "analyst", "visual", "lore", "reasoning", "coding", "knowledge", "system-knowledge", "simulation"];
  const KNOWN_RENDER_STYLES = [
    "hyper-real",
    "3d",
    "realistic",
    "semi-realistic",
    "vector",
    "logo",
    "monochrome",
    "sketch",
    "vfx",
    "text"
  ];
  const KNOWN_CAMERA_PROFILES = ["portrait-85mm", "wide-35mm", "macro", "telephoto-135mm"];
  const KNOWN_LIGHTING_PROFILES = ["studio-soft", "studio-hard", "natural-daylight", "cinematic-lowkey"];
  const KNOWN_MATERIAL_PROFILES = ["skin", "fabric", "metal", "glass"];
  const AGE_PROFILE_KEY = "omni-age-profile-v1";

  let state = {
    activeSessionId: null,
    sessions: {}
  };

  let runtimeSettings = {
    autoScroll: true,
    fontSize: "medium",
    soundEnabled: false,
    showTimestamps: false,
    compactMode: false,
    sendWithEnter: true,
    showAssistantBadges: true,
    autoDetectMode: true,
    requestTimeoutSeconds: 60,
    apiHealthIntervalSeconds: 30,
    apiRetries: 1
  };

  function getSetting(key, fallback = "") {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function getSettingBool(key, fallback = false) {
    const value = getSetting(key, "");
    if (value === "") return fallback;
    return value === "true";
  }

  function loadRuntimeSettings() {
    const fontSize = String(getSetting(SETTINGS_KEYS.FONT_SIZE, "medium") || "medium").trim().toLowerCase();
    const timeoutRaw = Number(getSetting(SETTINGS_KEYS.REQUEST_TIMEOUT, "60"));
    const healthIntervalRaw = Number(getSetting(SETTINGS_KEYS.API_HEALTH_INTERVAL, "30"));
    const retriesRaw = Number(getSetting(SETTINGS_KEYS.API_RETRIES, "1"));

    runtimeSettings = {
      autoScroll: getSettingBool(SETTINGS_KEYS.AUTO_SCROLL, true),
      fontSize: ["small", "medium", "large"].includes(fontSize) ? fontSize : "medium",
      soundEnabled: getSettingBool(SETTINGS_KEYS.SOUND, false),
      showTimestamps: getSettingBool(SETTINGS_KEYS.SHOW_TIMESTAMPS, false),
      compactMode: getSettingBool(SETTINGS_KEYS.COMPACT_MODE, false),
      sendWithEnter: getSettingBool(SETTINGS_KEYS.SEND_WITH_ENTER, true),
      showAssistantBadges: getSettingBool(SETTINGS_KEYS.SHOW_ASSISTANT_BADGES, true),
      autoDetectMode: getSettingBool(SETTINGS_KEYS.AUTO_DETECT_MODE, true),
      requestTimeoutSeconds: Number.isFinite(timeoutRaw)
        ? Math.max(10, Math.min(300, Math.floor(timeoutRaw)))
        : 60,
      apiHealthIntervalSeconds: Number.isFinite(healthIntervalRaw)
        ? Math.max(10, Math.min(120, Math.floor(healthIntervalRaw)))
        : 30,
      apiRetries: Number.isFinite(retriesRaw)
        ? Math.max(0, Math.min(4, Math.floor(retriesRaw)))
        : 1
    };
  }

  function applyRuntimeSettings() {
    if (!messagesEl) return;

    messagesEl.classList.toggle("chat-compact", !!runtimeSettings.compactMode);
    messagesEl.classList.toggle("chat-font-small", runtimeSettings.fontSize === "small");
    messagesEl.classList.toggle("chat-font-medium", runtimeSettings.fontSize === "medium");
    messagesEl.classList.toggle("chat-font-large", runtimeSettings.fontSize === "large");
  }

  function getDefaultModelFromSettings() {
    const candidate = normalizeModel(getSetting(SETTINGS_KEYS.DEFAULT_MODEL, "auto"));
    return candidate || "auto";
  }

  function formatMessageTimestamp(timestamp) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || ts <= 0) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function playNotificationSound(kind = "assistant") {
    if (!runtimeSettings.soundEnabled) return;
    if (typeof window.AudioContext === "undefined" && typeof window.webkitAudioContext === "undefined") return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const context = new AudioCtx();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = kind === "error" ? 180 : kind === "send" ? 420 : 660;
      gainNode.gain.value = 0.0001;

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      const now = context.currentTime;
      gainNode.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      oscillator.start(now);
      oscillator.stop(now + 0.15);

      oscillator.onended = () => {
        context.close().catch(() => {});
      };
    } catch {
      // ignore sound failures
    }
  }

  function normalizeMode(mode) {
    const normalized = typeof mode === "string" ? mode.trim().toLowerCase() : "";
    return KNOWN_MODES.includes(normalized) ? normalized : "";
  }

  function normalizeModel(model) {
    const normalized = typeof model === "string" ? model.trim().toLowerCase() : "";
    return KNOWN_MODELS.includes(normalized) ? normalized : "";
  }

  function normalizeImageStyle(style) {
    const normalized = typeof style === "string" ? style.trim().toLowerCase() : "";
    return KNOWN_RENDER_STYLES.includes(normalized) ? normalized : "";
  }

  function getActiveImageStyle(session = getActiveSession()) {
    return normalizeImageStyle(session?.imageStyle);
  }

  function normalizeCameraProfile(camera) {
    const normalized = typeof camera === "string" ? camera.trim().toLowerCase() : "";
    return KNOWN_CAMERA_PROFILES.includes(normalized) ? normalized : "";
  }

  function normalizeLightingProfile(lighting) {
    const normalized = typeof lighting === "string" ? lighting.trim().toLowerCase() : "";
    return KNOWN_LIGHTING_PROFILES.includes(normalized) ? normalized : "";
  }

  function getActiveCameraProfile(session = getActiveSession()) {
    return normalizeCameraProfile(session?.imageCamera) || "portrait-85mm";
  }

  function getActiveLightingProfile(session = getActiveSession()) {
    return normalizeLightingProfile(session?.imageLighting) || "studio-soft";
  }

  function normalizeMaterialName(material) {
    const normalized = typeof material === "string" ? material.trim().toLowerCase() : "";
    return KNOWN_MATERIAL_PROFILES.includes(normalized) ? normalized : "";
  }

  function normalizeMaterialList(value) {
    if (Array.isArray(value)) {
      return [...new Set(value.map((item) => normalizeMaterialName(item)).filter(Boolean))];
    }

    const raw = String(value || "").trim();
    if (!raw) return [];

    return [...new Set(raw.split(/[;,]/).map((item) => normalizeMaterialName(item)).filter(Boolean))];
  }

  function getActiveMaterials(session = getActiveSession()) {
    const materials = normalizeMaterialList(session?.imageMaterials);
    if (materials.length) return materials;
    return ["skin"];
  }

  function getAgeProfile() {
    try {
      const raw = localStorage.getItem(AGE_PROFILE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function buildSafetyProfile() {
    const profile = getAgeProfile() || {};
    const ageTier = String(profile.ageTier || "minor").toLowerCase() === "adult" ? "adult" : "minor";
    const nsfwAccess = Boolean(profile.nsfwAccess) && ageTier === "adult";
    return {
      ageTier,
      humanVerified: Boolean(profile.humanVerified),
      nsfwAccess,
      explicitAllowed: nsfwAccess,
      illegalBlocked: true
    };
  }

  function evaluatePromptPolicy(text, safetyProfile) {
    const value = String(text || "").toLowerCase();

    const illegalPattern = /\b(child\s*sexual|minor\s*nudity|underage\s*sex|bestiality|sexual\s*assault|rape\s*content|incest\s*porn|exploitative\s*sexual)\b/i;
    if (illegalPattern.test(value)) {
      return {
        blocked: true,
        reason: "illegal",
        message: "Request blocked. Illegal sexual content is not permitted under any access tier."
      };
    }

    const explicitPattern = /\b(nsfw|nudity|nude|porn|pornographic|explicit\s*sex|sexual\s*content|erotic|fetish)\b/i;
    const isExplicit = explicitPattern.test(value);

    if (isExplicit && safetyProfile.ageTier !== "adult") {
      return {
        blocked: true,
        reason: "minor-explicit-block",
        message: "This request is age-restricted. Explicit sexual content is disabled for under-18 profiles."
      };
    }

    return {
      blocked: false,
      reason: isExplicit ? "adult-explicit-allowed" : "safe"
    };
  }

  function parseStyleCommand(content) {
    const text = String(content || "").trim();
    if (!text.toLowerCase().startsWith("/style")) return null;

    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      return { action: "show" };
    }

    const rawStyle = parts.slice(1).join(" ").trim().toLowerCase();
    if (rawStyle === "auto" || rawStyle === "none" || rawStyle === "off" || rawStyle === "reset") {
      return { action: "set", style: "" };
    }

    return { action: "set", style: normalizeImageStyle(rawStyle) };
  }

  function parseCameraCommand(content) {
    const text = String(content || "").trim();
    if (!text.toLowerCase().startsWith("/camera")) return null;

    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      return { action: "show" };
    }

    const requested = parts.slice(1).join(" ").trim().toLowerCase();
    if (requested === "reset" || requested === "default" || requested === "auto") {
      return { action: "set", camera: "portrait-85mm" };
    }

    return { action: "set", camera: normalizeCameraProfile(requested) };
  }

  function parseLightCommand(content) {
    const text = String(content || "").trim();
    if (!text.toLowerCase().startsWith("/light")) return null;

    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      return { action: "show" };
    }

    const requested = parts.slice(1).join(" ").trim().toLowerCase();
    if (requested === "reset" || requested === "default" || requested === "auto") {
      return { action: "set", lighting: "studio-soft" };
    }

    return { action: "set", lighting: normalizeLightingProfile(requested) };
  }

  function parseMaterialsCommand(content) {
    const text = String(content || "").trim();
    const lower = text.toLowerCase();

    if (!lower.startsWith("/material") && !lower.startsWith("/materials")) return null;

    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      return { action: "show" };
    }

    const requested = parts.slice(1).join(" ").trim();
    const requestedLower = requested.toLowerCase();
    if (requestedLower === "reset" || requestedLower === "default" || requestedLower === "auto") {
      return { action: "set", materials: ["skin"] };
    }

    return { action: "set", materials: normalizeMaterialList(requested) };
  }

  function parseWebCommand(content) {
    const text = String(content || "").trim();
    const lower = text.toLowerCase();
    if (!lower.startsWith("/web")) return null;

    const query = text.slice(4).trim();
    if (!query) {
      return { action: "help", query: "" };
    }

    return { action: "search", query };
  }

  function formatAvailableStyles() {
    return KNOWN_RENDER_STYLES.join(", ");
  }

  function formatAvailableCameras() {
    return KNOWN_CAMERA_PROFILES.join(", ");
  }

  function formatAvailableLighting() {
    return KNOWN_LIGHTING_PROFILES.join(", ");
  }

  function formatAvailableMaterials() {
    return KNOWN_MATERIAL_PROFILES.join(", ");
  }

  function buildStyleStatusMessage(session) {
    const active = getActiveImageStyle(session);
    const camera = getActiveCameraProfile(session);
    const lighting = getActiveLightingProfile(session);
    const materials = getActiveMaterials(session);
    const styleText = active ? `Current style: **${active}**.` : "Current style: **auto** (no forced style).";
    return `${styleText}\nCamera: **${camera}**\nLighting: **${lighting}**\nMaterials: **${materials.join(", ")}**\n\nUse \`/style <name>\`, \`/camera <profile>\`, \`/light <profile>\`, \`/materials a,b,c\`.\nStyles: ${formatAvailableStyles()}\nCameras: ${formatAvailableCameras()}\nLighting: ${formatAvailableLighting()}\nMaterials: ${formatAvailableMaterials()}`;
  }

  async function requestInternetSearch(query, mode) {
    const params = new URLSearchParams({ q: String(query || "").trim(), mode: String(mode || "auto") });
    const response = await fetch(`/api/internet/search?${params.toString()}`, { method: "GET" });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(String(data?.error || "Internet search failed"));
    }

    return {
      mode: String(data?.mode || "auto"),
      profile: data?.profile || null,
      hits: Array.isArray(data?.hits) ? data.hits : []
    };
  }

  function toModelLabel(model) {
    const normalized = normalizeModel(model) || "auto";
    if (normalized === "auto") return "Auto Router";
    if (normalized === "gpt-4o-mini") return "GPT‑4o Mini";
    if (normalized === "gpt-4o") return "GPT‑4o";
    if (normalized === "deepseek") return "DeepSeek";
    return "Omni";
  }

  function toModeLabel(mode) {
    const normalized = normalizeMode(mode) || "auto";
    if (normalized === "system-knowledge") return "System Knowledge";
    if (normalized === "simulation") return "Simulation";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function getSimulationDefaults() {
    const defaultRules = String(
      getSetting(
        SETTINGS_KEYS.SIMULATION_DEFAULT_RULES,
        "domain: system-state\ntime: linear\nentities: bounded\ntransitions: deterministic-by-default"
      ) || ""
    ).trim();
    const maxDepth = Number(getSetting(SETTINGS_KEYS.SIMULATION_MAX_DEPTH, "8"));
    const maxSteps = Number(getSetting(SETTINGS_KEYS.SIMULATION_MAX_STEPS, "64"));
    const autoReset = getSettingBool(SETTINGS_KEYS.SIMULATION_AUTO_RESET, false);
    const verbosity = String(getSetting(SETTINGS_KEYS.SIMULATION_LOG_VERBOSITY, "balanced") || "balanced").trim().toLowerCase();

    return {
      rules: defaultRules || "domain: system-state\ntime: linear\nentities: bounded\ntransitions: deterministic-by-default",
      maxDepth: Number.isFinite(maxDepth) ? Math.max(1, Math.min(64, Math.floor(maxDepth))) : 8,
      maxSteps: Number.isFinite(maxSteps) ? Math.max(1, Math.min(500, Math.floor(maxSteps))) : 64,
      autoReset,
      verbosity: ["quiet", "balanced", "verbose"].includes(verbosity) ? verbosity : "balanced"
    };
  }

  function ensureSimulationState(session) {
    if (!session) return null;
    if (!session.simulation || typeof session.simulation !== "object") {
      const defaults = getSimulationDefaults();
      session.simulation = {
        id: `sim_${Date.now()}`,
        status: "inactive",
        steps: 0,
        rules: defaults.rules,
        logs: [{ ts: Date.now(), message: "Simulation profile initialized (system-state)." }],
        maxDepth: defaults.maxDepth,
        maxSteps: defaults.maxSteps,
        autoReset: defaults.autoReset,
        verbosity: defaults.verbosity
      };
    }
    return session.simulation;
  }

  function ensureMindState(session) {
    if (!session) return null;
    if (!session.mindState || typeof session.mindState !== "object") {
      session.mindState = {
        route: "chat",
        persona: "pending",
        userEmotion: "pending",
        omniEmotion: "pending",
        timeline: []
      };
    }

    if (!Array.isArray(session.mindState.timeline)) {
      session.mindState.timeline = [];
    }

    return session.mindState;
  }

  function appendMindTimeline(session, text) {
    const mindState = ensureMindState(session);
    if (!mindState) return;

    const entry = {
      ts: Date.now(),
      text: String(text || "").trim()
    };
    if (!entry.text) return;

    mindState.timeline.push(entry);
    mindState.timeline = mindState.timeline.slice(-30);
  }

  function renderMindTimeline(session) {
    if (!mindTimelineEl) return;
    const mindState = ensureMindState(session);
    const timeline = Array.isArray(mindState?.timeline) ? mindState.timeline : [];

    mindTimelineEl.innerHTML = "";
    if (!timeline.length) {
      const empty = document.createElement("div");
      empty.className = "mind-timeline-entry";
      empty.textContent = "No mind-state events yet.";
      mindTimelineEl.appendChild(empty);
      return;
    }

    for (const item of timeline.slice(-8)) {
      const row = document.createElement("div");
      row.className = "mind-timeline-entry";
      const time = Number.isFinite(item?.ts)
        ? new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "--:--:--";
      row.textContent = `[${time}] ${String(item?.text || "")}`;
      mindTimelineEl.appendChild(row);
    }

    mindTimelineEl.scrollTop = mindTimelineEl.scrollHeight;
  }

  function updateMindStateUI(session = getActiveSession()) {
    const mindState = ensureMindState(session);
    if (mindRouteEl) mindRouteEl.textContent = `Route: ${mindState?.route || "chat"}`;
    if (mindPersonaEl) mindPersonaEl.textContent = `Persona: ${mindState?.persona || "pending"}`;
    if (mindEmotionEl) {
      const userEmotion = mindState?.userEmotion || "pending";
      const omniEmotion = mindState?.omniEmotion || "pending";
      mindEmotionEl.textContent = `Emotion: ${userEmotion} → ${omniEmotion}`;
    }
    renderMindTimeline(session);
    renderInternetInspector(session);
  }

  function ensureInternetInspectorState(session = getActiveSession()) {
    if (!session) return null;
    if (!session.internetInspector || typeof session.internetInspector !== "object") {
      session.internetInspector = {
        mode: getActiveMode(session) || "auto",
        profile: "none",
        count: 0,
        query: "",
        sources: [],
        updatedAt: 0
      };
    }
    if (!Array.isArray(session.internetInspector.sources)) {
      session.internetInspector.sources = [];
    }
    return session.internetInspector;
  }

  function renderInternetInspector(session = getActiveSession()) {
    const internetState = ensureInternetInspectorState(session);
    if (!internetState) return;

    if (internetModeEl) {
      internetModeEl.textContent = `Internet Mode: ${String(internetState.mode || "auto")}`;
    }
    if (internetProfileEl) {
      internetProfileEl.textContent = `Profile: ${String(internetState.profile || "none")}`;
    }
    if (internetCountEl) {
      const count = Number.isFinite(Number(internetState.count)) ? Number(internetState.count) : 0;
      internetCountEl.textContent = `Sources: ${count}`;
    }
    if (internetQueryEl) {
      const query = String(internetState.query || "").trim();
      internetQueryEl.textContent = query ? `Query: ${query}` : "Query: not used yet.";
    }

    if (!internetSourcesEl) return;
    internetSourcesEl.innerHTML = "";
    const sourceList = Array.isArray(internetState.sources) ? internetState.sources : [];
    if (!sourceList.length) {
      const row = document.createElement("div");
      row.className = "internet-source-item";
      row.textContent = "No internet sources captured for this session yet.";
      internetSourcesEl.appendChild(row);
      return;
    }

    for (const source of sourceList.slice(0, 6)) {
      const row = document.createElement("div");
      row.className = "internet-source-item";
      row.textContent = String(source || "");
      internetSourcesEl.appendChild(row);
    }
  }

  function updateInternetInspectorFromMeta(session, meta, queryText = "") {
    const internetState = ensureInternetInspectorState(session);
    if (!internetState) return;

    if (meta?.internetMode) {
      internetState.mode = String(meta.internetMode || "auto").trim().toLowerCase() || "auto";
    }
    if (meta?.internetProfile) {
      internetState.profile = String(meta.internetProfile || "none").trim() || "none";
    }
    if (Number.isFinite(meta?.internetCount)) {
      internetState.count = Number(meta.internetCount) || 0;
    }
    if (queryText) {
      internetState.query = queryText;
    }
    internetState.updatedAt = Date.now();
    renderInternetInspector(session);
  }

  function updateInternetInspectorFromWebSearch(session, query, searchResult) {
    const internetState = ensureInternetInspectorState(session);
    if (!internetState) return;

    internetState.mode = String(searchResult?.mode || getActiveMode(session) || "auto").trim().toLowerCase();
    const profile = searchResult?.profile;
    if (profile && typeof profile === "object") {
      internetState.profile = `${String(profile.queryPrefix || "")}|${String(profile.querySuffix || "")}|${String(profile.limit || "")}`;
    }
    internetState.count = Array.isArray(searchResult?.hits) ? searchResult.hits.length : 0;
    internetState.query = String(query || "").trim();
    internetState.sources = Array.isArray(searchResult?.hits)
      ? searchResult.hits
          .slice(0, 6)
          .map((hit) => `${String(hit?.source || "web")} · ${String(hit?.title || "Untitled")}`)
      : [];
    internetState.updatedAt = Date.now();
    renderInternetInspector(session);
  }

  function appendSimulationLog(session, message) {
    const simulation = ensureSimulationState(session);
    if (!simulation) return;
    simulation.logs = Array.isArray(simulation.logs) ? simulation.logs : [];
    simulation.logs.push({ ts: Date.now(), message: String(message || "").trim() || "Simulation event" });
    simulation.logs = simulation.logs.slice(-40);
  }

  function renderSimulationLog(session) {
    if (!simulationLogEl) return;
    const simulation = ensureSimulationState(session);
    const logs = Array.isArray(simulation?.logs) ? simulation.logs : [];
    simulationLogEl.innerHTML = "";

    if (!logs.length) {
      simulationLogEl.innerHTML = "<div class=\"simulation-log-entry\">No simulation logs yet.</div>";
      return;
    }

    for (const entry of logs.slice(-20)) {
      const row = document.createElement("div");
      row.className = "simulation-log-entry";
      const timestamp = Number.isFinite(entry?.ts)
        ? new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "--:--:--";
      row.textContent = `[${timestamp}] ${String(entry?.message || "")}`;
      simulationLogEl.appendChild(row);
    }
    simulationLogEl.scrollTop = simulationLogEl.scrollHeight;
  }

  function syncSimulationEditor(session) {
    if (!simulationRulesEditorEl) return;
    const simulation = ensureSimulationState(session);
    const nextValue = String(simulation?.rules || "");
    if (simulationRulesEditorEl.value !== nextValue) {
      simulationRulesEditorEl.value = nextValue;
    }
  }

  function updateSimulationUI(session = getActiveSession()) {
    const mode = getActiveMode(session);
    const simulation = ensureSimulationState(session);
    const isSimulationMode = mode === "simulation";
    const isRunning = isSimulationMode && simulation?.status === "active";

    if (simulationPanelEl) {
      simulationPanelEl.hidden = !isSimulationMode;
      simulationPanelEl.open = !!isSimulationMode;
    }

    if (simulationBadgeEl) {
      simulationBadgeEl.hidden = !isSimulationMode;
      const stateLabel = simulation?.status === "active" ? "Running" : simulation?.status === "paused" ? "Paused" : "Inactive";
      const steps = Number.isFinite(simulation?.steps) ? simulation.steps : 0;
      simulationBadgeEl.textContent = `Simulation: ${stateLabel} · Steps ${steps}`;
    }

    if (chatAreaEl) {
      chatAreaEl.classList.toggle("simulation-active", !!isRunning);
    }

    if (simulationStartBtn) simulationStartBtn.disabled = !isSimulationMode || isRunning;
    if (simulationPauseBtn) simulationPauseBtn.disabled = !isSimulationMode || !isRunning;
    if (simulationResetBtn) simulationResetBtn.disabled = !isSimulationMode;
    if (simulationExportBtn) simulationExportBtn.disabled = !isSimulationMode;

    syncSimulationEditor(session);
    renderSimulationLog(session);
  }

  function detectModeFromContent(content) {
    if (!content) return null;
    const lower = content.trim().toLowerCase();
    
    const architectKeywords = ["design", "architecture", "structure", "system", "api", "schema", "database", "pipeline", "build", "framework", "component", "module"];
    const analystKeywords = ["analyze", "analysis", "data", "research", "report", "trend", "pattern", "insight", "breakdown", "summary", "compare", "evaluate"];
    const visualKeywords = ["image", "visual", "scene", "visual art", "describe", "paint", "draw", "cinematic", "composition", "artistic", "aesthetic"];
    const loreKeywords = ["story", "lore", "narrative", "fiction", "worldbuild", "character", "background", "history", "mythology", "tales", "legend"];
    const simulationKeywords = ["simulate", "simulation", "system-state", "state transition", "run scenario", "sandbox", "rules:", "/simulation"];
    
    const architectScore = architectKeywords.filter(k => lower.includes(k)).length;
    const analystScore = analystKeywords.filter(k => lower.includes(k)).length;
    const visualScore = visualKeywords.filter(k => lower.includes(k)).length;
    const loreScore = loreKeywords.filter(k => lower.includes(k)).length;
    const simulationScore = simulationKeywords.filter(k => lower.includes(k)).length;
    
    const scores = { architect: architectScore, analyst: analystScore, visual: visualScore, lore: loreScore, simulation: simulationScore };
    const maxScore = Math.max(...Object.values(scores));
    
    if (maxScore === 0) return null;
    
    const detectedMode = Object.keys(scores).find(k => scores[k] === maxScore);
    return detectedMode || null;
  }

  function getSelectedModeFromSettings() {
    try {
      const fallbackMode = normalizeMode(localStorage.getItem(SETTINGS_KEYS.DEFAULT_MODE)) || "auto";
      const selectionMode = (localStorage.getItem(SETTINGS_KEYS.MODE_SELECTION) || "automatic").trim().toLowerCase();
      if (selectionMode === "manual") {
        return fallbackMode;
      }
      return fallbackMode;
    } catch {
      return "auto";
    }
  }

  function getActiveMode(session = getActiveSession()) {
    const sessionMode = normalizeMode(session?.mode);
    if (sessionMode === "auto") return "auto";
    if (sessionMode) return sessionMode;
    return "auto";
  }

  function updateModeIndicator(mode) {
    if (!modeLabelEl) return;
    modeLabelEl.textContent = `Mode: ${toModeLabel(mode)}`;
  }

  function updateModelInspector(modelUsed, routeReason = "") {
    if (!modelInspectorEl) return;
    const modelText = modelUsed ? toModelLabel(modelUsed) : "Pending";
    const reasonText = routeReason ? ` (${routeReason})` : "";
    modelInspectorEl.textContent = `Model: ${modelText}${reasonText}`;
  }

  function updateModeButton(mode) {
    if (!modeBtn) return;
    const label = toModeLabel(mode);
    modeBtn.textContent = label;
    modeBtn.setAttribute("aria-label", `Change chat mode. Current mode: ${label}`);
  }

  function updateModelButton(model) {
    if (!modelBtn) return;
    const label = toModelLabel(model);
    modelBtn.textContent = label;
    modelBtn.setAttribute("aria-label", `Change model. Current model: ${label}`);
  }

  function getDropdownItems(menuEl) {
    if (!menuEl) return [];
    return Array.from(menuEl.querySelectorAll(".chat-dropdown-item[data-value]"));
  }

  function setActiveDropdownItem(menuEl, value) {
    const normalized = (value || "").trim().toLowerCase();
    for (const item of getDropdownItems(menuEl)) {
      const isActive = (item.dataset.value || "").toLowerCase() === normalized;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-selected", isActive ? "true" : "false");
    }
  }

  function setDropdownOpen(dropdownEl, buttonEl, open) {
    if (!dropdownEl || !buttonEl) return;
    dropdownEl.classList.toggle("open", !!open);
    buttonEl.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closeAllDropdowns() {
    setDropdownOpen(modelDropdown, modelBtn, false);
    setDropdownOpen(modeDropdown, modeBtn, false);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        createNewSession();
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.sessions || !parsed.activeSessionId) {
        createNewSession();
        return;
      }
      state = parsed;

      for (const session of Object.values(state.sessions)) {
        if (!session || typeof session !== "object") continue;
        session.mode = getActiveMode(session);
        ensureSimulationState(session);
      }

      if (!state.sessions[state.activeSessionId]) {
        const firstSessionId = Object.keys(state.sessions)[0];
        if (firstSessionId) {
          state.activeSessionId = firstSessionId;
        } else {
          createNewSession();
          return;
        }
      }

      saveState();
    } catch {
      createNewSession();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }

  function createNewSession() {
    const id = `session_${Date.now()}`;
    state.sessions[id] = {
      id,
      title: "New conversation",
      messages: [],
      mode: getSelectedModeFromSettings(),
      model: getDefaultModelFromSettings(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    ensureSimulationState(state.sessions[id]);
    state.activeSessionId = id;
    saveState();
  }

  function getActiveSession() {
    return state.sessions[state.activeSessionId] || null;
  }

  function setActiveSession(id) {
    if (!state.sessions[id]) return;
    state.activeSessionId = id;
    saveState();
    renderSessionsSidebar();
    syncSelectorsFromSession();
    renderActiveSessionMessages();
  }

  function syncSelectorsFromSession() {
    const session = getActiveSession();
    if (!session) return;

    const activeMode = getActiveMode(session);
    session.mode = activeMode;
    session.model = normalizeModel(session.model) || "auto";

    updateModelButton(session.model);
    updateModeButton(activeMode);
    setActiveDropdownItem(modelMenu, session.model);
    setActiveDropdownItem(modeMenu, activeMode);
    updateModeIndicator(activeMode);
    updateSimulationUI(session);
    updateMindStateUI(session);
  }

  function updateSessionMetaFromMessages(session) {
    if (!session.messages.length) {
      session.title = "New conversation";
      return;
    }
    const firstUser = session.messages.find(m => m.role === "user");
    if (firstUser) {
      session.title = firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? "…" : "");
    }
    session.updatedAt = Date.now();
  }

  function deleteSession(id) {
    if (!state.sessions[id]) return;
    delete state.sessions[id];
    const remainingIds = Object.keys(state.sessions);
    if (!remainingIds.length) {
      createNewSession();
    } else if (state.activeSessionId === id) {
      state.activeSessionId = remainingIds[0];
    }
    saveState();
    renderSessionsSidebar();
    renderActiveSessionMessages();
  }

  function resetToFreshChat() {
    if (isStreaming && currentAbortController) {
      try {
        currentAbortController.abort();
      } catch {
        // ignore
      }
    }

    isStreaming = false;
    if (sendBtn) sendBtn.disabled = false;
    if (inputEl) inputEl.disabled = false;
    if (typingIndicatorEl) typingIndicatorEl.style.display = "none";

    state = {
      activeSessionId: null,
      sessions: {}
    };

    createNewSession();
    syncSelectorsFromSession();
    renderSessionsSidebar();
    renderActiveSessionMessages();
    shouldStickToBottom = true;
    updateJumpToLatestVisibility();
  }

  // =========================
  // 3. MARKDOWN ENGINE
  // =========================
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderMarkdown(text) {
    if (!text) return "";

    let html = escapeHtml(text);

    // Code blocks ``` ```
    html = html.replace(/```([\s\S]*?)```/g, (m, code) => {
      return `<pre class="md-code"><code>${code.trim()}</code></pre>`;
    });

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, (m, code) => {
      return `<code class="md-inline-code">${code}</code>`;
    });

    // Bold **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Italic *text*
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Simple lists (lines starting with - or *)
    html = html.replace(/(^|\n)[*-]\s+(.+?)(?=\n|$)/g, (m, start, item) => {
      return `${start}<li>${item}</li>`;
    });
    html = html.replace(/(<li>[\s\S]+<\/li>)/g, "<ul>$1</ul>");

    // Line breaks
    html = html.replace(/\n/g, "<br>");

    return html;
  }

  // =========================
  // 4. MESSAGE ENGINE
  // =========================
  function clearMessages() {
    if (!messagesEl) return;
    messagesEl.innerHTML = "";
  }

  function createGeneratedImageCard(meta = {}) {
    const imageDataUrl = String(meta.imageDataUrl || "").trim();
    if (!imageDataUrl.startsWith("data:image/")) {
      return null;
    }

    const filename = String(meta.imageFilename || "generated-image.png").trim() || "generated-image.png";
    const prompt = String(meta.imagePrompt || "Generated image").trim() || "Generated image";
    const resolution = String(meta.imageResolution || "").trim();
    const styleId = String(meta.imageStyleId || "").trim();

    const card = document.createElement("div");
    card.className = "generated-image-card";

    const img = document.createElement("img");
    img.className = "generated-image-preview";
    img.src = imageDataUrl;
    img.alt = prompt;
    img.loading = "lazy";

    const actions = document.createElement("div");
    actions.className = "generated-image-actions";

    const download = document.createElement("a");
    download.className = "generated-image-download";
    download.href = imageDataUrl;
    download.download = filename;
    download.textContent = "Download image";
    download.setAttribute("aria-label", `Download generated image ${filename}`);

    actions.appendChild(download);

    if (resolution || styleId) {
      const info = document.createElement("div");
      info.className = "generated-image-meta";
      info.textContent = [resolution, styleId].filter(Boolean).join(" • ");
      actions.appendChild(info);
    }

    card.appendChild(img);
    card.appendChild(actions);

    return card;
  }

  function createMessageElement(role, content, meta = {}) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role === "user" ? "user" : "bot"} message-${role}`;

    const inner = document.createElement("div");
    inner.className = "message-inner";

    const header = document.createElement("div");
    header.className = "message-header";

    const roleLabel = document.createElement("span");
    roleLabel.className = "message-role";
    roleLabel.textContent = role === "user" ? "You" : "Omni";

    header.appendChild(roleLabel);

    if (runtimeSettings.showTimestamps && meta.timestamp) {
      const timestampEl = document.createElement("span");
      timestampEl.className = "message-timestamp";
      timestampEl.textContent = formatMessageTimestamp(meta.timestamp);
      header.appendChild(timestampEl);
    }

    if (runtimeSettings.showAssistantBadges && role === "assistant" && (meta.model || meta.mode)) {
      const badge = document.createElement("span");
      badge.className = "message-badge";
      
      // Format model name (capitalize first letter)
      const modelName = meta.model ? 
        meta.model.charAt(0).toUpperCase() + meta.model.slice(1) : null;
      
      // Format mode name using toModeLabel for consistent capitalization
      const modeName = meta.mode ? toModeLabel(meta.mode) : null;
      
      badge.textContent = [modelName, modeName].filter(Boolean).join(" • ");
      header.appendChild(badge);
    }

    const body = document.createElement("div");
    body.className = "message-body";
    body.innerHTML = renderMarkdown(content || "");

    const imageCard = createGeneratedImageCard(meta);
    if (imageCard) {
      if ((content || "").trim()) {
        const spacer = document.createElement("div");
        spacer.className = "generated-image-spacer";
        body.appendChild(spacer);
      }
      body.appendChild(imageCard);
    }

    inner.appendChild(header);
    inner.appendChild(body);
    wrapper.appendChild(inner);

    return { wrapper, body };
  }

  function appendMessage(role, content, meta = {}) {
    if (!messagesEl) return null;
    const { wrapper, body } = createMessageElement(role, content, meta);
    messagesEl.appendChild(wrapper);
    smoothScrollToBottom(false);
    return { wrapper, body };
  }

  function updateAssistantMessageBody(bodyEl, text, options = {}) {
    if (!bodyEl) return;
    bodyEl.innerHTML = renderMarkdown(text);
    if (options.highlight !== false) {
      highlightCodeBlocks(bodyEl);
    }
    smoothScrollToBottom(false);
  }

  function highlightCodeBlocks(containerEl) {
    if (!containerEl || !window.hljs) return;
    const blocks = containerEl.querySelectorAll("pre code");
    for (const block of blocks) {
      window.hljs.highlightElement(block);
    }
  }

  function renderActiveSessionMessages() {
    clearMessages();
    const session = getActiveSession();
    if (!session) return;
    for (const msg of session.messages) {
      const activeMode = getActiveMode(session);
      appendMessage(msg.role, msg.content, {
        model: session.model || "auto",
        mode: activeMode,
        timestamp: msg.timestamp || msg.ts || null,
        imageDataUrl: msg.imageDataUrl || "",
        imageFilename: msg.imageFilename || "",
        imagePrompt: msg.imagePrompt || "",
        imageResolution: msg.imageResolution || "",
        imageStyleId: msg.imageStyleId || ""
      });
    }
    updateMindStateUI(session);
  }

  // =========================
  // 5. TOKEN ENGINE
  // =========================
  function appendTokenWithSpacing(currentText, token) {
    const t = typeof token === "string" ? token : String(token ?? "");
    if (!t) return currentText;
    return (currentText || "") + t;
  }

  // =========================
  // 6. STREAMING + NETWORK ENGINE
  // =========================
  let isStreaming = false;
  let currentAbortController = null;
  let apiHealthy = true;
  let apiCheckTimer = null;

  function getApiEndpoint() {
    try {
      const saved = localStorage.getItem("omni-endpoint") || "";
      return saved.trim() || "/api/omni";
    } catch {
      return "/api/omni";
    }
  }

  function getImageEndpoint() {
    const chatEndpoint = getApiEndpoint();
    try {
      const url = new URL(chatEndpoint, window.location.origin);
      if (/\/api\/omni$/i.test(url.pathname)) {
        url.pathname = url.pathname.replace(/\/api\/omni$/i, "/api/image");
      } else {
        url.pathname = "/api/image";
      }
      url.search = "";

      if (url.origin === window.location.origin) {
        return url.pathname;
      }

      return url.toString();
    } catch {
      return "/api/image";
    }
  }

  function isImageGenerationRequest(text) {
    const value = String(text || "").trim().toLowerCase();
    if (!value) return false;
    if (value.startsWith("/image ") || value === "/image") return true;

    const directIntent = /\b(generate|create|make|render|draw|imagine|design)\b[\s\S]{0,80}\b(image|picture|illustration|art|photo|logo|poster|wallpaper)\b/i;
    const quickIntent = /\b(image of|picture of|illustration of|art of)\b/i;
    return directIntent.test(value) || quickIntent.test(value);
  }

  function extractImagePrompt(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";

    if (raw.toLowerCase().startsWith("/image")) {
      return raw.slice(6).trim();
    }

    return raw
      .replace(/^\s*(please\s+)?(generate|create|make|render|draw|imagine|design)\s+(an?\s+)?(image|picture|illustration|art|photo|logo|poster|wallpaper)\s*(of|for)?\s*/i, "")
      .trim() || raw;
  }

  async function requestGeneratedImage(session, prompt, safetyProfile = null) {
    const selectedStyle = getActiveImageStyle(session);
    const selectedCamera = getActiveCameraProfile(session);
    const selectedLighting = getActiveLightingProfile(session);
    const selectedMaterials = getActiveMaterials(session);
    const payload = {
      userId: session?.id || `session-${Date.now()}`,
      prompt,
      feedback: "",
      stylePack: selectedStyle || "",
      camera: selectedCamera,
      lighting: selectedLighting,
      materials: selectedStyle === "hyper-real" ? selectedMaterials : [],
      safetyProfile: safetyProfile || buildSafetyProfile()
    };

    const res = await fetch(getImageEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const reason = data?.error || "Image backend returned an error";
      throw new Error(reason);
    }

    const imageDataUrl = String(data?.imageDataUrl || "").trim();
    if (!imageDataUrl.startsWith("data:image/")) {
      throw new Error("Image response did not include a valid image payload");
    }

    return {
      imageDataUrl,
      filename: String(data?.filename || "generated-image.png").trim() || "generated-image.png",
      metadata: data?.metadata || {},
      modelUsed: String(res.headers.get("X-Omni-Image-Model") || data?.metadata?.model || "").trim()
    };
  }

  function setApiStatus(state) {
    if (!apiStatusEl) return;

    if (state === "online") {
      apiStatusEl.textContent = "API: online";
    } else if (state === "offline") {
      apiStatusEl.textContent = "API: offline";
    } else {
      apiStatusEl.textContent = "API: checking…";
    }
  }

  async function checkApiStatus() {
    setApiStatus("checking");

    try {
      const res = await fetch(getApiEndpoint(), {
        method: "OPTIONS"
      });
      apiHealthy = res.ok || res.status === 204;
    } catch {
      apiHealthy = false;
    }

    setApiStatus(apiHealthy ? "online" : "offline");
    return apiHealthy;
  }

  function startApiChecks() {
    if (apiCheckTimer) {
      clearInterval(apiCheckTimer);
    }

    checkApiStatus();
    apiCheckTimer = setInterval(() => {
      checkApiStatus();
    }, Math.max(10, runtimeSettings.apiHealthIntervalSeconds) * 1000);
  }

  function isRetryableStatus(status) {
    return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
  }

  async function streamOmniResponse(session, assistantBodyEl, onChunk, onMeta, safetyProfile = null) {
    const activeMode = getActiveMode(session);
    const payload = {
      messages: session.messages,
      model: session.model || "auto",
      mode: activeMode,
      safetyProfile: safetyProfile || buildSafetyProfile()
    };

    const controller = new AbortController();
    currentAbortController = controller;
    const timeoutMs = Math.max(10, runtimeSettings.requestTimeoutSeconds) * 1000;
    const timeoutHandle = setTimeout(() => {
      try {
        controller.abort("request-timeout");
      } catch {
        // ignore
      }
    }, timeoutMs);

    const maxAttempts = 1 + Math.max(0, runtimeSettings.apiRetries);
    let res;
    let lastError = null;
    let attempt = 0;

    try {
      while (attempt < maxAttempts) {
        attempt += 1;
        try {
          res = await fetch(getApiEndpoint(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal
          });

          if (res.ok && res.body) {
            break;
          }

          if (!isRetryableStatus(res.status) || attempt >= maxAttempts) {
            break;
          }
        } catch (error) {
          lastError = error;
          if (attempt >= maxAttempts) {
            throw error;
          }
        }
      }
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!res || !res.ok || !res.body) {
      if (lastError) {
        throw lastError;
      }
      throw new Error("Bad response from Omni backend");
    }

    if (typeof onMeta === "function") {
      onMeta({
        modelUsed: (res.headers.get("X-Omni-Model-Used") || "").trim(),
        routeReason: (res.headers.get("X-Omni-Route-Reason") || "").trim(),
        orchestratorRoute: (res.headers.get("X-Omni-Orchestrator-Route") || "").trim(),
        orchestratorReason: (res.headers.get("X-Omni-Orchestrator-Reason") || "").trim(),
        personaTone: (res.headers.get("X-Omni-Persona-Tone") || "").trim(),
        userEmotion: (res.headers.get("X-Omni-Emotion-User") || "").trim(),
        omniEmotion: (res.headers.get("X-Omni-Emotion-Omni") || "").trim(),
        internetMode: (res.headers.get("X-Omni-Internet-Mode") || "").trim(),
        internetProfile: (res.headers.get("X-Omni-Internet-Profile") || "").trim(),
        internetCount: Number(res.headers.get("X-Omni-Internet-Count") || "0"),
        simulationId: (res.headers.get("X-Omni-Simulation-Id") || "").trim(),
        simulationStatus: (res.headers.get("X-Omni-Simulation-Status") || "").trim(),
        simulationSteps: Number(res.headers.get("X-Omni-Simulation-Steps") || "0")
      });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    const processSseLine = (line) => {
      const normalized = line.replace(/\r$/, "");
      if (!normalized.startsWith("data:")) return false;

      let data = normalized.slice(5);

      if (data.startsWith(" ")) {
        data = data.slice(1);
      }

      if (data.trim() === "[DONE]") {
        return true;
      }

      if (data.length === 0) return false;

      let token = data;
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed === "string") {
          token = parsed;
        } else if (parsed && typeof parsed.token === "string") {
          token = parsed.token;
        } else if (parsed && typeof parsed === "object") {
          token = parsed;
        }
      } catch {
        // raw token
      }

      onChunk(token);
      return false;
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        if (buffer) {
          const trailingLines = buffer.split("\n");
          for (const trailingLine of trailingLines) {
            if (processSseLine(trailingLine)) {
              return;
            }
          }
        }
        break;
      }
      if (!value) continue;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (processSseLine(line)) {
          buffer = "";
          return;
        }
      }
    }
  }

  async function sendMessage(content) {
    if (isStreaming) return;
    const session = getActiveSession();
    if (!session) return;

    const trimmed = content.trim();
    if (!trimmed) return;

    const styleCommand = parseStyleCommand(trimmed);
    const cameraCommand = parseCameraCommand(trimmed);
    const lightCommand = parseLightCommand(trimmed);
    const materialsCommand = parseMaterialsCommand(trimmed);
    const webCommand = parseWebCommand(trimmed);
    if (styleCommand || cameraCommand || lightCommand || materialsCommand || webCommand) {
      const commandTimestamp = Date.now();
      session.messages.push({ role: "user", content: trimmed, timestamp: commandTimestamp });
      updateSessionMetaFromMessages(session);
      saveState();

      const activeMode = getActiveMode(session);
      appendMessage("user", trimmed, {
        model: session.model || "auto",
        mode: activeMode,
        timestamp: commandTimestamp
      });

      let assistantText = "";
      if (styleCommand) {
        if (styleCommand.action === "show") {
          assistantText = buildStyleStatusMessage(session);
        } else {
          const requestedStyle = String(styleCommand.style || "").trim();
          if (!requestedStyle && String(trimmed || "").trim().split(/\s+/).length > 1 && !/\b(auto|none|off|reset)\b/i.test(trimmed)) {
            assistantText = `Unknown style. Use one of: ${formatAvailableStyles()}`;
          } else {
            session.imageStyle = requestedStyle;
            if (requestedStyle === "hyper-real") {
              session.imageCamera = getActiveCameraProfile(session);
              session.imageLighting = getActiveLightingProfile(session);
            }
            session.updatedAt = Date.now();
            saveState();
            try {
              await savePreferences();
            } catch {
              // ignore style preference save failures
            }
            assistantText = requestedStyle
              ? `Image style set to **${requestedStyle}** for this session.`
              : "Image style reset to **auto** for this session.";
          }
        }
      } else if (cameraCommand) {
        if (cameraCommand.action === "show") {
          assistantText = `Current camera: **${getActiveCameraProfile(session)}**. Available: ${formatAvailableCameras()}`;
        } else {
          const requestedCamera = String(cameraCommand.camera || "").trim();
          if (!requestedCamera) {
            assistantText = `Unknown camera profile. Use one of: ${formatAvailableCameras()}`;
          } else {
            session.imageCamera = requestedCamera;
            session.updatedAt = Date.now();
            saveState();
            try {
              await savePreferences();
            } catch {
              // ignore camera preference save failures
            }
            assistantText = `Camera profile set to **${requestedCamera}**.`;
          }
        }
      } else if (lightCommand) {
        if (lightCommand.action === "show") {
          assistantText = `Current lighting: **${getActiveLightingProfile(session)}**. Available: ${formatAvailableLighting()}`;
        } else {
          const requestedLighting = String(lightCommand.lighting || "").trim();
          if (!requestedLighting) {
            assistantText = `Unknown lighting profile. Use one of: ${formatAvailableLighting()}`;
          } else {
            session.imageLighting = requestedLighting;
            session.updatedAt = Date.now();
            saveState();
            try {
              await savePreferences();
            } catch {
              // ignore lighting preference save failures
            }
            assistantText = `Lighting profile set to **${requestedLighting}**.`;
          }
        }
      } else if (materialsCommand) {
        if (materialsCommand.action === "show") {
          assistantText = `Current materials: **${getActiveMaterials(session).join(", ")}**. Available: ${formatAvailableMaterials()}`;
        } else {
          const requestedMaterials = Array.isArray(materialsCommand.materials) ? materialsCommand.materials : [];
          if (!requestedMaterials.length) {
            assistantText = `Unknown material profile. Use one or more of: ${formatAvailableMaterials()}`;
          } else {
            session.imageMaterials = requestedMaterials;
            session.updatedAt = Date.now();
            saveState();
            try {
              await savePreferences();
            } catch {
              // ignore material preference save failures
            }
            assistantText = `Materials set to **${requestedMaterials.join(", ")}**.`;
          }
        }
      } else if (webCommand) {
        if (webCommand.action === "help") {
          assistantText = "Usage: `/web <query>` to search the internet with your current mode profile.";
        } else {
          try {
            const currentMode = getActiveMode(session);
            const search = await requestInternetSearch(webCommand.query, currentMode);
            updateInternetInspectorFromWebSearch(session, webCommand.query, search);
            if (!search.hits.length) {
              assistantText = `No internet results found for **${webCommand.query}** in mode **${search.mode}**.`;
            } else {
              const preview = search.hits
                .slice(0, 4)
                .map((hit, index) => `${index + 1}. **${hit.title}**\n${hit.snippet || "No summary available."}\n${hit.url}`)
                .join("\n\n");
              assistantText = [
                `Internet search results for **${webCommand.query}** (mode: **${search.mode}**):`,
                preview
              ].join("\n\n");
            }
          } catch (error) {
            assistantText = `Internet search failed: ${error instanceof Error ? error.message : "unknown error"}`;
          }
        }
      } else {
        assistantText = "Rendering command received.";
      }

      appendMessage("assistant", assistantText, {
        model: session.model || "auto",
        mode: getActiveMode(session),
        timestamp: Date.now()
      });

      session.messages.push({
        role: "assistant",
        content: assistantText,
        timestamp: Date.now()
      });
      updateSessionMetaFromMessages(session);
      saveState();
      renderSessionsSidebar();
      playNotificationSound("assistant");

      if (inputEl) {
        inputEl.value = "";
        inputEl.focus();
      }
      return;
    }

    const safetyProfile = buildSafetyProfile();
    const policy = evaluatePromptPolicy(trimmed, safetyProfile);
    if (policy.blocked) {
      const blockTs = Date.now();
      session.messages.push({ role: "user", content: trimmed, timestamp: blockTs });
      appendMessage("user", trimmed, {
        model: session.model || "auto",
        mode: getActiveMode(session),
        timestamp: blockTs
      });

      appendMessage("assistant", policy.message, {
        model: session.model || "auto",
        mode: getActiveMode(session),
        timestamp: Date.now()
      });

      session.messages.push({
        role: "assistant",
        content: policy.message,
        timestamp: Date.now()
      });
      updateSessionMetaFromMessages(session);
      saveState();
      renderSessionsSidebar();

      if (inputEl) {
        inputEl.value = "";
        inputEl.focus();
      }
      return;
    }

    checkApiStatus().catch(() => {});

    // Push user message
    session.messages.push({ role: "user", content: trimmed, timestamp: Date.now() });
    updateSessionMetaFromMessages(session);
    saveState();

    let activeMode = getActiveMode(session);
    
    // Auto-detect mode based on user content
    if (activeMode === "auto" && runtimeSettings.autoDetectMode) {
      const detectedMode = detectModeFromContent(trimmed);
      if (detectedMode) {
        activeMode = detectedMode;
        session.mode = activeMode;
        saveState();
        updateModeButton(activeMode);
        updateModeIndicator(activeMode);
        setActiveDropdownItem(modeMenu, activeMode);
      }
    }

    if (activeMode === "simulation") {
      const simulation = ensureSimulationState(session);
      if (simulation.status !== "active") {
        simulation.status = "active";
        appendSimulationLog(session, "Simulation started from chat input.");
      }

      simulation.steps = Number(simulation.steps || 0) + 1;
      appendSimulationLog(session, `Step ${simulation.steps}: user input processed.`);
      updateSimulationUI(session);
    }
    
    appendMessage("user", trimmed, {
      model: session.model || "auto",
      mode: activeMode,
      timestamp: Date.now()
    });
    playNotificationSound("send");

    // Clear input
    if (inputEl) inputEl.value = "";

    const shouldGenerateImage = isImageGenerationRequest(trimmed);
    if (shouldGenerateImage) {
      const mindState = ensureMindState(session);
      if (mindState) {
        mindState.route = "image";
        appendMindTimeline(session, "route=image, source=direct-image-endpoint");
        updateMindStateUI(session);
      }

      const assistantMessage = appendMessage("assistant", "Generating image...", {
        model: session.model || "auto",
        mode: activeMode
      });
      const assistantBodyEl = assistantMessage ? assistantMessage.body : null;

      isStreaming = true;
      if (sendBtn) sendBtn.disabled = true;
      if (inputEl) inputEl.disabled = true;
      if (typingIndicatorEl) typingIndicatorEl.style.display = "block";

      try {
        const imagePrompt = extractImagePrompt(trimmed) || trimmed;
        const imageResult = await requestGeneratedImage(session, imagePrompt, safetyProfile);
        const resolution = String(imageResult?.metadata?.resolution || "").trim();
        const styleId = String(imageResult?.metadata?.style_id || "").trim();

        updateModelInspector(imageResult.modelUsed || session.model || "auto", "image-generated");

        if (assistantBodyEl) {
          assistantBodyEl.innerHTML = renderMarkdown(`Generated image for: **${imagePrompt}**`);
          const imageCard = createGeneratedImageCard({
            imageDataUrl: imageResult.imageDataUrl,
            imageFilename: imageResult.filename,
            imagePrompt,
            imageResolution: resolution,
            imageStyleId: styleId
          });
          if (imageCard) {
            const spacer = document.createElement("div");
            spacer.className = "generated-image-spacer";
            assistantBodyEl.appendChild(spacer);
            assistantBodyEl.appendChild(imageCard);
          }
          smoothScrollToBottom(true);
        }

        session.messages.push({
          role: "assistant",
          content: `Generated image for: ${imagePrompt}`,
          type: "image",
          imageDataUrl: imageResult.imageDataUrl,
          imageFilename: imageResult.filename,
          imagePrompt,
          imageResolution: resolution,
          imageStyleId: styleId,
          timestamp: Date.now()
        });
        updateSessionMetaFromMessages(session);
        saveState();
        playNotificationSound("assistant");

        if (runtimeSettings.showTimestamps || runtimeSettings.compactMode) {
          renderActiveSessionMessages();
        }
      } catch (err) {
        console.error("Omni image generation error:", err);
        updateAssistantMessageBody(
          assistantBodyEl,
          "[Error] Image generation failed. Try a different image prompt."
        );
        playNotificationSound("error");
      } finally {
        isStreaming = false;
        updateJumpToLatestVisibility();
        if (sendBtn) sendBtn.disabled = false;
        if (inputEl) inputEl.disabled = false;
        if (typingIndicatorEl) typingIndicatorEl.style.display = "none";
        if (inputEl) inputEl.focus();
      }

      return;
    }

    // Prepare assistant placeholder
    const assistantMessage = appendMessage("assistant", "", {
      model: session.model || "auto",
      mode: activeMode
    });
    const assistantBodyEl = assistantMessage ? assistantMessage.body : null;

    // UI state
    isStreaming = true;
    if (sendBtn) sendBtn.disabled = true;
    if (inputEl) inputEl.disabled = true;
    if (typingIndicatorEl) typingIndicatorEl.style.display = "block";

    session._streamingAssistantText = "";

    try {
      await streamOmniResponse(
        session,
        assistantBodyEl,
        (chunk) => {
          if (chunk && typeof chunk === "object") {
            const payload = chunk;
            session._streamingMeta = {
              route: String(payload.route || "").trim(),
              imageDataUrl: String(payload.imageDataUrl || "").trim(),
              imageFilename: String(payload?.image?.filename || "").trim(),
              imageResolution: String(payload?.image?.metadata?.resolution || "").trim(),
              imageStyleId: String(payload?.image?.metadata?.style_id || "").trim(),
              imagePrompt: trimmed
            };
            if (typeof payload.content === "string") {
              session._streamingAssistantText = appendTokenWithSpacing(
                session._streamingAssistantText,
                payload.content
              );
            }
          } else {
            session._streamingAssistantText = appendTokenWithSpacing(
              session._streamingAssistantText,
              chunk
            );
          }
          updateAssistantMessageBody(assistantBodyEl, session._streamingAssistantText || "", { highlight: false });
        },
        (meta) => {
          updateModelInspector(meta?.modelUsed || session.model || "auto", meta?.routeReason || "");
          updateInternetInspectorFromMeta(session, meta, trimmed);

          const mindState = ensureMindState(session);
          if (mindState) {
            if (meta?.orchestratorRoute) mindState.route = meta.orchestratorRoute;
            if (meta?.personaTone) mindState.persona = meta.personaTone;
            if (meta?.userEmotion) mindState.userEmotion = meta.userEmotion;
            if (meta?.omniEmotion) mindState.omniEmotion = meta.omniEmotion;

            const route = meta?.orchestratorRoute || "chat";
            const persona = meta?.personaTone || "pending";
            const emotions = `${meta?.userEmotion || "pending"}->${meta?.omniEmotion || "pending"}`;
            appendMindTimeline(session, `route=${route}, persona=${persona}, emotion=${emotions}`);
            updateMindStateUI(session);
          }

          if (getActiveMode(session) === "simulation") {
            const simulation = ensureSimulationState(session);
            if (meta?.simulationId) simulation.id = meta.simulationId;
            if (meta?.simulationStatus) simulation.status = meta.simulationStatus;
            if (Number.isFinite(meta?.simulationSteps) && meta.simulationSteps >= 0) {
              simulation.steps = meta.simulationSteps;
            }
            appendSimulationLog(session, `Backend sync: ${simulation.status}, steps ${simulation.steps}.`);
            updateSimulationUI(session);
          }
        },
        safetyProfile
      );

      const finalText = (session._streamingAssistantText || "").trim();
      const safeText = finalText || "[No response received]";
      updateAssistantMessageBody(assistantBodyEl, safeText);

      const streamedMeta = session._streamingMeta || {};
      if (assistantBodyEl && streamedMeta.imageDataUrl) {
        const imageCard = createGeneratedImageCard({
          imageDataUrl: streamedMeta.imageDataUrl,
          imageFilename: streamedMeta.imageFilename,
          imagePrompt: streamedMeta.imagePrompt || trimmed,
          imageResolution: streamedMeta.imageResolution,
          imageStyleId: streamedMeta.imageStyleId
        });
        if (imageCard) {
          const spacer = document.createElement("div");
          spacer.className = "generated-image-spacer";
          assistantBodyEl.appendChild(spacer);
          assistantBodyEl.appendChild(imageCard);
        }
      }

      session.messages.push({
        role: "assistant",
        content: safeText,
        type: streamedMeta.imageDataUrl ? "image" : "text",
        imageDataUrl: streamedMeta.imageDataUrl || "",
        imageFilename: streamedMeta.imageFilename || "",
        imagePrompt: streamedMeta.imagePrompt || "",
        imageResolution: streamedMeta.imageResolution || "",
        imageStyleId: streamedMeta.imageStyleId || ""
      });
      session.messages[session.messages.length - 1].timestamp = Date.now();
      if (getActiveMode(session) === "simulation") {
        appendSimulationLog(session, "Assistant produced simulation state update.");
      }
      delete session._streamingAssistantText;
      delete session._streamingMeta;
      updateSessionMetaFromMessages(session);
      saveState();
      updateMindStateUI(session);
      playNotificationSound("assistant");

      if (runtimeSettings.showTimestamps || runtimeSettings.compactMode) {
        renderActiveSessionMessages();
      }
    } catch (err) {
      console.error("Omni streaming error:", err);
      updateAssistantMessageBody(
        assistantBodyEl,
        "[Error] Something went wrong while streaming the response."
      );
      playNotificationSound("error");
    } finally {
      isStreaming = false;
      updateJumpToLatestVisibility();
      if (sendBtn) sendBtn.disabled = false;
      if (inputEl) inputEl.disabled = false;
      if (typingIndicatorEl) typingIndicatorEl.style.display = "none";
      if (inputEl) inputEl.focus();
    }
  }

  // =========================
  // 7. UI ENGINE (SCROLL, INPUT)
  // =========================
  let scrollTimeout = null;
  let shouldStickToBottom = true;
  let jumpToLatestBtn = null;

  function ensureJumpToLatestPill() {
    if (jumpToLatestBtn || !messagesEl) return;

    const chatArea = messagesEl.closest("#chat-area");
    if (!chatArea) return;

    jumpToLatestBtn = document.createElement("button");
    jumpToLatestBtn.type = "button";
    jumpToLatestBtn.className = "jump-to-latest";
    jumpToLatestBtn.textContent = "Jump to latest";
    jumpToLatestBtn.setAttribute("aria-label", "Jump to latest message");

    jumpToLatestBtn.addEventListener("click", () => {
      shouldStickToBottom = true;
      smoothScrollToBottom(true);
      updateJumpToLatestVisibility();
    });

    chatArea.appendChild(jumpToLatestBtn);
  }

  function updateJumpToLatestVisibility() {
    if (!jumpToLatestBtn) return;
    const shouldShow = isStreaming && !shouldStickToBottom;
    jumpToLatestBtn.classList.toggle("visible", shouldShow);
  }

  function isNearBottom() {
    if (!messagesEl) return true;
    const distanceFromBottom = messagesEl.scrollHeight - messagesEl.clientHeight - messagesEl.scrollTop;
    return distanceFromBottom <= 96;
  }

  function smoothScrollToBottom(force = false) {
    if (!messagesEl) return;
    if (!force && (!runtimeSettings.autoScroll || !shouldStickToBottom)) return;
    if (scrollTimeout) cancelAnimationFrame(scrollTimeout);

    const start = messagesEl.scrollTop;
    const end = messagesEl.scrollHeight - messagesEl.clientHeight;
    const duration = 200;
    const startTime = performance.now();

    function animate(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      messagesEl.scrollTop = start + (end - start) * eased;
      if (t < 1) {
        scrollTimeout = requestAnimationFrame(animate);
      }
    }

    scrollTimeout = requestAnimationFrame(animate);
    if (force) {
      shouldStickToBottom = true;
      updateJumpToLatestVisibility();
    }
  }

  function autoResizeInput() {
    if (!inputEl) return;
    inputEl.style.height = "auto";
    inputEl.style.height = inputEl.scrollHeight + "px";
  }

  // =========================
  // 8. SESSION SIDEBAR ENGINE
  // =========================
  function renderSessionsSidebar() {
    if (!sessionsSidebarEl) return;
    sessionsSidebarEl.innerHTML = "";

    const ids = Object.keys(state.sessions).sort((a, b) => {
      return state.sessions[b].updatedAt - state.sessions[a].updatedAt;
    });

    for (const id of ids) {
      const session = state.sessions[id];

      const item = document.createElement("div");
      item.className = "session-item";
      if (id === state.activeSessionId) {
        item.classList.add("session-item-active");
      }

      const title = document.createElement("div");
      title.className = "session-title";
      title.textContent = session.title || "New conversation";

      const meta = document.createElement("div");
      meta.className = "session-meta";
      const date = new Date(session.updatedAt || session.createdAt);
      meta.textContent = date.toLocaleString();

      item.appendChild(title);
      item.appendChild(meta);

      item.title = "";

      item.addEventListener("click", () => {
        setActiveSession(id);
      });

      // Right-click delete
      item.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (confirm("Delete this conversation?")) {
          deleteSession(id);
        }
      });

      sessionsSidebarEl.appendChild(item);
    }
  }

  // =========================
  // 9. INPUT ENGINE
  // =========================
  function handleSendClick() {
    if (!inputEl) return;
    const content = inputEl.value || "";
    sendMessage(content);
  }

  function handleInputKeydown(e) {
    const shouldSendWithEnter = runtimeSettings.sendWithEnter;
    const wantsSend = shouldSendWithEnter
      ? e.key === "Enter" && !e.shiftKey
      : e.key === "Enter" && (e.ctrlKey || e.metaKey);

    if (wantsSend) {
      e.preventDefault();
      handleSendClick();
    }
  }

  async function savePreferences() {
    const session = getActiveSession();
    if (!session) return;
    const preferredImageStyle = getActiveImageStyle(session);
    const preferredImageCamera = getActiveCameraProfile(session);
    const preferredImageLighting = getActiveLightingProfile(session);
    const preferredImageMaterials = getActiveMaterials(session);

    const payload = {
      preferredMode: getActiveMode(session),
      writingStyle: "concise",
      lastUsedSettings: {
        preferredModel: session.model || "auto",
        preferredImageStyle: preferredImageStyle || "",
        preferredImageCamera: preferredImageCamera,
        preferredImageLighting: preferredImageLighting,
        preferredImageMaterials: preferredImageMaterials.join(","),
        reasoningMode: getActiveMode(session) === "reasoning",
        codingMode: getActiveMode(session) === "coding",
        knowledgeMode: getActiveMode(session) === "knowledge"
      }
    };

    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      updateModelInspector(session.model || "auto", "preferences-saved");
    } catch {
      updateModelInspector(session.model || "auto", "save-failed");
    }
  }

  async function loadPreferences() {
    try {
      const res = await fetch("/api/preferences", { method: "GET" });
      if (!res.ok) return;

      const data = await res.json();
      const session = getActiveSession();
      if (!session || !data) return;

      const preferredMode = normalizeMode(data.preferredMode) || session.mode || "auto";
      const preferredImageStyle = normalizeImageStyle(data?.lastUsedSettings?.preferredImageStyle || "");
      const preferredImageCamera = normalizeCameraProfile(data?.lastUsedSettings?.preferredImageCamera || "") || "portrait-85mm";
      const preferredImageLighting = normalizeLightingProfile(data?.lastUsedSettings?.preferredImageLighting || "") || "studio-soft";
      const preferredImageMaterials = normalizeMaterialList(data?.lastUsedSettings?.preferredImageMaterials || "") || ["skin"];
      session.mode = preferredMode;
      session.imageStyle = preferredImageStyle;
      session.imageCamera = preferredImageCamera;
      session.imageLighting = preferredImageLighting;
      session.imageMaterials = preferredImageMaterials;
      session.updatedAt = Date.now();
      saveState();
      syncSelectorsFromSession();
    } catch {
      // ignore
    }
  }

  async function resetMemory() {
    try {
      await fetch("/api/preferences", { method: "DELETE" });
      updateModelInspector("auto", "memory-reset");
    } catch {
      updateModelInspector("auto", "reset-failed");
    }
  }

  function setMode(mode) {
    const session = getActiveSession();
    if (!session) return;

    session.mode = normalizeMode(mode) || "auto";
    ensureSimulationState(session);
    session.updatedAt = Date.now();
    saveState();
    updateModeButton(session.mode);
    setActiveDropdownItem(modeMenu, session.mode);
    updateModeIndicator(session.mode);
    updateSimulationUI(session);
    renderSessionsSidebar();
  }

  function startSimulation() {
    const session = getActiveSession();
    if (!session || getActiveMode(session) !== "simulation") return;
    const simulation = ensureSimulationState(session);
    simulation.status = "active";
    appendSimulationLog(session, "Simulation started.");
    session.updatedAt = Date.now();
    saveState();
    updateSimulationUI(session);
  }

  function pauseSimulation() {
    const session = getActiveSession();
    if (!session || getActiveMode(session) !== "simulation") return;
    const simulation = ensureSimulationState(session);
    simulation.status = "paused";
    appendSimulationLog(session, "Simulation paused.");
    session.updatedAt = Date.now();
    saveState();
    updateSimulationUI(session);
  }

  function resetSimulation() {
    const session = getActiveSession();
    if (!session || getActiveMode(session) !== "simulation") return;
    const simulation = ensureSimulationState(session);
    simulation.id = `sim_${Date.now()}`;
    simulation.status = "inactive";
    simulation.steps = 0;
    simulation.logs = [];
    appendSimulationLog(session, "Simulation reset.");
    session.updatedAt = Date.now();
    saveState();
    updateSimulationUI(session);
  }

  function exportSimulationState() {
    const session = getActiveSession();
    if (!session || getActiveMode(session) !== "simulation") return;
    const simulation = ensureSimulationState(session);
    const payload = {
      sessionId: session.id,
      exportedAt: new Date().toISOString(),
      simulation
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${simulation.id || "simulation"}-state.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
    appendSimulationLog(session, "Simulation state exported.");
    updateSimulationUI(session);
  }

  // =========================
  // 10. INIT
  // =========================
  function init() {
    loadRuntimeSettings();
    applyRuntimeSettings();
    loadState();
    syncSelectorsFromSession();
    renderSessionsSidebar();
    renderActiveSessionMessages();
    startApiChecks();
    updateModelInspector("auto", "router-ready");
    loadPreferences();
    updateSimulationUI();

    // Listen for settings changes from other tabs or same page
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY && e.newValue === null) {
        resetToFreshChat();
        return;
      }

      if (e.key === SETTINGS_KEYS.DEFAULT_MODE || e.key === SETTINGS_KEYS.MODE_SELECTION) {
        const session = getActiveSession();
        if (session) {
          const newMode = getSelectedModeFromSettings();
          session.mode = newMode;
          saveState();
          updateModeIndicator(newMode);
          syncSelectorsFromSession();
        }
      }

      if (
        e.key === SETTINGS_KEYS.AUTO_SCROLL ||
        e.key === SETTINGS_KEYS.FONT_SIZE ||
        e.key === SETTINGS_KEYS.SOUND ||
        e.key === SETTINGS_KEYS.SHOW_TIMESTAMPS ||
        e.key === SETTINGS_KEYS.COMPACT_MODE ||
        e.key === SETTINGS_KEYS.REQUEST_TIMEOUT
      ) {
        loadRuntimeSettings();
        applyRuntimeSettings();
        renderActiveSessionMessages();
      }

      if (e.key === SETTINGS_KEYS.DEFAULT_MODEL) {
        const session = getActiveSession();
        if (session) {
          session.model = getDefaultModelFromSettings();
          session.updatedAt = Date.now();
          saveState();
          syncSelectorsFromSession();
          renderSessionsSidebar();
        }
      }
    });

    // Listen for same-page settings events
    window.addEventListener("omni-settings-changed", (e) => {
      const { key } = e.detail;
      if (key === STORAGE_KEY) {
        resetToFreshChat();
        return;
      }

      if (key === SETTINGS_KEYS.DEFAULT_MODE || key === SETTINGS_KEYS.MODE_SELECTION) {
        const session = getActiveSession();
        if (session) {
          const newMode = getSelectedModeFromSettings();
          session.mode = newMode;
          saveState();
          updateModeIndicator(newMode);
          syncSelectorsFromSession();
        }
      }

      if (
        key === SETTINGS_KEYS.AUTO_SCROLL ||
        key === SETTINGS_KEYS.FONT_SIZE ||
        key === SETTINGS_KEYS.SOUND ||
        key === SETTINGS_KEYS.SHOW_TIMESTAMPS ||
        key === SETTINGS_KEYS.COMPACT_MODE ||
        key === SETTINGS_KEYS.SEND_WITH_ENTER ||
        key === SETTINGS_KEYS.SHOW_ASSISTANT_BADGES ||
        key === SETTINGS_KEYS.AUTO_DETECT_MODE ||
        key === SETTINGS_KEYS.REQUEST_TIMEOUT ||
        key === SETTINGS_KEYS.API_HEALTH_INTERVAL ||
        key === SETTINGS_KEYS.API_RETRIES
      ) {
        loadRuntimeSettings();
        applyRuntimeSettings();
        renderActiveSessionMessages();
        if (key === SETTINGS_KEYS.API_HEALTH_INTERVAL) {
          startApiChecks();
        }
      }

      if (key === SETTINGS_KEYS.DEFAULT_MODEL) {
        const session = getActiveSession();
        if (session) {
          session.model = getDefaultModelFromSettings();
          session.updatedAt = Date.now();
          saveState();
          syncSelectorsFromSession();
          renderSessionsSidebar();
        }
      }
    });

    if (modelBtn && modelDropdown) {
      modelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !modelDropdown.classList.contains("open");
        closeAllDropdowns();
        setDropdownOpen(modelDropdown, modelBtn, willOpen);
      });
    }

    if (modelMenu) {
      modelMenu.addEventListener("click", (e) => {
        const optionBtn = e.target.closest(".chat-dropdown-item[data-value]");
        if (!optionBtn) return;
        const session = getActiveSession();
        if (!session) return;
        session.model = normalizeModel(optionBtn.dataset.value) || "auto";
        session.updatedAt = Date.now();
        saveState();
        updateModelButton(session.model);
        setActiveDropdownItem(modelMenu, session.model);
        updateModelInspector(session.model, "manual-selection");
        closeAllDropdowns();
        renderSessionsSidebar();
      });
    }

    if (modeBtn && modeDropdown) {
      modeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !modeDropdown.classList.contains("open");
        closeAllDropdowns();
        setDropdownOpen(modeDropdown, modeBtn, willOpen);
      });
    }

    if (modeMenu) {
      modeMenu.addEventListener("click", (e) => {
        const optionBtn = e.target.closest(".chat-dropdown-item[data-value]");
        if (!optionBtn) return;
        setMode(normalizeMode(optionBtn.dataset.value) || getSelectedModeFromSettings());
        const session = getActiveSession();
        if (!session) return;
        const shouldPersistManualMode = getSettingBool(SETTINGS_KEYS.PERSIST_MANUAL_MODE, true);
        if (shouldPersistManualMode) {
          try {
            localStorage.setItem(SETTINGS_KEYS.MODE_SELECTION, "manual");
            localStorage.setItem(SETTINGS_KEYS.DEFAULT_MODE, session.mode);
          } catch {
            // ignore
          }
        }
        closeAllDropdowns();
      });
    }

    if (savePreferencesBtn) {
      savePreferencesBtn.addEventListener("click", savePreferences);
    }

    if (resetMemoryBtn) {
      resetMemoryBtn.addEventListener("click", resetMemory);
    }

    if (simulationStartBtn) {
      simulationStartBtn.addEventListener("click", startSimulation);
    }

    if (simulationPauseBtn) {
      simulationPauseBtn.addEventListener("click", pauseSimulation);
    }

    if (simulationResetBtn) {
      simulationResetBtn.addEventListener("click", resetSimulation);
    }

    if (simulationExportBtn) {
      simulationExportBtn.addEventListener("click", exportSimulationState);
    }

    if (simulationRulesEditorEl) {
      simulationRulesEditorEl.addEventListener("change", () => {
        const session = getActiveSession();
        if (!session || getActiveMode(session) !== "simulation") return;
        const simulation = ensureSimulationState(session);
        simulation.rules = String(simulationRulesEditorEl.value || "").trim();
        appendSimulationLog(session, "Simulation rules updated from editor.");
        session.updatedAt = Date.now();
        saveState();
        updateSimulationUI(session);
      });
    }

    document.addEventListener("click", (e) => {
      if (e.target.closest(".dropdown-control")) return;
      closeAllDropdowns();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAllDropdowns();
      }
    });

    if (sendBtn) {
      sendBtn.addEventListener("click", handleSendClick);
    }
    if (inputEl) {
      inputEl.addEventListener("keydown", handleInputKeydown);
      inputEl.addEventListener("input", autoResizeInput);
      autoResizeInput();

      try {
        const queuedPrompt = localStorage.getItem("omni-tools-prompt") || "";
        if (queuedPrompt.trim()) {
          inputEl.value = queuedPrompt;
          localStorage.removeItem("omni-tools-prompt");
          autoResizeInput();
        }
      } catch {
        // ignore queued prompt failures
      }
    }
    if (messagesEl) {
      ensureJumpToLatestPill();
      messagesEl.addEventListener("scroll", () => {
        shouldStickToBottom = isNearBottom();
        updateJumpToLatestVisibility();
      });
      shouldStickToBottom = true;
      updateJumpToLatestVisibility();
    }
    if (newSessionBtn) {
      newSessionBtn.addEventListener("click", () => {
        createNewSession();
        saveState();
        syncSelectorsFromSession();
        renderSessionsSidebar();
        renderActiveSessionMessages();
      });
    }
  }

  init();
})();