console.log("chat.js loaded");

const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const chatContainer = document.getElementById("chat-container");
const modeIndicator = document.getElementById("mode-indicator");
const modelSelect = document.getElementById("model");

if (!input || !sendBtn || !chatContainer) {
	console.error("❌ chat.js: Missing required DOM elements.");
}

sendBtn?.addEventListener("click", () => {
	sendMessage();
});

input?.addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		e.preventDefault();
		sendMessage();
	}
});

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

async function sendMessage() {
	const text = input.value.trim();
	if (!text) return;

	addUserMessage(text);
	input.value = "";

	const typing = addTypingIndicator();

	const payload = {
		message: text,
		mode: modeIndicator ? modeIndicator.textContent.replace("Mode: ", "") : "Architect",
		model: modelSelect ? modelSelect.value : "omni"
	};

	try {
		const res = await fetch("/api/omni", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		});

		if (!res.ok) {
			typing.textContent = `❌ Error: ${res.status}`;
			return;
		}

		const reader = res.body.getReader();
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