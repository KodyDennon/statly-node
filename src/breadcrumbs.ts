/**
 * Breadcrumb tracking for capturing user journey
 */

import type { Breadcrumb } from './types';

export class BreadcrumbManager {
    private breadcrumbs: Breadcrumb[] = [];
    private maxBreadcrumbs: number;

    constructor(maxBreadcrumbs = 100) {
        this.maxBreadcrumbs = maxBreadcrumbs;
    }

    /**
     * Add a breadcrumb
     */
    add(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
        const crumb: Breadcrumb = {
            timestamp: Date.now(),
            ...breadcrumb,
        };

        this.breadcrumbs.push(crumb);

        // Keep only the most recent breadcrumbs
        if (this.breadcrumbs.length > this.maxBreadcrumbs) {
            this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
        }
    }

    /**
     * Get all breadcrumbs
     */
    getAll(): Breadcrumb[] {
        return [...this.breadcrumbs];
    }

    /**
     * Clear all breadcrumbs
     */
    clear(): void {
        this.breadcrumbs = [];
    }

    /**
     * Set maximum breadcrumbs to keep
     */
    setMaxBreadcrumbs(max: number): void {
        this.maxBreadcrumbs = max;
        if (this.breadcrumbs.length > max) {
            this.breadcrumbs = this.breadcrumbs.slice(-max);
        }
    }
}
