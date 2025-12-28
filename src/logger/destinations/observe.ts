/**
 * Observe Destination
 * Sends log entries to Statly Observe backend with batching and sampling
 */

import type { Destination, LogEntry, LogLevel, ObserveDestinationConfig } from '../types';
import { LOG_LEVELS } from '../types';

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL = 5000; // 5 seconds
const DEFAULT_SAMPLING: Partial<Record<LogLevel, number>> = {
    trace: 0.01,  // 1%
    debug: 0.1,   // 10%
    info: 0.5,    // 50%
    warn: 1.0,    // 100%
    error: 1.0,   // 100%
    fatal: 1.0,   // 100%
    audit: 1.0,   // 100% - never sampled
};

export class ObserveDestination implements Destination {
    readonly name = 'observe';
    private config: Required<ObserveDestinationConfig>;
    private dsn: string;
    private endpoint: string;
    private queue: LogEntry[] = [];
    private isFlushing = false;
    private flushTimer?: ReturnType<typeof setInterval>;
    private minLevel: number = 0;

    constructor(dsn: string, config: ObserveDestinationConfig = {}) {
        this.dsn = dsn;
        this.endpoint = this.parseEndpoint(dsn);
        this.config = {
            enabled: config.enabled !== false,
            batchSize: config.batchSize || DEFAULT_BATCH_SIZE,
            flushInterval: config.flushInterval || DEFAULT_FLUSH_INTERVAL,
            sampling: { ...DEFAULT_SAMPLING, ...config.sampling },
            levels: config.levels || ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'audit'],
        };

        this.startFlushTimer();
    }

    /**
     * Parse DSN to construct endpoint
     */
    private parseEndpoint(dsn: string): string {
        try {
            const url = new URL(dsn);
            return `${url.protocol}//${url.host}/api/v1/logs/ingest`;
        } catch {
            return 'https://statly.live/api/v1/logs/ingest';
        }
    }

    /**
     * Start the flush timer
     */
    private startFlushTimer(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }

        // Only start timer in browser or Node.js
        if (typeof setInterval !== 'undefined') {
            this.flushTimer = setInterval(() => {
                this.flush();
            }, this.config.flushInterval);
        }
    }

    /**
     * Write a log entry (queues for batching)
     */
    write(entry: LogEntry): void {
        if (!this.config.enabled) {
            return;
        }

        // Check if level is in allowed levels
        if (!this.config.levels.includes(entry.level)) {
            return;
        }

        // Check minimum level
        if (LOG_LEVELS[entry.level] < this.minLevel) {
            return;
        }

        // Apply sampling (audit logs are never sampled)
        if (entry.level !== 'audit') {
            const sampleRate = this.config.sampling[entry.level] ?? 1.0;
            if (Math.random() > sampleRate) {
                return;
            }
        }

        // Add to queue
        this.queue.push(entry);

        // Flush if batch size reached
        if (this.queue.length >= this.config.batchSize) {
            this.flush();
        }
    }

    /**
     * Flush all queued entries to the server
     */
    async flush(): Promise<void> {
        if (this.isFlushing || this.queue.length === 0) {
            return;
        }

        this.isFlushing = true;
        const entries = [...this.queue];
        this.queue = [];

        try {
            await this.sendBatch(entries);
        } catch (error) {
            // Re-queue entries on failure (with limit)
            const maxQueue = this.config.batchSize * 3;
            this.queue = [...entries, ...this.queue].slice(0, maxQueue);
            console.error('[Statly Logger] Failed to send logs:', error);
        } finally {
            this.isFlushing = false;
        }
    }

    /**
     * Send a batch of entries to the server
     */
    private async sendBatch(entries: LogEntry[]): Promise<void> {
        if (entries.length === 0) {
            return;
        }

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Statly-DSN': this.dsn,
            },
            body: JSON.stringify({ logs: entries }),
            keepalive: true,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    }

    /**
     * Close the destination
     */
    async close(): Promise<void> {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        await this.flush();
    }

    /**
     * Set minimum log level
     */
    setMinLevel(level: LogLevel): void {
        this.minLevel = LOG_LEVELS[level];
    }

    /**
     * Set sampling rate for a level
     */
    setSamplingRate(level: LogLevel, rate: number): void {
        this.config.sampling[level] = Math.max(0, Math.min(1, rate));
    }

    /**
     * Enable or disable the destination
     */
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    /**
     * Get the current queue size
     */
    getQueueSize(): number {
        return this.queue.length;
    }
}
