/**
 * Statly Observe SDK
 *
 * Error tracking and monitoring for JavaScript applications.
 *
 * @example
 * ```typescript
 * import { Statly } from '@statly/observe-sdk';
 *
 * Statly.init({
 *   dsn: 'https://sk_live_xxx@statly.live/your-org',
 *   release: '1.0.0',
 *   environment: 'production',
 * });
 *
 * // Errors are captured automatically
 *
 * // Manual capture
 * try {
 *   riskyOperation();
 * } catch (error) {
 *   Statly.captureException(error);
 * }
 *
 * // Capture a message
 * Statly.captureMessage('Something happened', 'warning');
 *
 * // Set user context
 * Statly.setUser({
 *   id: 'user-123',
 *   email: 'user@example.com',
 * });
 *
 * // Add breadcrumb
 * Statly.addBreadcrumb({
 *   category: 'auth',
 *   message: 'User logged in',
 * });
 * ```
 */

import { StatlyClient } from './client';
import type { StatlyOptions, User, Breadcrumb, EventLevel } from './types';

// Global client instance
let client: StatlyClient | null = null;

/**
 * Load DSN from environment variables
 * Checks: STATLY_DSN, NEXT_PUBLIC_STATLY_DSN, STATLY_OBSERVE_DSN
 */
function loadDsnFromEnv(): string | undefined {
    // Node.js environment
    if (typeof process !== 'undefined' && process.env) {
        return (
            process.env.STATLY_DSN ||
            process.env.NEXT_PUBLIC_STATLY_DSN ||
            process.env.STATLY_OBSERVE_DSN
        );
    }
    return undefined;
}

/**
 * Load environment from environment variables
 */
function loadEnvironmentFromEnv(): string | undefined {
    if (typeof process !== 'undefined' && process.env) {
        return (
            process.env.STATLY_ENVIRONMENT ||
            process.env.NODE_ENV
        );
    }
    return undefined;
}

/**
 * Initialize the Statly SDK
 *
 * DSN can be passed explicitly or loaded from environment variables:
 * - STATLY_DSN
 * - NEXT_PUBLIC_STATLY_DSN (for Next.js)
 * - STATLY_OBSERVE_DSN
 *
 * @example
 * // Explicit DSN
 * Statly.init({ dsn: 'https://sk_live_xxx@statly.live/your-org' });
 *
 * // Auto-load from .env
 * Statly.init(); // Uses STATLY_DSN from environment
 */
function init(options?: Partial<StatlyOptions>): void {
    if (client) {
        console.warn('[Statly] SDK already initialized. Call close() first to reinitialize.');
        return;
    }

    // Auto-load DSN from environment if not provided
    const dsn = options?.dsn || loadDsnFromEnv();
    if (!dsn) {
        console.error('[Statly] No DSN provided. Set STATLY_DSN in your environment or pass dsn to init().');
        console.error('[Statly] Get your DSN at https://statly.live/dashboard/observe/setup');
        return;
    }

    // Auto-load environment from env if not provided
    const environment = options?.environment || loadEnvironmentFromEnv();

    const finalOptions = {
        ...options,
        dsn,
        environment,
    };

    client = new StatlyClient(finalOptions as StatlyOptions & { dsn: string });
    client.init();
}

/**
 * Capture an exception
 */
function captureException(error: Error | unknown, context?: Record<string, unknown>): string {
    if (!client) {
        console.warn('[Statly] SDK not initialized. Call Statly.init() first.');
        return '';
    }
    return client.captureException(error, context);
}

/**
 * Capture a message
 */
function captureMessage(message: string, level: EventLevel = 'info'): string {
    if (!client) {
        console.warn('[Statly] SDK not initialized. Call Statly.init() first.');
        return '';
    }
    return client.captureMessage(message, level);
}

/**
 * Set user context
 */
function setUser(user: User | null): void {
    if (!client) {
        console.warn('[Statly] SDK not initialized. Call Statly.init() first.');
        return;
    }
    client.setUser(user);
}

/**
 * Set a tag
 */
function setTag(key: string, value: string): void {
    if (!client) {
        console.warn('[Statly] SDK not initialized. Call Statly.init() first.');
        return;
    }
    client.setTag(key, value);
}

/**
 * Set multiple tags
 */
function setTags(tags: Record<string, string>): void {
    if (!client) {
        console.warn('[Statly] SDK not initialized. Call Statly.init() first.');
        return;
    }
    client.setTags(tags);
}

/**
 * Add a breadcrumb
 */
function addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    if (!client) {
        console.warn('[Statly] SDK not initialized. Call Statly.init() first.');
        return;
    }
    client.addBreadcrumb(breadcrumb);
}

/**
 * Flush pending events
 */
async function flush(): Promise<void> {
    if (!client) {
        return;
    }
    await client.flush();
}

/**
 * Close the SDK and flush pending events
 */
async function close(): Promise<void> {
    if (!client) {
        return;
    }
    await client.close();
    client = null;
}

/**
 * Get the current client instance
 */
function getClient(): StatlyClient | null {
    return client;
}

/**
 * Execute a function within a trace span
 */
async function trace<T>(
    name: string,
    operation: (span: import('./span').Span) => Promise<T> | T,
    tags?: Record<string, string>
): Promise<T> {
    if (!client) {
        return operation(null as any);
    }
    return client.trace(name, operation, tags);
}

/**
 * Start a new tracing span
 */
function startSpan(name: string, tags?: Record<string, string>): import('./span').Span | null {
    if (!client) return null;
    return client.startSpan(name, tags);
}

/**
 * Capture a completed span
 */
function captureSpan(span: import('./span').Span): string {
    if (!client) return '';
    return client.captureSpan(span);
}

// Export as namespace-like object
export const Statly = {
    init,
    captureException,
    captureMessage,
    setUser,
    setTag,
    setTags,
    addBreadcrumb,
    flush,
    close,
    getClient,
    trace,
    startSpan,
    captureSpan,
} as const;

// Also export individual functions and types
export {
    init,
    captureException,
    captureMessage,
    setUser,
    setTag,
    setTags,
    addBreadcrumb,
    flush,
    close,
    getClient,
    trace,
    startSpan,
    captureSpan,
};

export { StatlyClient } from './client';
export type {
    StatlyOptions,
    StatlyEvent,
    User,
    Breadcrumb,
    EventLevel,
    BrowserInfo,
    OSInfo,
    DeviceInfo,
    StackFrame,
    Exception,
} from './types';

// Framework integrations
export { requestHandler, expressErrorHandler } from './integrations/express';
export {
    withStatly,
    withStatlyPagesApi,
    withStatlyGetServerSideProps,
    withStatlyGetStaticProps,
    withStatlyServerAction,
    captureNextJsError,
} from './integrations/nextjs';
export { statlyFastifyPlugin, statlyPlugin, createRequestCapture } from './integrations/fastify';
