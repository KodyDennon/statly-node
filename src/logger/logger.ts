/**
 * Logger Class
 * Main entry point for the Statly Observe logging framework
 */

import type {
    LoggerConfig,
    LogEntry,
    LogLevel,
    Destination,
    LevelSet,
    ErrorExplanation,
    FixSuggestion,
} from './types';
import { LOG_LEVELS, DEFAULT_LEVELS, EXTENDED_LEVELS } from './types';
import { Scrubber } from './scrubbing/scrubber';
import { ConsoleDestination } from './destinations/console';
import { ObserveDestination } from './destinations/observe';
import { FileDestination } from './destinations/file';
import { AIFeatures, type AIConfig } from './ai';

const SDK_NAME = '@statly/observe';
const SDK_VERSION = '1.1.0';

export class Logger {
    private name: string;
    private config: LoggerConfig;
    private minLevel: number;
    private enabledLevels: Set<LogLevel>;
    private destinations: Destination[] = [];
    private scrubber: Scrubber;
    private ai: AIFeatures | null = null;
    private context: Record<string, unknown> = {};
    private tags: Record<string, string> = {};
    private sessionId?: string;
    private traceId?: string;
    private spanId?: string;

    constructor(config: LoggerConfig = {}) {
        this.name = config.loggerName || 'default';
        this.config = config;
        this.minLevel = LOG_LEVELS[config.level || 'debug'];
        this.enabledLevels = this.parseLevelSet(config.levels || 'default');
        this.scrubber = new Scrubber(config.scrubbing);
        this.context = config.context || {};
        this.tags = config.tags || {};

        // Generate session ID
        this.sessionId = this.generateId();

        // Initialize destinations
        this.initDestinations();

        // Initialize AI features if DSN is provided
        if (config.dsn) {
            this.ai = new AIFeatures(config.dsn);
        }
    }

    /**
     * Parse level set configuration
     */
    private parseLevelSet(levels: LevelSet): Set<LogLevel> {
        if (levels === 'default') {
            return new Set(DEFAULT_LEVELS);
        }
        if (levels === 'extended') {
            return new Set(EXTENDED_LEVELS);
        }
        return new Set(levels);
    }

    /**
     * Initialize destinations from config
     */
    private initDestinations(): void {
        const { destinations } = this.config;

        // Console destination (default enabled)
        if (!destinations || destinations.console?.enabled !== false) {
            this.destinations.push(new ConsoleDestination(destinations?.console));
        }

        // File destination (Node.js only)
        if (destinations?.file?.enabled && destinations.file.path) {
            this.destinations.push(new FileDestination(destinations.file));
        }

        // Observe destination (requires DSN)
        if (this.config.dsn && destinations?.observe?.enabled !== false) {
            this.destinations.push(new ObserveDestination(this.config.dsn, destinations?.observe));
        }
    }

