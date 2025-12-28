/**
 * Span module for Statly Observe SDK
 * Handles distributed tracing spans
 */

export enum SpanStatus {
    OK = 'ok',
    ERROR = 'error',
}

export interface SpanContext {
    traceId: string;
    spanId: string;
    parentId?: string | null;
}

export interface SpanData {
    name: string;
    traceId: string;
    spanId: string;
    parentId?: string | null;
    startTime: number;
    endTime?: number;
    durationMs?: number;
    status: SpanStatus;
    tags: Record<string, string>;
    metadata: Record<string, unknown>;
}

export class Span {
    public readonly name: string;
    public readonly context: SpanContext;
    public readonly startTime: number;
    private _endTime?: number;
    private _durationMs?: number;
    private _status: SpanStatus = SpanStatus.OK;
    private _tags: Record<string, string> = {};
    private _metadata: Record<string, unknown> = {};
    private _finished = false;

    constructor(name: string, context: SpanContext, tags?: Record<string, string>) {
        this.name = name;
        this.context = context;
        this.startTime = Date.now();
        if (tags) this._tags = { ...tags };
    }

    /**
     * Finish the span and calculate duration
     */
    finish(endTime?: number): void {
        if (this._finished) return;

        this._endTime = endTime || Date.now();
        this._durationMs = this._endTime - this.startTime;
        this._finished = true;
    }

    setTag(key: string, value: string): this {
        this._tags[key] = value;
        return this;
    }

    setMetadata(key: string, value: unknown): this {
        this._metadata[key] = value;
        return this;
    }

    setStatus(status: SpanStatus): this {
        this._status = status;
        return this;
    }

    get status(): SpanStatus {
        return this._status;
    }

    get tags(): Record<string, string> {
        return { ...this._tags };
    }

    get durationMs(): number | undefined {
        return this._durationMs;
    }

    toDict(): SpanData {
        return {
            name: this.name,
            traceId: this.context.traceId,
            spanId: this.context.spanId,
            parentId: this.context.parentId,
            startTime: this.startTime,
            endTime: this._endTime,
            durationMs: this._durationMs,
            status: this._status,
            tags: this._tags,
            metadata: this._metadata,
        };
    }
}

/**
 * Simplified trace context management
 * Use AsyncLocalStorage in Node.js, fall back to global in browser
 */
export class TraceContext {
    private static currentSpan: Span | null = null;

    static getActiveSpan(): Span | null {
        return this.currentSpan;
    }

    static setActiveSpan(span: Span | null): void {
        this.currentSpan = span;
    }
}
