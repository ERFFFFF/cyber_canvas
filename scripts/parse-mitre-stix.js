/**
 * parse-mitre-stix.js
 *
 * Converts the official MITRE ATT&CK STIX 2.1 bundle (enterprise-attack_new.json)
 * into the compact format used by the Cyber Canvas plugin (enterprise-attack.json).
 *
 * Usage: node scripts/parse-mitre-stix.js
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '..', 'MITRE', 'enterprise-attack_new.json');
const OUTPUT = path.join(__dirname, '..', 'MITRE', 'enterprise-attack.json');

// Tactic abbreviations (not present in STIX data, maintained manually)
const TACTIC_ABBREVIATIONS = {
    'TA0043': ['RE', 'RECON'],
    'TA0042': ['RD', 'RESDEV'],
    'TA0001': ['IA'],
    'TA0002': ['EX', 'EXEC'],
    'TA0003': ['PE', 'PERS'],
    'TA0004': ['PR', 'PRIV'],
    'TA0005': ['DE', 'DEF'],
    'TA0006': ['CA', 'CRED'],
    'TA0007': ['DI', 'DISC'],
    'TA0008': ['LA', 'LAT'],
    'TA0009': ['CO', 'COLL'],
    'TA0011': ['CC', 'C2'],
    'TA0010': ['EF', 'EXFIL'],
    'TA0040': ['IM', 'IMP']
};

function truncateToFirstSentence(desc) {
    if (!desc) return '';
    // Find the first period followed by whitespace or end-of-string
    const match = desc.match(/^(.+?\.)\s/);
    return match ? match[1].trim() : desc.substring(0, 200).trim();
}

function getMitreExternalId(obj) {
    if (!obj.external_references) return null;
    const ref = obj.external_references.find(r => r.source_name === 'mitre-attack');
    return ref ? ref.external_id : null;
}

console.log('Reading STIX bundle from:', INPUT);
const raw = fs.readFileSync(INPUT, 'utf8');
const bundle = JSON.parse(raw);
console.log('Parsed', bundle.objects.length, 'STIX objects');

// Extract version from x-mitre-collection
const collection = bundle.objects.find(o => o.type === 'x-mitre-collection');
const version = collection ? collection.x_mitre_version : 'unknown';
const lastUpdated = collection ? collection.modified.split('T')[0] : new Date().toISOString().split('T')[0];
console.log('Version:', version, '| Last updated:', lastUpdated);

// Build tactics
const stixTactics = bundle.objects.filter(o => o.type === 'x-mitre-tactic');
console.log('Found', stixTactics.length, 'tactics');

const shortnameToId = {};
const tacticsOutput = {};

stixTactics.forEach(t => {
    const id = getMitreExternalId(t);
    if (!id) return;

    shortnameToId[t.x_mitre_shortname] = id;

    tacticsOutput[id] = {
        id: id,
        name: t.name,
        short_name: t.x_mitre_shortname,
        description: truncateToFirstSentence(t.description),
        abbreviations: TACTIC_ABBREVIATIONS[id] || []
    };
});

console.log('Shortname-to-ID mapping:', shortnameToId);

// Build techniques (filter deprecated and revoked)
const stixTechniques = bundle.objects.filter(o =>
    o.type === 'attack-pattern' &&
    o.x_mitre_deprecated !== true &&
    o.revoked !== true
);
console.log('Found', stixTechniques.length, 'active techniques (filtered deprecated/revoked)');

const techniquesOutput = {};
let skipped = 0;

stixTechniques.forEach(ap => {
    const id = getMitreExternalId(ap);
    if (!id) {
        skipped++;
        return;
    }

    // Map kill_chain_phases to tactic IDs
    const tacticIds = (ap.kill_chain_phases || [])
        .filter(kc => kc.kill_chain_name === 'mitre-attack')
        .map(kc => shortnameToId[kc.phase_name])
        .filter(Boolean);

    if (tacticIds.length === 0) {
        skipped++;
        return;
    }

    // Derive parent for subtechniques
    const isSubtechnique = ap.x_mitre_is_subtechnique === true;
    const parent = isSubtechnique ? id.split('.')[0] : undefined;

    // Build URL
    const url = `https://attack.mitre.org/techniques/${id.replace('.', '/')}`;

    const entry = {
        id: id,
        name: ap.name,
        description: truncateToFirstSentence(ap.description),
        tactics: tacticIds,
        url: url
    };

    if (parent) entry.parent = parent;

    techniquesOutput[id] = entry;
});

console.log('Processed', Object.keys(techniquesOutput).length, 'techniques (skipped', skipped, ')');

// Assemble output
const output = {
    version: version,
    last_updated: lastUpdated,
    tactics: tacticsOutput,
    techniques: techniquesOutput
};

fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf8');
console.log('Wrote output to:', OUTPUT);
console.log('Summary:', Object.keys(tacticsOutput).length, 'tactics,', Object.keys(techniquesOutput).length, 'techniques');
