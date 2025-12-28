/**
 * Statly Observe Client
 * Main SDK entry point for error tracking
 */

import type { StatlyOptions, StatlyEvent, User, Breadcrumb, EventLevel } from './types';
import { Transport } from './transport';
import { BreadcrumbManager } from './breadcrumbs';
import { GlobalHandlers } from './integrations/global-handlers';
import { ConsoleIntegration } from './integrations/console';
import { TelemetryProvider } from './telemetry';
import { Span } from './span';

const SDK_NAME = '@statly/observe-sdk';
const SDK_VERSION = '0.1.0';

export class StatlyClient {
    private options: Required<StatlyOptions> & { dsn: string };
    private transport: Transport;
    private breadcrumbs: BreadcrumbManager;
    private globalHandlers: GlobalHandlers;
    private consoleIntegration: ConsoleIntegration;
    private user: User | null = null;
    private initialized = false;

    constructor(options: StatlyOptions & { dsn: string }) {
        this.options = this.mergeOptions(options);
        this.transport = new Transport({
            dsn: this.options.dsn,
            debug: this.options.debug,
        });
        this.breadcrumbs = new BreadcrumbManager(this.options.maxBreadcrumbs);
        this.globalHandlers = new GlobalHandlers();
        this.consoleIntegration = new ConsoleIntegration();
        TelemetryProvider.getInstance().setClient(this);
    }

    private mergeOptions(options: StatlyOptions & { dsn: string }): Required<StatlyOptions> & { dsn: string } {
        return {
            dsn: options.dsn,
            release: options.release ?? '',
            environment: options.environment ?? this.detectEnvironment(),
            debug: options.debug ?? false,
            sampleRate: options.sampleRate ?? 1.0,
            maxBreadcrumbs: options.maxBreadcrumbs ?? 100,
            autoCapture: options.autoCapture !== false,
            captureConsole: options.captureConsole !== false,
            captureNetwork: options.captureNetwork ?? false,
            tags: options.tags ?? {},
            beforeSend: options.beforeSend ?? ((e) => e),
        };
    }

