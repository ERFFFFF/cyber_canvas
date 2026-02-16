/**
 * MitreValidation.ts - Technique-tactic validation logic
 *
 * Provides tactic name normalization (handling abbreviations, short names,
 * and full names) and technique-tactic pairing validation with severity levels.
 * Used by MitreAggregator to validate IOC card MITRE fields against the dataset.
 */

import { MitreDataset } from './MitreLoader';
import { DEBUG } from '../debug';

// ---------------------------------------------------------------
// Tactic name normalization
// ---------------------------------------------------------------

/**
 * Normalize tactic name for lookup, handling multiple input formats.
 *
 * Accepts flexible tactic input from users and normalizes it to a tactic ID (e.g., "TA0006").
 * Uses a **three-pass matching strategy** with progressively more flexible rules:
 *
 * **Pass 1: Short Name Match** (e.g., "credential-access", "credentialaccess", "CREDENTIAL_ACCESS")
 * - Normalizes input: lowercase, remove spaces/dashes/underscores
 * - Compares against tactic.short_name (also normalized)
 * - Example: "credential access" → "credentialaccess" → matches "credential-access" → TA0006
 *
 * **Pass 2: Full Name Match** (e.g., "Credential Access")
 * - Same normalization as Pass 1
 * - Compares against tactic.name (normalized)
 * - Example: "Credential-Access" → "credentialaccess" → matches "Credential Access" → TA0006
 *
 * **Pass 3: Abbreviation Match** (e.g., "CA", "CRED", "CRED ACCESS")
 * - Uppercase input, no normalization
 * - Compares against tactic.abbreviations array
 * - Example: "ca" → "CA" → matches abbreviations → TA0006
 *
 * **Why Three Passes?**
 * Allows users to type tactics in any format without needing to know the exact
 * dataset format. All of these inputs resolve to the same tactic:
 * - "Credential Access", "credential-access", "CREDENTIAL_ACCESS"
 * - "CA", "CRED", "CRED ACCESS"
 *
 * @param name - User input tactic string
 * @param dataset - Loaded MITRE dataset
 * @returns Tactic ID (e.g., "TA0006") or null if no match found
 */
export function normalizeTacticName(name: string, dataset: MitreDataset): string | null {
    // Normalize: lowercase, remove spaces/dashes/underscores
    const normalized = name.toLowerCase().replace(/[\s\-_]+/g, '');

    if (DEBUG) console.debug('[MitreLoader] Normalizing tactic:', name, '→', normalized);

    // PASS 1: Check exact match against short_name (e.g., "credential-access")
    for (const [tacticId, tactic] of Object.entries(dataset.tactics)) {
        if (tactic.short_name.replace(/\-/g, '') === normalized) {
            if (DEBUG) console.debug('[MitreLoader] Matched by short_name:', tactic.name, '(' + tacticId + ')');
            return tacticId;
        }
    }

    // PASS 2: Check full name match (e.g., "Credential Access")
    for (const [tacticId, tactic] of Object.entries(dataset.tactics)) {
        if (tactic.name.toLowerCase().replace(/[\s\-_]+/g, '') === normalized) {
            if (DEBUG) console.debug('[MitreLoader] Matched by full name:', tactic.name, '(' + tacticId + ')');
            return tacticId;
        }
    }

    // PASS 3: Check abbreviations (e.g., "CA", "CRED")
    const upper = name.toUpperCase().trim();
    for (const [tacticId, tactic] of Object.entries(dataset.tactics)) {
        if (tactic.abbreviations.includes(upper)) {
            if (DEBUG) console.debug('[MitreLoader] Matched by abbreviation:', upper, '→', tactic.name, '(' + tacticId + ')');
            return tacticId;
        }
    }

    if (DEBUG) console.debug('[MitreLoader] No match found for:', name);
    return null;
}

// ---------------------------------------------------------------
// Technique-tactic validation
// ---------------------------------------------------------------

/**
 * Validate technique-tactic mapping with severity levels.
 *
 * Performs comprehensive validation of a technique-tactic pairing from an IOC card.
 * Returns a severity enum and optional error message for display in the MITRE modal.
 *
 * **Validation Steps (in order):**
 *
 * 1. **Normalize Tactic** - Use normalizeTacticName to resolve tactic ID
 *    - If fails → `unknown_tactic` (red)
 *
 * 2. **Check Technique Exists** - Look up technique ID in dataset
 *    - If not found → `unknown_technique` (red)
 *
 * 3. **Check Technique-Tactic Pairing** - Verify technique.tactics includes tacticId
 *    - If mismatch → `mismatch` (orange) with list of valid tactics
 *
 * 4. **All Checks Pass** → `valid` (green)
 *
 * **Severity Meanings:**
 * - `valid`: Correct pairing (green indicator)
 * - `unknown_technique`: Technique ID not in dataset (red, critical)
 * - `unknown_tactic`: Tactic name/abbreviation not recognized (red, critical)
 * - `mismatch`: Both exist but don't belong together (orange, warning)
 *
 * **Example Validation:**
 * ```
 * validateTechniqueTactic("T1566", "CA", dataset)
 * → { severity: 'valid', tacticId: 'TA0006' }
 *
 * validateTechniqueTactic("T1566", "Execution", dataset)
 * → { severity: 'mismatch', message: '...Valid tactics: Initial Access', tacticId: 'TA0002' }
 * ```
 *
 * @param techniqueId - Technique ID from IOC card (e.g., "T1566")
 * @param tacticInput - Tactic string from IOC card (e.g., "CA", "Credential Access")
 * @param dataset - Loaded MITRE dataset
 * @returns Validation result with severity, optional message, and tacticId
 */
export function validateTechniqueTactic(
    techniqueId: string,
    tacticInput: string,
    dataset: MitreDataset
): {
    severity: 'valid' | 'unknown_technique' | 'unknown_tactic' | 'mismatch';
    message?: string;
    tacticId?: string;
} {
    // STEP 1: Normalize tactic name to tactic ID (e.g., "CA" → "TA0006")
    const tacticId = normalizeTacticName(tacticInput, dataset);

    // Unknown tactic
    if (!tacticId) {
        return {
            severity: 'unknown_tactic',
            message: `Unknown tactic: "${tacticInput}"`
        };
    }

    // STEP 2: Check if technique exists in dataset
    const technique = dataset.techniques[techniqueId];
    if (!technique) {
        return {
            severity: 'unknown_technique',
            message: `Unknown technique: "${techniqueId}"`
        };
    }

    // STEP 3: Check if technique belongs to this tactic
    // Techniques can belong to multiple tactics, so check if tacticId is in the array
    if (!technique.tactics.includes(tacticId)) {
        // Build a helpful error message listing the correct tactics
        const validTactics = technique.tactics
            .map(tid => dataset.tactics[tid]?.name || tid)
            .join(', ');
        return {
            severity: 'mismatch',
            message: `${techniqueId} (${technique.name}) does not belong to ${dataset.tactics[tacticId].name}. Valid tactics: ${validTactics}`,
            tacticId
        };
    }

    // STEP 4: All validation checks passed
    return {
        severity: 'valid',
        tacticId
    };
}
