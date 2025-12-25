/**
 * HTTP Transport for sending events to Statly Observe
 */

import type { StatlyEvent } from './types';

export interface TransportOptions {
    dsn: string;
    debug?: boolean;
}

export interface TransportResult {
    success: boolean;
    status?: number;
    error?: string;
}

export class Transport {
    private dsn: string;
    private endpoint: string;
    private debug: boolean;
    private queue: StatlyEvent[] = [];
    private isSending = false;
    private maxQueueSize = 100;
    private flushInterval = 5000; // 5 seconds
    private flushTimer?: ReturnType<typeof setTimeout>;

    constructor(options: TransportOptions) {
        this.dsn = options.dsn;
        this.debug = options.debug ?? false;

        // Parse DSN to construct endpoint
        // DSN format: https://<api-key>@statly.live/<org-slug>
        // API endpoint: /api/v1/observe/ingest
        this.endpoint = this.parseEndpoint(options.dsn);

        // Start flush timer
        this.startFlushTimer();
    }

    private parseEndpoint(dsn: string): string {
        try {
            const url = new URL(dsn);
            // Construct the ingest endpoint on the same host
            return `${url.protocol}//${url.host}/api/v1/observe/ingest`;
        } catch {
            // Fallback - assume it's just the org slug
            return `https://statly.live/api/v1/observe/ingest`;
        }
    }

    private startFlushTimer(): void {
        if (typeof window !== 'undefined') {
            this.flushTimer = setInterval(() => {
                this.flush();
            }, this.flushInterval);
        }
    }

    /**
     * Add an event to the queue
     */
    enqueue(event: StatlyEvent): void {
        if (this.queue.length >= this.maxQueueSize) {
            // Drop oldest event if queue is full
            this.queue.shift();
            if (this.debug) {
                console.warn('[Statly] Event queue full, dropping oldest event');
            }
        }

        this.queue.push(event);

        // Flush immediately if queue has enough events
        if (this.queue.length >= 10) {
            this.flush();
        }
    }

    /**
     * Send a single event immediately
     */
    async send(event: StatlyEvent): Promise<TransportResult> {
        return this.sendBatch([event]);
    }

    /**
     * Flush all queued events
     */
    async flush(): Promise<void> {
        if (this.isSending || this.queue.length === 0) {
            return;
        }

        this.isSending = true;
        const events = [...this.queue];
        this.queue = [];

        try {
            await this.sendBatch(events);
        } catch (error) {
            // Put events back in queue on failure
            this.queue = [...events, ...this.queue].slice(0, this.maxQueueSize);
            if (this.debug) {
                console.error('[Statly] Failed to send events:', error);
            }
        } finally {
            this.isSending = false;
        }
    }

    /**
     * Send a batch of events
     */
    private async sendBatch(events: StatlyEvent[]): Promise<TransportResult> {
        if (events.length === 0) {
            return { success: true };
        }

        const payload = events.length === 1 ? events[0] : { events };

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Statly-DSN': this.dsn,
                },
                body: JSON.stringify(payload),
                // Use keepalive for better reliability during page unload
                keepalive: true,
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                if (this.debug) {
                    console.error('[Statly] API error:', response.status, errorText);
                }
                return {
                    success: false,
                    status: response.status,
                    error: errorText,
                };
            }

            if (this.debug) {
                console.log(`[Statly] Sent ${events.length} event(s)`);
            }

            return { success: true, status: response.status };
        } catch (error) {
            if (this.debug) {
                console.error('[Statly] Network error:', error);
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error',
            };
        }
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        // Attempt final flush
        this.flush();
    }
}
