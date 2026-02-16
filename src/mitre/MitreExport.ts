/**
 * MitreExport.ts - MITRE ATT&CK Navigator JSON export
 *
 * Generates a JSON layer file compatible with the official MITRE ATT&CK Navigator
 * (https://mitre-attack.github.io/attack-navigator/). The export uses pre-computed
 * tactics from the modal (what-you-see-is-what-you-export) and includes severity-based
 * coloring, IOC card counts as technique scores, and validation messages in comments.
 */

import { MitreTactic } from './MitreTypes';
import { isCriticalSeverity, getSeverityIcon } from './MitreSeverity';
import { MitreDataset } from './MitreLoader';
import { DEBUG } from '../debug';

/**
 * Export the current MITRE matrix to Navigator JSON format and trigger download.
 *
 * Uses the pre-computed tactics from the modal instead of re-running aggregation.
 * Only found techniques (isFound=true) are included in the export.
 *
 * @param tactics - Pre-computed tactics array from aggregation
 * @param iocCount - Total number of IOC cards for description text
 * @param dataset - MITRE dataset for tactic short name lookup
 */
export function exportToNavigator(
    tactics: MitreTactic[],
    iocCount: number,
    dataset: MitreDataset
): void {
    if (DEBUG) console.debug('[MitreExport] Starting export -', tactics.length, 'tactics,', iocCount, 'IOC cards');

    // Build MITRE ATT&CK Navigator layer format
    const layer = {
        name: "Cyber Canvas IOC Analysis",
        versions: {
            attack: "14",
            navigator: "4.9.4",
            layer: "4.5"
        },
        domain: "enterprise-attack",
        description: `Generated from ${iocCount} IOC cards in Obsidian Canvas`,
        filters: {
            platforms: ["windows", "linux", "macos"]
        },
        sorting: 0,
        layout: {
            layout: "side",
            aggregateFunction: "average",
            showID: true,
            showName: true,
            showAggregateScores: false,
            countUnscored: false
        },
        hideDisabled: false,
        techniques: [] as any[],
        gradient: {
            colors: ["#ff6666", "#ffe766", "#8ec843"],
            minValue: 0,
            maxValue: 100
        },
        legendItems: [] as any[],
        metadata: [] as any[],
        links: [] as any[],
        showTacticRowBackground: true,
        tacticRowBackground: "#dddddd",
        selectTechniquesAcrossTactics: true,
        selectSubtechniquesWithParent: false
    };

    // Add techniques to layer (only found techniques)
    tactics.forEach(tactic => {
        tactic.techniques.forEach(technique => {
            // Skip unfound techniques in export
            if (!technique.isFound) return;

            // Use tactic short name from dataset for Navigator compatibility
            const tacticData = dataset.tactics[technique.tacticId];
            const tacticShortName = tacticData?.short_name
                || tactic.name.toLowerCase().replace(/\s+/g, '-');

            // Set color based on severity
            let color: string;
            if (technique.severity === 'valid') {
                color = "#66bb6a";  // Green - valid
            } else if (isCriticalSeverity(technique.severity)) {
                color = "#f44336";  // Red - unknown
            } else if (technique.severity === 'mismatch') {
                color = "#ffa500";  // Orange - wrong tactic
            } else {
                color = "#66bb6a";  // Default green
            }

            // Build comment with validation status
            let comment = `Used in ${technique.count} IOC card${technique.count > 1 ? 's' : ''}`;
            if (technique.severity !== 'valid' && technique.validationMessage) {
                comment += `\n${getSeverityIcon(technique.severity)} ${technique.validationMessage}`;
            }

            layer.techniques.push({
                techniqueID: technique.id,
                tactic: tacticShortName,
                color,
                comment,
                enabled: true,
                metadata: [
                    { name: 'severity', value: technique.severity },
                    { name: 'ioc_cards', value: technique.iocCards.join(', ') }
                ],
                links: [],
                showSubtechniques: false,
                score: technique.count * 10 // Scale count for visual weight
            });
        });
    });

    if (DEBUG) console.debug('[MitreExport] Exported', layer.techniques.length, 'techniques to Navigator format');

    // Trigger download
    const jsonString = JSON.stringify(layer, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `mitre-navigator-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
}
