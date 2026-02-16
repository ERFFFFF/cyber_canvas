/**
 * IOCParser.ts - Shared IOC node parsing orchestrator
 *
 * Single entry point for parsing IOC canvas nodes. Delegates to:
 * - IOCTypeDetection: regex pattern matching for IOC type identification
 * - IOCFieldExtractors: value, time, splunk, MITRE, and card ID extraction
 * - IOCVisualLookup: SVG icon and color resolution from IOC_TYPES registry
 *
 * Consumers import `parseIOCNode` and `IOCNodeData` from this module.
 */

import { DEBUG } from '../debug';

// Re-export IOCNodeData from its canonical location for backward compatibility.
// Consumers that imported { IOCNodeData } from './IOCParser' continue to work.
export type { IOCNodeData } from '../types/IOCNodeData';
import type { IOCNodeData } from '../types/IOCNodeData';

// Sub-module imports
import { detectIOCType } from './IOCTypeDetection';
import {
    extractValue,
    extractTime,
    extractSplunkQuery,
    extractTactic,
    extractTechnique,
    extractCardId,
    extractCardRole
} from './IOCFieldExtractors';
import { lookupTypeVisuals } from './IOCVisualLookup';

/**
 * Parse an Obsidian canvas text node and extract structured IOC data.
 *
 * This is the main entry point used by timeline processors and the MITRE
 * modal. It combines all extraction steps:
 *   1. Detect IOC type from the node's text content
 *   2. Extract value, time, splunk query, tactic, and technique
 *   3. Look up the SVG icon and color from IOC_TYPES
 *
 * @param node - An Obsidian canvas node object with `id`, `text`, and
 *               optional `color` properties
 * @returns IOCNodeData with all fields populated, or null if the node
 *          text does not match any known IOC type
 */
export function parseIOCNode(node: any): IOCNodeData | null {
    if (DEBUG) console.debug('[IOCParser] ==================== PARSING NODE ====================');
    if (DEBUG) console.debug('[IOCParser] Node ID:', node.id);
    if (DEBUG) console.debug('[IOCParser] Text length:', node.text?.length || 0);

    if (!node.text) {
        if (DEBUG) console.debug('[IOCParser] No text content');
        return null;
    }

    // Step 1: Detect IOC type
    const iocType = detectIOCType(node.text);
    if (!iocType) {
        if (DEBUG) console.debug('[IOCParser] No IOC type detected');
        return null;
    }
    if (DEBUG) console.debug('[IOCParser] IOC Type:', iocType);

    // Step 2: Extract field values
    const value = extractValue(node.text);
    const time = extractTime(node.text);
    const splunkQuery = extractSplunkQuery(node.text);
    const tactic = extractTactic(node.text);
    const technique = extractTechnique(node.text);
    const cardId = extractCardId(node.text);
    const role = extractCardRole(node.text);

    // Step 3: Look up icon and color from the IOC_TYPES constant
    const fallbackColor = node.color || '#333';
    const { icon, color } = lookupTypeVisuals(iocType, fallbackColor);

    const result: IOCNodeData = {
        id: node.id,
        cardId: cardId,
        type: iocType,
        value,
        time,
        splunkQuery,
        tactic,
        technique,
        icon,
        color,
        ...(role === 'child' ? { isChild: true } : {})
    };

    if (DEBUG) console.debug('[IOCParser] EXTRACTION COMPLETE:', {
        type: iocType,
        cardId: cardId || '(no ID)',
        value: value || '(empty)',
        time: time || '(empty)',
        tactic: tactic || '(empty)',
        technique: technique || '(empty)'
    });
    return result;
}
