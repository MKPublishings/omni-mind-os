// omni chat.js — Style C (Full Mind/OS)
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
  const modelSelect = document.getElementById("model-select") || document.getElementById("model");
  const modeSelect = document.getElementById("mode-select");
  const modeLabelEl = document.getElementById("mode-label") || document.querySelector("#mode-indicator span");
  const apiStatusEl = document.getElementById("api-status");

  const sessionsSidebarEl = document.getElementById("sessions-sidebar");
  const newSessionBtn = document.getElementById("new-session-btn");

  // Optional typing indicator
  const typingIndicatorEl = document.getElementById("typing-indicator");

  // =========================
  // 2. STATE ENGINE
  // =========================
  const STORAGE_KEY = "omni_chat_sessions_v1";
  const SETTINGS_KEYS = {
    MODE_SELECTION: "omni-mode-selection",
    DEFAULT_MODE: "omni-default-mode"
  };
  const KNOWN_MODES = ["architect", "analyst", "visual", "lore"];

  let state = {
    activeSessionId: null,
    sessions: {}
  };

  function normalizeMode(mode) {
    const normalized = typeof mode === "string" ? mode.trim().toLowerCase() : "";
    return KNOWN_MODES.includes(normalized) ? normalized : "";
  }

  function toModeLabel(mode) {
    const normalized = normalizeMode(mode) || "architect";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function getSelectedModeFromSettings() {
    try {
      const fallbackMode = normalizeMode(localStorage.getItem(SETTINGS_KEYS.DEFAULT_MODE)) || "architect";
      const selectionMode = (localStorage.getItem(SETTINGS_KEYS.MODE_SELECTION) || "automatic").trim().toLowerCase();
      if (selectionMode === "manual") {
        return fallbackMode;
      }
      return fallbackMode;
    } catch {
      return "architect";
    }
  }

  function getActiveMode(session = getActiveSession()) {
    const sessionMode = normalizeMode(session?.mode);
    if (sessionMode) return sessionMode;
    return getSelectedModeFromSettings();
  }

  function updateModeIndicator(mode) {
    if (!modeLabelEl) return;
    modeLabelEl.textContent = `Mode: ${toModeLabel(mode)}`;
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
      model: "omni",
      mode: getSelectedModeFromSettings(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
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

    if (modelSelect) {
      modelSelect.value = session.model || "omni";
    }
    if (modeSelect) {
      modeSelect.value = activeMode;
    }

    updateModeIndicator(activeMode);
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

    if (role === "assistant" && (meta.model || meta.mode)) {
      const badge = document.createElement("span");
      badge.className = "message-badge";
      badge.textContent = [meta.model, meta.mode].filter(Boolean).join(" • ");
      header.appendChild(badge);
    }

    const body = document.createElement("div");
    body.className = "message-body";
    body.innerHTML = renderMarkdown(content || "");

    inner.appendChild(header);
    inner.appendChild(body);
    wrapper.appendChild(inner);

    return { wrapper, body };
  }

  function appendMessage(role, content, meta = {}) {
    if (!messagesEl) return null;
    const { wrapper, body } = createMessageElement(role, content, meta);
    messagesEl.appendChild(wrapper);
    smoothScrollToBottom(true);
    return { wrapper, body };
  }

  function updateAssistantMessageBody(bodyEl, text) {
    if (!bodyEl) return;
    bodyEl.innerHTML = renderMarkdown(text);
    smoothScrollToBottom(false);
  }

  function renderActiveSessionMessages() {
    clearMessages();
    const session = getActiveSession();
    if (!session) return;
    for (const msg of session.messages) {
      appendMessage(msg.role, msg.content, {
        model: session.model,
        mode: session.mode
      });
    }
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
    }, 30000);
  }

  async function streamOmniResponse(session, assistantBodyEl, onChunk) {
    const payload = {
      messages: session.messages,
      model: session.model || (modelSelect ? modelSelect.value : "omni"),
      mode: session.mode || (modeSelect ? modeSelect.value : "chat")
    };

    const controller = new AbortController();
    currentAbortController = controller;

    const res = await fetch(getApiEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!res.ok || !res.body) {
      throw new Error("Bad response from Omni backend");
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
        } else if (parsed && typeof parsed.content === "string") {
          token = parsed.content;
        }
      } catch {
        // raw token
      }

      onChunk(token);
      updateAssistantMessageBody(assistantBodyEl, session._streamingAssistantText);
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

    const isApiOnline = await checkApiStatus();
    if (!isApiOnline) {
      appendMessage(
        "assistant",
        "[Connection] API is offline right now. Please try again in a moment.",
        {
          model: session.model,
          mode: session.mode
        }
      );
      return;
    }

    // Push user message
    session.messages.push({ role: "user", content: trimmed });
    updateSessionMetaFromMessages(session);
    saveState();

    appendMessage("user", trimmed, {
      model: session.model,
      mode: session.mode
    });

    // Clear input
    if (inputEl) inputEl.value = "";

    // Prepare assistant placeholder
    const assistantMessage = appendMessage("assistant", "", {
      model: session.model,
      mode: session.mode
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
        (token) => {
          session._streamingAssistantText = appendTokenWithSpacing(
            session._streamingAssistantText,
            token
          );
        }
      );

      const finalText = (session._streamingAssistantText || "").trim();
      const safeText = finalText || "[No response received]";
      updateAssistantMessageBody(assistantBodyEl, safeText);

      session.messages.push({ role: "assistant", content: safeText });
      delete session._streamingAssistantText;
      updateSessionMetaFromMessages(session);
      saveState();
    } catch (err) {
      console.error("Omni streaming error:", err);
      updateAssistantMessageBody(
        assistantBodyEl,
        "[Error] Something went wrong while streaming the response."
      );
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
    if (!force && !shouldStickToBottom) return;
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  }

  // =========================
  // 10. INIT
  // =========================
  function init() {
    loadState();
    syncSelectorsFromSession();
    renderSessionsSidebar();
    renderActiveSessionMessages();
    startApiChecks();

    if (modelSelect) {
      modelSelect.addEventListener("change", () => {
        const session = getActiveSession();
        if (!session) return;
        session.model = modelSelect.value || "omni";
        session.updatedAt = Date.now();
        saveState();
        renderSessionsSidebar();
      });
    }

    if (modeSelect) {
      modeSelect.addEventListener("change", () => {
        const session = getActiveSession();
        if (!session) return;
        session.mode = normalizeMode(modeSelect.value) || getSelectedModeFromSettings();
        session.updatedAt = Date.now();
        saveState();
        updateModeIndicator(session.mode);
        renderSessionsSidebar();
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener("click", handleSendClick);
    }
    if (inputEl) {
      inputEl.addEventListener("keydown", handleInputKeydown);
      inputEl.addEventListener("input", autoResizeInput);
      autoResizeInput();
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