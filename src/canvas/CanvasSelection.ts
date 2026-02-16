/**
 * CanvasSelection.ts - Extract MITRE technique from selected canvas node
 *
 * Reads the currently selected canvas node and parses its IOC card text
 * to extract a MITRE technique ID. Used by the MITRE toolbar button to
 * pre-highlight the technique of the selected card when the modal opens.
 *
 * Tries three approaches to detect selection (internal API is undocumented):
 *   1. canvas.selection (Set of node IDs)
 *   2. canvas.selectedNodes (array or Set of node objects)
 *   3. Iterating canvas.nodes and checking node.selected flag
 */

import { App, ItemView } from 'obsidian';
import { parseIOCNode } from '../parsing/IOCParser';
import { DEBUG } from '../debug';

/**
 * Extract MITRE technique ID from the currently selected canvas node.
 *
 * @param app - Obsidian App instance
 * @returns Technique ID (e.g., "T1566.001") or null if no selection or no technique
 */
export function getSelectedTechniqueId(app: App): string | null {
    try {
        const activeView = app.workspace.getActiveViewOfType(ItemView);
        if (!activeView || activeView.getViewType() !== 'canvas') {
            return null;
        }

        const canvas = (activeView as any).canvas;
        if (!canvas) {
            return null;
        }

        // Try multiple approaches to find selected node
        let selectedNode: any = null;

        // Approach 1: canvas.selection (likely a Set)
        if (canvas.selection && canvas.selection.size > 0) {
            const firstSelectedId = Array.from(canvas.selection)[0];
            selectedNode = canvas.nodes.get(firstSelectedId);
        }

        // Approach 2: canvas.selectedNodes
        if (!selectedNode && canvas.selectedNodes) {
            if (Array.isArray(canvas.selectedNodes) && canvas.selectedNodes.length > 0) {
                selectedNode = canvas.selectedNodes[0];
            } else if (canvas.selectedNodes.size > 0) {
                selectedNode = Array.from(canvas.selectedNodes)[0];
            }
        }

        // Approach 3: Iterate nodes and check selected flag
        if (!selectedNode && canvas.nodes) {
            canvas.nodes.forEach((node: any) => {
                if (node.selected || node.isSelected) {
                    selectedNode = node;
                    return;
                }
            });
        }

        if (!selectedNode || !selectedNode.text) {
            return null;
        }

        // Parse IOC card using existing parser
        const parsedData = parseIOCNode(selectedNode);
        if (!parsedData || !parsedData.technique || !parsedData.technique.trim()) {
            return null;
        }

        // Extract technique ID
        const technique = parsedData.technique.toUpperCase();
        const idMatch = technique.match(/T\d{4}(?:\.\d{3})?/i);
        if (idMatch) {
            if (DEBUG) console.debug('[CanvasSelection] Selected technique:', idMatch[0].toUpperCase());
            return idMatch[0].toUpperCase();
        }

        return null;

    } catch (err) {
        console.error('[CanvasSelection] Error getting selected technique:', err);
        return null;
    }
}
