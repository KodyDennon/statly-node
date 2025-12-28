/**
 * Statly Observe Logger
 *
 * A comprehensive logging framework with multi-destination output,
 * secret scrubbing, sampling, and AI-powered analysis.
 *
 * @example
 * ```typescript
 * import { Logger } from '@statly/observe';
 *
 * // Create a logger with default settings
 * const logger = new Logger({
 *   dsn: 'https://sk_live_xxx@statly.live/your-org',
 *   loggerName: 'my-app',
 *   environment: 'production',
 *   release: '1.0.0',
 * });
 *
 * // Basic logging
 * logger.info('Application started');
 * logger.debug('Processing request', { requestId: '123' });
 * logger.warn('Deprecated API used', { endpoint: '/old-api' });
 * logger.error('Failed to process', { error: 'timeout' });
 *
 * // Log with Error object
 * try {
 *   riskyOperation();
 * } catch (err) {
 *   logger.error(err);
 * }
 *
 * // Audit logging (always logged, never sampled)
 * logger.audit('User login', { userId: '123', ip: '10.0.0.1' });
 *
 * // AI-powered analysis
 * const explanation = await logger.explainError(error);
 * const fix = await logger.suggestFix(error);
 *
 * // Child loggers
 * const requestLogger = logger.child({
 *   name: 'request',
 *   context: { requestId: '456' },
 * });
 * requestLogger.info('Handling request');
 *
 * // Configure destinations
 * logger.addDestination(myCustomDestination);
 *
 * // Cleanup
 * await logger.close();
 * ```
 */

export { Logger } from './logger';
export { Scrubber } from './scrubbing/scrubber';
export { ConsoleDestination } from './destinations/console';
export { ObserveDestination } from './destinations/observe';
export { FileDestination } from './destinations/file';
export { AIFeatures } from './ai';

// Re-export types
export type {
    LogLevel,
    LogEntry,
    LoggerConfig,
    Destination,
    ConsoleDestinationConfig,
    FileDestinationConfig,
    FileRotationConfig,
    ObserveDestinationConfig,
    ScrubbingConfig,
    ScrubPattern,
    ErrorExplanation,
    FixSuggestion,
    LevelSet,
} from './types';

export { LOG_LEVELS, DEFAULT_LEVELS, EXTENDED_LEVELS } from './types';

// Scrubbing utilities
export { SENSITIVE_KEYS, SCRUB_PATTERNS, REDACTED, isSensitiveKey } from './scrubbing/patterns';

// Formatters
export { formatPretty, formatJson, formatJsonPretty, getConsoleMethod } from './formatters/console';

// Create a default logger instance
import { Logger } from './logger';

let defaultLogger: Logger | null = null;

/**
 * Get or create the default logger instance
 */
export function getDefaultLogger(): Logger {
    if (!defaultLogger) {
        defaultLogger = new Logger();
    }
    return defaultLogger;
}

/**
 * Set the default logger instance
 */
export function setDefaultLogger(logger: Logger): void {
    defaultLogger = logger;
}

// Convenience functions using default logger
export function trace(message: string, context?: Record<string, unknown>): void {
    getDefaultLogger().trace(message, context);
}

export function debug(message: string, context?: Record<string, unknown>): void {
    getDefaultLogger().debug(message, context);
}

export function info(message: string, context?: Record<string, unknown>): void {
    getDefaultLogger().info(message, context);
}

export function warn(message: string, context?: Record<string, unknown>): void {
    getDefaultLogger().warn(message, context);
}

export function error(messageOrError: string | Error, context?: Record<string, unknown>): void {
    if (messageOrError instanceof Error) {
        getDefaultLogger().error(messageOrError, context);
    } else {
        getDefaultLogger().error(messageOrError, context);
    }
}

export function fatal(messageOrError: string | Error, context?: Record<string, unknown>): void {
    if (messageOrError instanceof Error) {
        getDefaultLogger().fatal(messageOrError, context);
    } else {
        getDefaultLogger().fatal(messageOrError, context);
    }
}

export function audit(message: string, context?: Record<string, unknown>): void {
    getDefaultLogger().audit(message, context);
}
