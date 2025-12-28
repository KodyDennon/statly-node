/**
 * Secret Scrubbing Patterns
 * Built-in regex patterns for detecting and redacting sensitive data
 */

import type { ScrubPattern } from '../types';

// Sensitive key names (case insensitive)
export const SENSITIVE_KEYS = new Set([
    'password',
    'passwd',
    'pwd',
    'secret',
    'api_key',
    'apikey',
    'api-key',
    'token',
    'access_token',
    'accesstoken',
    'refresh_token',
    'auth',
    'authorization',
    'bearer',
    'credential',
    'credentials',
    'private_key',
    'privatekey',
    'private-key',
    'secret_key',
    'secretkey',
    'secret-key',
    'session_id',
    'sessionid',
    'session-id',
    'session',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
]);

// Pattern definitions with regex and description
export const SCRUB_PATTERNS: Record<ScrubPattern, { regex: RegExp; description: string }> = {
    apiKey: {
        regex: /(?:api[_-]?key|apikey)\s*[=:]\s*["']?([a-zA-Z0-9_\-]{20,})["']?/gi,
        description: 'API keys in various formats',
    },
    password: {
        regex: /(?:password|passwd|pwd|secret)\s*[=:]\s*["']?([^"'\s]{3,})["']?/gi,
        description: 'Passwords and secrets',
    },
    token: {
        regex: /(?:bearer\s+|token\s*[=:]\s*["']?)([a-zA-Z0-9_\-\.]{20,})["']?/gi,
        description: 'Bearer tokens and auth tokens',
    },
    creditCard: {
        // Visa, Mastercard, Amex, Discover, etc.
        regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
        description: 'Credit card numbers',
    },
    ssn: {
        regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
        description: 'US Social Security Numbers',
    },
    email: {
        regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
        description: 'Email addresses',
    },
    ipAddress: {
        regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
        description: 'IPv4 addresses',
    },
    awsKey: {
        regex: /(?:AKIA|ABIA|ACCA)[A-Z0-9]{16}/g,
        description: 'AWS Access Key IDs',
    },
    privateKey: {
        regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
        description: 'Private keys in PEM format',
    },
    jwt: {
        regex: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
        description: 'JSON Web Tokens',
    },
};

// Redaction placeholder
export const REDACTED = '[REDACTED]';

/**
 * Check if a key name indicates sensitive data
 */
export function isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return SENSITIVE_KEYS.has(lowerKey);
}

/**
 * Get the regex for a pattern name
 */
export function getPattern(name: ScrubPattern): RegExp {
    const pattern = SCRUB_PATTERNS[name];
    return pattern ? new RegExp(pattern.regex.source, pattern.regex.flags) : new RegExp('(?!)'); // Never matches
}
