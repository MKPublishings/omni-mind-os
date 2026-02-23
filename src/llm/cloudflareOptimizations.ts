// ============================================================
// OMNI MIND/OS — Cloudflare Workers Optimizations
// Cloudflare-specific API optimizations and utilities
// ============================================================

import { optimizedFetch, getStreamingEngine } from "./optimizedStreaming";

/**
 * Cloudflare Workers Cache API wrapper for API responses
 */
export class CloudflareCacheManager {
  private cacheName: string = "omni-api-cache";

  async get(key: string): Promise<any | null> {
    if (typeof caches === "undefined") return null;

    try {
      const cache = await caches.open(this.cacheName);
      const response = await cache.match(key);
      if (response) {
        return response.json();
      }
    } catch {
      return null;
    }
    return null;
  }

  async set(key: string, data: any, ttlSeconds: number = 300): Promise<void> {
    if (typeof caches === "undefined") return;

    try {
      const cache = await caches.open(this.cacheName);
      const response = new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `max-age=${ttlSeconds}`
        }
      });
      await cache.put(key, response);
    } catch (error) {
      console.error("Cache write error:", error);
    }
  }

  async clear(): Promise<void> {
    if (typeof caches === "undefined") return;

    try {
      await caches.delete(this.cacheName);
    } catch (error) {
      console.error("Cache clear error:", error);
    }
  }
}

/**
 * Token streaming optimizer with chunk batching
 */
export class TokenStreamOptimizer {
  private chunkSize: number = 48;
  private batchDelay: number = 5; // ms

  constructor(config?: { chunkSize?: number; batchDelay?: number }) {
    if (config?.chunkSize) this.chunkSize = config.chunkSize;
    if (config?.batchDelay) this.batchDelay = config.batchDelay;
  }

  /**
   * Create optimized streaming response with batched token delivery
   */
  createOptimizedStream(text: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const chunks = this.chunkText(text);
    let index = 0;
    const batchDelay = this.batchDelay;

    return new ReadableStream({
      async pull(controller) {
        if (index >= chunks.length) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const chunk = chunks[index];
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        index++;

        // Small delay for smooth streaming
        if (index < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }
    });
  }

  private chunkText(text: string): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += this.chunkSize) {
      chunks.push(text.slice(i, i + this.chunkSize));
    }
    return chunks;
  }
}

/**
 * Cloudflare-specific fetch with optimized headers and connection settings
 */
export async function cloudflareOptimizedFetch(
  url: string,
  options: RequestInit = {},
  env?: any
): Promise<Response> {
  const optimizedOptions: RequestInit = {
    ...options,
    headers: {
      "User-Agent": "Omni-Mind-OS/1.0",
      "Connection": "keep-alive",
      ...options.headers
    },
    // Cloudflare Workers fetch optimizations
    cf: {
      cacheTtl: 300,
      cacheEverything: false,
      minify: false,
      polish: "off",
      ...(options as any)?.cf
    }
  };

  return fetch(url, optimizedOptions);
}

/**
 * Parallel API request processor with automatic batching
 */
export async function parallelApiCalls<T>(
  calls: Array<() => Promise<T>>,
  maxConcurrent: number = 5
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const call of calls) {
    const promise = call().then(result => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= maxConcurrent) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Rate limit handler with exponential backoff
 */
export class RateLimitManager {
  private retryAfter: Map<string, number> = new Map();

  async handleRateLimit(key: string, retryAfterSeconds?: number): Promise<void> {
    const waitTime = retryAfterSeconds
      ? retryAfterSeconds * 1000
      : this.calculateBackoff(key);

    this.retryAfter.set(key, Date.now() + waitTime);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  isRateLimited(key: string): boolean {
    const limitedUntil = this.retryAfter.get(key);
    if (!limitedUntil) return false;

    if (Date.now() >= limitedUntil) {
      this.retryAfter.delete(key);
      return false;
    }

    return true;
  }

  private calculateBackoff(key: string): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, max 16s
    const attempts = this.retryAfter.has(key) ? 1 : 0;
    return Math.min(1000 * Math.pow(2, attempts), 16000);
  }
}

/**
 * Connection pool statistics and monitoring
 */
export function getConnectionStats() {
  const engine = getStreamingEngine();
  return {
    ...engine.getStats(),
    timestamp: Date.now(),
    workerId: (globalThis as any).WORKER_ID || "unknown"
  };
}

/**
 * Warm up connections to external APIs during Worker initialization
 */
export async function warmupConnections(env: any): Promise<void> {
  const warmupUrls: string[] = [];

  // Add API endpoints that need warming
  if (env?.OPENAI_API_KEY) {
    warmupUrls.push("https://api.openai.com/v1/models");
  }
  if (env?.DEEPSEEK_API_KEY) {
    warmupUrls.push("https://api.deepseek.com/v1/models");
  }

  // Fire warmup requests (don't await, just initiate)
  warmupUrls.forEach(url => {
    fetch(url, { method: "HEAD" }).catch(() => {
      // Ignore errors during warmup
    });
  });
}
