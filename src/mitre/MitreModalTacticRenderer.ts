/**
 * MitreModalTacticRenderer.ts - Tactic column and technique item rendering
 *
 * Renders individual tactic sections as vertical columns in the MITRE matrix.
 * Each column contains technique items with expand/collapse, validation icons,
 * count badges with tooltips, and subtechnique nesting.
 */

import { MitreTechnique, MitreTactic, SearchState } from './MitreTypes';
import { cleanDescription, truncateDescription } from './MitreTextUtils';
import { isCriticalSeverity, getSeverityIcon, applySeverityClass } from './MitreSeverity';
import { highlightMatches } from './MitreSearch';
import { MitreModalContext, isActiveTechnique, toggleExpansion } from './MitreModalHelpers';
import { IOC_TYPES } from '../types/IOCCardsTypes';
import { DEBUG } from '../debug';

// ---------------------------------------------------------------
// Count badge with tooltip
// ---------------------------------------------------------------

/**
 * Create a count badge with hover tooltip showing card details.
 *
 * @param parentEl - Element to attach the badge div to
 * @param technique - Technique with count/iocCards
 * @param ctx - Modal context for IOC data lookup
 * @param extraIocCards - Additional card IDs to show (e.g., from found subtechniques)
 */
export function createCountBadgeWithTooltip(
    parentEl: HTMLElement,
    technique: MitreTechnique,
    ctx: MitreModalContext,
    extraIocCards?: string[]
): void {
    const badge = parentEl.createDiv('mitre-technique-count-badge');
    badge.textContent = `${technique.count} card${technique.count > 1 ? 's' : ''}`;

    // Merge technique's own iocCards with any extra cards from subtechniques
    const allCardIds = [...technique.iocCards, ...(extraIocCards || [])];

    // Create tooltip element (hidden by default)
    const tooltip = badge.createDiv('mitre-count-tooltip');
    tooltip.style.display = 'none';

    // Populate tooltip with card details
    allCardIds.forEach((cardId, index) => {
        const iocData = ctx.iocDataMap.get(cardId);
        if (!iocData) return;

        const cardItem = tooltip.createDiv('mitre-tooltip-card');

        // Card type with icon color
        const iocType = Object.values(IOC_TYPES).find(t => t.name === iocData.type);
        const typeColor = iocType?.color || '#888';
        const typeEl = cardItem.createDiv('mitre-tooltip-type');
        typeEl.style.color = typeColor;
        typeEl.style.fontWeight = 'bold';
        typeEl.textContent = iocData.type;

        // Card value/identifier
        if (iocData.value) {
            const valueEl = cardItem.createDiv('mitre-tooltip-value');
            valueEl.textContent = iocData.value;
        }

        // MITRE fields (note: uses wrong property names - existing known bug)
        if ((iocData as any).mitreTactic || (iocData as any).mitreTechnique) {
            const mitreEl = cardItem.createDiv('mitre-tooltip-fields');
            if ((iocData as any).mitreTactic) {
                mitreEl.createSpan({ text: `Tactic: ${(iocData as any).mitreTactic}` });
            }
            if ((iocData as any).mitreTechnique) {
                if ((iocData as any).mitreTactic) mitreEl.createSpan({ text: ' | ' });
                mitreEl.createSpan({ text: `Technique: ${(iocData as any).mitreTechnique}` });
            }
        }

        // Add separator between cards (except last)
        if (index < allCardIds.length - 1) {
            cardItem.style.borderBottom = '1px solid var(--background-modifier-border)';
            cardItem.style.paddingBottom = '8px';
            cardItem.style.marginBottom = '8px';
        }
    });

    // Hover event listeners
    badge.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
    });
    badge.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });

    if (DEBUG) console.debug('[MitreModalRenderer]   → Count badge with tooltip:', technique.count, 'card(s), allCards:', allCardIds.length);
}

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

    // Show validation icon ONLY for found techniques with issues
    if (technique.isFound && technique.severity !== 'valid' && technique.severity !== 'not_found') {
        const warningEl = techInfo.createEl('span', {
            cls: 'mitre-validation-icon',
            attr: {
                'title': technique.validationMessage || 'Warning'
            }
        });
        warningEl.innerHTML = getSeverityIcon(technique.severity);
    }

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

