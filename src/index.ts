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
 * Initialize the Statly SDK
 */
function init(options: StatlyOptions): void {
    if (client) {
        console.warn('[Statly] SDK already initialized. Call close() first to reinitialize.');
        return;
    }

    client = new StatlyClient(options);
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
