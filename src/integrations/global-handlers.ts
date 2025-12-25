/**
 * Global error handler integration
 * Automatically captures unhandled errors and promise rejections
 */

export interface GlobalHandlerOptions {
    onerror?: boolean;
    onunhandledrejection?: boolean;
}

export type ErrorCallback = (error: Error, context?: Record<string, unknown>) => void;

export class GlobalHandlers {
    private originalOnError: OnErrorEventHandler | null = null;
    private originalOnUnhandledRejection: ((event: PromiseRejectionEvent) => void) | null = null;
    private errorCallback: ErrorCallback | null = null;
    private options: GlobalHandlerOptions;

    constructor(options: GlobalHandlerOptions = {}) {
        this.options = {
            onerror: options.onerror !== false,
            onunhandledrejection: options.onunhandledrejection !== false,
        };
    }

    /**
     * Install global error handlers
     */
    install(callback: ErrorCallback): void {
        this.errorCallback = callback;

        if (typeof window === 'undefined') {
            return; // Not in browser environment
        }

        if (this.options.onerror) {
            this.installOnError();
        }

        if (this.options.onunhandledrejection) {
            this.installOnUnhandledRejection();
        }
    }

    /**
     * Uninstall global error handlers
     */
    uninstall(): void {
        if (typeof window === 'undefined') {
            return;
        }

        if (this.originalOnError !== null) {
            window.onerror = this.originalOnError;
            this.originalOnError = null;
        }

        if (this.originalOnUnhandledRejection !== null) {
            window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
            this.originalOnUnhandledRejection = null;
        }

        this.errorCallback = null;
    }

    private installOnError(): void {
        this.originalOnError = window.onerror;

        window.onerror = (
            message: string | Event,
            source?: string,
            lineno?: number,
            colno?: number,
            error?: Error
        ) => {
            // Call original handler first
            if (this.originalOnError) {
                this.originalOnError.call(window, message, source, lineno, colno, error);
            }

            // Capture the error
            if (this.errorCallback) {
                const errorObj = error || new Error(String(message));

                // Add location info if not in stack
                if (!error && source) {
                    (errorObj as Error & { filename?: string; lineno?: number; colno?: number }).filename = source;
                    (errorObj as Error & { lineno?: number }).lineno = lineno;
                    (errorObj as Error & { colno?: number }).colno = colno;
                }

                this.errorCallback(errorObj, {
                    mechanism: { type: 'onerror', handled: false },
                    source,
                    lineno,
                    colno,
                });
            }

            return false; // Don't prevent default error handling
        };
    }

    private installOnUnhandledRejection(): void {
        this.originalOnUnhandledRejection = this.handleUnhandledRejection.bind(this);
        window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    }

    private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
        if (!this.errorCallback) {
            return;
        }

        let error: Error;

        if (event.reason instanceof Error) {
            error = event.reason;
        } else if (typeof event.reason === 'string') {
            error = new Error(event.reason);
        } else {
            error = new Error('Unhandled Promise Rejection');
            (error as Error & { reason: unknown }).reason = event.reason;
        }

        this.errorCallback(error, {
            mechanism: { type: 'onunhandledrejection', handled: false },
        });
    };
}
