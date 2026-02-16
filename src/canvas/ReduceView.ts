/**
 * ReduceView.ts - Compact/reduced view toggle for IOC cards
 *
 * Toggles between normal and compact view for all IOC cards on the active
 * canvas. Compact view hides card headers and metadata (via CSS class)
 * and resizes all text nodes to 60px height (via canvas API).
 *
 * Two-part implementation:
 *   1. CSS: `.ioc-reduced` class on canvas wrapper hides content
 *   2. JS: canvas node heights stored in `_iocOriginalHeight`, resized to 60px
 */

import { App, ItemView } from 'obsidian';
import { DEBUG } from '../debug';

/**
 * Toggle the reduced/compact view for IOC cards on the active canvas.
 *
 * Algorithm:
 *   1. Toggle isReducedView flag (passed by reference via return value)
 *   2. Add/remove `.ioc-reduced` class on canvas wrapper
 *   3. Loop through all canvas text nodes:
 *      - If reducing: store original height in `_iocOriginalHeight`, resize to 60px
 *      - If restoring: read stored height, restore original dimensions
 *   4. Call canvas.requestFrame() and canvas.requestSave() to persist
 *
 * Why 60px: enough to show a single line of text with padding.
 *
 * @param app - Obsidian App instance
 * @param isReducedView - Current state (true = currently reduced)
 * @returns New state after toggle (true = now reduced)
 */
export function toggleReduceView(app: App, isReducedView: boolean): boolean {
    const activeView = app.workspace.getActiveViewOfType(ItemView);
    if (!activeView || activeView.getViewType() !== 'canvas') return isReducedView;

    const canvas = (activeView as any).canvas;
    if (!canvas) return isReducedView;

    const newState = !isReducedView;

    if (DEBUG) console.debug('[ReduceView] Toggling reduce view:', isReducedView, '->', newState);

    // Add/remove CSS class on the canvas wrapper for CSS-based content hiding
    const wrapperEl = canvas.wrapperEl;
    if (wrapperEl) {
        if (newState) {
            wrapperEl.classList.add('ioc-reduced');
        } else {
            wrapperEl.classList.remove('ioc-reduced');
        }
    }

    // Resize all text nodes
    if (canvas.nodes) {
        canvas.nodes.forEach((node: any) => {
            if (!node.text) return; // only text nodes (IOC cards have text)
            if (newState) {
                // Store original dimensions before reducing
                if (!node._iocOriginalHeight) {
                    node._iocOriginalHeight = node.height;
                }
                // Resize to compact single-line height
                if (node.resize) {
                    node.resize({ width: node.width, height: 60 });
                } else {
                    node.height = 60;
                }
            } else {
                // Restore original height
                const originalH = node._iocOriginalHeight || 400;
                if (node.resize) {
                    node.resize({ width: node.width, height: originalH });
                } else {
                    node.height = originalH;
                }
            }
        });
    }

    canvas.requestFrame();
    canvas.requestSave();

    return newState;
}
