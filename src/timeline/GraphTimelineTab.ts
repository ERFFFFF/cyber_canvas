/**
 * GraphTimelineTab.ts - Horizontal dot graph timeline with drag-to-zoom
 *
 * Orchestrates the interactive graph timeline by:
 *   1. Parsing and filtering IOC data for valid timestamps
 *   2. Delegating DOM creation to GraphTimelineRendering
 *   3. Wiring up interaction handlers (drag-to-zoom, input fields, reset, copy)
 *   4. Managing viewport state and zoom operations via GraphTimelineHelpers
 *
 * Features:
 *   - X-axis: dynamically scales with zoom level
 *   - Colored dots positioned proportionally along the axis
 *   - Hover tooltips showing type, value, time
 *   - Click and drag to select time range and zoom (Splunk-like interaction)
 *   - Manual time range input fields with automatic zoom
 *   - Reset button to zoom back to full data range
 *   - Timeline takes full modal width with edge padding for visibility
 *   - Filtered card list below the graph
 */

import { IOCNodeData } from '../types/IOCNodeData';
import { generateCopyText } from './TimelineCopyExport';
import { Notice } from 'obsidian';
import { computePaddedViewport, formatTimestamp, formatShortTime, EDGE_PADDING_PERCENT } from './GraphTimelineHelpers';
import { createGraphTimelineDOM } from './GraphTimelineRendering';

/**
 * Render the graph timeline tab content.
 *
 * @param container - Parent DOM element to render into
 * @param iocData - IOC card data sorted chronologically
 */
