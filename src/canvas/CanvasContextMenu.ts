/**
 * CanvasContextMenu.ts - Right-click context menu for IOC card role conversion
 *
 * Intercepts the `contextmenu` event on canvas nodes to provide IOC-specific
 * actions: converting between Parent [P] and Child [C] roles, and deleting
 * selected nodes. Non-IOC nodes are left alone so Obsidian's default context
 * menu appears normally.
 *
 * Uses DOM-level event interception because Obsidian has no official
 * `canvas:node-menu` workspace event — only file-menu, editor-menu, etc.
 */

import { App, ItemView, Menu } from 'obsidian';
import { DEBUG } from '../debug';

// ---------------------------------------------------------------
// Listener tracking for cleanup
// ---------------------------------------------------------------

/** WeakMap to store listener references for cleanup on unload. */
const listenerMap = new WeakMap<HTMLElement, (e: MouseEvent) => void>();

// ---------------------------------------------------------------
// Role conversion
// ---------------------------------------------------------------

/**
 * Modify a canvas node's text to change its role badge.
 *
 * Performs two string replacements in the HTML header:
 *   - CSS class: ioc-role-parent <-> ioc-role-child
 *   - Badge text: >[P]< <-> >[C]<
 *
 * @param node - Canvas node object (has .text property)
 * @param targetRole - The role to convert to
 */
function convertCardRole(node: any, targetRole: 'parent' | 'child'): void {
    const text: string = node.text || node.getText?.() || '';
    if (!text) return;

    let newText: string;
    if (targetRole === 'child') {
        // P -> C
        newText = text
            .replace('ioc-role-parent', 'ioc-role-child')
            .replace('>[P]<', '>[C]<');
    } else {
        // C -> P
        newText = text
            .replace('ioc-role-child', 'ioc-role-parent')
            .replace('>[C]<', '>[P]<');
    }

    // Update the node text via the canvas API
    if (node.setText) {
        node.setText(newText);
    } else {
        node.text = newText;
    }

    if (DEBUG) console.debug(`[CanvasContextMenu] Converted node to ${targetRole}`);
}

/**
 * Check if a node's text contains an IOC role badge ([P] or [C]).
 * @returns 'parent' | 'child' | null
 */
function getNodeRole(node: any): 'parent' | 'child' | null {
    const text: string = node.text || node.getText?.() || '';
    if (/>\[P\]</.test(text)) return 'parent';
    if (/>\[C\]</.test(text)) return 'child';
    return null;
}

// ---------------------------------------------------------------
// Context menu handler
// ---------------------------------------------------------------

/**
 * Set up the right-click context menu on a canvas wrapper element.
 *
 * Attaches a `contextmenu` listener (capture phase) that:
 *   1. Finds the clicked .canvas-node element
 *   2. Maps it to a canvas node object via nodeEl comparison
 *   3. Checks if the node is an IOC card (has [P] or [C] badge)
 *   4. Shows an Obsidian Menu with role conversion + delete options
 *
 * For non-IOC nodes, the event propagates normally so Obsidian's
 * default context menu appears.
 *
 * @param app - Obsidian App instance
 * @param canvas - The internal canvas object (has .nodes, .selection, .wrapperEl)
 */
export function setupCanvasContextMenu(app: App, canvas: any): void {
    const wrapperEl: HTMLElement = canvas.wrapperEl;
    if (!wrapperEl) return;

    // Prevent duplicate listeners on the same wrapper
    if (listenerMap.has(wrapperEl)) return;

    const handler = (e: MouseEvent) => {
        // Step 1: Find the clicked .canvas-node DOM element
        const nodeEl = (e.target as HTMLElement).closest('.canvas-node');
        if (!nodeEl) return; // Click wasn't on a node — let default menu show

        // Step 2: Map DOM element to canvas node object
        let targetNode: any = null;
        canvas.nodes.forEach((node: any) => {
            if (node.nodeEl === nodeEl || node.contentEl === nodeEl) {
                targetNode = node;
            }
        });
        if (!targetNode) return;

        // Step 3: Check if this is an IOC card
        const clickedRole = getNodeRole(targetNode);
        if (!clickedRole) return; // Not an IOC card — let Obsidian handle it

        // Step 4: Prevent Obsidian's default context menu
        e.preventDefault();
        e.stopImmediatePropagation();

        // Step 5: Determine selection — single card or multi-select
        const selectedNodes: any[] = [];
        const selection = canvas.selection;
        if (selection && selection.size > 1 && selection.has(targetNode)) {
            // Multi-select: operate on all selected IOC cards
            selection.forEach((node: any) => {
                if (getNodeRole(node)) {
                    selectedNodes.push(node);
                }
            });
        } else {
            // Single card
            selectedNodes.push(targetNode);
        }

        // Step 6: Build the menu
        const menu = new Menu();
        const isMulti = selectedNodes.length > 1;

        if (isMulti) {
            // Multi-select: show both conversion options
            menu.addItem((item) => {
                item.setTitle('Convert to Parent [P]')
                    .setIcon('arrow-up-circle')
                    .onClick(() => {
                        selectedNodes.forEach(n => convertCardRole(n, 'parent'));
                        canvas.requestSave();
                    });
            });
            menu.addItem((item) => {
                item.setTitle('Convert to Child [C]')
                    .setIcon('arrow-down-circle')
                    .onClick(() => {
                        selectedNodes.forEach(n => convertCardRole(n, 'child'));
                        canvas.requestSave();
                    });
            });
        } else {
            // Single card: show only the opposite role
            const oppositeRole = clickedRole === 'parent' ? 'child' : 'parent';
            const label = oppositeRole === 'parent'
                ? 'Convert to Parent [P]'
                : 'Convert to Child [C]';
            const icon = oppositeRole === 'parent'
                ? 'arrow-up-circle'
                : 'arrow-down-circle';

            menu.addItem((item) => {
                item.setTitle(label)
                    .setIcon(icon)
                    .onClick(() => {
                        convertCardRole(targetNode, oppositeRole);
                        canvas.requestSave();
                    });
            });
        }

        // Separator + Delete option
        menu.addSeparator();
        menu.addItem((item) => {
            item.setTitle('Delete')
                .setIcon('trash')
                .onClick(() => {
                    selectedNodes.forEach(n => canvas.removeNode(n));
                    canvas.requestSave();
                });
        });

        menu.showAtMouseEvent(e);
    };

    // Attach on capture phase to intercept before Obsidian's handler
    wrapperEl.addEventListener('contextmenu', handler, true);
    listenerMap.set(wrapperEl, handler);

    if (DEBUG) console.debug('[CanvasContextMenu] Context menu handler attached');
}

// ---------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------

/**
 * Remove the context menu listener from a canvas wrapper element.
 * Called during plugin unload to prevent memory leaks.
 *
 * @param wrapperEl - The canvas wrapper DOM element
 */
export function removeCanvasContextMenu(wrapperEl: HTMLElement): void {
    const handler = listenerMap.get(wrapperEl);
    if (handler) {
        wrapperEl.removeEventListener('contextmenu', handler, true);
        listenerMap.delete(wrapperEl);
        if (DEBUG) console.debug('[CanvasContextMenu] Context menu handler removed');
    }
}
