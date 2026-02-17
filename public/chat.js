// ============================================================
// OMNI MIND/OS — CHAT ENGINE (FINAL VERSION)
// Handles: message flow, streaming, UI state, mode switching.
// ============================================================

const chatContainer = document.getElementById("chat-container");
const inputField = document.getElementById("chat-input");
const sendButton = document.getElementById("send-btn");
const modeIndicator = document.getElementById("mode-indicator");

// Omni runtime state
const OmniState = {
  mode: "Architect",
  messages: [],
  streaming: false,
  sessionId: crypto.randomUUID()
};

// ------------------------------------------------------------
// UI HELPERS
// ------------------------------------------------------------

function appendMessage(role, content) {
  const bubble = document.createElement("div");
  bubble.className = role === "user" ? "msg user-msg" : "msg omni-msg";
  bubble.innerHTML = content;
  chatContainer.appendChild(bubble);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function setMode(modeName) {
  OmniState.mode = modeName;
  modeIndicator.textContent = `Mode: ${modeName}`;
}

// ------------------------------------------------------------
// MESSAGE SENDING
// ------------------------------------------------------------

async function sendMessage() {
  const text = inputField.value.trim();
  if (!text || OmniState.streaming) return;

  OmniState.messages.push({ role: "user", content: text });
  appendMessage("user", text);
  inputField.value = "";

  await streamOmniResponse();
}

// ------------------------------------------------------------
// STREAMING RESPONSE
// ------------------------------------------------------------

async function streamOmniResponse() {
  OmniState.streaming = true;

  const bubble = document.createElement("div");
  bubble.className = "msg omni-msg";
  chatContainer.appendChild(bubble);

  try {
  fetch("/api/omni", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
    });

    const reader = response.body.getReader();
    let text = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = new TextDecoder().decode(value);
      text += chunk;
      bubble.innerHTML = text;
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    OmniState.messages.push({
      role: "assistant",
      content: text
    });

  } catch (err) {
    bubble.innerHTML = "⚠️ Streaming error.";
  }

  OmniState.streaming = false;
}

// ------------------------------------------------------------
// EVENT LISTENERS
// ------------------------------------------------------------

sendButton.addEventListener("click", sendMessage);

inputField.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

// Mode buttons
document.querySelectorAll("[data-mode]").forEach(btn => {
  btn.addEventListener("click", () => {
    const newMode = btn.getAttribute("data-mode");
    setMode(newMode);
  });
});

// Initial greeting
appendMessage(
  "assistant",
  "Omni Mind/OS online. Cognitive scaffolding initialized. How shall we begin?"
);
let currentModel = "omni";

document.getElementById("model").addEventListener("change", (e) => {
  currentModel = e.target.value;
});
const payload = {
  mode: currentMode,
  model: currentModel,
  messages: chatHistory
};
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/api/omni") {
      return handleOmni(request, env)
    }
    return new Response("Not found", { status: 404 })
  }
}
document.getElementById("send-btn").addEventListener("click", () => {
    sendMessage();
});
async function sendMessage() {
    const input = document.getElementById("user-input");
    const text = input.value.trim();
    if (!text) return;

    addUserMessage(text);
    input.value = "";

    const response = await fetch("/api/omni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let botMessage = addBotMessage("");

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        botMessage.textContent += decoder.decode(value);
    }
}