/**
 * GraphTimelineRendering.ts - DOM element creation for graph timeline
 *
 * Creates all DOM elements needed by the graph timeline:
 *   - Controls bar (From/To inputs, Reset button)
 *   - Graph area (axis, tooltip, selection overlay)
 *   - Colored dots with y-jitter and hover tooltips
 *   - Filtered card list container
 *   - Copy button (positioned absolute in top-right)
 *
 * Returns a GraphTimelineDOM struct with references to all created elements.
 * Event handlers that need viewport state (copy, reset, drag) are NOT set up here -
 * the caller (GraphTimelineTab) wires those up since they depend on mutable state.
 * Dot hover tooltips ARE set up here since they only need each dot's own data.
 */

import { IOCNodeData } from '../types/IOCNodeData';
import { formatTimestamp } from './GraphTimelineHelpers';

// ---------------------------------------------------------------
// DOM element reference struct
// ---------------------------------------------------------------

/**
 * All DOM element references created by createGraphTimelineDOM().
 * Provides the caller with direct access to every interactive element
 * for wiring up event handlers that depend on viewport state.
 */
export interface GraphTimelineDOM {
    controlsEl: HTMLElement;
    startInput: HTMLInputElement;
    endInput: HTMLInputElement;
    resetBtn: HTMLElement;
    graphArea: HTMLElement;
    axisEl: HTMLElement;
    tooltip: HTMLElement;
    selectionOverlay: HTMLElement;
    dots: HTMLElement[];
    listContainer: HTMLElement;
    copyBtn: HTMLElement;
}

// ---------------------------------------------------------------
// DOM creation
// ---------------------------------------------------------------

/**
 * Create all DOM elements for the graph timeline.
 *
 * Builds the full UI structure: controls bar, graph area with axis/dots/tooltip/overlay,
 * list container, and copy button. Dot hover tooltips are wired up here since they
 * only need each dot's own data. Other handlers (drag, copy, reset, input change)
 * are left for the caller to set up.
 *
 * @param container - Parent DOM element to render into
 * @param timedData - IOC data paired with parsed timestamps, sorted chronologically
 * @param dataMinTime - Earliest timestamp in the full dataset
 * @param dataMaxTime - Latest timestamp in the full dataset
 * @returns GraphTimelineDOM with references to all created elements
 */
export function createGraphTimelineDOM(
    container: HTMLElement,
    timedData: Array<{ ioc: IOCNodeData; ts: number }>,
    dataMinTime: number,
    dataMaxTime: number
): GraphTimelineDOM {

    // ---------------------------------------------------------------
    // Time range controls
    // ---------------------------------------------------------------
    const controlsEl = container.createDiv('graph-range-controls');
    controlsEl.createEl('span', { text: 'From: ', cls: 'graph-range-label' });
    const startInput = controlsEl.createEl('input', {
        cls: 'graph-range-input',
        type: 'text'
    }) as HTMLInputElement;
    startInput.value = formatTimestamp(dataMinTime);

    controlsEl.createEl('span', { text: ' To: ', cls: 'graph-range-label' });
    const endInput = controlsEl.createEl('input', {
        cls: 'graph-range-input',
        type: 'text'
    }) as HTMLInputElement;
    endInput.value = formatTimestamp(dataMaxTime);

    const resetBtn = controlsEl.createEl('button', {
        text: 'Reset',
        cls: 'graph-range-reset'
    });

    // ---------------------------------------------------------------
    // Graph area
    // ---------------------------------------------------------------
    const graphArea = container.createDiv('graph-timeline-area');

    // Time axis line
    const axisEl = graphArea.createDiv('graph-time-axis');

    // Tooltip element (shared across all dots, repositioned on hover)
    const tooltip = graphArea.createDiv('graph-tooltip');
    tooltip.style.display = 'none';

    // Selection overlay for drag-to-zoom interaction
    const selectionOverlay = graphArea.createDiv('graph-selection-overlay');
    selectionOverlay.style.display = 'none';

    // ---------------------------------------------------------------
    // Dots with y-jitter and hover tooltips
    // ---------------------------------------------------------------
    const dots: HTMLElement[] = [];
    timedData.forEach((d, idx) => {
        // Y-jitter to avoid overlap: alternate up/down from center
        const yOffset = (idx % 2 === 0 ? -1 : 1) * ((idx % 4) * 6 + 4);

        const dot = graphArea.createDiv('graph-dot');
        dot.style.top = `calc(50% + ${yOffset}px)`;
        dot.style.backgroundColor = d.ioc.color;
        dot.style.borderColor = d.ioc.color;
        dot.setAttribute('data-ts', String(d.ts));

        // Hover tooltip - only needs dot's own data, no viewport state
        dot.addEventListener('mouseenter', () => {
            tooltip.style.display = 'block';
            tooltip.innerHTML = `<strong>${d.ioc.type}</strong><br/>` +
                `${d.ioc.value || '(no value)'}<br/>` +
                `<span class="graph-tooltip-time">${d.ioc.time}</span>`;
            // Position tooltip near the dot
            const rect = graphArea.getBoundingClientRect();
            const dotRect = dot.getBoundingClientRect();
            tooltip.style.left = `${dotRect.left - rect.left + 6}px`;
            tooltip.style.top = `${dotRect.top - rect.top - 60}px`;
        });

        dot.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });

        dots.push(dot);
    });

    // ---------------------------------------------------------------
    // Filtered card list container
    // ---------------------------------------------------------------
    const listContainer = container.createDiv('graph-filtered-list');

    // ---------------------------------------------------------------
    // Copy button (positioned absolute in top-right of modal)
    // Click handler set up by caller since it needs viewport state
    // ---------------------------------------------------------------
    const copyBtn = container.createEl('button', {
        text: 'Copy Filtered Range',
        cls: 'timeline-copy-button graph-timeline-copy'
    });
    copyBtn.style.position = 'absolute';
    copyBtn.style.top = '10px';
    copyBtn.style.right = '10px';

    return {
        controlsEl,
        startInput,
        endInput,
        resetBtn,
        graphArea,
        axisEl,
        tooltip,
        selectionOverlay,
        dots,
        listContainer,
        copyBtn
    };
}
