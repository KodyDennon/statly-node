/**
 * Statly Observe SDK Types
 */

export interface StatlyOptions {
    /**
     * DSN for your organization: https://<api-key>@statly.live/<org-slug>
     * Can be omitted if STATLY_DSN, NEXT_PUBLIC_STATLY_DSN, or STATLY_OBSERVE_DSN is set in environment
     */
    dsn?: string;

    /** Release/version identifier */
    release?: string;

    /** Environment (e.g., 'production', 'staging', 'development') */
    environment?: string;

    /** Enable debug logging */
    debug?: boolean;

    /** Sample rate for error events (0.0 to 1.0) */
    sampleRate?: number;

    /** Maximum breadcrumbs to capture */
    maxBreadcrumbs?: number;

    /** Auto-attach global error handlers */
    autoCapture?: boolean;

    /** Capture console errors as breadcrumbs */
    captureConsole?: boolean;

    /** Capture XHR/fetch requests as breadcrumbs */
    captureNetwork?: boolean;

    /** Custom tags to attach to all events */
    tags?: Record<string, string>;

    /** Before send hook - return null to drop the event */
    beforeSend?: (event: StatlyEvent) => StatlyEvent | null;
}

export interface User {
    id?: string;
    email?: string;
    name?: string;
    username?: string;
    [key: string]: unknown;
}

export interface Breadcrumb {
    timestamp?: number;
    category?: string;
    message?: string;
    level?: 'debug' | 'info' | 'warning' | 'error';
    data?: Record<string, unknown>;
}

export interface StackFrame {
    filename?: string;
    function?: string;
    lineno?: number;
    colno?: number;
    in_app?: boolean;
    context_line?: string;
    pre_context?: string[];
    post_context?: string[];
}

export interface Exception {
    type?: string;
    value?: string;
    stacktrace?: {
        frames?: StackFrame[];
    };
}

export interface BrowserInfo {
    name?: string;
    version?: string;
}

export interface OSInfo {
    name?: string;
    version?: string;
}

export interface DeviceInfo {
    type?: string;
    model?: string;
    vendor?: string;
}

export interface StatlyEvent {
    message: string;
    timestamp?: number;
    level?: 'debug' | 'info' | 'warning' | 'error' | 'fatal';
    stack?: string;
    exception?: Exception;
    environment?: string;
    release?: string;
    url?: string;
    user?: User;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    breadcrumbs?: Breadcrumb[];
    browser?: BrowserInfo;
    os?: OSInfo;
    device?: DeviceInfo;
    sdk?: {
        name: string;
        version: string;
    };
    fingerprint?: string[];
}

export type EventLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';
