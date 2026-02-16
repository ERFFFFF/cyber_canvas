/**
 * MitreAggregatorCardProcessing.ts - STEP 1: Build found techniques from IOC cards
 *
 * Processes all IOC cards to build the foundTechniques map, card-level validations,
 * and missing field tracking. This is the first step of the 5-step aggregation
 * algorithm, extracted from MitreAggregator.ts for single-responsibility.
 *
 * Handles three cases per card:
 * 1. Empty technique field -> track as missing (informational)
 * 2. Empty tactic field (technique filled) -> track as missing, still highlight technique
 * 3. Both filled -> full validation via MitreLoader.validateTechniqueTactic()
 */

import { IOCNodeData } from '../parsing/IOCParser';
import { ValidationSeverity, MissingFieldInfo } from './MitreTypes';
import { shouldOverrideSeverity } from './MitreSeverity';
import { MitreDataset, validateTechniqueTactic } from './MitreLoader';
import { extractTechniqueId, extractTechniqueName } from './MitreAggregatorTypes';
import { DEBUG } from '../debug';

// ---------------------------------------------------------------
// Found technique entry type
// ---------------------------------------------------------------

/**
 * Tracks aggregated data for a single found technique across all IOC cards.
 * Multiple cards may reference the same technique - counts and severities
 * are aggregated here.
 */
export interface FoundTechniqueEntry {
    /** Number of IOC cards referencing this technique */
    count: number;
    /** IOC card node IDs for tooltip/hover display */
    iocCards: string[];
    /** Worst validation severity across all cards referencing this technique */
    severity: ValidationSeverity;
    /** Error message from the worst-severity validation */
    validationMessage?: string;
    /** Original tactic string from the IOC card */
    userProvidedTactic: string;
}

// ---------------------------------------------------------------
// Card validation entry type
// ---------------------------------------------------------------

/** Per-card validation result used for building error groups in STEP 5. */
export interface CardValidationEntry {
    cardId: string;
    techniqueId: string;
    techniqueName: string;
    tactic: string;
    severity: ValidationSeverity;
    validationMessage?: string;
    iocType: string;
    nodeId: string;
}

// ---------------------------------------------------------------
// Result of STEP 1
// ---------------------------------------------------------------

/** Result of buildFoundTechniquesFromIOC - all data collected in STEP 1. */
export interface BuildFoundResult {
    /** Map of technique ID -> aggregated found data */
    foundTechniques: Map<string, FoundTechniqueEntry>;
    /** Map of node ID -> per-card validation result */
    cardValidations: Map<string, CardValidationEntry>;
    /** Cards missing tactic field (informational) */
    missingTacticCards: MissingFieldInfo[];
    /** Cards missing technique field (informational) */
    missingTechniqueCards: MissingFieldInfo[];
    /** Total IOC cards processed (including those with missing fields) */
    iocCount: number;
}

// ---------------------------------------------------------------
// Parent technique tracking
// ---------------------------------------------------------------

/**
 * Mark parent technique as found when a subtechnique is referenced.
 *
 * When an analyst specifies a subtechnique like T1053.005, both the subtechnique
 * AND its parent (T1053) should be highlighted in the matrix. The parent inherits
 * count from subtechniques but does NOT include IOC card IDs directly (since the
 * card referenced the subtechnique, not the parent).
 *
 * @param techniqueId - The technique ID (may be subtechnique like T1053.005)
 * @param foundTechniques - Map tracking all found techniques
 * @param tactic - The user-provided tactic string
 */
function markParentAsFound(
    techniqueId: string,
    foundTechniques: Map<string, FoundTechniqueEntry>,
    tactic: string
): void {
    // Only applies to subtechniques (IDs containing a dot)
    if (!techniqueId.includes('.')) return;

    // Extract parent ID (e.g., T1053.005 -> T1053)
    const parentId = techniqueId.split('.')[0];

    if (foundTechniques.has(parentId)) {
        const existing = foundTechniques.get(parentId)!;
        existing.count++;
    } else {
        foundTechniques.set(parentId, {
            count: 1,
            iocCards: [],  // Empty - cards reference subtechniques, not parent
            severity: 'valid',
            validationMessage: undefined,
            userProvidedTactic: tactic
        });
    }

    if (DEBUG) console.debug('[MitreAggregator] Marked parent technique as found:', {
        subtechnique: techniqueId,
        parent: parentId,
        tactic: tactic
    });
}

// ---------------------------------------------------------------
// STEP 1: Build found techniques from IOC cards
// ---------------------------------------------------------------

/**
 * Build map of found techniques from IOC cards (STEP 1 of aggregation).
 *
 * Loops through all IOC cards and extracts MITRE tactic/technique fields.
 * For each unique technique ID, tracks count, IOC card IDs, worst severity,
 * and validation messages. Also builds per-card validation entries and
 * tracks cards with missing fields.
 *
 * @param iocData - Array of parsed IOC nodes from canvas
 * @param dataset - Loaded MITRE dataset for validation
 * @returns BuildFoundResult with foundTechniques map, card validations, and missing field info
 */
