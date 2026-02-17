console.log("chat.js loaded");

// -------------------------
// DOM ELEMENTS
// -------------------------
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const chatContainer = document.getElementById("chat-container");

// Safety check
if (!input || !sendBtn || !chatContainer) {
    console.error("❌ chat.js: Missing required DOM elements.");
}

// -------------------------
// EVENT LISTENERS
// -------------------------
sendBtn.addEventListener("click", () => {
    console.log("Send button clicked");
    sendMessage();
});

input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        console.log("Enter pressed");
        sendMessage();
    }
});

// -------------------------
// MESSAGE HELPERS
// -------------------------
function addUserMessage(text) {
    const div = document.createElement("div");
    div.className = "message user";
    div.textContent = text;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addBotMessage(text = "") {
    const div = document.createElement("div");
    div.className = "message bot";
    div.textContent = text;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return div;
}

function addTypingIndicator() {
    const div = document.createElement("div");
    div.className = "message bot typing";
    div.textContent = "Omni is thinking…";
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return div;
}

// -------------------------
// MAIN SEND FUNCTION
// -------------------------
async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    addUserMessage(text);
    input.value = "";

    const typing = addTypingIndicator();

    try {
        const response = await fetch("/api/omni", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text })
        });

        if (!response.ok) {
            typing.textContent = "❌ Error: " + response.status;
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let botDiv = addBotMessage("");
        typing.remove();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            botDiv.textContent += decoder.decode(value);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

    } catch (err) {
        console.error("Chat error:", err);
        typing.textContent = "❌ Network error";
    }
}