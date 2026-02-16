/**
 * MitreAggregator.ts - IOC-to-MITRE matrix aggregation algorithm (STEPs 2-5)
 *
 * Implements the core aggregation that builds the complete MITRE ATT&CK matrix
 * from IOC card data. STEP 1 (card processing) is delegated to
 * MitreAggregatorCardProcessing.ts. This module handles:
 *
 * **Algorithm Steps (in this file):**
 * 2. Build full tactic structure from dataset (all 14 tactics)
 * 3. Populate ALL techniques from dataset (found and unfound)
 * 4. Convert to array and sort by kill chain order
 * 5. Collect validation errors for display
 *
 * Types and extraction helpers live in MitreAggregatorTypes.ts.
 */

import { IOCNodeData } from '../parsing/IOCParser';
import {
    MitreTechnique,
    MitreTactic,
    ValidationError
} from './MitreTypes';
import { MitreDataset } from './MitreLoader';
import { DEBUG } from '../debug';

// Re-export types and helpers so existing importers don't break
export { AggregationResult, extractTechniqueId, extractTechniqueName } from './MitreAggregatorTypes';
import { AggregationResult, TACTIC_ORDER } from './MitreAggregatorTypes';
import { buildFoundTechniquesFromIOC } from './MitreAggregatorCardProcessing';

// ---------------------------------------------------------------
// Core aggregation (STEPs 2-5)
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
    if (DEBUG) console.debug('[MitreAggregator] Starting full matrix aggregation with', iocData.length, 'IOC cards');
    if (DEBUG) console.debug('[MitreAggregator] Dataset has', Object.keys(dataset.techniques).length, 'techniques');

    // Build IOC data map for hover tooltips
    const iocDataMap = new Map<string, IOCNodeData>();
    iocData.forEach(ioc => {
        iocDataMap.set(ioc.id, ioc);
    });

    // ---------------------------------------------------------------
    // STEP 1: Build map of found techniques from IOC cards
    // ---------------------------------------------------------------
    // Delegated to MitreAggregatorCardProcessing.buildFoundTechniquesFromIOC()
    const {
        foundTechniques,
        cardValidations,
        missingTacticCards,
        missingTechniqueCards,
        iocCount
    } = buildFoundTechniquesFromIOC(iocData, dataset);

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

    if (DEBUG) console.debug('[MitreAggregator] Full matrix built:', {
        totalTactics: tactics.length,
        totalTechniques: tactics.reduce((sum, t) => sum + t.techniques.length, 0),
        foundTechniques: foundTechniques.size
    });

    // ---------------------------------------------------------------
    // STEP 5: Collect validation errors for display
    // ---------------------------------------------------------------
    // Build the validation errors array for rendering at the top of the modal.
    // Groups errors by technique+severity to avoid duplicates.
    if (DEBUG) console.debug('[MitreAggregator] Collecting validation errors from card-level validation...');
    const validationErrors: ValidationError[] = [];

    const errorsByTechnique = new Map<string, {
        techniqueId: string;
        techniqueName: string;
        severity: 'unknown_technique' | 'unknown_tactic' | 'mismatch';
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

    if (DEBUG) console.debug('[MitreAggregator] Aggregation complete:', {
        errorGroups: validationErrors.length,
        cardsWithErrors: Array.from(cardValidations.values()).filter(v => v.severity !== 'valid').length,
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
