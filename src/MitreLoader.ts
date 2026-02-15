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

/** Common abbreviations for MITRE tactic names. */
const TACTIC_ABBREVIATIONS: Record<string, string[]> = {
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
 *
 * The official MITRE ATT&CK dataset uses STIX 2.1 (Structured Threat Information
 * eXpression) format, which is a JSON-based standard for representing cyber threat
 * intelligence. The bundle contains multiple object types mixed together.
 *
 * **STIX Object Types:**
 * - `x-mitre-collection`: Metadata (version, last updated)
 * - `x-mitre-tactic`: Tactic definitions (e.g., Initial Access, Execution)
 * - `attack-pattern`: Technique and subtechnique definitions
 *
 * **Two-Pass Algorithm:**
 * We parse in two passes because techniques reference tactics by short_name
 * (e.g., "initial-access") in their kill_chain_phases, so tactics must be
 * extracted first to build the short_name → tactic ID mapping.
 *
 * **Pass 1:** Extract all tactics and build short_name mapping
 * **Pass 2:** Extract all techniques and resolve tactic IDs from kill_chain_phases
 *
 * @param stixBundle - Raw STIX 2.1 bundle JSON object
 * @returns Normalized MitreDataset with tactics and techniques indexed by ID
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

    // ---------------------------------------------------------------
    // FIRST PASS: Extract tactics
    // ---------------------------------------------------------------
    // Build the complete tactics map BEFORE processing techniques, because
    // techniques reference tactics by short_name in kill_chain_phases.
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
    // Example mapping: "initial-access" → "TA0001"
    const shortNameToTacticId = new Map<string, string>();
    for (const [tacticId, tactic] of Object.entries(tactics)) {
        shortNameToTacticId.set(tactic.short_name, tacticId);
    }

    // ---------------------------------------------------------------
    // SECOND PASS: Extract techniques
    // ---------------------------------------------------------------
    // Now that we have the full tactics map, process all attack-pattern objects
    // (techniques and subtechniques). Resolve tactic IDs from kill_chain_phases
    // using the shortNameToTacticId map built above.
    //
    // **Technique Structure:**
    // - Parent techniques: Regular techniques (e.g., T1566 - Phishing)
    // - Subtechniques: Child techniques with parent reference (e.g., T1566.001)
    // - Techniques can belong to multiple tactics (stored as array)
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
 *
 * Creates multiple abbreviation formats to support flexible user input:
 *
 * **1. Initials (automatic):**
 * - "Credential Access" → "CA"
 * - "Command and Control" → "CC"
 * - "Privilege Escalation" → "PE"
 *
 * **2. Known abbreviations (from TACTIC_ABBREVIATIONS constant):**
 * - Adds common short forms like "CRED", "C2", "PRIV", etc.
 *
 * **Algorithm:**
 * - Split tactic name by spaces or hyphens: /[\s\-]+/
 * - Map each word to its first character: ['C', 'A']
 * - Join and uppercase: "CA"
 * - Append known abbreviations from lookup table
 *
 * @param tacticName - Full tactic name (e.g., "Credential Access")
 * @returns Array of abbreviation strings (e.g., ["CA", "CRED", "CRED ACCESS"])
 */
function generateAbbreviations(tacticName: string): string[] {
    const abbrevs: string[] = [];

    // Generate initials (e.g., "Credential Access" -> "CA")
    const words = tacticName.split(/[\s\-]+/);
    if (words.length > 0) {
        // Map each word to first letter, join, uppercase
        abbrevs.push(words.map(w => w[0]).join('').toUpperCase());
    }

    // Add known abbreviations from TACTIC_ABBREVIATIONS constant
    if (TACTIC_ABBREVIATIONS[tacticName]) {
        abbrevs.push(...TACTIC_ABBREVIATIONS[tacticName]);
    }

    return abbrevs;
}


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

    console.debug('[MitreLoader] Normalizing tactic:', name, '→', normalized);

    // PASS 1: Check exact match against short_name (e.g., "credential-access")
    for (const [tacticId, tactic] of Object.entries(dataset.tactics)) {
        if (tactic.short_name.replace(/\-/g, '') === normalized) {
            console.debug('[MitreLoader] ✓ Matched by short_name:', tactic.name, '(' + tacticId + ')');
            return tacticId;
        }
    }

    // PASS 2: Check full name match (e.g., "Credential Access")
    for (const [tacticId, tactic] of Object.entries(dataset.tactics)) {
        if (tactic.name.toLowerCase().replace(/[\s\-_]+/g, '') === normalized) {
            console.debug('[MitreLoader] ✓ Matched by full name:', tactic.name, '(' + tacticId + ')');
            return tacticId;
        }
    }

    // PASS 3: Check abbreviations (e.g., "CA", "CRED")
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
 * - `empty_tactic`: Not used here (handled in aggregation)
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
    severity: 'valid' | 'unknown_technique' | 'unknown_tactic' | 'mismatch' | 'empty_tactic';
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
