/**
 * Next.js Integration
 *
 * Provides error handling for Next.js applications including
 * API routes and server components.
 *
 * @example
 * ```typescript
 * // In your error.tsx (App Router)
 * 'use client';
 *
 * import { Statly } from '@statly/observe-sdk';
 *
 * export default function Error({
 *   error,
 *   reset,
 * }: {
 *   error: Error & { digest?: string };
 *   reset: () => void;
 * }) {
 *   useEffect(() => {
 *     Statly.captureException(error);
 *   }, [error]);
 *
 *   return <ErrorUI error={error} reset={reset} />;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In your API route
 * import { withStatly } from '@statly/observe-sdk/nextjs';
 *
 * export const GET = withStatly(async (request) => {
 *   // Your handler code
 *   return Response.json({ data: 'ok' });
 * });
 * ```
 */

import { Statly } from '../index';

type NextApiRequest = {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    query?: Record<string, string | string[]>;
    body?: unknown;
};

type NextApiResponse = {
    status: (code: number) => NextApiResponse;
    json: (data: unknown) => void;
    end: () => void;
};

type NextApiHandler<T = unknown> = (
    req: NextApiRequest,
    res: NextApiResponse
) => Promise<T> | T;

/**
 * Wrap a Next.js Pages API route handler with error tracking
 */
export function withStatlyPagesApi<T>(handler: NextApiHandler<T>): NextApiHandler<T> {
    return async (req: NextApiRequest, res: NextApiResponse) => {
        return Statly.trace(`${req.method} ${req.url}`, async (span) => {
            span.setTag('component', 'nextjs-pages-api');
            span.setTag('http.method', req.method || 'GET');
            span.setTag('http.url', req.url || 'unknown');

            // Add request breadcrumb
            Statly.addBreadcrumb({
                category: 'http',
                message: `${req.method} ${req.url}`,
                level: 'info',
                data: {
                    method: req.method,
                    url: req.url,
                },
            });

            try {
                const result = await handler(req, res);
                return result;
            } catch (error) {
                // Build context
                const context: Record<string, unknown> = {
                    request: {
                        method: req.method,
                        url: req.url,
                        headers: sanitizeHeaders(req.headers),
                        query: req.query,
                    },
                };

                // Capture the exception
                Statly.captureException(error, context);

                // Re-throw for Next.js error handling
                throw error;
            }
        });
    };
}

type NextRequest = {
    method: string;
    url: string;
    headers: Headers;
    nextUrl?: {
        pathname: string;
        searchParams: URLSearchParams;
    };
    json: () => Promise<unknown>;
};

type NextRouteHandler = (
    request: NextRequest,
    context?: { params?: Promise<Record<string, string>> }
) => Promise<Response> | Response;

/**
 * Wrap a Next.js App Router handler with error tracking
 */
export function withStatly<T extends NextRouteHandler>(handler: T): T {
    const wrappedHandler = async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
        return Statly.trace(`${request.method} ${request.nextUrl?.pathname || request.url}`, async (span) => {
            span.setTag('component', 'nextjs-app-router');
            span.setTag('http.method', request.method);
            span.setTag('http.url', request.nextUrl?.pathname || request.url);

            // Add request breadcrumb
            Statly.addBreadcrumb({
                category: 'http',
                message: `${request.method} ${request.nextUrl?.pathname || request.url}`,
                level: 'info',
                data: {
                    method: request.method,
                    url: request.nextUrl?.pathname || request.url,
                },
            });

            try {
                const result = await handler(request, context);
                if (result instanceof Response) {
                    span.setTag('http.status_code', result.status.toString());
                }
                return result;
            } catch (error) {
                // Build context
                const headers: Record<string, string> = {};
                request.headers.forEach((value, key) => {
                    headers[key] = value;
                });

                const errorContext: Record<string, unknown> = {
                    request: {
                        method: request.method,
                        url: request.nextUrl?.pathname || request.url,
                        headers: sanitizeHeaders(headers),
                        searchParams: request.nextUrl?.searchParams?.toString(),
                    },
                };

                // Add route params if available
                if (context?.params) {
                    try {
                        errorContext.params = await context.params;
                    } catch {
                        // Ignore errors getting params
                    }
                }

                // Capture the exception
                Statly.captureException(error, errorContext);

                // Re-throw for Next.js error handling
                throw error;
            }
        });
    };

    return wrappedHandler as T;
}

