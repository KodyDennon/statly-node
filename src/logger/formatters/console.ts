/**
 * Console Formatter
 * Formats log entries for console output with colors
 */

import type { LogEntry, LogLevel } from '../types';

// ANSI color codes
const COLORS = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',

    // Foreground colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',

    // Background colors
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m',
};

// Level colors
const LEVEL_COLORS: Record<LogLevel, string> = {
    trace: COLORS.gray,
    debug: COLORS.cyan,
    info: COLORS.green,
    warn: COLORS.yellow,
    error: COLORS.red,
    fatal: `${COLORS.bgRed}${COLORS.white}`,
    audit: COLORS.magenta,
};

// Level labels (padded for alignment)
const LEVEL_LABELS: Record<LogLevel, string> = {
    trace: 'TRACE',
    debug: 'DEBUG',
    info: 'INFO ',
    warn: 'WARN ',
    error: 'ERROR',
    fatal: 'FATAL',
    audit: 'AUDIT',
};

export interface ConsoleFormatOptions {
    colors?: boolean;
    timestamps?: boolean;
    showLevel?: boolean;
    showLogger?: boolean;
    showContext?: boolean;
    showSource?: boolean;
}

/**
 * Format a log entry for pretty console output
 */
export function formatPretty(entry: LogEntry, options: ConsoleFormatOptions = {}): string {
    const {
        colors = true,
        timestamps = true,
        showLevel = true,
        showLogger = true,
        showContext = true,
        showSource = false,
    } = options;

    const parts: string[] = [];

    // Timestamp
    if (timestamps) {
        const date = new Date(entry.timestamp);
        const time = date.toISOString().replace('T', ' ').replace('Z', '');
        parts.push(colors ? `${COLORS.dim}${time}${COLORS.reset}` : time);
    }

    // Level
    if (showLevel) {
        const levelColor = colors ? LEVEL_COLORS[entry.level] : '';
        const levelLabel = LEVEL_LABELS[entry.level];
        parts.push(colors ? `${levelColor}${levelLabel}${COLORS.reset}` : levelLabel);
    }

    // Logger name
    if (showLogger && entry.loggerName) {
        parts.push(colors ? `${COLORS.blue}[${entry.loggerName}]${COLORS.reset}` : `[${entry.loggerName}]`);
    }

    // Message
    parts.push(entry.message);

    // Source location
    if (showSource && entry.source) {
        const { file, line, function: fn } = entry.source;
        const loc = [file, line, fn].filter(Boolean).join(':');
        if (loc) {
            parts.push(colors ? `${COLORS.dim}(${loc})${COLORS.reset}` : `(${loc})`);
        }
    }

    let result = parts.join(' ');

    // Context (on new line)
    if (showContext && entry.context && Object.keys(entry.context).length > 0) {
        const contextStr = JSON.stringify(entry.context, null, 2);
        result += '\n' + (colors ? `${COLORS.dim}${contextStr}${COLORS.reset}` : contextStr);
    }

    return result;
}

/**
 * Format a log entry as JSON
 */
export function formatJson(entry: LogEntry): string {
    return JSON.stringify(entry);
}

/**
 * Format a log entry as JSON with pretty printing
 */
export function formatJsonPretty(entry: LogEntry): string {
    return JSON.stringify(entry, null, 2);
}

/**
 * Get the native console method for a log level
 */
export function getConsoleMethod(level: LogLevel): 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace' {
    switch (level) {
        case 'trace':
            return 'trace';
        case 'debug':
            return 'debug';
        case 'info':
            return 'info';
        case 'warn':
            return 'warn';
        case 'error':
        case 'fatal':
            return 'error';
        case 'audit':
            return 'info';
        default:
            return 'log';
    }
}
