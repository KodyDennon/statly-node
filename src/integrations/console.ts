/**
 * Console integration
 * Captures console calls as breadcrumbs
 */

import type { Breadcrumb } from '../types';

export type ConsoleBreadcrumbCallback = (breadcrumb: Omit<Breadcrumb, 'timestamp'>) => void;

type ConsoleMethod = 'debug' | 'info' | 'warn' | 'error' | 'log';

export class ConsoleIntegration {
    private originalMethods: Partial<Record<ConsoleMethod, typeof console.log>> = {};
    private callback: ConsoleBreadcrumbCallback | null = null;
    private levels: ConsoleMethod[] = ['debug', 'info', 'warn', 'error', 'log'];

    /**
     * Install console breadcrumb tracking
     */
    install(callback: ConsoleBreadcrumbCallback, levels?: ConsoleMethod[]): void {
        this.callback = callback;

        if (levels) {
            this.levels = levels;
        }

        if (typeof console === 'undefined') {
            return;
        }

        for (const level of this.levels) {
            this.wrapConsoleMethod(level);
        }
    }

    /**
     * Uninstall console breadcrumb tracking
     */
    uninstall(): void {
        if (typeof console === 'undefined') {
            return;
        }

        for (const level of this.levels) {
            if (this.originalMethods[level]) {
                (console as any)[level] = this.originalMethods[level];
                delete this.originalMethods[level];
            }
        }

        this.callback = null;
    }

    private wrapConsoleMethod(level: ConsoleMethod): void {
        const originalMethod = console[level];
        if (!originalMethod) {
            return;
        }

        this.originalMethods[level] = originalMethod;

        const self = this;
        (console as any)[level] = function (...args: unknown[]) {
            // Create breadcrumb
            if (self.callback) {
                self.callback({
                    category: 'console',
                    message: self.formatArgs(args),
                    level: self.mapLevel(level),
                    data: args.length > 1 ? { arguments: args } : undefined,
                });
            }

            // Call original method
            originalMethod.apply(console, args);
        };
    }

    private formatArgs(args: unknown[]): string {
        return args
            .map((arg) => {
                if (typeof arg === 'string') {
                    return arg;
                }
                if (arg instanceof Error) {
                    return arg.message;
                }
                try {
                    return JSON.stringify(arg);
                } catch {
                    return String(arg);
                }
            })
            .join(' ');
    }

    private mapLevel(consoleLevel: ConsoleMethod): 'debug' | 'info' | 'warning' | 'error' {
        switch (consoleLevel) {
            case 'debug':
                return 'debug';
            case 'info':
            case 'log':
                return 'info';
            case 'warn':
                return 'warning';
            case 'error':
                return 'error';
            default:
                return 'info';
        }
    }
}
