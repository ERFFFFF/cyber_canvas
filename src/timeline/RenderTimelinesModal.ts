/**
 * RenderTimelinesModal.ts - Timeline visualization modal with 3 tabs.
 *
 * Tab 1: Time Timeline - Chronological IOC card display (existing behavior)
 * Tab 2: Graph - Horizontal dot timeline with time range filtering
 * Tab 3: Link Timeline - Parent-child grouping by canvas arrows
 *
 * All DOM is built with Obsidian's createEl/createDiv API; colors are applied
 * via inline styles using each IOC type's color from the card data.
 */
import { App, Modal } from 'obsidian';
import { extractFixedIOCData } from './TimeTimelineProcessing';
import { renderTimeTimeline } from './TimeTimelineTab';
import { renderGraphTimeline } from './GraphTimelineTab';
import { getCanvasEdges } from '../canvas/CanvasEdges';
import { buildParentChildGroups } from './LinkTimelineProcessing';
import { renderLinkTimeline } from './LinkTimelineTab';
import { DEBUG } from '../debug';

export class RenderTimelinesModal extends Modal {
    private plugin: any;

    constructor(app: App, plugin: any) {
        super(app);
        this.plugin = plugin;
    }

    onOpen(): void {
        const { contentEl } = this;
        this.modalEl.classList.add('timeline-modal-fullscreen');

        // Extract IOC data once for all tabs
        const iocData = extractFixedIOCData(this.app);
        if (DEBUG) console.debug('[TimelineModal] Extracted', iocData.length, 'IOC cards');

        // Sort chronologically for time-based views
        const sortedData = [...iocData].sort(
            (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
        );

        // ---------------------------------------------------------------
        // Header with title
        // ---------------------------------------------------------------
        const headerContainer = contentEl.createDiv('timeline-modal-header');
        headerContainer.createEl('h2', { text: 'IOC Timeline' });

        // ---------------------------------------------------------------
        // Tab bar
        // ---------------------------------------------------------------
        const tabBar = contentEl.createDiv('timeline-tab-bar');
        const tabs = [
            { id: 'time', label: 'Time Timeline' },
            { id: 'graph', label: 'Graph' },
            { id: 'link', label: 'Link Timeline' }
        ];

        const tabContents: Record<string, HTMLElement> = {};
        const tabButtons: HTMLElement[] = [];

        tabs.forEach((tab, idx) => {
            const btn = tabBar.createEl('button', {
                text: tab.label,
                cls: 'timeline-tab-button'
            });
            if (idx === 0) btn.classList.add('active');
            tabButtons.push(btn);

            btn.addEventListener('click', () => {
                // Switch active tab
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                Object.values(tabContents).forEach(c => c.style.display = 'none');
                tabContents[tab.id].style.display = 'block';
            });
        });

        // ---------------------------------------------------------------
        // Tab content areas
        // ---------------------------------------------------------------
        const contentArea = contentEl.createDiv('timeline-tab-content-area');

        // Tab 1: Time Timeline
        const timeTab = contentArea.createDiv('timeline-tab-pane');
        tabContents['time'] = timeTab;
        renderTimeTimeline(timeTab, sortedData);

        // Tab 2: Graph
        const graphTab = contentArea.createDiv('timeline-tab-pane');
        graphTab.style.display = 'none';
        tabContents['graph'] = graphTab;
        renderGraphTimeline(graphTab, sortedData);

        // Tab 3: Link Timeline
        const linkTab = contentArea.createDiv('timeline-tab-pane');
        linkTab.style.display = 'none';
        tabContents['link'] = linkTab;
        const edges = getCanvasEdges(this.app);
        const result = buildParentChildGroups(iocData, edges);
        renderLinkTimeline(linkTab, result);
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
