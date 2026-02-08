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
     * @returns Array of parsed IOC node data objects, unsorted
     */
    extractFixedIOCData(): IOCNodeData[] {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (!activeLeaf || !activeLeaf.view || activeLeaf.view.getViewType() !== 'canvas') {
            return [];
        }

        const canvasView = activeLeaf.view as any;
        const canvas = canvasView.canvas;
        if (!canvas || !canvas.nodes) {
            return [];
        }

        // Parse each canvas text node and collect those with valid IOC types
        const iocData: IOCNodeData[] = [];
        canvas.nodes.forEach((node: any) => {
            if (node.text) {
                const parsedData = parseIOCNode(node);
                if (parsedData) {
                    iocData.push(parsedData);
                }
            }
        });

        return iocData;
    }
}
