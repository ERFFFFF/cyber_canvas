/**
 * MitreSeverity.ts - Severity classification and CSS styling helpers
 *
 * Provides utility functions for determining severity levels and applying
 * appropriate visual styling to technique elements in the MITRE matrix.
 *
 * Severity Ranking (highest to lowest priority):
 * 1. unknown_technique (4) - Technique ID not in dataset (red)
 * 2. unknown_tactic (3) - Tactic name not recognized (red)
 * 3. mismatch (2) - Both valid but wrong pairing (orange)
 * 4. valid (1) - Correct pairing (green)
 */

import { ValidationSeverity } from './MitreTypes';

/**
 * Whether the severity represents a critical error (red indicator).
 * Critical severities: unknown_technique, unknown_tactic.
 */
export function isCriticalSeverity(severity: string): boolean {
    return severity === 'unknown_technique'
        || severity === 'unknown_tactic';
}

/**
 * Get the appropriate icon for a validation severity level.
 * Critical errors get red circle, warnings get warning triangle.
 */
export function getSeverityIcon(severity: string): string {
    return isCriticalSeverity(severity) ? '🔴' : '⚠️';
}

/**
 * Apply the appropriate CSS validation class based on severity.
 * - valid -> mitre-technique-valid (green)
 * - critical errors -> mitre-technique-error (red)
 * - mismatch -> mitre-technique-warning (orange)
 */
export function applySeverityClass(element: HTMLElement, severity: string): void {
    if (severity === 'valid') {
        element.addClass('mitre-technique-valid');
    } else if (isCriticalSeverity(severity)) {
        element.addClass('mitre-technique-error');
    } else if (severity === 'mismatch') {
        element.addClass('mitre-technique-warning');
    }
}

/**
 * Determines if newSeverity should override existingSeverity when aggregating.
 *
 * When multiple IOC cards reference the same technique with different validation
 * results, the most critical severity is kept. Uses numerical ranking where
 * higher number = more critical error.
 *
 * @param newSeverity - Severity from newly processed card
 * @param existingSeverity - Current aggregated severity for this technique
 * @returns true if newSeverity should replace existingSeverity
 */
export function shouldOverrideSeverity(
    newSeverity: ValidationSeverity,
    existingSeverity: ValidationSeverity
): boolean {
    const severityRank: Record<ValidationSeverity, number> = {
        'unknown_technique': 4,
        'unknown_tactic': 3,
        'mismatch': 2,
        'valid': 1
    };
    return severityRank[newSeverity] > severityRank[existingSeverity];
}
