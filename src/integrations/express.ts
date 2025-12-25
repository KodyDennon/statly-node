/**
 * Express.js Integration
 *
 * Provides middleware for error handling in Express applications.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { Statly, expressErrorHandler, requestHandler } from '@statly/observe-sdk';
 *
 * const app = express();
 *
 * // Initialize Statly
 * Statly.init({ dsn: 'your-dsn' });
 *
 * // Add request handler first (optional, for request context)
 * app.use(requestHandler());
 *
 * // Your routes here
 * app.get('/', (req, res) => { ... });
 *
 * // Add error handler last
 * app.use(expressErrorHandler());
 * ```
 */

import { Statly } from '../index';

interface ExpressRequest {
    method: string;
    url: string;
    originalUrl?: string;
    path?: string;
    headers: Record<string, string | string[] | undefined>;
    query?: Record<string, string>;
    params?: Record<string, string>;
    body?: unknown;
    ip?: string;
    user?: { id?: string; email?: string; [key: string]: unknown };
    session?: { id?: string; [key: string]: unknown };
    statlyContext?: {
        transactionName?: string;
        startTime?: number;
    };
}

interface ExpressResponse {
    statusCode: number;
    headersSent: boolean;
    on(event: string, callback: () => void): void;
}

type NextFunction = (err?: Error | unknown) => void;

type RequestHandler = (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => void;
type ErrorHandler = (err: Error | unknown, req: ExpressRequest, res: ExpressResponse, next: NextFunction) => void;

/**
 * Request handler middleware
 * Adds request context and timing information
 */
export function requestHandler(): RequestHandler {
    return (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        // Store request start time
        req.statlyContext = {
            transactionName: `${req.method} ${req.path || req.url}`,
            startTime: Date.now(),
        };

        // Add request breadcrumb
        Statly.addBreadcrumb({
            category: 'http',
            message: `${req.method} ${req.originalUrl || req.url}`,
            level: 'info',
            data: {
                method: req.method,
                url: req.originalUrl || req.url,
            },
        });

        // Set user from session if available
        if (req.user) {
            Statly.setUser({
                id: req.user.id?.toString(),
                email: req.user.email?.toString(),
            });
        }

        // Track response
        res.on('finish', () => {
            const duration = req.statlyContext?.startTime
                ? Date.now() - req.statlyContext.startTime
                : undefined;

            Statly.addBreadcrumb({
                category: 'http',
                message: `Response ${res.statusCode}`,
                level: res.statusCode >= 400 ? 'error' : 'info',
                data: {
                    statusCode: res.statusCode,
                    duration,
                },
            });
        });

        next();
    };
}

/**
 * Error handler middleware
 * Captures errors and sends them to Statly
 */
export function expressErrorHandler(options: {
    shouldHandleError?: (error: Error) => boolean;
} = {}): ErrorHandler {
    return (err: Error | unknown, req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        const error = err instanceof Error ? err : new Error(String(err));

        // Check if we should handle this error
        if (options.shouldHandleError && !options.shouldHandleError(error)) {
            return next(err);
        }

        // Build context from request
        const context: Record<string, unknown> = {
            request: {
                method: req.method,
                url: req.originalUrl || req.url,
                headers: sanitizeHeaders(req.headers),
                query: req.query,
                data: sanitizeBody(req.body),
            },
        };

        // Add IP if available
        if (req.ip) {
            context.ip = req.ip;
        }

        // Add user info if available
        if (req.user) {
            Statly.setUser({
                id: req.user.id?.toString(),
                email: req.user.email?.toString(),
            });
        }

        // Set transaction name tag
        if (req.statlyContext?.transactionName) {
            Statly.setTag('transaction', req.statlyContext.transactionName);
        }

        // Capture the exception
        Statly.captureException(error, context);

        // Continue to the next error handler
        next(err);
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

/**
 * Sanitize request body
 */
function sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') {
        return body;
    }

    const sensitiveFields = ['password', 'secret', 'token', 'apiKey', 'api_key', 'credit_card', 'creditCard', 'ssn'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
        if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
            sanitized[key] = '[Filtered]';
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeBody(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}
