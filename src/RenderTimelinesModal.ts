/**
 * RenderTimelinesModal.ts - Timeline visualization for IOC cards.
 *
 * Shows all IOC cards sorted chronologically by their "Time of Event" field.
 * Each item is a colored card with the IOC icon, value, timestamp, and
 * optional Splunk/MITRE metadata.
 *
 * All DOM is built with Obsidian's createEl/createDiv API; colors are applied
 * via inline styles using each IOC type's color from the card data.
 */
import { App, Modal } from 'obsidian';
import { TimeTimelineProcessor } from './TimeTimelineProcessing';
import { IOCNodeData } from './IOCParser';

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

        const headerContainer = contentEl.createDiv('timeline-modal-header');
        headerContainer.createEl('h2', { text: '🕐 Time-Based IOC Timeline' });

        const contentArea = contentEl.createDiv('timeline-tab-content');
        this.renderEnhancedTimeTimeline(contentArea);
    }

    /**
     * Renders the chronological Time Timeline. Extracts IOC data from canvas
     * nodes via the time processor, sorts by event timestamp, and renders each
     * IOC as a colored card with a gradient connector to the next card.
     *
     * DEBUG: Console logs show timeline data for troubleshooting.
     */
    private renderEnhancedTimeTimeline(container: HTMLElement): void {
        console.debug('[TimeTimeline] Starting render');

        // Extract IOC data from canvas nodes
        const iocData = this.timeProcessor.extractFixedIOCData();
        console.debug('[TimeTimeline] Extracted', iocData.length, 'IOC cards');

        // Check if we have any IOC cards
        if (iocData.length === 0) {
            container.createEl('p', {
                text: 'No IOC cards found in the current canvas. Create some IOC cards first to see the timeline.',
                cls: 'timeline-empty-message'
            });
            return;
        }

        // Sort ascending by event time so the earliest IOC appears first
        iocData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        const timelineContainer = container.createDiv('timeline-container');

        iocData.forEach((ioc, index) => {
            const timelineItem = timelineContainer.createDiv('timeline-item');

            // Apply the IOC's color to background gradient and shadow for visual grouping
            timelineItem.style.setProperty('--ioc-color', ioc.color);
            timelineItem.style.setProperty('--ioc-color-30', `${ioc.color}30`);
            timelineItem.style.background = `linear-gradient(135deg, ${ioc.color}15 0%, ${ioc.color}05 100%)`;
            timelineItem.style.boxShadow = `0 4px 12px ${ioc.color}25`;
            timelineItem.style.borderColor = ioc.color;

            // Gradient connector between this card and the next one; blends the
            // two IOC colors to visually link consecutive timeline events
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

            // Display time on first line
            const timeEl = detailsContainer.createDiv('timeline-time');
            timeEl.innerHTML = `🕐 Time: ${ioc.time}`;

            // Display value on its own line below if available
            if (ioc.value && ioc.value.trim()) {
                const valueEl = detailsContainer.createDiv('timeline-value');
                valueEl.innerHTML = `📌 Value: ${ioc.value}`;
            }

            if (ioc.splunkQuery && ioc.splunkQuery.trim()) {
                const splunkEl = detailsContainer.createDiv('timeline-splunk');
                splunkEl.innerHTML = `🔍 Splunk Query: ${ioc.splunkQuery}`;
            }

            if (ioc.tactic) {
                const tacticEl = detailsContainer.createDiv('timeline-tactic');
                tacticEl.innerHTML = `⚔️ Tactic: ${ioc.tactic}`;
            }

            if (ioc.technique) {
                const techniqueEl = detailsContainer.createDiv('timeline-technique');
                techniqueEl.innerHTML = `🎯 Technique: ${ioc.technique}`;
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
