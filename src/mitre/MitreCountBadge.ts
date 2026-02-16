/**
 * MitreCountBadge.ts - Count badge with hover tooltip for technique items
 *
 * Creates a small badge showing how many IOC cards reference a technique,
 * with a hover tooltip that lists individual card details (type, value).
 */

import { MitreTechnique } from './MitreTypes';
import { MitreModalContext } from './MitreModalHelpers';
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