export function buildFoundTechniquesFromIOC(
    iocData: IOCNodeData[],
    dataset: MitreDataset
): BuildFoundResult {
    const foundTechniques = new Map<string, FoundTechniqueEntry>();

    // Track validation per card for accurate error reporting
    const cardValidations = new Map<string, CardValidationEntry>();

    // Track cards with missing fields (informational, not errors)
    const missingTacticCards: MissingFieldInfo[] = [];
    const missingTechniqueCards: MissingFieldInfo[] = [];

    // Count ALL IOC cards (including those with missing fields)
    let iocCount = 0;

    iocData.forEach(ioc => {
        const rawTactic = (ioc.tactic || '').trim();
        const rawTechnique = (ioc.technique || '').trim();

        if (DEBUG) console.debug('[MitreAggregator] Processing IOC card:', {
            cardId: ioc.cardId || '(no ID)',
            type: ioc.type,
            nodeId: ioc.id,
            rawTactic: rawTactic || '(empty)',
            rawTechnique: rawTechnique || '(empty)'
        });

        // ---------------------------------------------------------------
        // CASE 1: Empty technique field
        // ---------------------------------------------------------------
        // If the technique field is empty, we cannot validate anything.
        // Track as missing (informational) instead of creating an error.
        if (!rawTechnique) {
            if (DEBUG) console.debug('[MitreAggregator] IOC card has empty technique:', ioc.id);

            // Track as missing technique (informational)
            const missingInfo: MissingFieldInfo = {
                cardId: ioc.cardId || ioc.id,
                iocType: ioc.type,
                nodeId: ioc.id,
                missing: !rawTactic ? 'both' : 'technique'
            };
            missingTechniqueCards.push(missingInfo);

            // Also track missing tactic if both are empty
            if (!rawTactic) {
                missingTacticCards.push({...missingInfo, missing: 'both'});
            }

            iocCount++;  // Count this card (was previously skipped)
            return;      // Can't validate without technique, but we've tracked it
        }

        const technique = rawTechnique;
        const techniqueId = extractTechniqueId(technique);
        const techniqueName = extractTechniqueName(technique, dataset);

        // ---------------------------------------------------------------
        // CASE 2: Empty tactic field (but technique is filled)
        // ---------------------------------------------------------------
        // The analyst provided a technique but left the tactic field empty.
        // Track as missing (informational) instead of creating an error.
        if (!rawTactic) {
            if (DEBUG) console.debug('[MitreAggregator] IOC card has empty tactic:', ioc.id);

            // Track as missing tactic (informational, NOT an error)
            missingTacticCards.push({
                cardId: ioc.cardId || ioc.id,
                iocType: ioc.type,
                nodeId: ioc.id,
                missing: 'tactic'
            });

            iocCount++;  // Count this card

            // Still add technique to foundTechniques for matrix highlighting
            // (technique exists, just can't validate tactic relationship)
            if (!foundTechniques.has(techniqueId)) {
                foundTechniques.set(techniqueId, {
                    count: 1,
                    iocCards: [ioc.id],
                    severity: 'valid',  // No severity penalty for missing tactic
                    validationMessage: undefined,
                    userProvidedTactic: '(empty)'
                });
            } else {
                const existing = foundTechniques.get(techniqueId)!;
                existing.count++;
                existing.iocCards.push(ioc.id);
            }

            markParentAsFound(techniqueId, foundTechniques, '(empty)');
            return;  // Skip validation (can't validate without tactic)
        }

        // ---------------------------------------------------------------
        // CASE 3: Both tactic and technique filled - normal validation
        // ---------------------------------------------------------------
        // Standard validation path using MitreLoader.validateTechniqueTactic().
        const tactic = rawTactic;
        const validation = validateTechniqueTactic(techniqueId, tactic, dataset);

        if (DEBUG) console.debug('[MitreAggregator] Validated technique:', {
            cardId: ioc.cardId || ioc.id,
            techniqueId,
            tactic,
            severity: validation.severity,
            message: validation.message || 'valid'
        });

        iocCount++;  // Count this card

        // Always store individual card validation
        cardValidations.set(ioc.id, {
            cardId: ioc.cardId || ioc.id,
            techniqueId,
            techniqueName,
            tactic,
            severity: validation.severity,
            validationMessage: validation.message,
            iocType: ioc.type,
            nodeId: ioc.id
        });

        // Existing foundTechniques aggregation (for matrix coloring)
        if (foundTechniques.has(techniqueId)) {
            const existing = foundTechniques.get(techniqueId)!;
            existing.count++;
            existing.iocCards.push(ioc.id);
            if (shouldOverrideSeverity(validation.severity, existing.severity)) {
                existing.severity = validation.severity;
                existing.validationMessage = validation.message;
            }
        } else {
            foundTechniques.set(techniqueId, {
                count: 1,
                iocCards: [ioc.id],
                severity: validation.severity,
                validationMessage: validation.message,
                userProvidedTactic: tactic
            });
        }

        markParentAsFound(techniqueId, foundTechniques, tactic);
    });

    if (DEBUG) console.debug('[MitreAggregator] Found', foundTechniques.size, 'unique techniques in IOC cards');

    return {
        foundTechniques,
        cardValidations,
        missingTacticCards,
        missingTechniqueCards,
        iocCount
    };
}
