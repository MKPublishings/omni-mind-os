// omni chat.js
// Assumptions:
// - Backend: POST /api/omni  (JSON body: { messages, model, mode })
// - Response: text/event-stream with lines: "data: { ... }" and "data: [DONE]"
// - HTML elements:
//   #chat-messages  (container for messages)
//   #chat-input     (textarea or input)
//   #send-btn       (button)
//   #model-select   (select)   [optional]
//   #mode-select    (select)   [optional]

(() => {
  const messagesEl = document.getElementById("chat-messages");
  const inputEl = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const modelSelect = document.getElementById("model-select");
  const modeSelect = document.getElementById("mode-select");

  let conversation = [];
  let isStreaming = false;

  // Utility: create message bubble
  function createMessageElement(role, text) {
    const el = document.createElement("div");
    el.className = `message message-${role}`;
    el.textContent = text;
    return el;
  }

  // Utility: scroll to bottom
  function scrollToBottom() {
    if (!messagesEl) return;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Append a full message (user or assistant)
  function appendMessage(role, text) {
    if (!messagesEl) return;
    const el = createMessageElement(role, text);
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }

  // Update an existing assistant message element
  function updateAssistantElement(el, text) {
    if (!el) return;
    el.textContent = text;
    scrollToBottom();
  }

  // Token spacing logic
  function appendTokenWithSpacing(currentText, token) {
    // Trim raw token
    const t = token;

    // If punctuation, attach directly
    if (/^[.,!?;:]/.test(t)) {
      return currentText + t;
    }

    // If current text is empty, just add token
    if (!currentText) {
      return t;
    }

    // If current text already ends with space, just add token
    if (/\s$/.test(currentText)) {
      return currentText + t;
    }

    // Default: add a space then token
    return currentText + " " + t;
  }

  // Main send handler
  async function handleSend() {
    if (isStreaming) return;

    const content = (inputEl?.value || "").trim();
    if (!content) return;

    // Add user message to UI and history
    appendMessage("user", content);
    conversation.push({ role: "user", content });

    // Clear input
    inputEl.value = "";

    // Prepare assistant placeholder
    let assistantText = "";
    const assistantEl = appendMessage("assistant", "");

    // Build payload
    const payload = {
      messages: conversation,
      model: modelSelect ? modelSelect.value : "omni",
      mode: modeSelect ? modeSelect.value : "chat"
    };

    isStreaming = true;
    sendBtn.disabled = true;
    if (inputEl) inputEl.disabled = true;

    try {
      const res = await fetch("/api/omni", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok || !res.body) {
        assistantText = "[Error] Unable to reach Omni backend.";
        updateAssistantElement(assistantEl, assistantText);
        isStreaming = false;
        sendBtn.disabled = false;
        if (inputEl) inputEl.disabled = false;
        return;
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

        // Split into lines for SSE-style "data:" frames
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const data = trimmed.slice(5).trim(); // remove "data:"

          if (!data) continue;
          if (data === "[DONE]") {
            // End of stream
            buffer = "";
            break;
          }

          // Expect data to be either plain text token or JSON with { token: "..." }
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
            // not JSON, treat as raw token
          }

          // Append token with spacing
          assistantText = appendTokenWithSpacing(assistantText, token);
          updateAssistantElement(assistantEl, assistantText);
        }
      }

      // Finalize assistant message
      if (assistantText.trim().length === 0) {
        assistantText = "[No response received]";
        updateAssistantElement(assistantEl, assistantText);
      }

      // Push assistant message into history
      conversation.push({ role: "assistant", content: assistantText });
    } catch (err) {
      console.error("Omni chat error:", err);
      const errorText = "[Error] Something went wrong while streaming the response.";
      updateAssistantElement(assistantEl, errorText);
    } finally {
      isStreaming = false;
      sendBtn.disabled = false;
      if (inputEl) inputEl.disabled = false;
      inputEl?.focus();
    }
  }

  // Enter key to send (Shift+Enter for newline)
  function handleKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Wire up events
  if (sendBtn) {
    sendBtn.addEventListener("click", handleSend);
  }
  if (inputEl) {
    inputEl.addEventListener("keydown", handleKeydown);
  }

  // Optional: initial system message or greeting
  // conversation.push({ role: "system", content: "You are Omni, the resident mind of mkptri.org." });
})();