    /**
     * Generate a unique ID
     */
    private generateId(): string {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Check if a level should be logged
     */
    private shouldLog(level: LogLevel): boolean {
        // Audit logs are always logged
        if (level === 'audit') {
            return true;
        }

        // Check minimum level
        if (LOG_LEVELS[level] < this.minLevel) {
            return false;
        }

        // Check enabled levels
        return this.enabledLevels.has(level);
    }

    /**
     * Get source location (if available)
     */
    private getSource(): { file?: string; line?: number; function?: string } | undefined {
        try {
            const err = new Error();
            const stack = err.stack?.split('\n');
            if (!stack || stack.length < 5) return undefined;

            // Find the first non-logger frame
            for (let i = 3; i < stack.length; i++) {
                const frame = stack[i];
                if (!frame.includes('logger.ts') && !frame.includes('Logger.')) {
                    const match = frame.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+)(?::\d+)?\)?/);
                    if (match) {
                        return {
                            function: match[1] || undefined,
                            file: match[2],
                            line: parseInt(match[3], 10),
                        };
                    }
                }
            }
        } catch {
            // Ignore errors
        }
        return undefined;
    }

    /**
     * Create a log entry
     */
    private createEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
        return {
            level,
            message: this.scrubber.scrubMessage(message),
            timestamp: Date.now(),
            loggerName: this.name,
            context: context ? this.scrubber.scrub({ ...this.context, ...context }) : this.scrubber.scrub(this.context),
            tags: this.tags,
            source: this.getSource(),
            traceId: this.traceId,
            spanId: this.spanId,
            sessionId: this.sessionId,
            environment: this.config.environment,
            release: this.config.release,
            sdkName: SDK_NAME,
            sdkVersion: SDK_VERSION,
        };
    }

    /**
     * Write to all destinations
     */
    private write(entry: LogEntry): void {
        for (const dest of this.destinations) {
            try {
                dest.write(entry);
            } catch (error) {
                console.error(`[Statly Logger] Failed to write to ${dest.name}:`, error);
            }
        }
    }

    // ==================== Public Logging Methods ====================

    /**
     * Log a trace message
     */
    trace(message: string, context?: Record<string, unknown>): void {
        if (!this.shouldLog('trace')) return;
        this.write(this.createEntry('trace', message, context));
    }

    /**
     * Log a debug message
     */
    debug(message: string, context?: Record<string, unknown>): void {
        if (!this.shouldLog('debug')) return;
        this.write(this.createEntry('debug', message, context));
    }

    /**
     * Log an info message
     */
    info(message: string, context?: Record<string, unknown>): void {
        if (!this.shouldLog('info')) return;
        this.write(this.createEntry('info', message, context));
    }

    /**
     * Log a warning message
     */
    warn(message: string, context?: Record<string, unknown>): void {
        if (!this.shouldLog('warn')) return;
        this.write(this.createEntry('warn', message, context));
    }

    /**
     * Log an error message
     */
    error(message: string, context?: Record<string, unknown>): void;
    error(error: Error, context?: Record<string, unknown>): void;
    error(messageOrError: string | Error, context?: Record<string, unknown>): void {
        if (!this.shouldLog('error')) return;

        if (messageOrError instanceof Error) {
            const entry = this.createEntry('error', messageOrError.message, {
                ...context,
                stack: messageOrError.stack,
                errorType: messageOrError.name,
            });
            this.write(entry);
        } else {
            this.write(this.createEntry('error', messageOrError, context));
        }
    }

    /**
     * Log a fatal message
     */
    fatal(message: string, context?: Record<string, unknown>): void;
    fatal(error: Error, context?: Record<string, unknown>): void;
    fatal(messageOrError: string | Error, context?: Record<string, unknown>): void {
        if (!this.shouldLog('fatal')) return;

        if (messageOrError instanceof Error) {
            const entry = this.createEntry('fatal', messageOrError.message, {
                ...context,
                stack: messageOrError.stack,
                errorType: messageOrError.name,
            });
            this.write(entry);
        } else {
            this.write(this.createEntry('fatal', messageOrError, context));
        }
    }

    /**
     * Log an audit message (always logged, never sampled)
     */
    audit(message: string, context?: Record<string, unknown>): void {
        // Audit logs bypass level checks
        this.write(this.createEntry('audit', message, context));
    }

    /**
     * Log at a specific level
     */
    log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
        if (!this.shouldLog(level)) return;
        this.write(this.createEntry(level, message, context));
    }

    // ==================== Context & Tags ====================

    /**
     * Set persistent context
     */
    setContext(context: Record<string, unknown>): void {
        this.context = { ...this.context, ...context };
    }

    /**
     * Clear context
     */
    clearContext(): void {
        this.context = {};
    }

    /**
     * Set a tag
     */
    setTag(key: string, value: string): void {
        this.tags[key] = value;
    }

    /**
     * Set multiple tags
     */
    setTags(tags: Record<string, string>): void {
        this.tags = { ...this.tags, ...tags };
    }

    /**
     * Clear tags
     */
    clearTags(): void {
        this.tags = {};
    }

    // ==================== Tracing ====================

    /**
     * Set trace ID for distributed tracing
     */
    setTraceId(traceId: string): void {
        this.traceId = traceId;
    }

    /**
     * Set span ID
     */
    setSpanId(spanId: string): void {
        this.spanId = spanId;
    }

    /**
     * Clear tracing context
     */
    clearTracing(): void {
        this.traceId = undefined;
        this.spanId = undefined;
    }

    // ==================== Child Loggers ====================

    /**
     * Create a child logger with additional context
     */
    child(options: { name?: string; context?: Record<string, unknown>; tags?: Record<string, string> } = {}): Logger {
        const childConfig: LoggerConfig = {
            ...this.config,
            loggerName: options.name || `${this.name}.child`,
            context: { ...this.context, ...options.context },
            tags: { ...this.tags, ...options.tags },
        };

        const child = new Logger(childConfig);
        child.traceId = this.traceId;
        child.spanId = this.spanId;
        child.sessionId = this.sessionId;

        return child;
    }

    // ==================== AI Features ====================

    /**
     * Explain an error using AI
     */
    async explainError(error: Error | string): Promise<ErrorExplanation> {
        if (!this.ai) {
            return {
                summary: 'AI features not available (no DSN configured)',
                possibleCauses: [],
            };
        }
        return this.ai.explainError(error);
    }

    /**
     * Suggest fixes for an error using AI
     */
    async suggestFix(error: Error | string, context?: {
        code?: string;
        file?: string;
        language?: string;
    }): Promise<FixSuggestion> {
        if (!this.ai) {
            return {
                summary: 'AI features not available (no DSN configured)',
                suggestedFixes: [],
            };
        }
        return this.ai.suggestFix(error, context);
    }

    /**
     * Configure AI features
     */
    configureAI(config: AIConfig): void {
        if (this.ai) {
            if (config.apiKey) this.ai.setApiKey(config.apiKey);
            if (config.enabled !== undefined) this.ai.setEnabled(config.enabled);
        }
    }

    // ==================== Destination Management ====================

    /**
     * Add a custom destination
     */
    addDestination(destination: Destination): void {
        this.destinations.push(destination);
    }

    /**
     * Remove a destination by name
     */
    removeDestination(name: string): void {
        this.destinations = this.destinations.filter(d => d.name !== name);
    }

    /**
     * Get all destinations
     */
    getDestinations(): Destination[] {
        return [...this.destinations];
    }

    // ==================== Level Configuration ====================

    /**
     * Set minimum log level
     */
    setLevel(level: LogLevel): void {
        this.minLevel = LOG_LEVELS[level];
    }

    /**
     * Get current minimum level
     */
    getLevel(): LogLevel {
        const entries = Object.entries(LOG_LEVELS) as [LogLevel, number][];
        const entry = entries.find(([, value]) => value === this.minLevel);
        return entry ? entry[0] : 'debug';
    }

    /**
     * Check if a level is enabled
     */
    isLevelEnabled(level: LogLevel): boolean {
        return this.shouldLog(level);
    }

    // ==================== Lifecycle ====================

    /**
     * Flush all destinations
     */
    async flush(): Promise<void> {
        await Promise.all(
            this.destinations
                .filter(d => d.flush)
                .map(d => d.flush!())
        );
    }

    /**
     * Close the logger and all destinations
     */
    async close(): Promise<void> {
        await Promise.all(
            this.destinations
                .filter(d => d.close)
                .map(d => d.close!())
        );
    }

    /**
     * Get logger name
     */
    getName(): string {
        return this.name;
    }

    /**
     * Get session ID
     */
    getSessionId(): string | undefined {
        return this.sessionId;
    }
}