/**
 * Capture errors from Next.js error boundaries
 *
 * @example
 * ```typescript
 * // app/error.tsx
 * 'use client';
 *
 * import { captureNextJsError } from '@statly/observe-sdk/nextjs';
 *
 * export default function Error({
 *   error,
 *   reset,
 * }: {
 *   error: Error & { digest?: string };
 *   reset: () => void;
 * }) {
 *   useEffect(() => {
 *     captureNextJsError(error);
 *   }, [error]);
 *
 *   return <ErrorUI />;
 * }
 * ```
 */
export function captureNextJsError(
    error: Error & { digest?: string },
    context?: Record<string, unknown>
): string {
    return Statly.captureException(error, {
        ...context,
        digest: error.digest,
        source: 'nextjs-error-boundary',
    });
}

/**
 * Capture errors in getServerSideProps
 *
 * @example
 * ```typescript
 * export const getServerSideProps = withStatlyGetServerSideProps(async (context) => {
 *   // Your code here
 *   return { props: {} };
 * });
 * ```
 */
export function withStatlyGetServerSideProps<
    Props extends { [key: string]: unknown },
    Context extends { req?: { url?: string }; resolvedUrl?: string }
>(
    handler: (context: Context) => Promise<{ props: Props } | { redirect: unknown } | { notFound: boolean }>
): (context: Context) => Promise<{ props: Props } | { redirect: unknown } | { notFound: boolean }> {
    return async (context: Context) => {
        try {
            return await handler(context);
        } catch (error) {
            Statly.captureException(error, {
                source: 'getServerSideProps',
                url: context.req?.url || context.resolvedUrl,
            });
            throw error;
        }
    };
}

/**
 * Capture errors in getStaticProps
 *
 * @example
 * ```typescript
 * export const getStaticProps = withStatlyGetStaticProps(async (context) => {
 *   // Your code here
 *   return { props: {} };
 * });
 * ```
 */
export function withStatlyGetStaticProps<
    Props extends { [key: string]: unknown },
    Context extends { params?: Record<string, string> }
>(
    handler: (context: Context) => Promise<{ props: Props; revalidate?: number } | { redirect: unknown } | { notFound: boolean }>
): (context: Context) => Promise<{ props: Props; revalidate?: number } | { redirect: unknown } | { notFound: boolean }> {
    return async (context: Context) => {
        try {
            return await handler(context);
        } catch (error) {
            Statly.captureException(error, {
                source: 'getStaticProps',
                params: context.params,
            });
            throw error;
        }
    };
}

/**
 * Server Action wrapper for error tracking
 *
 * @example
 * ```typescript
 * 'use server';
 *
 * import { withStatlyServerAction } from '@statly/observe-sdk/nextjs';
 *
 * export const submitForm = withStatlyServerAction(async (formData: FormData) => {
 *   // Your code here
 * });
 * ```
 */
export function withStatlyServerAction<Args extends unknown[], Result>(
    action: (...args: Args) => Promise<Result>,
    actionName?: string
): (...args: Args) => Promise<Result> {
    return async (...args: Args) => {
        return Statly.trace(`Action: ${actionName || 'unknown'}`, async (span) => {
            span.setTag('component', 'nextjs-server-action');
            span.setTag('action.name', actionName || 'unknown');

            Statly.addBreadcrumb({
                category: 'action',
                message: `Server action: ${actionName || 'unknown'}`,
                level: 'info',
            });

            try {
                return await action(...args);
            } catch (error) {
                Statly.captureException(error, {
                    source: 'server-action',
                    actionName,
                });
                throw error;
            }
        });
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