export function renderGraphTimeline(container: HTMLElement, iocData: IOCNodeData[]): void {
    // ---------------------------------------------------------------
    // Early return: no IOC data at all
    // ---------------------------------------------------------------
    if (iocData.length === 0) {
        container.createEl('p', {
            text: 'No IOC cards found. Create some IOC cards with timestamps to see the graph.',
            cls: 'timeline-empty-message'
        });
        return;
    }

    // ---------------------------------------------------------------
    // Parse timestamps and filter out cards without valid times
    // ---------------------------------------------------------------
    const timedData = iocData
        .map(ioc => ({ ioc, ts: new Date(ioc.time).getTime() }))
        .filter(d => !isNaN(d.ts))
        .sort((a, b) => a.ts - b.ts);

    if (timedData.length === 0) {
        container.createEl('p', {
            text: 'No IOC cards with valid timestamps found.',
            cls: 'timeline-empty-message'
        });
        return;
    }

    // Data bounds (never change - represent full dataset)
    const dataMinTime = timedData[0].ts;
    const dataMaxTime = timedData[timedData.length - 1].ts;

    // Viewport bounds (changes with zoom)
    let viewMinTime = dataMinTime;
    let viewMaxTime = dataMaxTime;

    // State for range selection
    let rangeStart = dataMinTime;
    let rangeEnd = dataMaxTime;

    // State for drag interaction
    let isDragging = false;
    let dragStartTime = 0;

    // ---------------------------------------------------------------
    // Create all DOM elements via rendering module
    // ---------------------------------------------------------------
    const dom = createGraphTimelineDOM(container, timedData, dataMinTime, dataMaxTime);
    const {
        startInput, endInput, resetBtn,
        graphArea, axisEl, selectionOverlay,
        dots, listContainer
    } = dom;

    // ---------------------------------------------------------------
    // Viewport update functions
    // ---------------------------------------------------------------

    /**
     * Update axis tick labels based on current viewport.
     * Ticks span the padded range so edge dots are fully visible.
     */
    function updateAxisTicks() {
        // Remove old ticks
        axisEl.querySelectorAll('.graph-axis-tick').forEach(el => el.remove());

        // Calculate padded viewport range
        const { paddedMin, paddedSpan } = computePaddedViewport(viewMinTime, viewMaxTime);

        // Add ticks across the padded range
        const tickCount = Math.min(6, timedData.length);
        for (let i = 0; i < tickCount; i++) {
            const pct = tickCount === 1 ? 50 : (i / (tickCount - 1)) * 100;
            const tickTime = paddedMin + (pct / 100) * paddedSpan;
            const tick = axisEl.createDiv('graph-axis-tick');
            tick.style.left = `${pct}%`;
            tick.setAttribute('data-label', formatShortTime(tickTime));
        }
    }

    /**
     * Reposition all dots based on current viewport.
     * Dots are positioned using padded range so edge dots aren't at exact 0%/100%.
     */
    function updateDotPositions() {
        // Calculate padded viewport range
        const { paddedMin, paddedSpan } = computePaddedViewport(viewMinTime, viewMaxTime);

        dots.forEach(dot => {
            const ts = Number(dot.getAttribute('data-ts'));
            // Hide dots outside actual viewport (use non-padded range for visibility check)
            if (ts < viewMinTime || ts > viewMaxTime) {
                dot.style.display = 'none';
            } else {
                dot.style.display = 'block';
                // Position using padded range (edge dots at ~5% and ~95%, not 0% and 100%)
                const pct = ((ts - paddedMin) / paddedSpan) * 100;
                dot.style.left = `${pct}%`;
            }
        });
    }

    /**
     * Update dot highlighting and filtered card list.
     */
    function updateFilter() {
        // Update dot highlighting
        dots.forEach(dot => {
            const ts = Number(dot.getAttribute('data-ts'));
            if (ts >= rangeStart && ts <= rangeEnd) {
                dot.classList.add('selected');
            } else {
                dot.classList.remove('selected');
            }
        });

        // Render filtered card list
        listContainer.empty();
        const filtered = timedData.filter(d => d.ts >= rangeStart && d.ts <= rangeEnd);

        if (filtered.length === 0) {
            listContainer.createEl('p', { text: 'No cards in selected range.', cls: 'timeline-empty-message' });
            return;
        }

        listContainer.createEl('p', { text: `Showing ${filtered.length} of ${timedData.length} cards`, cls: 'graph-filter-count' });

        filtered.forEach(d => {
            const item = listContainer.createDiv('timeline-item');
            item.style.setProperty('--ioc-color', d.ioc.color);
            item.style.background = `linear-gradient(135deg, ${d.ioc.color}15 0%, ${d.ioc.color}05 100%)`;
            item.style.boxShadow = `0 4px 12px ${d.ioc.color}25`;
            item.style.borderColor = d.ioc.color;

            const iconContainer = item.createDiv('timeline-icon');
            iconContainer.innerHTML = d.ioc.icon;
            iconContainer.style.background = `${d.ioc.color}20`;
            iconContainer.style.borderColor = d.ioc.color;

            const details = item.createDiv('timeline-details');
            const titleEl = details.createEl('h3', { text: d.ioc.type });
            titleEl.style.textShadow = `0 1px 3px ${d.ioc.color}40`;

            details.createDiv({ cls: 'timeline-time', text: `Time: ${d.ioc.time}` });
            if (d.ioc.value && d.ioc.value.trim()) {
                details.createDiv({ cls: 'timeline-value', text: `Value: ${d.ioc.value}` });
            }
            if (d.ioc.tactic) {
                details.createDiv({ cls: 'timeline-tactic', text: `Tactic: ${d.ioc.tactic}` });
            }
            if (d.ioc.technique) {
                details.createDiv({ cls: 'timeline-technique', text: `Technique: ${d.ioc.technique}` });
            }
        });
    }

    /**
     * Zoom the timeline to a specific time range.
     * Updates viewport, repositions dots, regenerates axis ticks, and updates filters.
     *
     * @param newStart - Start timestamp for the zoomed range
     * @param newEnd - End timestamp for the zoomed range
     */
    function zoomToRange(newStart: number, newEnd: number) {
        // Ensure start < end
        if (newStart > newEnd) {
            [newStart, newEnd] = [newEnd, newStart];
        }

        // Update viewport
        viewMinTime = newStart;
        viewMaxTime = newEnd;

        // Update range selection
        rangeStart = newStart;
        rangeEnd = newEnd;

        // Update input fields
        startInput.value = formatTimestamp(newStart);
        endInput.value = formatTimestamp(newEnd);

        // Update visual elements
        updateAxisTicks();
        updateDotPositions();
        updateFilter();
    }

    // ---------------------------------------------------------------
    // Copy button handler (needs viewport state)
    // ---------------------------------------------------------------
    dom.copyBtn.addEventListener('click', () => {
        const text = generateCopyText(timedData.map(d => d.ioc), viewMinTime, viewMaxTime);
        const filtered = timedData.filter(d => d.ts >= viewMinTime && d.ts <= viewMaxTime);
        navigator.clipboard.writeText(text).then(() => {
            new Notice(`Copied ${filtered.length} of ${timedData.length} entries to clipboard`);
        });
    });

    // ---------------------------------------------------------------
    // Drag-to-zoom interaction
    // ---------------------------------------------------------------
    graphArea.addEventListener('mousedown', (e) => {
        // Only start drag on axis area (not on dots)
        if ((e.target as HTMLElement).classList.contains('graph-dot')) return;

        const rect = graphArea.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = (clickX - 30) / (rect.width - 60); // account for container padding

        // Calculate padded viewport range for mouse-to-time conversion
        const { paddedMin, paddedSpan } = computePaddedViewport(viewMinTime, viewMaxTime);

        dragStartTime = paddedMin + pct * paddedSpan;

        // Clamp to data bounds
        dragStartTime = Math.max(dataMinTime, Math.min(dataMaxTime, dragStartTime));

        isDragging = true;
        graphArea.classList.add('dragging');
        startInput.value = formatTimestamp(dragStartTime);

        // Show selection overlay
        selectionOverlay.style.display = 'block';
        selectionOverlay.style.left = `${clickX}px`;
        selectionOverlay.style.width = '0px';
    });

    graphArea.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const rect = graphArea.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const pct = (currentX - 30) / (rect.width - 60);

        // Calculate padded viewport range for mouse-to-time conversion
        const { paddedMin, paddedSpan } = computePaddedViewport(viewMinTime, viewMaxTime);

        const currentTime = paddedMin + pct * paddedSpan;

        // Clamp to data bounds
        const clampedTime = Math.max(dataMinTime, Math.min(dataMaxTime, currentTime));
        endInput.value = formatTimestamp(clampedTime);

        // Update selection overlay (convert dragStartTime back to screen position using padded range)
        const startX = ((dragStartTime - paddedMin) / paddedSpan) * (rect.width - 60) + 30;
        const endX = currentX;
        const left = Math.min(startX, endX);
        const width = Math.abs(endX - startX);
        selectionOverlay.style.left = `${left}px`;
        selectionOverlay.style.width = `${width}px`;
    });

    graphArea.addEventListener('mouseup', (e) => {
        if (!isDragging) return;

        const rect = graphArea.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const pct = (endX - 30) / (rect.width - 60);

        // Calculate padded viewport range for mouse-to-time conversion
        const { paddedMin, paddedSpan } = computePaddedViewport(viewMinTime, viewMaxTime);

        let dragEndTime = paddedMin + pct * paddedSpan;

        // Clamp to data bounds
        dragEndTime = Math.max(dataMinTime, Math.min(dataMaxTime, dragEndTime));

        isDragging = false;
        graphArea.classList.remove('dragging');
        selectionOverlay.style.display = 'none';

        // Only zoom if there's a meaningful selection (> 1 second)
        if (Math.abs(dragEndTime - dragStartTime) > 1000) {
            zoomToRange(dragStartTime, dragEndTime);
        }
    });

    graphArea.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            graphArea.classList.remove('dragging');
            selectionOverlay.style.display = 'none';
        }
    });

    // ---------------------------------------------------------------
    // Event handlers for input fields
    // ---------------------------------------------------------------
    startInput.addEventListener('change', () => {
        const parsed = new Date(startInput.value).getTime();
        if (!isNaN(parsed)) {
            zoomToRange(parsed, rangeEnd);
        }
    });

    endInput.addEventListener('change', () => {
        const parsed = new Date(endInput.value).getTime();
        if (!isNaN(parsed)) {
            zoomToRange(rangeStart, parsed);
        }
    });

    resetBtn.addEventListener('click', () => {
        zoomToRange(dataMinTime, dataMaxTime);
    });

    // ---------------------------------------------------------------
    // Initial render with full range
    // ---------------------------------------------------------------
    updateAxisTicks();
    updateDotPositions();
    updateFilter();
}
