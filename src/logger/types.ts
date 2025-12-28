/**
 * Logger Types
 * Type definitions for the Statly Observe logging framework
 */

// Log levels - syslog compatible with extensions
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'audit';

export const LOG_LEVELS: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5,
    audit: 6, // Special: always logged, never sampled
};

// Level sets
export type LevelSet = 'default' | 'extended' | LogLevel[];
export const DEFAULT_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
export const EXTENDED_LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'audit'];

// Log entry
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: number;
    loggerName?: string;
    context?: Record<string, unknown>;
    tags?: Record<string, string>;
    source?: {
        file?: string;
        line?: number;
        function?: string;
    };
    traceId?: string;
    spanId?: string;
    sessionId?: string;
    environment?: string;
    release?: string;
    sdkName?: string;
    sdkVersion?: string;
}

// Console destination config
export interface ConsoleDestinationConfig {
    enabled?: boolean;
    colors?: boolean;
    format?: 'pretty' | 'json';
    timestamps?: boolean;
    levels?: LogLevel[];
}

// File destination config (Node.js only)
export interface FileDestinationConfig {
    enabled?: boolean;
    path: string;
    format?: 'json' | 'text';
    rotation?: FileRotationConfig;
    levels?: LogLevel[];
}

export interface FileRotationConfig {
    type: 'size' | 'time';
    // Size-based rotation
    maxSize?: string; // '10MB', '100KB', etc.
    maxFiles?: number;
    // Time-based rotation
    interval?: 'hourly' | 'daily' | 'weekly';
    retentionDays?: number;
    // Common
    compress?: boolean;
}

// Observe (remote) destination config
export interface ObserveDestinationConfig {
    enabled?: boolean;
    batchSize?: number;
    flushInterval?: number;
    sampling?: Partial<Record<LogLevel, number>>;
    levels?: LogLevel[];
}

// Scrubbing config
export interface ScrubbingConfig {
    enabled?: boolean;
    patterns?: ScrubPattern[];
    customPatterns?: RegExp[];
    allowlist?: string[];
    customScrubber?: (key: string, value: unknown) => unknown;
}

// Built-in scrub patterns
export type ScrubPattern =
    | 'apiKey'
    | 'password'
    | 'token'
    | 'creditCard'
    | 'ssn'
    | 'email'
    | 'ipAddress'
    | 'awsKey'
    | 'privateKey'
    | 'jwt';

// Logger configuration
export interface LoggerConfig {
    dsn?: string;
    level?: LogLevel;
    levels?: LevelSet;
    loggerName?: string;
    environment?: string;
    release?: string;
    destinations?: {
        console?: ConsoleDestinationConfig;
        file?: FileDestinationConfig;
        observe?: ObserveDestinationConfig;
    };
    scrubbing?: ScrubbingConfig;
    context?: Record<string, unknown>;
    tags?: Record<string, string>;
}

// Destination interface
export interface Destination {
    name: string;
    write(entry: LogEntry): void | Promise<void>;
    flush?(): Promise<void>;
    close?(): Promise<void>;
}

// AI Features
export interface ErrorExplanation {
    summary: string;
    possibleCauses: string[];
    stackAnalysis?: string;
    relatedDocs?: string[];
}

export interface FixSuggestion {
    summary: string;
    suggestedFixes: Array<{
        description: string;
        code?: string;
        confidence: 'high' | 'medium' | 'low';
    }>;
    preventionTips?: string[];
}
