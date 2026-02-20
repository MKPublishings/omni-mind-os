console.log("chat.js loaded");

const input = document.getElementById("chat-input");
const chatWindow = document.getElementById("chat-window");
const sendBtn = document.getElementById("chat-send");

if (!input || !chatWindow || !sendBtn) {
  console.error("Chat UI elements missing:", {
    input: !!input,
    chatWindow: !!chatWindow,
    sendBtn: !!sendBtn
  });
}

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

async function sendMessage() {
  if (!input || !chatWindow || !sendBtn) return;
  if (sending) return;

  const text = input.value.trim();
  if (!text) return;

  sending = true;
  sendBtn.disabled = true;

  messages.push({ role: "user", content: text });
  addMessage("user", text);
  input.value = "";

  const assistantBubble = addMessage("assistant", "…");

  try {
    const res = await fetch("/api/omni", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        mode: "Architect",
        model: "omni"
      })
    });

    if (!res.ok) {
      assistantBubble.textContent = `Error ${res.status}: ${await res.text()}`;
      return;
    }

    const txt = await res.text();
    assistantBubble.textContent = txt || "Empty response";
    if (txt) messages.push({ role: "assistant", content: txt });
  } catch (e) {
    console.error(e);
    assistantBubble.textContent = "Network error";
  } finally {
    sending = false;
    sendBtn.disabled = false;
  }
}

sendBtn?.addEventListener("click", sendMessage);
input?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});