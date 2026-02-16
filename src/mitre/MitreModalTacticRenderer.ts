/**
 * MitreModalTacticRenderer.ts - Tactic column and technique item rendering
 *
 * Renders individual tactic sections as vertical columns in the MITRE matrix.
 * Each column contains technique items with expand/collapse, validation icons,
 * count badges with tooltips, and subtechnique nesting.
 *
 * Count badge rendering delegated to MitreCountBadge.ts.
 * Subtechnique rendering delegated to MitreSubtechniqueRenderer.ts.
 */

import { MitreTechnique, MitreTactic, SearchState } from './MitreTypes';
import { cleanDescription, truncateDescription } from './MitreTextUtils';
import { applySeverityClass, getSeverityIcon } from './MitreSeverity';
import { highlightMatches } from './MitreSearch';
import { MitreModalContext, isActiveTechnique, toggleExpansion } from './MitreModalHelpers';
import { createCountBadgeWithTooltip } from './MitreCountBadge';
import { DEBUG } from '../debug';

// ---------------------------------------------------------------
// Tactic section rendering
// ---------------------------------------------------------------

/**
 * Render a single tactic column with all its techniques.
 *
 * @param container - Parent container element
 * @param tactic - Tactic data with nested techniques
 * @param ctx - Modal context for state and callbacks
 * @param searchState - Current search state for filtering/highlighting
 */
export function renderTacticSection(
    container: HTMLElement,
    tactic: MitreTactic,
    ctx: MitreModalContext,
    searchState?: SearchState | null
): void {
    if (DEBUG) console.debug('[MitreModalRenderer] ========== RENDERING TACTIC SECTION ==========');
    if (DEBUG) console.debug('[MitreModalRenderer] Tactic:', tactic.displayName || tactic.name);

    const tacticColumn = container.createDiv('mitre-tactic-column');

    // Show found vs total count
    const foundCount = tactic.techniques.filter(t => t.isFound).length;
    const totalCount = tactic.techniques.length;

    if (DEBUG) console.debug('[MitreModalRenderer] Found techniques:', foundCount, '/', totalCount);

    const tacticHeader = tacticColumn.createDiv('mitre-tactic-header');
    tacticHeader.createEl('h3', { text: `⚔️ ${tactic.displayName || tactic.name}` });
    tacticHeader.createEl('span', {
        text: `${foundCount} active / ${totalCount} total techniques`,
        cls: 'mitre-technique-count'
    });

    const techniqueList = tacticColumn.createDiv('mitre-technique-list');

    tactic.techniques.forEach((technique) => {
        renderTechniqueItem(techniqueList, technique, ctx, searchState);
    });

    if (DEBUG) console.debug('[MitreModalRenderer] ========== TACTIC RENDERING COMPLETE ==========');
}

// ---------------------------------------------------------------
// Technique item rendering
// ---------------------------------------------------------------

/**
 * Render a single technique item within a tactic column.
 */
function renderTechniqueItem(
    techniqueList: HTMLElement,
    technique: MitreTechnique,
    ctx: MitreModalContext,
    searchState?: SearchState | null
): void {
    const techItem = techniqueList.createDiv('mitre-technique-item');

    // Check if this technique has subtechniques
    const subtechniques = ctx.subtechniquesMap.get(technique.id) || [];
    const hasSubtechniques = subtechniques.length > 0;

    // Check if description is long
    const cleanedDesc = cleanDescription(technique.description || '');
    const isLongDescription = cleanedDesc.length > ctx.TECHNIQUE_TRUNCATE_LIMIT;

    // Expandable if long description OR has subtechniques
    const isExpandable = isLongDescription || hasSubtechniques;

    // Add data attributes for state management
    techItem.setAttribute('data-technique-id', technique.id);
    techItem.setAttribute('data-subtechnique-count', subtechniques.length.toString());
    techItem.setAttribute('data-is-expandable', isExpandable.toString());
    techItem.setAttribute('data-full-description', cleanedDesc);
    if (isLongDescription) {
        const truncated = truncateDescription(cleanedDesc);
        techItem.setAttribute('data-truncated-description', truncated);
    }

    // Check if this is the active technique (from selected card)
    const isActive = isActiveTechnique(technique.id, ctx.activeTechniqueId);
    if (isActive) {
        techItem.addClass('mitre-technique-active');
    }

    // Apply styling based on isFound and severity
    if (!technique.isFound) {
        techItem.addClass('mitre-technique-unfound');
    } else {
        applySeverityClass(techItem, technique.severity);
    }

    const techInfo = techItem.createDiv('mitre-technique-info');

    // Add expand icon if expandable (long description OR subtechniques)
    if (isExpandable) {
        techInfo.createEl('span', {
            cls: 'mitre-expand-icon',
            text: '▶'
        });
        techItem.addClass('has-expandable');
        techItem.addClass('collapsed');

        // Click handler for expand/collapse
        techItem.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleExpansion(techItem, ctx, subtechniques);
        });
    }

    // Validation icon rendering disabled per user request
    // if (technique.isFound && technique.severity !== 'valid' && technique.severity !== 'not_found') {
    //     const warningEl = techInfo.createEl('span', {
    //         cls: 'mitre-validation-icon',
    //         attr: {
    //             'title': technique.validationMessage || 'Warning'
    //         }
    //     });
    //     warningEl.innerHTML = getSeverityIcon(technique.severity);
    // }

    techInfo.createEl('span', {
        text: technique.id,
        cls: 'mitre-technique-id'
    });

    // Add subtechnique count to name if present
    const nameText = hasSubtechniques
        ? `${technique.name} (${subtechniques.length})`
        : technique.name;
    const nameEl = techInfo.createEl('span', {
        text: nameText,
        cls: 'mitre-technique-name'
    });

    // Apply search highlighting to name if active
    if (searchState?.isActive) {
        highlightMatches(nameEl, technique.name, searchState);
    }

    // Show description for ALL techniques
    if (technique.description) {
        const descEl = techItem.createDiv('mitre-technique-description');

        const isExpanded = techItem.hasClass('expanded');
        let displayText: string;

        if (isExpanded || !isExpandable) {
            displayText = cleanedDesc;
        } else {
            displayText = truncateDescription(cleanedDesc);
        }

        descEl.textContent = displayText;

        if (searchState?.isActive) {
            highlightMatches(descEl, displayText, searchState);
        }
    }

    // Show count badge ONLY for found techniques
    if (technique.isFound) {
        // Collect iocCards from found subtechniques for parent tooltip
        const subtechCards: string[] = [];
        subtechniques.forEach(sub => {
            if (sub.isFound && sub.iocCards.length > 0) {
                subtechCards.push(...sub.iocCards);
            }
        });
        createCountBadgeWithTooltip(techItem, technique, ctx, subtechCards);
    }
}
