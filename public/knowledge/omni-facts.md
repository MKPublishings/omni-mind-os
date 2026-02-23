# Omni Facts

Omni Mind/OS is a Cloudflare Worker-based cognitive runtime with streaming responses.

## Core Capabilities
- Multi-model routing across Omni, GPT-4o, GPT-4o-mini, and DeepSeek.
- Mode-aware behavior with specialized interaction styles.
- Safety sanitization on input and output paths.
- Memory integration for user preferences.

## Retrieval Notes
- Knowledge files are indexed from the `/public/knowledge` asset directory.
- `/api/search?q=...` returns top relevant chunks for factual lookups.
