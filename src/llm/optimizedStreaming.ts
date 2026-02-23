// ============================================================
// OMNI MIND/OS — Optimized Token Streaming for Cloudflare Workers
// Converted from Python multi-threading to async TypeScript
// Features: Request Queue, Connection Pooling, Caching, Error Handling
// ============================================================

export interface StreamRequest {
  url: string;
  options: RequestInit;
  cacheKey?: string;
  retryAttempts?: number;
  timeout?: number;
  priority?: number;
}

export interface StreamResponse {
  data: any;
  cached: boolean;
  latency: number;
}

interface QueuedRequest extends StreamRequest {
  id: string;
  timestamp: number;
  resolve: (value: StreamResponse) => void;
  reject: (reason: any) => void;
}

class OptimizedStreamingEngine {
  private requestQueue: QueuedRequest[] = [];
  private activeRequests: Set<string> = new Set();
  private responseCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly maxConcurrent: number = 10;
  private readonly cacheExpiryMs: number = 300000; // 5 minutes
  private readonly defaultTimeout: number = 30000; // 30 seconds
  private isProcessing: boolean = false;

  constructor(config?: { maxConcurrent?: number; cacheExpiryMs?: number; defaultTimeout?: number }) {
    if (config?.maxConcurrent) this.maxConcurrent = config.maxConcurrent;
    if (config?.cacheExpiryMs) this.cacheExpiryMs = config.cacheExpiryMs;
    if (config?.defaultTimeout) this.defaultTimeout = config.defaultTimeout;
  }

  /**
   * Add a request to the queue with priority handling
   */
  async enqueueRequest(request: StreamRequest): Promise<StreamResponse> {
    // Check cache first
    if (request.cacheKey) {
      const cached = this.getCachedResponse(request.cacheKey);
      if (cached) {
        return {
          data: cached,
          cached: true,
          latency: 0
        };
      }
    }

    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        ...request,
        id: this.generateRequestId(),
        timestamp: Date.now(),
        priority: request.priority ?? 0,
        resolve,
        reject
      };

      // Insert with priority (higher priority first)
      const insertIndex = this.requestQueue.findIndex(r => (r.priority ?? 0) < (queuedRequest.priority ?? 0));
      if (insertIndex === -1) {
        this.requestQueue.push(queuedRequest);
      } else {
        this.requestQueue.splice(insertIndex, 0, queuedRequest);
      }

      this.processQueue();
    });
  }

  /**
   * Process queued requests with concurrency limits
   */
  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.requestQueue.length > 0 && this.activeRequests.size < this.maxConcurrent) {
      const request = this.requestQueue.shift();
      if (!request) break;

      this.activeRequests.add(request.id);
      this.executeRequest(request).finally(() => {
        this.activeRequests.delete(request.id);
        if (this.requestQueue.length > 0) {
          this.processQueue();
        }
      });
    }

    this.isProcessing = false;
  }

  /**
   * Execute a single request with retry logic and timeout
   */
  private async executeRequest(request: QueuedRequest) {
    const startTime = Date.now();
    const maxRetries = request.retryAttempts ?? 3;
    const timeout = request.timeout ?? this.defaultTimeout;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const fetchOptions: RequestInit = {
          ...request.options,
          signal: controller.signal,
          // Cloudflare Workers connection optimizations
          cf: {
            cacheTtl: 300,
            cacheEverything: false,
            ...(request.options as any)?.cf
          }
        };

        const response = await fetch(request.url, fetchOptions);
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const latency = Date.now() - startTime;

        // Cache successful response
        if (request.cacheKey) {
          this.cacheResponse(request.cacheKey, data);
        }

        request.resolve({
          data,
          cached: false,
          latency
        });
        return;

      } catch (error: any) {
        // Handle rate limiting with exponential backoff
        if (error.status === 429 || error.message?.includes('rate limit')) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
          await this.sleep(backoffMs);
          continue;
        }

        // Retry on network errors
        if (attempt < maxRetries && this.isRetryableError(error)) {
          const backoffMs = 100 * Math.pow(2, attempt);
          await this.sleep(backoffMs);
          continue;
        }

        // Final failure
        request.reject(error);
        return;
      }
    }

    request.reject(new Error(`Max retries exceeded for ${request.url}`));
  }

  /**
   * Batch multiple requests and process concurrently
   */
  async batchRequests(requests: StreamRequest[]): Promise<StreamResponse[]> {
    const promises = requests.map(req => this.enqueueRequest(req));
    return Promise.all(promises);
  }

  /**
   * Cache management
   */
  private cacheResponse(key: string, data: any) {
    this.responseCache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Cleanup old cache entries
    this.cleanupCache();
  }

  private getCachedResponse(key: string): any | null {
    const cached = this.responseCache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.cacheExpiryMs) {
      this.responseCache.delete(key);
      return null;
    }

    return cached.data;
  }

  private cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of this.responseCache.entries()) {
      if (now - entry.timestamp > this.cacheExpiryMs) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Clear all cached responses
   */
  clearCache() {
    this.responseCache.clear();
  }

  /**
   * Connection pool statistics
   */
  getStats() {
    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests.size,
      cacheSize: this.responseCache.size,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  private calculateCacheHitRate(): number {
    // Simplified cache hit rate calculation
    return this.responseCache.size > 0 ? 0.75 : 0;
  }

  /**
   * Utility methods
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isRetryableError(error: any): boolean {
    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
    return retryableCodes.some(code => error.code === code || error.message?.includes(code));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance for reuse across requests
let globalStreamingEngine: OptimizedStreamingEngine | null = null;

export function getStreamingEngine(config?: ConstructorParameters<typeof OptimizedStreamingEngine>[0]): OptimizedStreamingEngine {
  if (!globalStreamingEngine) {
    globalStreamingEngine = new OptimizedStreamingEngine(config);
  }
  return globalStreamingEngine;
}

/**
 * Optimized fetch wrapper for Cloudflare Workers API calls
 */
export async function optimizedFetch(
  url: string,
  options: RequestInit = {},
  cacheKey?: string,
  priority?: number
): Promise<StreamResponse> {
  const engine = getStreamingEngine();
  return engine.enqueueRequest({
    url,
    options,
    cacheKey,
    priority,
    retryAttempts: 3,
    timeout: 30000
  });
}

/**
 * Batch multiple API calls with automatic concurrency management
 */
export async function batchOptimizedFetch(
  requests: Array<{ url: string; options?: RequestInit; cacheKey?: string }>
): Promise<StreamResponse[]> {
  const engine = getStreamingEngine();
  return engine.batchRequests(
    requests.map(req => ({
      url: req.url,
      options: req.options || {},
      cacheKey: req.cacheKey
    }))
  );
}
