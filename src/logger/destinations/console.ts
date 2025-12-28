/**
 * Console Destination
 * Outputs log entries to the console with formatting and colors
 */

import type { Destination, LogEntry, LogLevel, ConsoleDestinationConfig } from '../types';
import { LOG_LEVELS } from '../types';
import { formatPretty, formatJson, getConsoleMethod } from '../formatters/console';

export class ConsoleDestination implements Destination {
    readonly name = 'console';
    private config: Required<ConsoleDestinationConfig>;
    private minLevel: number;

    constructor(config: ConsoleDestinationConfig = {}) {
        this.config = {
            enabled: config.enabled !== false,
            colors: config.colors !== false,
            format: config.format || 'pretty',
            timestamps: config.timestamps !== false,
            levels: config.levels || ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'audit'],
        };
        this.minLevel = 0; // Accept all levels by default
    }

    /**
     * Write a log entry to the console
     */
    write(entry: LogEntry): void {
        if (!this.config.enabled) {
            return;
        }

        // Check if level is in allowed levels
        if (!this.config.levels.includes(entry.level)) {
            return;
        }

        // Check minimum level
        if (LOG_LEVELS[entry.level] < this.minLevel) {
            return;
        }

        // Format the entry
        let output: string;
        if (this.config.format === 'json') {
            output = formatJson(entry);
        } else {
            output = formatPretty(entry, {
                colors: this.config.colors && this.supportsColors(),
                timestamps: this.config.timestamps,
            });
        }

        // Get the appropriate console method
        const method = getConsoleMethod(entry.level);

        // Output to console
        console[method](output);
    }

    /**
     * Check if the environment supports colors
     */
    private supportsColors(): boolean {
        // Browser
        if (typeof window !== 'undefined') {
            return true; // Browsers support CSS colors in console
        }

        // Node.js
        if (typeof process !== 'undefined') {
            // Check for TTY
            if (process.stdout && 'isTTY' in process.stdout) {
                return Boolean(process.stdout.isTTY);
            }
            // Check environment variables
            const env = process.env;
            if (env.FORCE_COLOR !== undefined) {
                return env.FORCE_COLOR !== '0';
            }
            if (env.NO_COLOR !== undefined) {
                return false;
            }
            if (env.TERM === 'dumb') {
                return false;
            }
            return true;
        }

        return false;
    }

    /**
     * Set minimum log level
     */
    setMinLevel(level: LogLevel): void {
        this.minLevel = LOG_LEVELS[level];
    }

    /**
     * Enable or disable the destination
     */
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    /**
     * Set color mode
     */
    setColors(enabled: boolean): void {
        this.config.colors = enabled;
    }

    /**
     * Set output format
     */
    setFormat(format: 'pretty' | 'json'): void {
        this.config.format = format;
    }
}
