/**
 * MitreAggregator.ts - IOC-to-MITRE matrix aggregation algorithm
 *
 * Implements the 5-step aggregation that builds the complete MITRE ATT&CK matrix
 * from IOC card data. Processes all IOC cards, validates technique-tactic pairings,
 * and produces the full matrix structure with 14 tactics and ~800+ techniques.
 *
 * **Algorithm Steps:**
 * 1. Build map of found techniques from IOC cards (with validation per card)
 * 2. Build full tactic structure from dataset (all 14 tactics)
 * 3. Populate ALL techniques from dataset (found and unfound)
 * 4. Convert to array and sort by kill chain order
 * 5. Collect validation errors for display
 */

import { IOCNodeData } from '../parsing/IOCParser';
import {
    MitreTechnique,
    MitreTactic,
    ValidationError,
    ValidationSeverity,
    MissingFieldInfo,
    MissingFieldsResult
} from './MitreTypes';
import { shouldOverrideSeverity } from './MitreSeverity';
import {
    MitreDataset,
    validateTechniqueTactic
} from './MitreLoader';
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
    foundTechniques: Map<string, {
        count: number;
        iocCards: string[];
        severity: ValidationSeverity;
        validationMessage?: string;
        userProvidedTactic: string;
    }>,
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
// Kill chain sort order
// ---------------------------------------------------------------

