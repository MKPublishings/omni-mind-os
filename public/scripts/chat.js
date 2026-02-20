console.log("chat.js loaded");

const input = document.getElementById("chat-input");
const chatWindow = document.getElementById("chat-window");
const sendBtn = document.getElementById("chat-send");

let messages = [];
let sending = false;

function addMessage(role, content) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.textContent = content;
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return bubble;
}

function buildPayload() {
  // Keep only valid message objects
  const safeMessages = messages.filter(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant" || m.role === "system") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0
  );

  return {
    messages: safeMessages,
    mode: "Architect",
    model: "omni"
  };
}

async function sendMessage() {
  if (sending) return;

  const text = input?.value?.trim() || "";
  if (!text) return;

  sending = true;
  sendBtn.disabled = true;

  messages.push({ role: "user", content: text });
  addMessage("user", text);
  input.value = "";

  const assistantBubble = addMessage("assistant", "…");

  try {
    const payload = buildPayload();

    const response = await fetch("/api/omni", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errText = "";
      try {
        errText = await response.text();
      } catch {
        errText = "";
      }
      assistantBubble.textContent = `Error ${response.status}${errText ? `: ${errText}` : ""}`;
      return;
    }

    if (!response.body) {
      assistantBubble.textContent = "No response body";
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
      assistantBubble.textContent = fullText || "…";
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    fullText += decoder.decode();
    fullText = fullText.trim();
    if (fullText) {
      messages.push({ role: "assistant", content: fullText });
    } else {
      assistantBubble.textContent = "Empty assistant response";
    }
  } catch {
    assistantBubble.textContent = "Network error";
  } finally {
    sending = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

sendBtn?.addEventListener("click", sendMessage);

input?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});