/**
 * GraphTimelineHelpers.ts - Viewport math and formatting utilities for graph timeline
 *
 * Contains pure helper functions used by both GraphTimelineTab and GraphTimelineRendering:
 *   - Padded viewport computation (edge padding so dots don't sit at exact 0%/100%)
 *   - Timestamp formatting for input fields and axis tick labels
 */

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

/**
 * Edge padding as a percentage of the viewport range (8% on each side).
 * This ensures dots at min/max timestamps aren't positioned at exact 0%/100%
 * where they'd be hidden behind the container's 30px horizontal padding.
 */
export const EDGE_PADDING_PERCENT = 0.08;

// ---------------------------------------------------------------
// Padded viewport computation
// ---------------------------------------------------------------

/** Padded viewport range with pre-computed span for positioning calculations. */
export interface PaddedViewport {
    paddedMin: number;
    paddedMax: number;
    paddedSpan: number;
}

/**
 * Compute the padded viewport range from raw view bounds.
 * Adds EDGE_PADDING_PERCENT padding on each side so edge dots are fully visible.
 *
 * @param viewMin - Start timestamp of the current viewport
 * @param viewMax - End timestamp of the current viewport
 * @returns PaddedViewport with min, max, and span including padding
 */
export function computePaddedViewport(viewMin: number, viewMax: number): PaddedViewport {
    const viewSpan = viewMax - viewMin || 1;
    const paddingMs = EDGE_PADDING_PERCENT * viewSpan;
    return {
        paddedMin: viewMin - paddingMs,
        paddedMax: viewMax + paddingMs,
        paddedSpan: (viewMax + paddingMs) - (viewMin - paddingMs)
    };
}

// ---------------------------------------------------------------
// Timestamp formatting
// ---------------------------------------------------------------

/**
 * Format a timestamp for display in input fields (YYYY-MM-DD HH:MM:SS).
 *
 * @param ts - Unix timestamp in milliseconds
 * @returns Formatted string like "2026-02-16 14:30:00"
 */
export function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    return d.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Format a short time label for axis ticks (two-line display).
 * Returns "YYYY-MM-DD\nHH:MM:SS" with newline separator for two-line rendering
 * in the axis tick CSS (white-space: pre-line).
 *
 * @param ts - Unix timestamp in milliseconds
 * @returns Two-line formatted string for axis tick display
 */
export function formatShortTime(ts: number): string {
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    // Return with newline separator for two-line rendering
    return `${year}-${month}-${day}\n${hours}:${minutes}:${seconds}`;
}