// ---------------------------------------------------------------
// Subtechniques rendering
// ---------------------------------------------------------------

/**
 * Render subtechniques container inside a parent technique element.
 *
 * @param parentEl - The parent technique DOM element
 * @param subtechniques - Array of subtechnique objects
 * @param ctx - Modal context for state and callbacks
 * @param searchState - Current search state for highlighting
 */
export function renderSubtechniques(
    parentEl: HTMLElement,
    subtechniques: MitreTechnique[],
    ctx: MitreModalContext,
    searchState?: SearchState | null
): void {
    const container = parentEl.createDiv({ cls: 'mitre-subtechniques-container' });

    subtechniques.forEach(subtech => {
        const subItem = container.createDiv('mitre-technique-item mitre-subtechnique');

        // Check if subtechnique description is long
        const cleanedDesc = cleanDescription(subtech.description || '');
        const isLongDescription = cleanedDesc.length > ctx.SUBTECHNIQUE_TRUNCATE_LIMIT;

        // Add data attributes for state management
        subItem.setAttribute('data-technique-id', subtech.id);
        subItem.setAttribute('data-full-description', cleanedDesc);
        if (isLongDescription) {
            const truncated = truncateDescription(cleanedDesc, ctx.SUBTECHNIQUE_TRUNCATE_LIMIT);
            subItem.setAttribute('data-truncated-description', truncated);
        }

        // Check if this subtechnique is active
        const isActive = isActiveTechnique(subtech.id, ctx.activeTechniqueId);
        if (isActive) {
            subItem.addClass('mitre-technique-active');
        }

        // Apply styling based on isFound and severity
        if (!subtech.isFound) {
            subItem.addClass('mitre-technique-unfound');
        } else {
            applySeverityClass(subItem, subtech.severity);
        }

        const subInfo = subItem.createDiv('mitre-technique-info');

        // Add expand icon if description is long
        if (isLongDescription) {
            subInfo.createEl('span', {
                cls: 'mitre-expand-icon',
                text: '▶'
            });
            subItem.addClass('has-expandable');
            subItem.addClass('collapsed');

            subItem.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleExpansion(subItem, ctx);
            });
        }

        // Show validation icon for found subtechniques with issues
        if (subtech.isFound && subtech.severity !== 'valid' && subtech.severity !== 'not_found') {
            const warningEl = subInfo.createEl('span', {
                cls: 'mitre-validation-icon',
                attr: {
                    'title': subtech.validationMessage || 'Warning'
                }
            });
            warningEl.innerHTML = getSeverityIcon(subtech.severity);
        }

        subInfo.createEl('span', {
            text: subtech.id,
            cls: 'mitre-technique-id'
        });

        const nameEl = subInfo.createEl('span', {
            text: subtech.name,
            cls: 'mitre-technique-name'
        });

        // Apply search highlighting to name if active
        if (searchState?.isActive) {
            highlightMatches(nameEl, subtech.name, searchState);
        }

        // Show description with truncation
        if (subtech.description) {
            const descEl = subItem.createDiv('mitre-technique-description');

            let displayText: string;
            if (isLongDescription) {
                displayText = truncateDescription(cleanedDesc, ctx.SUBTECHNIQUE_TRUNCATE_LIMIT);
            } else {
                displayText = cleanedDesc;
            }

            descEl.textContent = displayText;

            if (searchState?.isActive) {
                highlightMatches(descEl, displayText, searchState);
            }
        }

        // Show count badge for found subtechniques
        if (subtech.isFound) {
            createCountBadgeWithTooltip(subItem, subtech, ctx);
        }
    });
}
