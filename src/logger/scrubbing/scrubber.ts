/**
 * Secret Scrubber
 * Detects and redacts sensitive data from log entries
 */

import type { ScrubPattern, ScrubbingConfig } from '../types';
import { SCRUB_PATTERNS, REDACTED, isSensitiveKey } from './patterns';

export class Scrubber {
    private enabled: boolean;
    private patterns: Map<string, RegExp>;
    private customPatterns: RegExp[];
    private allowlist: Set<string>;
    private customScrubber?: (key: string, value: unknown) => unknown;

    constructor(config: ScrubbingConfig = {}) {
        this.enabled = config.enabled !== false;
        this.patterns = new Map();
        this.customPatterns = config.customPatterns || [];
        this.allowlist = new Set((config.allowlist || []).map(k => k.toLowerCase()));
        this.customScrubber = config.customScrubber;

        // Load built-in patterns
        const patternNames = config.patterns || [
            'apiKey',
            'password',
            'token',
            'creditCard',
            'ssn',
            'awsKey',
            'privateKey',
            'jwt',
        ];

        for (const name of patternNames) {
            const pattern = SCRUB_PATTERNS[name as ScrubPattern];
            if (pattern) {
                // Create a new regex instance to avoid shared state
                this.patterns.set(name, new RegExp(pattern.regex.source, pattern.regex.flags));
            }
        }
    }

    /**
     * Scrub sensitive data from a value
     */
    scrub<T>(value: T): T {
        if (!this.enabled) {
            return value;
        }

        return this.scrubValue(value, '') as T;
    }

    /**
     * Scrub a log message string
     */
    scrubMessage(message: string): string {
        if (!this.enabled) {
            return message;
        }

        let result = message;

        // Apply built-in patterns
        for (const [, regex] of this.patterns) {
            result = result.replace(regex, REDACTED);
        }

        // Apply custom patterns
        for (const regex of this.customPatterns) {
            result = result.replace(regex, REDACTED);
        }

        return result;
    }

    /**
     * Recursively scrub sensitive data
     */
    private scrubValue(value: unknown, key: string): unknown {
        // Check allowlist first
        if (key && this.allowlist.has(key.toLowerCase())) {
            return value;
        }

        // Apply custom scrubber if provided
        if (this.customScrubber && key) {
            const result = this.customScrubber(key, value);
            if (result !== value) {
                return result;
            }
        }

        // Check if key indicates sensitive data
        if (key && isSensitiveKey(key)) {
            return REDACTED;
        }

        // Handle different types
        if (value === null || value === undefined) {
            return value;
        }

        if (typeof value === 'string') {
            return this.scrubString(value);
        }

        if (Array.isArray(value)) {
            return value.map((item, index) => this.scrubValue(item, String(index)));
        }

        if (typeof value === 'object') {
            return this.scrubObject(value as Record<string, unknown>);
        }

        return value;
    }

    /**
     * Scrub sensitive patterns from a string
     */
    private scrubString(value: string): string {
        let result = value;

        // Apply built-in patterns
        for (const [, regex] of this.patterns) {
            // Reset regex state and replace
            regex.lastIndex = 0;
            result = result.replace(regex, REDACTED);
        }

        // Apply custom patterns
        for (const regex of this.customPatterns) {
            const newRegex = new RegExp(regex.source, regex.flags);
            result = result.replace(newRegex, REDACTED);
        }

        return result;
    }

    /**
     * Scrub sensitive data from an object
     */
    private scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(obj)) {
            result[key] = this.scrubValue(value, key);
        }

        return result;
    }

    /**
     * Add a custom pattern at runtime
     */
    addPattern(pattern: RegExp): void {
        this.customPatterns.push(pattern);
    }

    /**
     * Add a key to the allowlist
     */
    addToAllowlist(key: string): void {
        this.allowlist.add(key.toLowerCase());
    }

    /**
     * Check if scrubbing is enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Enable or disable scrubbing
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
}
