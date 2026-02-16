/**
 * CanvasToolbar.ts - Canvas control bar button injection
 *
 * Injects plugin buttons (Timeline, IOC Cards, Reduce, MITRE) into Obsidian's
 * native `.canvas-controls` bar. Uses `.ioc-toolbar` class as a
 * duplicate-injection guard. Each button is a `.canvas-control-item` with
 * a `.clickable-icon` child to match native Obsidian styling.
 */

import { App, ItemView } from 'obsidian';
import { DEBUG } from '../debug';

// ---------------------------------------------------------------
// SVG icon constants (18x18 stroke-based)
// ---------------------------------------------------------------

/** Clock icon for the Timeline button. */
const TIMELINE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

/** Monitor icon for the IOC Cards button. */
const CARDS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';

/** Shrink icon for the Reduce View toggle button. */
const REDUCE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

/** Smaller card icon with arrow for the Child Card button. */
const CHILD_CARD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="6" width="16" height="12" rx="2" ry="2"/><line x1="9" y1="22" x2="15" y2="22"/><line x1="12" y1="18" x2="12" y2="22"/><polyline points="1 12 4 9 7 12"/></svg>';

/** Crosshair icon for the MITRE ATT&CK Mapper button. */
const MITRE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';

// ---------------------------------------------------------------
// Context interface
// ---------------------------------------------------------------

/**
 * Callback bundle passed by main.ts to decouple toolbar from plugin internals.
 * Each callback wires a button to its corresponding plugin action.
 */
export interface ToolbarContext {
    app: App;
    onTimeline: () => void;
    onAddCard: () => void;
    onChildCard: () => void;
    onReduce: () => boolean;   // Returns new isReducedView state
    onMitre: () => void;
    isReducedView: boolean;
}

// ---------------------------------------------------------------
// Button factory
// ---------------------------------------------------------------

/**
 * Creates a single toolbar button with SVG icon for the canvas control bar.
 *
 * @param label - Tooltip / aria-label text
 * @param svgIcon - Inline SVG markup string
 * @param onClick - Click handler
 * @returns The button's root DOM element
 */
export function createToolbarButton(label: string, svgIcon: string, onClick: () => void): HTMLElement {
    const item = document.createElement('div');
    item.className = 'canvas-control-item';
    item.setAttribute('aria-label', label);
    item.setAttribute('title', label);
    item.addEventListener('click', onClick);

    const icon = document.createElement('div');
    icon.className = 'clickable-icon';
    icon.innerHTML = svgIcon;
    item.appendChild(icon);

    return item;
}

// ---------------------------------------------------------------
// Toolbar injection
// ---------------------------------------------------------------

/**
 * Injects control buttons into Obsidian's native canvas control bar.
 *
 * Buttons added:
 *   - Timeline: opens the attack-timeline modal
 *   - IOC Cards: opens the IOC card selector
 *   - Reduce: toggles compact view
 *   - MITRE: opens the MITRE ATT&CK mapper
 *
 * Uses `.ioc-toolbar` class as duplicate-injection guard.
 * Wrapped in try/catch so failures never take down the plugin.
 *
 * @param ctx - ToolbarContext with app reference and button callbacks
 */
export function addCanvasButtons(ctx: ToolbarContext): void {
    try {
        const activeView = ctx.app.workspace.getActiveViewOfType(ItemView);

        // Only inject into canvas views
        if (!activeView || activeView.getViewType() !== 'canvas') {
            return;
        }

        const canvasView = activeView.containerEl;
        if (!canvasView) {
            return;
        }

        // Find Obsidian's native canvas controls bar
        const canvasControls = canvasView.querySelector('.canvas-controls');
        if (!canvasControls) {
            return;
        }

        // Prevent duplicate injection
        if (canvasControls.querySelector('.ioc-toolbar')) {
            return;
        }

        if (DEBUG) console.debug('[CanvasToolbar] Injecting toolbar buttons');

        const iocToolbar = document.createElement('div');
        iocToolbar.className = 'ioc-toolbar';

        const timelineBtn = createToolbarButton('Show Attack Timelines', TIMELINE_SVG, ctx.onTimeline);
        const parentBtn = createToolbarButton('Parent Card', CARDS_SVG, ctx.onAddCard);
        const childBtn = createToolbarButton('Child Card', CHILD_CARD_SVG, ctx.onChildCard);

        const reduceBtn = createToolbarButton('Toggle Reduce View', REDUCE_SVG, () => {
            const newState = ctx.onReduce();
            const icon = reduceBtn.querySelector('.clickable-icon');
            if (icon) icon.classList.toggle('is-active', newState);
        });

        const mitreBtn = createToolbarButton('MITRE ATT&CK Mapper', MITRE_SVG, ctx.onMitre);

        iocToolbar.appendChild(timelineBtn);
        iocToolbar.appendChild(parentBtn);
        iocToolbar.appendChild(childBtn);
        iocToolbar.appendChild(reduceBtn);
        iocToolbar.appendChild(mitreBtn);
        canvasControls.appendChild(iocToolbar);
    } catch (err) {
        // Button injection is non-critical; log and continue
        console.error('IOC Canvas: failed to inject canvas buttons', err);
    }
}
