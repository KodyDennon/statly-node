/**
 * Telemetry module for Statly Observe SDK
 */

import { Span, SpanStatus, TraceContext } from './span';

export class TelemetryProvider {
    private static instance: TelemetryProvider;
    private client: any = null;

    private constructor() {}

    static getInstance(): TelemetryProvider {
        if (!TelemetryProvider.instance) {
            TelemetryProvider.instance = new TelemetryProvider();
        }
        return TelemetryProvider.instance;
    }

    setClient(client: any): void {
        this.client = client;
    }

    /**
     * Start a new span
     */
    startSpan(name: string, tags?: Record<string, string>): Span {
        const parent = TraceContext.getActiveSpan();
        
        const traceId = parent ? parent.context.traceId : this.generateId();
        const parentId = parent ? parent.context.spanId : null;
        
        const span = new Span(name, {
            traceId,
            spanId: this.generateId(),
            parentId,
        }, tags);

        TraceContext.setActiveSpan(span);
        return span;
    }

    /**
     * Finish and report a span
     */
    finishSpan(span: Span): void {
        span.finish();
        
        // Restore parent context if possible
        // (In JS, proper async context requires AsyncLocalStorage or manual propagation)
        if (TraceContext.getActiveSpan() === span) {
            TraceContext.setActiveSpan(null); // Simple for now
        }

        if (this.client) {
            this.client.captureSpan(span);
        }
    }

    private generateId(): string {
        return Math.random().toString(16).substring(2, 18);
    }
}

/**
 * Execute a function within a trace span
 */
export async function trace<T>(
    name: string,
    operation: (span: Span) => Promise<T> | T,
    tags?: Record<string, string>
): Promise<T> {
    const provider = TelemetryProvider.getInstance();
    const span = provider.startSpan(name, tags);
    
    try {
        const result = await operation(span);
        return result;
    } catch (error) {
        span.setStatus(SpanStatus.ERROR);
        span.setTag('error', 'true');
        if (error instanceof Error) {
            span.setTag('exception.type', error.name);
            span.setTag('exception.message', error.message);
        }
        throw error;
    } finally {
        provider.finishSpan(span);
    }
}
