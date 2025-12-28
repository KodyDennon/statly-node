/**
 * File Destination
 * Writes log entries to files with rotation support (Node.js only)
 */

import type { Destination, LogEntry, LogLevel, FileDestinationConfig, FileRotationConfig } from '../types';
import { LOG_LEVELS } from '../types';
import { formatJson } from '../formatters/console';

// Parse size string to bytes
function parseSize(size: string): number {
    const match = size.match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB|B)?$/i);
    if (!match) return 10 * 1024 * 1024; // Default 10MB

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();

    switch (unit) {
        case 'KB': return value * 1024;
        case 'MB': return value * 1024 * 1024;
        case 'GB': return value * 1024 * 1024 * 1024;
        default: return value;
    }
}

// Format date for file names
function formatDate(date: Date): string {
    return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

export class FileDestination implements Destination {
    readonly name = 'file';
    private config: Required<FileDestinationConfig>;
    private minLevel: number = 0;
    private buffer: string[] = [];
    private currentSize = 0;
    private maxSize: number;
    private lastRotation: Date;
    private rotationInterval: number;
    private writePromise: Promise<void> = Promise.resolve();

    // File system operations (injected for Node.js compatibility)
    private fs: {
        appendFile: (path: string, data: string) => Promise<void>;
        rename: (oldPath: string, newPath: string) => Promise<void>;
        stat: (path: string) => Promise<{ size: number }>;
        mkdir: (path: string, options: { recursive: true }) => Promise<string | undefined>;
        readdir: (path: string) => Promise<string[]>;
        unlink: (path: string) => Promise<void>;
    } | null = null;

    constructor(config: FileDestinationConfig) {
        this.config = {
            enabled: config.enabled !== false,
            path: config.path,
            format: config.format || 'json',
            rotation: config.rotation || { type: 'size', maxSize: '10MB', maxFiles: 5 },
            levels: config.levels || ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'audit'],
        };

        this.maxSize = parseSize(this.config.rotation.maxSize || '10MB');
        this.lastRotation = new Date();
        this.rotationInterval = this.getRotationInterval();

        // Try to load Node.js fs module
        this.initFileSystem();
    }

    /**
     * Initialize file system operations
     */
    private async initFileSystem(): Promise<void> {
        if (typeof process !== 'undefined' && process.versions?.node) {
            try {
                const fs = await import('fs/promises');
                const path = await import('path');

                const fsOps = {
                    appendFile: fs.appendFile,
                    rename: fs.rename,
                    stat: fs.stat,
                    mkdir: (p: string, opts: { recursive: true }) => fs.mkdir(p, opts),
                    readdir: fs.readdir,
                    unlink: fs.unlink,
                };
                this.fs = fsOps;

                // Ensure directory exists
                const dir = path.dirname(this.config.path);
                await fsOps.mkdir(dir, { recursive: true });
            } catch {
                console.warn('[Statly Logger] File destination not available (not Node.js)');
                this.config.enabled = false;
            }
        } else {
            this.config.enabled = false;
        }
    }

    /**
     * Get rotation interval in milliseconds
     */
    private getRotationInterval(): number {
        const { interval } = this.config.rotation;
        switch (interval) {
            case 'hourly': return 60 * 60 * 1000;
            case 'daily': return 24 * 60 * 60 * 1000;
            case 'weekly': return 7 * 24 * 60 * 60 * 1000;
            default: return Infinity;
        }
    }

    /**
     * Write a log entry
     */
    write(entry: LogEntry): void {
        if (!this.config.enabled || !this.fs) {
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
        let line: string;
        if (this.config.format === 'json') {
            line = formatJson(entry);
        } else {
            const date = new Date(entry.timestamp).toISOString();
            line = `${date} [${entry.level.toUpperCase()}] ${entry.loggerName ? `[${entry.loggerName}] ` : ''}${entry.message}`;
            if (entry.context && Object.keys(entry.context).length > 0) {
                line += ` ${JSON.stringify(entry.context)}`;
            }
        }

        // Add to buffer
        this.buffer.push(line + '\n');
        this.currentSize += line.length + 1;

        // Check if we need to write
        if (this.buffer.length >= 100 || this.currentSize >= 64 * 1024) {
            this.scheduleWrite();
        }
    }

    /**
     * Schedule a buffered write
     */
    private scheduleWrite(): void {
        this.writePromise = this.writePromise.then(() => this.writeBuffer());
    }

    /**
     * Write buffer to file
     */
    private async writeBuffer(): Promise<void> {
        if (!this.fs || this.buffer.length === 0) {
            return;
        }

        // Check rotation
        await this.checkRotation();

        const data = this.buffer.join('');
        this.buffer = [];
        this.currentSize = 0;

        try {
            await this.fs.appendFile(this.config.path, data);
        } catch (error) {
            console.error('[Statly Logger] Failed to write to file:', error);
        }
    }

    /**
     * Check if rotation is needed
     */
    private async checkRotation(): Promise<void> {
        if (!this.fs) return;

        const { type } = this.config.rotation;
        let shouldRotate = false;

        if (type === 'size') {
            try {
                const stats = await this.fs.stat(this.config.path);
                shouldRotate = stats.size >= this.maxSize;
            } catch {
                // File doesn't exist yet
            }
        } else if (type === 'time') {
            const now = new Date();
            shouldRotate = now.getTime() - this.lastRotation.getTime() >= this.rotationInterval;
        }

        if (shouldRotate) {
            await this.rotate();
        }
    }

    /**
     * Rotate the log file
     */
    private async rotate(): Promise<void> {
        if (!this.fs) return;

        try {
            const rotatedPath = `${this.config.path}.${formatDate(new Date())}`;
            await this.fs.rename(this.config.path, rotatedPath);
            this.lastRotation = new Date();

            // Clean up old files
            await this.cleanupOldFiles();
        } catch (error) {
            console.error('[Statly Logger] Failed to rotate file:', error);
        }
    }

    /**
     * Clean up old rotated files
     */
    private async cleanupOldFiles(): Promise<void> {
        if (!this.fs) return;

        const { maxFiles, retentionDays } = this.config.rotation;

        try {
            const path = await import('path');
            const dir = path.dirname(this.config.path);
            const basename = path.basename(this.config.path);
            const files = await this.fs.readdir(dir);

            // Find rotated files
            const rotatedFiles = files
                .filter(f => f.startsWith(basename + '.'))
                .map(f => ({ name: f, path: path.join(dir, f) }))
                .sort((a, b) => b.name.localeCompare(a.name));

            // Delete files exceeding maxFiles
            if (maxFiles) {
                for (const file of rotatedFiles.slice(maxFiles)) {
                    await this.fs.unlink(file.path);
                }
            }

            // Delete files exceeding retentionDays
            if (retentionDays) {
                const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
                for (const file of rotatedFiles) {
                    const match = file.name.match(/\.(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})$/);
                    if (match) {
                        const fileDate = new Date(match[1].replace('_', 'T').replace(/-/g, ':'));
                        if (fileDate.getTime() < cutoff) {
                            await this.fs.unlink(file.path);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[Statly Logger] Failed to cleanup old files:', error);
        }
    }

    /**
     * Flush buffered writes
     */
    async flush(): Promise<void> {
        this.scheduleWrite();
        await this.writePromise;
    }

    /**
     * Close the destination
     */
    async close(): Promise<void> {
        await this.flush();
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
}
