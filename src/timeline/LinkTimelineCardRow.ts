/**
 * LinkTimelineCardRow.ts - Shared card row rendering for Link Timeline
 *
 * Renders an IOC card row with role badge, icon, and details.
 * Used by renderLeafNode and error item rendering in LinkTimelineTab.
 */

import { IOCNodeData } from '../types/IOCNodeData';

/**
 * Options for rendering an IOC card row in the Link Timeline.
 */
export interface CardRowOptions {
    container: HTMLElement;
    ioc: IOCNodeData;
    showConnector?: boolean;
    depth?: number;
    extraClasses?: string[];
}

/**
 * Render a single IOC card row with role badge, icon, and details.
 * @returns The created row HTMLElement
 */
export function renderIOCCardRow(opts: CardRowOptions): HTMLElement {
    const { container, ioc, showConnector = false, depth = 0, extraClasses = [] } = opts;

    const rowEl = container.createDiv('link-timeline-child');
    extraClasses.forEach(cls => rowEl.classList.add(cls));
    if (depth > 0) {
        rowEl.classList.add(`depth-${depth}`);
        rowEl.style.marginLeft = `${depth * 30}px`;
    }
    rowEl.style.borderLeftColor = ioc.color;

    if (showConnector) {
        rowEl.createDiv('link-timeline-connector');
    }

    rowEl.createEl('span', {
        text: ioc.isChild ? '[C]' : '[P]',
        cls: `link-timeline-role-badge ${ioc.isChild ? 'role-child' : 'role-parent'}`
    });

    const iconEl = rowEl.createDiv('link-timeline-icon');
    iconEl.innerHTML = ioc.icon;
    iconEl.style.color = ioc.color;

    const detailsEl = rowEl.createDiv('link-timeline-details');
    detailsEl.createEl('strong', { text: ioc.type });
    if (ioc.time) {
        detailsEl.createEl('span', { text: ` | ${ioc.time}`, cls: 'link-timeline-time' });
    }
    if (ioc.cardId) {
        detailsEl.createEl('span', { text: ` | ${ioc.cardId}`, cls: 'link-timeline-card-id' });
    }
    if (ioc.value && ioc.value.trim()) {
        detailsEl.createDiv({ text: ioc.value, cls: 'link-timeline-value' });
    }
    if (ioc.tactic) {
        detailsEl.createDiv({ text: `Tactic: ${ioc.tactic}`, cls: 'link-timeline-tactic' });
    }
    if (ioc.technique) {
        detailsEl.createDiv({ text: `Technique: ${ioc.technique}`, cls: 'link-timeline-technique' });
    }

    return rowEl;
}
