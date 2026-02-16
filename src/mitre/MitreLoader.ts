/**
 * MitreLoader.ts - Async loader for MITRE ATT&CK dataset
 *
 * Loads the full MITRE dataset from MITRE/enterprise-attack.json.
 * Requires enterprise-attack.json - throws error if unavailable.
 *
 * Delegates STIX parsing to MitreStixParser.ts and validation to MitreValidation.ts.
 * Re-exports normalizeTacticName and validateTechniqueTactic so existing imports
 * from './MitreLoader' continue to work.
 */

import { App } from 'obsidian';
import { DEBUG } from '../debug';
import { parseStixBundle } from './MitreStixParser';

// ---------------------------------------------------------------
// Re-exports for backward compatibility
// ---------------------------------------------------------------
// Existing modules import { validateTechniqueTactic } from './MitreLoader',
// so we re-export from the new MitreValidation module.
export { normalizeTacticName, validateTechniqueTactic } from './MitreValidation';

// ---------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------

export interface MitreDataset {
    version: string;
    last_updated: string;
    tactics: Record<string, TacticData>;
    techniques: Record<string, TechniqueData>;
}

export interface TacticData {
    id: string;              // "TA0006"
    name: string;            // "Credential Access"
    short_name: string;      // "credential-access"
    description: string;
    abbreviations: string[]; // ["CA", "CRED"]
}

export interface TechniqueData {
    id: string;              // "T1557"
    name: string;            // "Adversary-in-the-Middle"
    description: string;
    tactics: string[];       // ["TA0006"]
    parent?: string;         // For sub-techniques
    url: string;
}

// ---------------------------------------------------------------
// Dataset cache
// ---------------------------------------------------------------

let cachedDataset: MitreDataset | null = null;

// ---------------------------------------------------------------
// Dataset loader
// ---------------------------------------------------------------

/**
 * Load MITRE dataset from JSON file or fallback to embedded data.
 */
export async function loadMitreDataset(app: App): Promise<MitreDataset> {
    if (cachedDataset) {
        if (DEBUG) console.debug('[MitreLoader] Returning cached dataset');
        return cachedDataset;
    }

    try {
        // Try to load from vault
        const adapter = app.vault.adapter;
        const jsonPath = '.obsidian/plugins/cyber_canvas/MITRE/enterprise-attack.json';

        if (DEBUG) console.debug('[MitreLoader] Attempting to load from:', jsonPath);

        if (await adapter.exists(jsonPath)) {
            const content = await adapter.read(jsonPath);
            const stixBundle = JSON.parse(content);

            // Check if it's a STIX bundle
            if (stixBundle.type === 'bundle' && Array.isArray(stixBundle.objects)) {
                if (DEBUG) console.debug('[MitreLoader] Parsing STIX 2.1 bundle format...');
                cachedDataset = parseStixBundle(stixBundle);
                if (DEBUG) console.debug('[MitreLoader] Loaded full dataset from STIX bundle. Tactics:', Object.keys(cachedDataset.tactics).length, 'Techniques:', Object.keys(cachedDataset.techniques).length);
                return cachedDataset;
            } else if (stixBundle.version && stixBundle.tactics && stixBundle.techniques) {
                // Old pre-processed format (backward compatibility)
                cachedDataset = stixBundle;
                if (DEBUG) console.debug('[MitreLoader] Loaded pre-processed dataset. Version:', cachedDataset.version, 'Techniques:', Object.keys(cachedDataset.techniques).length);
                return cachedDataset;
            } else {
                console.warn('[MitreLoader] Unknown JSON format');
            }
        } else {
            console.error('[MitreLoader] JSON file not found at:', jsonPath);
            throw new Error(
                'MITRE ATT&CK dataset not found. Please ensure enterprise-attack.json exists in the MITRE folder. ' +
                'Download from: https://github.com/mitre-attack/attack-stix-data'
            );
        }
    } catch (err) {
        console.error('[MitreLoader] Failed to load MITRE dataset:', err);
        throw new Error(
            'MITRE ATT&CK dataset not found. Please ensure enterprise-attack.json exists in the MITRE folder. ' +
            'Download from: https://github.com/mitre-attack/attack-stix-data'
        );
    }

    // If we reach here without returning, dataset load failed
    throw new Error('MITRE ATT&CK dataset could not be loaded');
}
