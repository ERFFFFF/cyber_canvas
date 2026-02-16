/**
 * MitreStixParser.ts - STIX 2.1 bundle parser for MITRE ATT&CK dataset
 *
 * Parses the official MITRE ATT&CK STIX 2.1 bundle format into the
 * internal MitreDataset structure. Handles tactic abbreviation generation
 * and the two-pass parsing algorithm (tactics first, then techniques).
 */

import { MitreDataset, TacticData, TechniqueData } from './MitreLoader';
import { DEBUG } from '../debug';

// ---------------------------------------------------------------
// Tactic abbreviation constants
// ---------------------------------------------------------------

/** Common abbreviations for MITRE tactic names. */
export const TACTIC_ABBREVIATIONS: Record<string, string[]> = {
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
    'Exfiltration': ['EXFIL', 'EXFILTRATE'],
    'Impact': ['IMP', 'IM']
};

// ---------------------------------------------------------------
// Abbreviation generation
// ---------------------------------------------------------------

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
export function generateAbbreviations(tacticName: string): string[] {
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

// ---------------------------------------------------------------
// STIX 2.1 bundle parser
// ---------------------------------------------------------------

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
export function parseStixBundle(stixBundle: any): MitreDataset {
    if (DEBUG) console.debug('[MitreLoader] Parsing STIX bundle with', stixBundle.objects?.length, 'objects');

    const tactics: Record<string, TacticData> = {};
    const techniques: Record<string, TechniqueData> = {};

    // Extract version info from collection metadata
    let version = 'unknown';
    let last_updated = new Date().toISOString().split('T')[0];

    for (const obj of stixBundle.objects) {
        if (obj.type === 'x-mitre-collection') {
            version = obj.x_mitre_version || 'unknown';
            last_updated = obj.modified?.split('T')[0] || last_updated;
            if (DEBUG) console.debug('[MitreLoader] Found collection metadata - version:', version, 'updated:', last_updated);
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

    if (DEBUG) console.debug('[MitreLoader] Parsed', Object.keys(tactics).length, 'tactics');

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

    if (DEBUG) console.debug('[MitreLoader] Parsed', Object.keys(techniques).length, 'techniques');

    return {
        version,
        last_updated,
        tactics,
        techniques
    };
}
