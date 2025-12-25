/**
 * Fastify Integration
 *
 * Provides plugin for error handling in Fastify applications.
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { Statly } from '@statly/observe-sdk';
 * import { statlyFastifyPlugin } from '@statly/observe-sdk/fastify';
 *
 * const fastify = Fastify();
 *
 * // Initialize Statly
 * Statly.init({ dsn: 'your-dsn' });
 *
 * // Register the plugin
 * fastify.register(statlyFastifyPlugin);
 *
 * // Your routes here
 * fastify.get('/', async (request, reply) => { ... });
 * ```
 */

import { Statly } from '../index';

interface FastifyRequest {
    id: string;
    method: string;
    url: string;
    routerPath?: string;
    headers: Record<string, string | string[] | undefined>;
    query?: Record<string, string>;
    params?: Record<string, string>;
    body?: unknown;
    ip?: string;
    ips?: string[];
}

interface FastifyReply {
    statusCode: number;
    sent: boolean;
}

interface FastifyError extends Error {
    statusCode?: number;
    code?: string;
    validation?: unknown[];
}

interface FastifyInstance {
    addHook(hook: string, handler: (request: FastifyRequest, reply: FastifyReply, done: () => void) => void): void;
    setErrorHandler(handler: (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => void): void;
    decorate(name: string, value: unknown): void;
}

interface StatlyFastifyPluginOptions {
    /**
     * Whether to capture validation errors (default: true)
     */
    captureValidationErrors?: boolean;

    /**
     * Custom function to determine if an error should be captured
     */
    shouldCapture?: (error: FastifyError) => boolean;

    /**
     * Skip capturing errors with these status codes
     */
    skipStatusCodes?: number[];
}

/**
 * Fastify plugin for Statly error tracking
 */
export function statlyFastifyPlugin(
    fastify: FastifyInstance,
    options: StatlyFastifyPluginOptions,
    done: () => void
): void {
    const {
        captureValidationErrors = true,
        shouldCapture,
        skipStatusCodes = [400, 401, 403, 404],
    } = options;

    // Add request hook for breadcrumbs and timing
    fastify.addHook('onRequest', (request: FastifyRequest, _reply: FastifyReply, hookDone: () => void) => {
        // Store start time on request
        (request as FastifyRequest & { statlyStartTime?: number }).statlyStartTime = Date.now();

        // Add breadcrumb for request
        Statly.addBreadcrumb({
            category: 'http',
            message: `${request.method} ${request.routerPath || request.url}`,
            level: 'info',
            data: {
                method: request.method,
                url: request.url,
                routerPath: request.routerPath,
                requestId: request.id,
            },
        });

        hookDone();
    });

    // Add response hook
    fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, hookDone: () => void) => {
        const startTime = (request as FastifyRequest & { statlyStartTime?: number }).statlyStartTime;
        const duration = startTime ? Date.now() - startTime : undefined;

        Statly.addBreadcrumb({
            category: 'http',
            message: `Response ${reply.statusCode}`,
            level: reply.statusCode >= 400 ? 'error' : 'info',
            data: {
                statusCode: reply.statusCode,
                duration,
                requestId: request.id,
            },
        });

        hookDone();
    });

    // Set error handler
    fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
        // Check if we should skip this error
        const statusCode = error.statusCode || 500;

        if (skipStatusCodes.includes(statusCode)) {
            throw error; // Re-throw to use default handler
        }

        // Skip validation errors if configured
        if (!captureValidationErrors && error.validation) {
            throw error;
        }

        // Check custom shouldCapture
        if (shouldCapture && !shouldCapture(error)) {
            throw error;
        }

        // Build context
        const context: Record<string, unknown> = {
            request: {
                id: request.id,
                method: request.method,
                url: request.url,
                routerPath: request.routerPath,
                headers: sanitizeHeaders(request.headers),
                query: request.query,
                params: request.params,
            },
            error: {
                statusCode: error.statusCode,
                code: error.code,
            },
        };

        // Add IP if available
        if (request.ip) {
            context.ip = request.ip;
        }

        // Add validation details if present
        if (error.validation) {
            context.validation = error.validation;
        }

        // Set tags
        Statly.setTag('http.method', request.method);
        Statly.setTag('http.url', request.routerPath || request.url);
        Statly.setTag('http.status_code', String(statusCode));

        // Capture the exception
        Statly.captureException(error, context);

        // Re-throw for Fastify's default error handling
        throw error;
    });

    done();
}

/**
 * Alternative export as a standard Fastify plugin
 */
export const statlyPlugin = statlyFastifyPlugin;

/**
 * Create a request-scoped error capture function
 */
export function createRequestCapture(request: FastifyRequest) {
    return (error: Error, additionalContext?: Record<string, unknown>) => {
        const context: Record<string, unknown> = {
            request: {
                id: request.id,
                method: request.method,
                url: request.url,
                routerPath: request.routerPath,
            },
            ...additionalContext,
        };

        return Statly.captureException(error, context);
    };
}

/**
 * Sanitize headers to remove sensitive information
 */
function sanitizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string | string[] | undefined> {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    const sanitized: Record<string, string | string[] | undefined> = {};

    for (const [key, value] of Object.entries(headers)) {
        if (sensitiveHeaders.includes(key.toLowerCase())) {
            sanitized[key] = '[Filtered]';
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}
