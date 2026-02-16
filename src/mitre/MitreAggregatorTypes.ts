/**
 * MitreAggregatorTypes.ts - Shared types, constants, and extraction helpers for aggregation
 *
 * Contains the AggregationResult interface, technique ID/name extraction functions,
 * and the TACTIC_ORDER kill chain constant. These are separated from the core
 * aggregation logic so that MitreAggregatorCardProcessing.ts and MitreAggregator.ts
 * can both import them without circular dependencies.
 */

import { IOCNodeData } from '../parsing/IOCParser';
import {
    MitreTechnique,
    MitreTactic,
    ValidationError,
    MissingFieldsResult
} from './MitreTypes';
import { MitreDataset } from './MitreLoader';
import { DEBUG } from '../debug';

// ---------------------------------------------------------------
// Aggregation result
// ---------------------------------------------------------------

/**
 * Result of the aggregation algorithm, containing all data needed
 * for rendering the MITRE matrix and validation errors.
 */
export interface AggregationResult {
    /** All 14 tactics with nested techniques (found and unfound) */
    tactics: MitreTactic[];
    /** Validation errors grouped by technique+severity */
    validationErrors: ValidationError[];
    /** Map of parent technique IDs to their subtechniques */
    subtechniquesMap: Map<string, MitreTechnique[]>;
    /** Map of IOC node IDs to their parsed data (for hover tooltips) */
    iocDataMap: Map<string, IOCNodeData>;
    /** Total count of IOC cards processed */
    iocCount: number;
    /** Information about cards with missing MITRE fields */
    missingFields: MissingFieldsResult;
}

// ---------------------------------------------------------------
// Kill chain sort order
// ---------------------------------------------------------------

/** MITRE kill chain order for sorting tactics left to right (14 tactics). */
export const TACTIC_ORDER = [
    'TA0043', // Reconnaissance
    'TA0042', // Resource Development
    'TA0001', // Initial Access
    'TA0002', // Execution
    'TA0003', // Persistence
    'TA0004', // Privilege Escalation
    'TA0005', // Defense Evasion
    'TA0006', // Credential Access
    'TA0007', // Discovery
    'TA0008', // Lateral Movement
    'TA0009', // Collection
    'TA0011', // Command and Control
    'TA0010', // Exfiltration
    'TA0040'  // Impact
];

// ---------------------------------------------------------------
// Technique ID/name extraction
// ---------------------------------------------------------------

/**
 * Extract technique ID from various input formats.
 *
 * Supported formats:
 * - "T1566" -> "T1566"
 * - "T1566.001" -> "T1566.001"
 * - "T1566 - Phishing" -> "T1566"
 * - "Phishing (T1566)" -> "T1566"
 * - "Phishing" (name only) -> "Phishing" (fallback, will fail validation)
 *
 * NOTE: Technique field is already uppercased by IOCParser for consistency.
 *
 * @param technique - Raw technique string
 * @returns Extracted technique ID or raw string as fallback
 */
export function extractTechniqueId(technique: string): string {
    const idMatch = technique.match(/T\d{4}(?:\.\d{3})?/i);
    if (idMatch) {
        const techniqueId = idMatch[0].toUpperCase();
        if (DEBUG) console.debug('[MitreAggregator] Extracted technique ID:', techniqueId, 'from:', technique);
        return techniqueId;
    }

    if (DEBUG) console.debug('[MitreAggregator] No technique ID found in:', technique, '- using raw string');
    return technique.trim();
}

/**
 * Extract technique name from various input formats.
 *
 * Supported formats:
 * - "T1566 - Phishing" -> "Phishing"
 * - "Phishing (T1566)" -> "Phishing"
 * - "T1566" (ID only) -> lookup name from dataset
 * - "Phishing" (name only) -> "Phishing"
 *
 * @param technique - Raw technique string
 * @param dataset - MITRE dataset for ID-to-name lookup (nullable)
 * @returns Extracted or looked-up technique name
 */
export function extractTechniqueName(technique: string, dataset: MitreDataset | null): string {
    // Format: "T1566 - Phishing" or "T1566.001 - Spearphishing Attachment"
    const dashMatch = technique.match(/T\d{4}(?:\.\d{3})?\s*-\s*(.+)/);
    if (dashMatch) {
        const name = dashMatch[1].trim();
        if (DEBUG) console.debug('[MitreAggregator] Extracted name from dash format:', name);
        return name;
    }

    // Format: "Phishing (T1566)" or "Spearphishing Attachment (T1566.001)"
    const parenMatch = technique.match(/(.+?)\s*\(T\d{4}(?:\.\d{3})?\)/);
    if (parenMatch) {
        const name = parenMatch[1].trim();
        if (DEBUG) console.debug('[MitreAggregator] Extracted name from paren format:', name);
        return name;
    }

    // ID-only format: lookup name from dataset
    const idOnlyMatch = technique.match(/^T\d{4}(?:\.\d{3})?$/);
    if (idOnlyMatch && dataset) {
        const techData = dataset.techniques[idOnlyMatch[0]];
        if (techData) {
            if (DEBUG) console.debug('[MitreAggregator] Looked up name for ID:', idOnlyMatch[0], '->', techData.name);
            return techData.name;
        }
    }

    if (DEBUG) console.debug('[MitreAggregator] Using raw technique string as name:', technique);
    return technique.trim();
}
