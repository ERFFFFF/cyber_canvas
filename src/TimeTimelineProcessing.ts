/**
 * TimeTimelineProcessing.ts - Chronological IOC timeline extraction
 *
 * This processor reads all text nodes from the active Obsidian canvas,
 * parses each one for IOC data using the shared IOCParser, and returns
 * them as a flat array suitable for time-based sorting and display.
 *
 * The RenderTimelinesModal sorts the returned array by the `time` field
 * to produce a chronological attack timeline view.
 */

import { App } from 'obsidian';
import { IOCCardsTypes } from './IOCCardsTypes';
import { parseIOCNode, IOCNodeData } from './IOCParser';

export class TimeTimelineProcessor {
    private app: App;
    private plugin: any;
    private IOCCardsTypes: IOCCardsTypes;

    constructor(app: App, plugin: any, IOCCardsTypes: IOCCardsTypes) {
        this.app = app;
        this.plugin = plugin;
        this.IOCCardsTypes = IOCCardsTypes;
    }

    /**
     * Extract IOC data from all canvas text nodes for time-based timeline.
     *
     * Iterates over every node in the active canvas. Each node with a `text`
     * property is parsed via the shared IOCParser. Nodes that match a known
     * IOC type are included in the returned array.
     *
     * The caller (RenderTimelinesModal) sorts the result by time for display.
     *
     * DEBUG: Console logs show processing steps for troubleshooting.
     *
     * @returns Array of parsed IOC node data objects, unsorted
     */
    extractFixedIOCData(): IOCNodeData[] {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[TimeProcessor] ===== STARTING TIME TIMELINE EXTRACTION =====');

        const activeLeaf = this.app.workspace.activeLeaf;
        if (!activeLeaf || !activeLeaf.view || activeLeaf.view.getViewType() !== 'canvas') {
            console.log('[TimeProcessor] ✗ No active canvas view found');
            console.log('[TimeProcessor] ===== EXTRACTION FAILED =====');
            return [];
        }

        const canvasView = activeLeaf.view as any;
        const canvas = canvasView.canvas;
        if (!canvas || !canvas.nodes) {
            console.log('[TimeProcessor] ✗ No canvas or canvas.nodes found');
            console.log('[TimeProcessor] ===== EXTRACTION FAILED =====');
            return [];
        }

        const totalNodes = canvas.nodes.size || canvas.nodes.length || 0;
        console.log('[TimeProcessor] ✓ Canvas found with', totalNodes, 'total nodes');
        console.log('[TimeProcessor] Processing nodes...');

        // Parse each canvas text node and collect those with valid IOC types
        const iocData: IOCNodeData[] = [];
        let processedCount = 0;
        let iocCount = 0;
        let emptyValueCount = 0;

        canvas.nodes.forEach((node: any) => {
            processedCount++;
            if (node.text) {
                console.log(`[TimeProcessor] ───── Node ${processedCount}/${totalNodes} ─────`);
                console.log('[TimeProcessor] Node ID:', node.id);
                console.log('[TimeProcessor] Parsing node...');

                const parsedData = parseIOCNode(node);
                if (parsedData) {
                    iocCount++;
                    console.log('[TimeProcessor] ✓ IOC detected:', parsedData.type);
                    console.log('[TimeProcessor]   Value:', parsedData.value ? `"${parsedData.value}"` : '(EMPTY)');
                    console.log('[TimeProcessor]   Time:', parsedData.time || '(no time)');

                    if (!parsedData.value || !parsedData.value.trim()) {
                        emptyValueCount++;
                        console.log('[TimeProcessor]   ⚠️  WARNING: This IOC has an EMPTY value!');
                    }

                    iocData.push(parsedData);
                } else {
                    console.log('[TimeProcessor] ✗ Not an IOC node (no match)');
                }
            }
        });

        console.log('[TimeProcessor] ───────────────────────────────────────────────');
        console.log('[TimeProcessor] ===== EXTRACTION SUMMARY =====');
        console.log('[TimeProcessor] Total nodes processed:', processedCount);
        console.log('[TimeProcessor] IOC cards found:', iocCount);
        console.log('[TimeProcessor] IOCs with values:', iocCount - emptyValueCount);
        console.log('[TimeProcessor] IOCs with EMPTY values:', emptyValueCount);
        console.log('[TimeProcessor] Returning', iocData.length, 'IOC data objects');
        console.log('[TimeProcessor] ===== EXTRACTION COMPLETE =====');
        console.log('═══════════════════════════════════════════════════════════════');

        return iocData;
    }
}
