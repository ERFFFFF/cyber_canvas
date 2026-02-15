/**
 * MitreLoader.ts - Async loader for MITRE ATT&CK dataset
 *
 * Loads the full MITRE dataset from MITRE/enterprise-attack.json.
 * Requires enterprise-attack.json - throws error if unavailable.
 */

import { App } from 'obsidian';

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

let cachedDataset: MitreDataset | null = null;

/**
 * Load MITRE dataset from JSON file or fallback to embedded data.
 */
export async function loadMitreDataset(app: App): Promise<MitreDataset> {
    if (cachedDataset) {
        console.debug('[MitreLoader] Returning cached dataset');
        return cachedDataset;
    }

    try {
        // Try to load from vault
        const adapter = app.vault.adapter;
        const jsonPath = '.obsidian/plugins/cyber_canvas/MITRE/enterprise-attack.json';

        console.debug('[MitreLoader] Attempting to load from:', jsonPath);

        if (await adapter.exists(jsonPath)) {
            const content = await adapter.read(jsonPath);
            const stixBundle = JSON.parse(content);

            // Check if it's a STIX bundle
            if (stixBundle.type === 'bundle' && Array.isArray(stixBundle.objects)) {
                console.debug('[MitreLoader] Parsing STIX 2.1 bundle format...');
                cachedDataset = parseStixBundle(stixBundle);
                console.log('[MitreLoader] ✓ Loaded full dataset from STIX bundle. Tactics:', Object.keys(cachedDataset.tactics).length, 'Techniques:', Object.keys(cachedDataset.techniques).length);
                return cachedDataset;
            } else if (stixBundle.version && stixBundle.tactics && stixBundle.techniques) {
                // Old pre-processed format (backward compatibility)
                cachedDataset = stixBundle;
                console.log('[MitreLoader] ✓ Loaded pre-processed dataset. Version:', cachedDataset.version, 'Techniques:', Object.keys(cachedDataset.techniques).length);
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

/**
 * Parse STIX 2.1 bundle format into MitreDataset.
 */
function parseStixBundle(stixBundle: any): MitreDataset {
    console.debug('[MitreLoader] Parsing STIX bundle with', stixBundle.objects?.length, 'objects');

    const tactics: Record<string, TacticData> = {};
    const techniques: Record<string, TechniqueData> = {};

    // Extract version info from collection metadata
    let version = 'unknown';
    let last_updated = new Date().toISOString().split('T')[0];

    for (const obj of stixBundle.objects) {
        if (obj.type === 'x-mitre-collection') {
            version = obj.x_mitre_version || 'unknown';
            last_updated = obj.modified?.split('T')[0] || last_updated;
            console.debug('[MitreLoader] Found collection metadata - version:', version, 'updated:', last_updated);
        }
    }

    // First pass: extract tactics
    for (const obj of stixBundle.objects) {
        if (obj.type === 'x-mitre-tactic' && !obj.x_mitre_deprecated) {
            const tacticId = obj.external_references?.find((ref: any) => ref.source_name === 'mitre-attack')?.external_id;
            if (!tacticId) continue;

            const shortName = obj.x_mitre_shortname || tacticId.toLowerCase();
            tactics[tacticId] = {
                id: tacticId,
                name: obj.name,
                short_name: shortName,
                description: obj.description || '',
                abbreviations: generateAbbreviations(obj.name)
            };
        }
    }

    console.debug('[MitreLoader] Parsed', Object.keys(tactics).length, 'tactics');

    // Build tactic short name to ID map for technique processing
    const shortNameToTacticId = new Map<string, string>();
    for (const [tacticId, tactic] of Object.entries(tactics)) {
        shortNameToTacticId.set(tactic.short_name, tacticId);
    }

    // Second pass: extract techniques
    for (const obj of stixBundle.objects) {
        if (obj.type === 'attack-pattern' && !obj.x_mitre_deprecated) {
            const techniqueId = obj.external_references?.find((ref: any) => ref.source_name === 'mitre-attack')?.external_id;
            if (!techniqueId) continue;

            // Extract tactic IDs from kill_chain_phases
            const tacticIds: string[] = [];
            if (obj.kill_chain_phases) {
                for (const phase of obj.kill_chain_phases) {
                    if (phase.kill_chain_name === 'mitre-attack') {
                        const tacticId = shortNameToTacticId.get(phase.phase_name);
                        if (tacticId) {
                            tacticIds.push(tacticId);
                        }
                    }
                }
            }

            // Determine parent for sub-techniques
            let parent: string | undefined;
            if (obj.x_mitre_is_subtechnique && techniqueId.includes('.')) {
                parent = techniqueId.split('.')[0];
            }

            techniques[techniqueId] = {
                id: techniqueId,
                name: obj.name,
                description: obj.description || '',
                tactics: tacticIds,
                parent,
                url: obj.external_references?.find((ref: any) => ref.source_name === 'mitre-attack')?.url ||
                     `https://attack.mitre.org/techniques/${techniqueId.replace('.', '/')}`
            };
        }
    }

    console.debug('[MitreLoader] Parsed', Object.keys(techniques).length, 'techniques');

    return {
        version,
        last_updated,
        tactics,
        techniques
    };
}

/**
 * Generate abbreviations for a tactic name.
 */
function generateAbbreviations(tacticName: string): string[] {
    const abbrevs: string[] = [];

    // Generate initials (e.g., "Credential Access" -> "CA")
    const words = tacticName.split(/[\s\-]+/);
    if (words.length > 0) {
        abbrevs.push(words.map(w => w[0]).join('').toUpperCase());
    }

    // Common abbreviations (including short 2-letter variants)
    const commonAbbrevs: Record<string, string[]> = {
        'Reconnaissance': ['RECON', 'RECCE', 'RE'],
        'Resource Development': ['RESOURCE', 'RES', 'RD'],
        'Initial Access': ['IA', 'INIT'],
        'Execution': ['EXEC', 'EXE', 'EX'],
        'Persistence': ['PERSIST', 'PERS', 'PS'],
        'Privilege Escalation': ['PRIV', 'PE', 'PRIVESC', 'PRIV ESC'],
        'Defense Evasion': ['DEFENSE', 'DEF', 'DE'],
        'Credential Access': ['CRED', 'CA', 'CRED ACCESS'],
        'Discovery': ['DISC', 'DIS', 'DI'],
        'Lateral Movement': ['LATERAL', 'LM', 'LAT MOVE'],
        'Collection': ['COLLECT', 'COL', 'CO'],
        'Command and Control': ['C2', 'CNC', 'CC'],
        'Exfiltration': ['EXFIL', 'EXFILTRATE', 'EX'],
        'Impact': ['IMP', 'IM']
    };

    if (commonAbbrevs[tacticName]) {
        abbrevs.push(...commonAbbrevs[tacticName]);
    }

    return abbrevs;
}


/**
 * Normalize tactic name for lookup, handling abbreviations.
 */
export function normalizeTacticName(name: string, dataset: MitreDataset): string | null {
    const normalized = name.toLowerCase().replace(/[\s\-_]+/g, '');

    console.debug('[MitreLoader] Normalizing tactic:', name, '→', normalized);

    // Check exact match first (match against short_name without dashes)
    for (const [tacticId, tactic] of Object.entries(dataset.tactics)) {
        if (tactic.short_name.replace(/\-/g, '') === normalized) {
            console.debug('[MitreLoader] ✓ Matched by short_name:', tactic.name, '(' + tacticId + ')');
            return tacticId;
        }
    }

    // Check full name match
    for (const [tacticId, tactic] of Object.entries(dataset.tactics)) {
        if (tactic.name.toLowerCase().replace(/[\s\-_]+/g, '') === normalized) {
            console.debug('[MitreLoader] ✓ Matched by full name:', tactic.name, '(' + tacticId + ')');
            return tacticId;
        }
    }

    // Check abbreviations
    const upper = name.toUpperCase().trim();
    for (const [tacticId, tactic] of Object.entries(dataset.tactics)) {
        if (tactic.abbreviations.includes(upper)) {
            console.debug('[MitreLoader] ✓ Matched by abbreviation:', upper, '→', tactic.name, '(' + tacticId + ')');
            return tacticId;
        }
    }

    console.debug('[MitreLoader] ✗ No match found for:', name);
    return null;
}

/**
 * Validate technique-tactic mapping with severity levels.
 */
export function validateTechniqueTactic(
    techniqueId: string,
    tacticInput: string,
    dataset: MitreDataset
): {
    severity: 'valid' | 'unknown_technique' | 'unknown_tactic' | 'mismatch' | 'empty_tactic';
    message?: string;
    tacticId?: string;
} {
    const tacticId = normalizeTacticName(tacticInput, dataset);

    // Unknown tactic
    if (!tacticId) {
        return {
            severity: 'unknown_tactic',
            message: `Unknown tactic: "${tacticInput}"`
        };
    }

    // Unknown technique
    const technique = dataset.techniques[techniqueId];
    if (!technique) {
        return {
            severity: 'unknown_technique',
            message: `Unknown technique: "${techniqueId}"`
        };
    }

    // Technique doesn't belong to this tactic
    if (!technique.tactics.includes(tacticId)) {
        const validTactics = technique.tactics
            .map(tid => dataset.tactics[tid]?.name || tid)
            .join(', ');
        return {
            severity: 'mismatch',
            message: `${techniqueId} (${technique.name}) does not belong to ${dataset.tactics[tacticId].name}. Valid tactics: ${validTactics}`,
            tacticId
        };
    }

    // Valid!
    return {
        severity: 'valid',
        tacticId
    };
}
