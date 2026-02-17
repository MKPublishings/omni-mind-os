/**
 * Type definitions for the LLM chat application.
 */

export interface Env {
	/**
	 * Binding for the Workers AI API.
	 */
	AI: {
		chat: (messages: ChatMessage[], options?: any) => AsyncIterable<string>;
	};

	/**
	 * Binding for static assets.
	 */
	ASSETS: { fetch: (request: Request) => Promise<Response> };
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}
