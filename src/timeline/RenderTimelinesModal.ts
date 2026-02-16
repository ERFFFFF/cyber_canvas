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
import { App, Modal, Notice } from 'obsidian';
import { TimeTimelineProcessor } from './TimeTimelineProcessing';
import { IOCNodeData } from '../parsing/IOCParser';
import { generateCopyText } from './TimelineCopyExport';
import { renderGraphTimeline } from './GraphTimelineTab';
import { getCanvasEdges } from '../canvas/CanvasEdges';
import { buildParentChildGroups } from './LinkTimelineProcessing';
import { renderLinkTimeline } from './LinkTimelineTab';
import { DEBUG } from '../debug';

export class RenderTimelinesModal extends Modal {
    private plugin: any;
    private timeProcessor: TimeTimelineProcessor;

    constructor(app: App, plugin: any) {
        super(app);
        this.plugin = plugin;
        this.timeProcessor = new TimeTimelineProcessor(app, plugin, plugin.iocTypes);
    }

    onOpen(): void {
        const { contentEl } = this;
        this.modalEl.classList.add('timeline-modal-fullscreen');

        // Extract IOC data once for all tabs
        const iocData = this.timeProcessor.extractFixedIOCData();
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
        this.renderEnhancedTimeTimeline(timeTab, sortedData);

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

    /**
     * Renders the chronological Time Timeline. Takes pre-sorted IOC data
     * and renders each IOC as a colored card with a gradient connector.
     */
    private renderEnhancedTimeTimeline(container: HTMLElement, iocData: IOCNodeData[]): void {
        if (DEBUG) console.debug('[TimeTimeline] Starting render');

        if (iocData.length === 0) {
            container.createEl('p', {
                text: 'No IOC cards found in the current canvas. Create some IOC cards first to see the timeline.',
                cls: 'timeline-empty-message'
            });
            return;
        }

        // Add copy button for Time tab
        const timeCopyBtn = container.createEl('button', {
            text: 'Copy Timeline',
            cls: 'timeline-copy-button'
        });
        timeCopyBtn.style.position = 'absolute';
        timeCopyBtn.style.top = '10px';
        timeCopyBtn.style.right = '10px';
        timeCopyBtn.addEventListener('click', () => {
            const text = generateCopyText(iocData);
            navigator.clipboard.writeText(text).then(() => {
                new Notice(`Copied ${iocData.length} entries to clipboard`);
            });
        });

        const timelineContainer = container.createDiv('timeline-container');

        iocData.forEach((ioc, index) => {
            const timelineItem = timelineContainer.createDiv('timeline-item');

            // Apply the IOC's color to background gradient and shadow for visual grouping
            timelineItem.style.setProperty('--ioc-color', ioc.color);
            timelineItem.style.setProperty('--ioc-color-30', `${ioc.color}30`);
            timelineItem.style.background = `linear-gradient(135deg, ${ioc.color}15 0%, ${ioc.color}05 100%)`;
            timelineItem.style.boxShadow = `0 4px 12px ${ioc.color}25`;
            timelineItem.style.borderColor = ioc.color;

            // Gradient connector between this card and the next one
            if (index < iocData.length - 1) {
                const connector = timelineItem.createDiv('timeline-connector');
                connector.style.background = `linear-gradient(180deg, ${ioc.color} 0%, ${iocData[index + 1].color} 100%)`;
            }

            const iconContainer = timelineItem.createDiv('timeline-icon');
            iconContainer.innerHTML = ioc.icon;
            iconContainer.style.background = `${ioc.color}20`;
            iconContainer.style.borderColor = ioc.color;

            const detailsContainer = timelineItem.createDiv('timeline-details');

            const titleEl = detailsContainer.createEl('h3', { text: ioc.type });
            titleEl.style.textShadow = `0 1px 3px ${ioc.color}40`;

            const timeEl = detailsContainer.createDiv('timeline-time');
            timeEl.textContent = `Time: ${ioc.time}`;

            if (ioc.value && ioc.value.trim()) {
                const valueEl = detailsContainer.createDiv('timeline-value');
                valueEl.textContent = `Value: ${ioc.value}`;
            }

            if (ioc.splunkQuery && ioc.splunkQuery.trim()) {
                const splunkEl = detailsContainer.createDiv('timeline-splunk');
                splunkEl.textContent = `Splunk Query: ${ioc.splunkQuery}`;
            }

            if (ioc.tactic) {
                const tacticEl = detailsContainer.createDiv('timeline-tactic');
                tacticEl.textContent = `Tactic: ${ioc.tactic}`;
            }

            if (ioc.technique) {
                const techniqueEl = detailsContainer.createDiv('timeline-technique');
                techniqueEl.textContent = `Technique: ${ioc.technique}`;
            }

            timelineItem.addEventListener('mouseover', () => {
                timelineItem.style.boxShadow = `0 8px 20px ${ioc.color}35`;
            });

            timelineItem.addEventListener('mouseout', () => {
                timelineItem.style.boxShadow = `0 4px 12px ${ioc.color}25`;
            });
        });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
