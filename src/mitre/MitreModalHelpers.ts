/**
 * MitreModalHelpers.ts - Shared context and utilities for MITRE modal rendering
 *
 * Defines the MitreModalContext interface that replaces `this` in extracted
 * rendering functions, plus helper functions used across multiple modal modules.
 */

import { MitreTechnique, SearchState } from './MitreTypes';
import { truncateDescription } from './MitreTextUtils';
import { highlightMatches } from './MitreSearch';
import type { IOCNodeData } from '../types/IOCNodeData';

// ---------------------------------------------------------------
// Context interface
// ---------------------------------------------------------------

/**
 * Shared context passed to extracted rendering functions instead of `this`.
 * Built by RenderMitreModal.getContext() from class properties.
 */
export interface MitreModalContext {
    /** Currently selected technique ID (from canvas selection), or null. */
    activeTechniqueId: string | null;
    /** Current search state, or null if no search is active. */
    currentSearchState: SearchState | null;
    /** Map of parent technique IDs to their subtechnique arrays. */
    subtechniquesMap: Map<string, MitreTechnique[]>;
    /** Map of IOC node IDs to parsed data (for hover tooltips). */
    iocDataMap: Map<string, IOCNodeData>;
    /** Max characters for parent technique descriptions in collapsed state. */
    TECHNIQUE_TRUNCATE_LIMIT: number;
    /** Max characters for subtechnique descriptions in collapsed state. */
    SUBTECHNIQUE_TRUNCATE_LIMIT: number;
    /** Callback to render subtechniques inside a parent element. */
    renderSubtechniques: (parentEl: HTMLElement, subtechniques: MitreTechnique[], searchState?: SearchState | null) => void;
}

// ---------------------------------------------------------------
// Active technique check
// ---------------------------------------------------------------

/**
 * Check if a technique should be highlighted as the active selection.
 * Handles both direct matches and parent-child relationships.
 *
 * @param techniqueId - The technique ID to check
 * @param activeTechniqueId - The currently active technique ID (from canvas selection)
 * @returns true if this technique should be highlighted in purple
 */
export function isActiveTechnique(techniqueId: string, activeTechniqueId: string | null): boolean {
    if (!activeTechniqueId) return false;

    // Direct match
    if (techniqueId === activeTechniqueId) return true;

    // Parent match: selected technique is a subtechnique of this technique
    if (activeTechniqueId.includes('.')) {
        const parentId = activeTechniqueId.split('.')[0];
        if (techniqueId === parentId) return true;
    }

    return false;
}

// ---------------------------------------------------------------
// Expand/collapse toggle
// ---------------------------------------------------------------

/**
 * Toggle expansion (expand/collapse) for techniques or subtechniques.
 * Handles description swap and optional subtechniques rendering.
 *
 * @param element - The technique/subtechnique DOM element
 * @param ctx - Modal context with search state and subtechniques callback
 * @param subtechniques - Subtechniques to render (only for parent techniques)
 */
export function toggleExpansion(
    element: HTMLElement,
    ctx: MitreModalContext,
    subtechniques?: MitreTechnique[]
): void {
    const isCollapsed = element.hasClass('collapsed');
    const expandIcon = element.querySelector('.mitre-expand-icon') as HTMLElement;
    const descEl = element.querySelector('.mitre-technique-description') as HTMLElement;

    if (isCollapsed) {
        // EXPAND
        element.removeClass('collapsed');
        element.addClass('expanded');
        element.setAttribute('data-is-expanded', 'true');
        if (expandIcon) expandIcon.setText('▼');

        // Render subtechniques if provided (only for parent techniques)
        if (subtechniques && subtechniques.length > 0) {
            ctx.renderSubtechniques(element, subtechniques, ctx.currentSearchState);
        }

        // Show full description
        if (descEl) {
            const fullDesc = element.getAttribute('data-full-description');
            if (fullDesc) {
                descEl.textContent = fullDesc;
                if (ctx.currentSearchState?.isActive) {
                    highlightMatches(descEl, fullDesc, ctx.currentSearchState);
                }
            }
        }
    } else {
        // COLLAPSE
        element.removeClass('expanded');
        element.addClass('collapsed');
        element.setAttribute('data-is-expanded', 'false');
        if (expandIcon) expandIcon.setText('▶');

        // Remove subtechniques container if present
        element.querySelector('.mitre-subtechniques-container')?.remove();

        // Show truncated description
        if (descEl) {
            const fullDesc = element.getAttribute('data-full-description');
            const truncatedDesc = element.getAttribute('data-truncated-description');
            const displayText = truncatedDesc || (fullDesc ? truncateDescription(fullDesc) : null);
            if (displayText) {
                descEl.textContent = displayText;
                if (ctx.currentSearchState?.isActive) {
                    highlightMatches(descEl, displayText, ctx.currentSearchState);
                }
            }
        }
    }
}
