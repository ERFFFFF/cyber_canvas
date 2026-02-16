/**
 * MitreStatsBar.ts - Statistics bar rendering for MITRE modal
 *
 * Renders the summary statistics bar at the top of the MITRE ATT&CK modal,
 * showing coverage percentage, active tactics, IOC card count, and warnings
 * for cards with missing MITRE fields (tactic or technique).
 *
 * Extracted from RenderMitreModal.renderMitreMapping() to keep the modal
 * orchestrator focused on data flow and delegation.
 */
import { MitreTactic, MissingFieldsResult } from './MitreTypes';

// ---------------------------------------------------------------
// Stats bar rendering
// ---------------------------------------------------------------

/**
 * Renders the MITRE modal statistics bar with coverage, tactics, IOC count,
 * and missing field warnings.
 *
 * Stats displayed:
 *   - Coverage: found/total techniques with percentage
 *   - Active tactics: how many tactics have at least one found technique
 *   - IOC card count: total cards extracted from canvas
 *   - Missing tactic warning: cards with tactic field empty (with tooltip)
 *   - Missing technique warning: cards with technique field empty (with tooltip)
 *
 * @param statsContainer - The DOM element to render stats into
 * @param tactics - Array of tactic columns from aggregation result
 * @param iocCount - Total number of IOC cards on the canvas
 * @param missingFields - Cards with missing tactic/technique fields
 */
export function renderStatsBar(
    statsContainer: HTMLElement,
    tactics: MitreTactic[],
    iocCount: number,
    missingFields: MissingFieldsResult
): void {
    // ---------------------------------------------------------------
    // Coverage percentage calculation
    // ---------------------------------------------------------------

    const totalTechniques = tactics.reduce((sum, t) => sum + t.techniques.length, 0);
    const foundTechniques = tactics.reduce(
        (sum, t) => sum + t.techniques.filter(tech => tech.isFound).length,
        0
    );
    const coveragePercent = totalTechniques > 0
        ? Math.round((foundTechniques / totalTechniques) * 100)
        : 0;

    // Coverage stat
    statsContainer.createEl('div', {
        text: `📊 Coverage: ${foundTechniques}/${totalTechniques} techniques (${coveragePercent}%)`,
        cls: 'mitre-stat-item'
    });

    // ---------------------------------------------------------------
    // Active tactics count
    // ---------------------------------------------------------------

    const activeTactics = tactics.filter(t => t.techniques.some(tech => tech.isFound)).length;
    statsContainer.createEl('div', {
        text: `⚔️ Tactics: ${activeTactics}/${tactics.length} active`,
        cls: 'mitre-stat-item'
    });

    // ---------------------------------------------------------------
    // IOC card count
    // ---------------------------------------------------------------

    statsContainer.createEl('div', {
        text: `📇 IOC Cards: ${iocCount} total`,
        cls: 'mitre-stat-item'
    });

    // ---------------------------------------------------------------
    // Missing tactic warning (with hover tooltip showing card details)
    // ---------------------------------------------------------------

    const missingTacticCount = missingFields.missingTactic.length;
    if (missingTacticCount > 0) {
        const missingTacticEl = statsContainer.createEl('div', {
            text: `⚠️ Missing Tactic: ${missingTacticCount} card${missingTacticCount === 1 ? '' : 's'}`,
            cls: 'mitre-stat-item mitre-stat-warning'
        });

        // Hover tooltip with card details
        const tooltipText = missingFields.missingTactic
            .map(info => {
                const missing = info.missing === 'both' ? 'tactic, technique' : 'tactic';
                return `${info.iocType} ${info.cardId} (missing: ${missing})`;
            })
            .join('\n');

        missingTacticEl.setAttribute('title', tooltipText);
        missingTacticEl.setAttribute('aria-label', `${missingTacticCount} cards missing tactic field`);
    }

    // ---------------------------------------------------------------
    // Missing technique warning (with hover tooltip showing card details)
    // ---------------------------------------------------------------

    const missingTechniqueCount = missingFields.missingTechnique.length;
    if (missingTechniqueCount > 0) {
        const missingTechniqueEl = statsContainer.createEl('div', {
            text: `⚠️ Missing Technique: ${missingTechniqueCount} card${missingTechniqueCount === 1 ? '' : 's'}`,
            cls: 'mitre-stat-item mitre-stat-warning'
        });

        // Hover tooltip with card details
        const tooltipText = missingFields.missingTechnique
            .map(info => {
                const missing = info.missing === 'both' ? 'tactic, technique' : 'technique';
                return `${info.iocType} ${info.cardId} (missing: ${missing})`;
            })
            .join('\n');

        missingTechniqueEl.setAttribute('title', tooltipText);
        missingTechniqueEl.setAttribute('aria-label', `${missingTechniqueCount} cards missing technique field`);
    }
}
