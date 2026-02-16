/**
 * TimeTimelineProcessing.ts - Chronological IOC timeline extraction
 *
 * Reads all text nodes from the active Obsidian canvas, parses each one
 * for IOC data using the shared IOCParser, and returns them as a flat
 * array suitable for time-based sorting and display.
 *
 * The RenderTimelinesModal sorts the returned array by the `time` field
 * to produce a chronological attack timeline view.
 */

import { App } from 'obsidian';
import { parseIOCNode, IOCNodeData } from '../parsing/IOCParser';
import { DEBUG } from '../debug';

/**
 * Extract IOC data from all canvas text nodes for time-based timeline.
 *
 * Iterates over every node in the active canvas. Each node with a `text`
 * property is parsed via the shared IOCParser. Nodes that match a known
 * IOC type are included in the returned array.
 *
 * The caller (RenderTimelinesModal) sorts the result by time for display.
 *
 * @param app - Obsidian App instance
 * @returns Array of parsed IOC node data objects, unsorted
 */
export function extractFixedIOCData(app: App): IOCNodeData[] {
    if (DEBUG) console.debug('[TimeProcessor] Starting extraction');

    const activeLeaf = app.workspace.activeLeaf;
    if (!activeLeaf || !activeLeaf.view || activeLeaf.view.getViewType() !== 'canvas') {
        if (DEBUG) console.debug('[TimeProcessor] No active canvas view');
        return [];
    }

    const canvasView = activeLeaf.view as any;
    const canvas = canvasView.canvas;
    if (!canvas || !canvas.nodes) {
        if (DEBUG) console.debug('[TimeProcessor] No canvas or nodes');
        return [];
    }

    const totalNodes = canvas.nodes.size || canvas.nodes.length || 0;
    if (DEBUG) console.debug('[TimeProcessor] Processing', totalNodes, 'nodes');

    // Parse each canvas text node and collect those with valid IOC types
    const iocData: IOCNodeData[] = [];
    let emptyValueCount = 0;

    canvas.nodes.forEach((node: any) => {
        if (node.text) {
            const parsedData = parseIOCNode(node);
            if (parsedData) {
                if (!parsedData.value || !parsedData.value.trim()) {
                    emptyValueCount++;
                }
                iocData.push(parsedData);
            }
        }
    });

    if (DEBUG) console.debug('[TimeProcessor] Extraction complete - found:', iocData.length, 'IOCs,', emptyValueCount, 'empty values');
    return iocData;
}
