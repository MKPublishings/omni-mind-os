console.log("chat.js loaded");

// ------------------------------------------------------------
// ELEMENTS
// ------------------------------------------------------------
const chatContainer = document.getElementById("chat-container");
const inputField = document.getElementById("user-input");
const sendButton = document.getElementById("send-btn");
const modeIndicator = document.getElementById("mode-indicator");
const modelSelector = document.getElementById("model");

// ------------------------------------------------------------
// OMNI STATE
// ------------------------------------------------------------
const OmniState = {
  mode: "Architect",
  model: "omni",
  messages: [],
  streaming: false
};

// ------------------------------------------------------------
// UI HELPERS
// ------------------------------------------------------------
function appendMessage(role, content) {
  const bubble = document.createElement("div");
  bubble.className = role === "user" ? "msg user-msg" : "msg omni-msg";
  bubble.textContent = content;
  chatContainer.appendChild(bubble);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return bubble;
}

function setMode(modeName) {
  OmniState.mode = modeName;
  modeIndicator.textContent = `Mode: ${modeName}`;
}

function setModel(modelName) {
  OmniState.model = modelName;
}

// ------------------------------------------------------------
// SEND MESSAGE
// ------------------------------------------------------------
async function sendMessage() {
  const text = inputField.value.trim();
  if (!text || OmniState.streaming) return;

  // Add user message
  OmniState.messages.push({ role: "user", content: text });
  appendMessage("user", text);
  inputField.value = "";

  // Stream assistant response
  await streamOmniResponse();
}

// ------------------------------------------------------------
// STREAMING RESPONSE
// ------------------------------------------------------------
async function streamOmniResponse() {
  OmniState.streaming = true;

  // Create assistant bubble
  const bubble = appendMessage("assistant", "…");

  try {
    const response = await fetch("/api/omni", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: OmniState.messages,
        model: OmniState.model,
        mode: OmniState.mode
      })
    });

    if (!response.ok) {
      bubble.textContent = `Error ${response.status}`;
      OmniState.streaming = false;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      fullText += chunk;
      bubble.textContent = fullText;
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Save assistant message
    OmniState.messages.push({
      role: "assistant",
      content: fullText
    });

  } catch (err) {
    console.error(err);
    bubble.textContent = "⚠️ Network or streaming error.";
  }

  OmniState.streaming = false;
}

// ------------------------------------------------------------
// EVENT LISTENERS
// ------------------------------------------------------------
sendButton.addEventListener("click", sendMessage);

inputField.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Mode buttons
document.querySelectorAll("[data-mode]").forEach(btn => {
  btn.addEventListener("click", () => {
    setMode(btn.getAttribute("data-mode"));
  });
});

// Model selector
modelSelector.addEventListener("change", (e) => {
  setModel(e.target.value);
});

// ------------------------------------------------------------
// INITIAL GREETING
// ------------------------------------------------------------
appendMessage(
  "assistant",
  "Omni Mind/OS online. Cognitive scaffolding initialized."
);