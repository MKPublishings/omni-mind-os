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
  const apiStatusEl = document.getElementById("api-status");

  const sessionsSidebarEl = document.getElementById("sessions-sidebar");
  const newSessionBtn = document.getElementById("new-session-btn");

  // Optional typing indicator
  const typingIndicatorEl = document.getElementById("typing-indicator");

  // =========================
  // 2. STATE ENGINE
  // =========================
  const STORAGE_KEY = "omni_chat_sessions_v1";

  let state = {
    activeSessionId: null,
    sessions: {}
  };

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
      mode: "chat",
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

    if (modelSelect) {
      modelSelect.value = session.model || "omni";
    }
    if (modeSelect) {
      modeSelect.value = session.mode || "chat";
    }
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

    // Simple fade-in
    requestAnimationFrame(() => {
      wrapper.classList.add("message-visible");
    });

    return { wrapper, body };
  }

  function appendMessage(role, content, meta = {}) {
    if (!messagesEl) return null;
    const { wrapper, body } = createMessageElement(role, content, meta);
    messagesEl.appendChild(wrapper);
    smoothScrollToBottom();
    return { wrapper, body };
  }

  function updateAssistantMessageBody(bodyEl, text) {
    if (!bodyEl) return;
    bodyEl.innerHTML = renderMarkdown(text);
    smoothScrollToBottom();
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

    if (!currentText) {
      return t;
    }

    const prevChar = currentText[currentText.length - 1] || "";

    // Keep explicit whitespace exactly as streamed
    if (/^\s+$/.test(t)) {
      return currentText + t;
    }

    // Punctuation attaches directly
    if (/^[.,!?;:%)\]}]/.test(t)) {
      return currentText + t;
    }

    // Apostrophes/quotes attach to existing word pieces
    if (/^['’`]/.test(t) && /[A-Za-z0-9]$/.test(currentText)) {
      return currentText + t;
    }

    if (/\s$/.test(currentText) || /^\s/.test(t)) {
      return currentText + t;
    }

    // Character-stream fallback: keep alphanumeric runs contiguous
    if (t.length === 1 && /[A-Za-z0-9]/.test(t) && /[A-Za-z0-9]$/.test(currentText)) {
      return currentText + t;
    }

    if (/^[\])}]/.test(t)) {
      return currentText + t;
    }

    if (/[([{\-\/“"']$/.test(prevChar)) {
      return currentText + t;
    }

    return currentText + " " + t;
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

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const normalized = line.replace(/\r$/, "");
        if (!normalized.startsWith("data:")) continue;

        let data = normalized.slice(5);

        // SSE allows a single optional space after ':'
        if (data.startsWith(" ")) {
          data = data.slice(1);
        }

        if (data.trim() === "[DONE]") {
          buffer = "";
          return;
        }

        if (data.length === 0) continue;

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
  function smoothScrollToBottom() {
    if (!messagesEl) return;
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

      // Hover preview
      item.title = session.messages
        .slice(0, 3)
        .map(m => `${m.role === "user" ? "You" : "Omni"}: ${m.content.slice(0, 60)}`)
        .join("\n");

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
        session.mode = modeSelect.value || "chat";
        session.updatedAt = Date.now();
        saveState();
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