/** MITRE kill chain order for sorting tactics left to right (14 tactics). */
const TACTIC_ORDER = [
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
// Core aggregation
// ---------------------------------------------------------------

/**
 * Aggregate MITRE tactics and techniques from IOC cards into full matrix structure.
 *
 * This is the core aggregation algorithm that builds the complete MITRE ATT&CK matrix
 * showing ALL 14 tactics and ALL ~800+ techniques, with found techniques highlighted
 * and validated.
 *
 * @param iocData - Array of parsed IOC nodes from canvas
 * @param dataset - Loaded MITRE dataset
 * @returns AggregationResult with tactics, errors, subtechniques map, and IOC data map
 */
export function aggregateTacticsTechniques(
    iocData: IOCNodeData[],
    dataset: MitreDataset
): AggregationResult {
    console.log('[MitreAggregator] Starting full matrix aggregation with', iocData.length, 'IOC cards');
    console.log('[MitreAggregator] Dataset has', Object.keys(dataset.techniques).length, 'techniques');

    // Build IOC data map for hover tooltips
    const iocDataMap = new Map<string, IOCNodeData>();
    iocData.forEach(ioc => {
        iocDataMap.set(ioc.id, ioc);
    });

    // ---------------------------------------------------------------
    // STEP 1: Build map of found techniques from IOC cards
    // ---------------------------------------------------------------
    // Loop through all IOC cards and extract MITRE tactic/technique fields.
    // For each unique technique ID, track:
    //   - count: how many IOC cards reference it
    //   - iocCards: array of node IDs
    //   - severity: worst validation result (using shouldOverrideSeverity)
    //   - validationMessage: error message if invalid
    //   - userProvidedTactic: original tactic string from IOC card
    //
    // Also build cardValidations map for per-card error reporting.
    const foundTechniques = new Map<string, {
        count: number;
        iocCards: string[];
        severity: ValidationSeverity;
        validationMessage?: string;
        userProvidedTactic: string;
    }>();

    // Track validation per card for accurate error reporting
    const cardValidations = new Map<string, {
        cardId: string;
        techniqueId: string;
        techniqueName: string;
        tactic: string;
        severity: ValidationSeverity;
        validationMessage?: string;
        iocType: string;
        nodeId: string;
    }>();

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

    console.log('[MitreAggregator] Found', foundTechniques.size, 'unique techniques in IOC cards');

    // ---------------------------------------------------------------
    // STEP 2: Build full tactic structure from dataset
    // ---------------------------------------------------------------
    // Create a MitreTactic entry for ALL 14 tactics in the ATT&CK framework.
    const tacticMap = new Map<string, MitreTactic>();

    Object.values(dataset.tactics).forEach(tacticData => {
        tacticMap.set(tacticData.id, {
            name: tacticData.id,
            displayName: `${tacticData.name} (${tacticData.id})`,
            techniques: []
        });
    });

    // ---------------------------------------------------------------
    // STEP 3: Populate ALL techniques from dataset
    // ---------------------------------------------------------------
    // Loop through ALL ~800+ techniques and add them to their respective
    // tactics. Found techniques get aggregated data from STEP 1; unfound
    // techniques get severity='not_found' (gray).
    const subtechniquesMap = new Map<string, MitreTechnique[]>();

    Object.values(dataset.techniques).forEach(techData => {
        const foundData = foundTechniques.get(techData.id);
        const isFound = !!foundData;

        const techniqueObj: MitreTechnique = {
            id: techData.id,
            name: techData.name,
            tactic: '',
            tacticId: '',
            count: foundData?.count || 0,
            iocCards: foundData?.iocCards || [],
            severity: foundData?.severity || 'not_found',
            validationMessage: foundData?.validationMessage,
            description: techData.description,
            isFound
        };

        // Subtechniques stored separately
        if (techData.parent) {
            if (!subtechniquesMap.has(techData.parent)) {
                subtechniquesMap.set(techData.parent, []);
            }
            if (techData.tactics.length > 0) {
                techniqueObj.tactic = foundData?.userProvidedTactic || techData.tactics[0];
                techniqueObj.tacticId = techData.tactics[0];
            }
            subtechniquesMap.get(techData.parent)!.push(techniqueObj);

            if (DEBUG) console.debug('[MitreAggregator] Added subtechnique:', {
                id: techData.id,
                parent: techData.parent,
                isFound,
                totalSubtechniques: subtechniquesMap.get(techData.parent)!.length
            });
            return; // Skip adding to main tactic list
        }

        // Parent techniques added to ALL their valid tactics
        techData.tactics.forEach(tacticId => {
            if (!tacticMap.has(tacticId)) {
                console.warn('[MitreAggregator] Unknown tactic ID in dataset:', tacticId);
                return;
            }

            const tactic = tacticMap.get(tacticId)!;
            tactic.techniques.push({
                ...techniqueObj,
                tactic: foundData?.userProvidedTactic || tacticId,
                tacticId
            });
        });
    });

    // Debug: Log subtechniques summary
    console.log('[MitreAggregator] Subtechniques aggregation complete:');
    subtechniquesMap.forEach((subs, parentId) => {
        const foundCount = subs.filter(s => s.isFound).length;
        console.log(`  ${parentId}: ${subs.length} total (${foundCount} found, ${subs.length - foundCount} unfound)`);
    });

    // ---------------------------------------------------------------
    // STEP 4: Convert to array and sort by kill chain order
    // ---------------------------------------------------------------
    const tactics = Array.from(tacticMap.values());

    tactics.sort((a, b) => {
        const indexA = TACTIC_ORDER.indexOf(a.name);
        const indexB = TACTIC_ORDER.indexOf(b.name);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    // Sort techniques: found first, then by ID
    tactics.forEach(tactic => {
        tactic.techniques.sort((a, b) => {
            if (a.isFound && !b.isFound) return -1;
            if (!a.isFound && b.isFound) return 1;
            return a.id.localeCompare(b.id);
        });
    });

    console.log('[MitreAggregator] Full matrix built:', {
        totalTactics: tactics.length,
        totalTechniques: tactics.reduce((sum, t) => sum + t.techniques.length, 0),
        foundTechniques: foundTechniques.size
    });

    // ---------------------------------------------------------------
    // STEP 5: Collect validation errors for display
    // ---------------------------------------------------------------
    // Build the validation errors array for rendering at the top of the modal.
    // Groups errors by technique+severity to avoid duplicates.
    console.log('[MitreAggregator] Collecting validation errors from card-level validation...');
    const validationErrors: ValidationError[] = [];

    const errorsByTechnique = new Map<string, {
        techniqueId: string;
        techniqueName: string;
        severity: 'unknown_technique' | 'unknown_tactic' | 'mismatch' | 'empty_tactic';
        message: string;
        cards: Array<{ cardId: string; iocType: string; nodeId: string; }>;
    }>();

    cardValidations.forEach((cardValidation, cardId) => {
        if (cardValidation.severity !== 'valid') {
            const key = `${cardValidation.techniqueId}-${cardValidation.severity}`;

            if (!errorsByTechnique.has(key)) {
                errorsByTechnique.set(key, {
                    techniqueId: cardValidation.techniqueId,
                    techniqueName: cardValidation.techniqueName,
                    severity: cardValidation.severity as any,
                    message: cardValidation.validationMessage || 'Validation error',
                    cards: []
                });
            }

            errorsByTechnique.get(key)!.cards.push({
                cardId: cardValidation.cardId,
                iocType: cardValidation.iocType,
                nodeId: cardValidation.nodeId
            });
        }
    });

    errorsByTechnique.forEach((errorData) => {
        validationErrors.push({
            techniqueId: errorData.techniqueId,
            techniqueName: errorData.techniqueName,
            severity: errorData.severity,
            message: errorData.message,
            iocCards: errorData.cards
        });
    });

    console.log('[MitreAggregator] Found', validationErrors.length, 'validation error groups from', cardValidations.size, 'cards');
    console.log('[MitreAggregator] Cards with errors:', Array.from(cardValidations.values()).filter(v => v.severity !== 'valid').length);
    console.log('[MitreAggregator] Missing fields:', {
        missingTactic: missingTacticCards.length,
        missingTechnique: missingTechniqueCards.length
    });

    return {
        tactics,
        validationErrors,
        subtechniquesMap,
        iocDataMap,
        iocCount,
        missingFields: {
            missingTactic: missingTacticCards,
            missingTechnique: missingTechniqueCards
        }
    };
}