    private detectEnvironment(): string {
        if (typeof window !== 'undefined') {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return 'development';
            }
            if (window.location.hostname.includes('staging') || window.location.hostname.includes('stage')) {
                return 'staging';
            }
        }
        return 'production';
    }

    /**
     * Initialize the SDK
     */
    init(): void {
        if (this.initialized) {
            if (this.options.debug) {
                console.warn('[Statly] SDK already initialized');
            }
            return;
        }

        this.initialized = true;

        // Install global error handlers
        if (this.options.autoCapture) {
            this.globalHandlers.install((error, context) => {
                this.captureError(error, context);
            });
        }

        // Install console breadcrumb tracking
        if (this.options.captureConsole) {
            this.consoleIntegration.install((breadcrumb) => {
                this.breadcrumbs.add(breadcrumb);
            });
        }

        // Add navigation breadcrumb
        this.addBreadcrumb({
            category: 'navigation',
            message: 'SDK initialized',
            level: 'info',
        });

        if (this.options.debug) {
            console.log('[Statly] SDK initialized', {
                environment: this.options.environment,
                release: this.options.release,
            });
        }
    }

    /**
     * Capture an exception/error
     */
    captureException(error: Error | unknown, context?: Record<string, unknown>): string {
        let errorObj: Error;

        if (error instanceof Error) {
            errorObj = error;
        } else if (typeof error === 'string') {
            errorObj = new Error(error);
        } else {
            errorObj = new Error('Unknown error');
            (errorObj as Error & { originalError: unknown }).originalError = error;
        }

        return this.captureError(errorObj, context);
    }

    /**
     * Capture a message
     */
    captureMessage(message: string, level: EventLevel = 'info'): string {
        const event = this.buildEvent({
            message,
            level,
        });

        return this.sendEvent(event);
    }

    /**
     * Capture a completed span
     */
    captureSpan(span: Span): string {
        const event = this.buildEvent({
            message: `Span: ${span.name}`,
            level: 'span',
            span: span.toDict(),
        });

        return this.sendEvent(event);
    }

    /**
     * Start a new tracing span
     */
    startSpan(name: string, tags?: Record<string, string>): Span {
        return TelemetryProvider.getInstance().startSpan(name, tags);
    }

    /**
     * Execute a function within a trace span
     */
    async trace<T>(
        name: string,
        operation: (span: Span) => Promise<T> | T,
        tags?: Record<string, string>
    ): Promise<T> {
        const { trace: traceFn } = await import('./telemetry');
        return traceFn(name, operation, tags);
    }

    /**
     * Internal method to capture an error
     */
    private captureError(error: Error, context?: Record<string, unknown>): string {
        // Check sample rate
        if (Math.random() > this.options.sampleRate) {
            return '';
        }

        const event = this.buildEvent({
            message: error.message,
            level: 'error',
            stack: error.stack,
            exception: {
                type: error.name,
                value: error.message,
                stacktrace: this.parseStackTrace(error.stack),
            },
            extra: context,
        });

        return this.sendEvent(event);
    }

    /**
     * Build a complete event from partial data
     */
    private buildEvent(partial: Partial<StatlyEvent>): StatlyEvent {
        const event: StatlyEvent = {
            message: partial.message || 'Unknown error',
            timestamp: Date.now(),
            level: partial.level || 'error',
            environment: this.options.environment,
            release: this.options.release || undefined,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
            user: this.user || undefined,
            tags: { ...this.options.tags, ...partial.tags },
            extra: partial.extra,
            breadcrumbs: this.breadcrumbs.getAll(),
            browser: this.getBrowserInfo(),
            os: this.getOSInfo(),
            sdk: {
                name: SDK_NAME,
                version: SDK_VERSION,
            },
            ...partial,
        };

        return event;
    }

    /**
     * Parse a stack trace string into structured frames
     */
    private parseStackTrace(stack?: string): { frames?: Array<{ filename?: string; function?: string; lineno?: number; colno?: number }> } | undefined {
        if (!stack) {
            return undefined;
        }

        const frames: Array<{ filename?: string; function?: string; lineno?: number; colno?: number }> = [];
        const lines = stack.split('\n');

        for (const line of lines) {
            // Chrome/Node format: "at functionName (filename:line:col)"
            const chromeMatch = line.match(/^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
            if (chromeMatch) {
                frames.push({
                    function: chromeMatch[1] || '<anonymous>',
                    filename: chromeMatch[2],
                    lineno: parseInt(chromeMatch[3], 10),
                    colno: parseInt(chromeMatch[4], 10),
                });
                continue;
            }

            // Firefox/Safari format: "functionName@filename:line:col"
            const firefoxMatch = line.match(/^(.+?)@(.+?):(\d+):(\d+)$/);
            if (firefoxMatch) {
                frames.push({
                    function: firefoxMatch[1] || '<anonymous>',
                    filename: firefoxMatch[2],
                    lineno: parseInt(firefoxMatch[3], 10),
                    colno: parseInt(firefoxMatch[4], 10),
                });
            }
        }

        return frames.length > 0 ? { frames } : undefined;
    }

    /**
     * Send an event to the server
     */
    private sendEvent(event: StatlyEvent): string {
        // Apply beforeSend hook
        const processed = this.options.beforeSend(event);
        if (!processed) {
            if (this.options.debug) {
                console.log('[Statly] Event dropped by beforeSend');
            }
            return '';
        }

        // Generate event ID
        const eventId = this.generateEventId();

        // Add breadcrumb for this event
        this.breadcrumbs.add({
            category: 'statly',
            message: `Captured ${event.level}: ${event.message.slice(0, 50)}`,
            level: 'info',
        });

        // Send via transport
        this.transport.enqueue(processed);

        if (this.options.debug) {
            console.log('[Statly] Event captured:', eventId, event.message);
        }

        return eventId;
    }

    private generateEventId(): string {
        return crypto.randomUUID?.() ||
            'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
    }

    /**
     * Set user context
     */
    setUser(user: User | null): void {
        this.user = user;
        if (this.options.debug && user) {
            console.log('[Statly] User set:', user.id || user.email);
        }
    }

    /**
     * Set a single tag
     */
    setTag(key: string, value: string): void {
        this.options.tags[key] = value;
    }

    /**
     * Set multiple tags
     */
    setTags(tags: Record<string, string>): void {
        Object.assign(this.options.tags, tags);
    }

    /**
     * Add a breadcrumb
     */
    addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
        this.breadcrumbs.add(breadcrumb);
    }

    /**
     * Get browser info
     */
    private getBrowserInfo(): { name?: string; version?: string } | undefined {
        if (typeof navigator === 'undefined') {
            return undefined;
        }

        const ua = navigator.userAgent;
        let name = 'Unknown';
        let version = '';

        if (ua.includes('Firefox/')) {
            name = 'Firefox';
            version = ua.split('Firefox/')[1]?.split(' ')[0] || '';
        } else if (ua.includes('Chrome/')) {
            name = 'Chrome';
            version = ua.split('Chrome/')[1]?.split(' ')[0] || '';
        } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
            name = 'Safari';
            version = ua.split('Version/')[1]?.split(' ')[0] || '';
        } else if (ua.includes('Edge/') || ua.includes('Edg/')) {
            name = 'Edge';
            version = ua.split(/Edg?e?\//)[1]?.split(' ')[0] || '';
        }

        return { name, version };
    }

    /**
     * Get OS info
     */
    private getOSInfo(): { name?: string; version?: string } | undefined {
        if (typeof navigator === 'undefined') {
            return undefined;
        }

        const ua = navigator.userAgent;
        let name = 'Unknown';
        let version = '';

        if (ua.includes('Windows')) {
            name = 'Windows';
            const match = ua.match(/Windows NT (\d+\.\d+)/);
            if (match) version = match[1];
        } else if (ua.includes('Mac OS X')) {
            name = 'macOS';
            const match = ua.match(/Mac OS X (\d+[._]\d+)/);
            if (match) version = match[1].replace('_', '.');
        } else if (ua.includes('Linux')) {
            name = 'Linux';
        } else if (ua.includes('Android')) {
            name = 'Android';
            const match = ua.match(/Android (\d+\.\d+)/);
            if (match) version = match[1];
        } else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
            name = 'iOS';
            const match = ua.match(/OS (\d+_\d+)/);
            if (match) version = match[1].replace('_', '.');
        }

        return { name, version };
    }

    /**
     * Flush pending events and clean up
     */
    async close(): Promise<void> {
        this.globalHandlers.uninstall();
        this.consoleIntegration.uninstall();
        await this.transport.flush();
        this.transport.destroy();
        this.initialized = false;
    }

    /**
     * Force flush pending events
     */
    async flush(): Promise<void> {
        await this.transport.flush();
    }
}
