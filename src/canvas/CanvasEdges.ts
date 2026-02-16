/**
 * CanvasEdges.ts - Canvas edge (arrow) traversal utilities
 *
 * Reads edges from Obsidian's internal canvas API and returns normalized
 * edge data for parent-child relationship detection. Arrow direction
 * determines relationship: fromNode = parent, toNode = child.
 */

import { App, ItemView } from 'obsidian';
import { DEBUG } from '../debug';

/** Normalized edge data representing a canvas arrow between two nodes. */
export interface EdgeData {
    /** Canvas node ID the arrow originates from (parent) */
    fromNodeId: string;
    /** Canvas node ID the arrow points to (child) */
    toNodeId: string;
}

/**
 * Read all edges from the active canvas and return normalized edge data.
 *
 * Accesses the internal canvas API via `(view as any).canvas.edges`.
 * The edges Map contains edge objects with `from.node.id` and `to.node.id`.
 *
 * @param app - Obsidian App instance
 * @returns Array of normalized edge data, empty if no canvas or edges
 */
export function getCanvasEdges(app: App): EdgeData[] {
    const activeView = app.workspace.getActiveViewOfType(ItemView);
    if (!activeView || activeView.getViewType() !== 'canvas') {
        if (DEBUG) console.debug('[CanvasEdges] No active canvas view');
        return [];
    }

    const canvas = (activeView as any).canvas;
    if (!canvas || !canvas.edges) {
        if (DEBUG) console.debug('[CanvasEdges] No canvas or edges');
        return [];
    }

    const edges: EdgeData[] = [];

    canvas.edges.forEach((edge: any) => {
        // Internal canvas edge structure: edge.from.node and edge.to.node
        const fromId = edge?.from?.node?.id;
        const toId = edge?.to?.node?.id;

        if (fromId && toId) {
            edges.push({ fromNodeId: fromId, toNodeId: toId });
        } else if (DEBUG) {
            console.debug('[CanvasEdges] Skipping edge with missing node IDs:', edge);
        }
    });

    if (DEBUG) console.debug('[CanvasEdges] Found', edges.length, 'edges');
    return edges;
}
