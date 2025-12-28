/**
 * AI Features for Logger
 * Provides AI-powered error explanation and fix suggestions
 */

import type { ErrorExplanation, FixSuggestion, LogEntry } from '../types';

export interface AIConfig {
    enabled?: boolean;
    apiKey?: string;
    model?: string;
    endpoint?: string;
}

export class AIFeatures {
    private config: Required<AIConfig>;
    private dsn: string;

    constructor(dsn: string, config: AIConfig = {}) {
        this.dsn = dsn;
        this.config = {
            enabled: config.enabled ?? true,
            apiKey: config.apiKey || '',
            model: config.model || 'claude-3-haiku-20240307',
            endpoint: config.endpoint || this.parseEndpoint(dsn),
        };
    }

    /**
     * Parse DSN to construct AI endpoint
     */
    private parseEndpoint(dsn: string): string {
        try {
            const url = new URL(dsn);
            return `${url.protocol}//${url.host}/api/v1/logs/ai`;
        } catch {
            return 'https://statly.live/api/v1/logs/ai';
        }
    }

    /**
     * Explain an error using AI
     */
    async explainError(error: Error | LogEntry | string): Promise<ErrorExplanation> {
        if (!this.config.enabled) {
            return {
                summary: 'AI features are disabled',
                possibleCauses: [],
            };
        }

        const errorData = this.normalizeError(error);

        try {
            const response = await fetch(`${this.config.endpoint}/explain`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Statly-DSN': this.dsn,
                    ...(this.config.apiKey && { 'X-AI-API-Key': this.config.apiKey }),
                },
                body: JSON.stringify({
                    error: errorData,
                    model: this.config.model,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('[Statly Logger AI] Failed to explain error:', err);
            return {
                summary: 'Failed to get AI explanation',
                possibleCauses: [],
            };
        }
    }

    /**
     * Suggest fixes for an error using AI
     */
    async suggestFix(error: Error | LogEntry | string, context?: {
        code?: string;
        file?: string;
        language?: string;
    }): Promise<FixSuggestion> {
        if (!this.config.enabled) {
            return {
                summary: 'AI features are disabled',
                suggestedFixes: [],
            };
        }

        const errorData = this.normalizeError(error);

        try {
            const response = await fetch(`${this.config.endpoint}/suggest-fix`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Statly-DSN': this.dsn,
                    ...(this.config.apiKey && { 'X-AI-API-Key': this.config.apiKey }),
                },
                body: JSON.stringify({
                    error: errorData,
                    context,
                    model: this.config.model,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('[Statly Logger AI] Failed to suggest fix:', err);
            return {
                summary: 'Failed to get AI fix suggestion',
                suggestedFixes: [],
            };
        }
    }

    /**
     * Analyze a batch of logs for patterns
     */
    async analyzePatterns(logs: LogEntry[]): Promise<{
        patterns: Array<{
            type: string;
            description: string;
            occurrences: number;
            examples: string[];
        }>;
        summary: string;
        recommendations: string[];
    }> {
        if (!this.config.enabled) {
            return {
                patterns: [],
                summary: 'AI features are disabled',
                recommendations: [],
            };
        }

        try {
            const response = await fetch(`${this.config.endpoint}/analyze-patterns`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Statly-DSN': this.dsn,
                    ...(this.config.apiKey && { 'X-AI-API-Key': this.config.apiKey }),
                },
                body: JSON.stringify({
                    logs: logs.slice(0, 1000), // Limit to 1000 logs
                    model: this.config.model,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('[Statly Logger AI] Failed to analyze patterns:', err);
            return {
                patterns: [],
                summary: 'Failed to analyze patterns',
                recommendations: [],
            };
        }
    }

    /**
     * Normalize error input to a standard format
     */
    private normalizeError(error: Error | LogEntry | string): {
        message: string;
        stack?: string;
        type?: string;
        context?: Record<string, unknown>;
    } {
        if (typeof error === 'string') {
            return { message: error };
        }

        if (error instanceof Error) {
            return {
                message: error.message,
                stack: error.stack,
                type: error.name,
            };
        }

        // LogEntry
        return {
            message: error.message,
            type: error.level,
            context: error.context,
        };
    }

    /**
     * Set API key for AI features
     */
    setApiKey(apiKey: string): void {
        this.config.apiKey = apiKey;
    }

    /**
     * Enable or disable AI features
     */
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    /**
     * Check if AI features are enabled
     */
    isEnabled(): boolean {
        return this.config.enabled;
    }
}
