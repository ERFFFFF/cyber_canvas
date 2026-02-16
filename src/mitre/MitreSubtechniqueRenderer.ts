/**
 * MitreSubtechniqueRenderer.ts - Subtechnique list rendering
 *
 * Renders the expandable subtechniques container inside a parent technique
 * element. Each subtechnique shows ID, name, truncated description, validation
 * icon, and count badge. Supports expand/collapse for long descriptions.
 */

import { MitreTechnique, SearchState } from './MitreTypes';
import { cleanDescription, truncateDescription } from './MitreTextUtils';
import { applySeverityClass, getSeverityIcon } from './MitreSeverity';
import { highlightMatches } from './MitreSearch';
import { MitreModalContext, isActiveTechnique, toggleExpansion } from './MitreModalHelpers';
import { createCountBadgeWithTooltip } from './MitreCountBadge';

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
