/**
 * TimeTimelineTab.ts - Chronological Time Timeline renderer.
 *
 * Renders IOC cards as a vertical timeline sorted by "Time of Event".
 * Each card is displayed with its IOC color, gradient connectors between
 * consecutive items, SVG icon, and detail fields (time, value, splunk, MITRE).
 * Includes a copy button that exports all entries to clipboard.
 */

import { Notice } from 'obsidian';
import { IOCNodeData } from '../parsing/IOCParser';
import { generateCopyText } from './TimelineCopyExport';
import { DEBUG } from '../debug';

/**
 * Renders the chronological Time Timeline into the given container.
 *
 * Takes pre-sorted IOC data and renders each IOC as a colored card with:
 * - Gradient background and shadow using the IOC type's color
 * - Gradient connector line between consecutive cards
 * - SVG icon with colored border
 * - Detail fields: time, value, splunk query, tactic, technique
 * - Hover effect (enhanced box shadow)
 * - Copy button to export all entries as tab-separated text
 *
 * @param container - DOM element to render the timeline into
 * @param iocData - Array of parsed IOC data, pre-sorted chronologically
 */
export function renderTimeTimeline(container: HTMLElement, iocData: IOCNodeData[]): void {
    if (DEBUG) console.debug('[TimeTimeline] Starting render');

    // ---------------------------------------------------------------
    // Empty state: no IOC cards found
    // ---------------------------------------------------------------
    if (iocData.length === 0) {
        container.createEl('p', {
            text: 'No IOC cards found in the current canvas. Create some IOC cards first to see the timeline.',
            cls: 'timeline-empty-message'
        });
        return;
    }

    // ---------------------------------------------------------------
    // Copy button: exports all IOC entries as tab-separated text
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // Timeline items: one card per IOC, connected by gradient lines
    // ---------------------------------------------------------------
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

        // Hover effect: enhanced box shadow on mouseover
        timelineItem.addEventListener('mouseover', () => {
            timelineItem.style.boxShadow = `0 8px 20px ${ioc.color}35`;
        });

        timelineItem.addEventListener('mouseout', () => {
            timelineItem.style.boxShadow = `0 4px 12px ${ioc.color}25`;
        });
    });
}
