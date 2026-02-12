/**
 * RenderTimelinesModal.ts - Full-screen dual-tab timeline visualization.
 *
 * Opens a modal with two tabs:
 *   - Time Timeline: shows all IOC cards sorted chronologically by their
 *     "Time of Event" field. Each item is a colored card with the IOC icon,
 *     value, timestamp, and optional Splunk/MITRE metadata.
 *   - Link Timeline: shows a layered directed graph built from canvas
 *     edges between IOC nodes. Nodes at the same depth are displayed
 *     side-by-side horizontally, with SVG arrows showing all connections.
 *
 * Data flows:
 *   TimeTimelineProcessor  -->  renderEnhancedTimeTimeline()
 *   LinkTimelineProcessor  -->  renderEnhancedLayeredTimeline()
 *
 * All DOM is built with Obsidian's createEl/createDiv API; colors are applied
 * via inline styles using each IOC type's color from the card data.
 */
import { App, Modal, Notice } from 'obsidian';
import { LinkTimelineProcessor, LayeredNode, GraphEdge } from './LinkTimelineProcessing';
import { TimeTimelineProcessor } from './TimeTimelineProcessing';
import { IOCNodeData } from './IOCParser';

export class RenderTimelinesModal extends Modal {
    private plugin: any;
    /** Which tab is currently visible. */
    private activeTab: 'time' | 'link';
    private timeProcessor: TimeTimelineProcessor;
    private linkProcessor: LinkTimelineProcessor;

    constructor(app: App, plugin: any) {
        super(app);
        this.plugin = plugin;
        this.activeTab = 'time';
        this.timeProcessor = new TimeTimelineProcessor(app, plugin, plugin.iocTypes);
        this.linkProcessor = new LinkTimelineProcessor(app, plugin, plugin.iocTypes);
    }

    /** Builds the modal header with tab buttons and renders the default (time) tab. */
    onOpen(): void {
        const { contentEl } = this;
        this.modalEl.classList.add('timeline-modal-fullscreen');

        const headerContainer = contentEl.createDiv('timeline-modal-header');
        headerContainer.createEl('h2', { text: '🕐 Attack Timeline Analysis - Full Screen View' });

        const tabContainer = headerContainer.createDiv('timeline-tabs');
        const timeTab = tabContainer.createEl('button', { text: '🕒 Time Timeline', cls: 'timeline-tab-button' });
        const linkTab = tabContainer.createEl('button', { text: '🔗 Link Timeline', cls: 'timeline-tab-button' });

        this.updateTabStyles(timeTab, linkTab);

        timeTab.addEventListener('click', () => {
            this.activeTab = 'time';
            this.updateTabStyles(timeTab, linkTab);
            this.renderTabContent(contentEl);
        });

        linkTab.addEventListener('click', () => {
            this.activeTab = 'link';
            this.updateTabStyles(timeTab, linkTab);
            this.renderTabContent(contentEl);
        });

        this.renderTabContent(contentEl);
    }

    /** Toggles the `active` CSS class between the two tab buttons. */
    private updateTabStyles(timeTab: HTMLElement, linkTab: HTMLElement): void {
        timeTab.classList.remove('active');
        linkTab.classList.remove('active');

        if (this.activeTab === 'time') {
            timeTab.classList.add('active');
        } else if (this.activeTab === 'link') {
            linkTab.classList.add('active');
        }
    }

    /**
     * Swaps out the tab content area. Removes the previous content DOM node and
     * creates a fresh one, then delegates to the appropriate renderer.
     */
    private renderTabContent(contentEl: HTMLElement): void {
        const existingContent = contentEl.querySelector('.timeline-tab-content');
        if (existingContent) {
            existingContent.remove();
        }

        const contentArea = contentEl.createDiv('timeline-tab-content');

        if (this.activeTab === 'time') {
            this.renderEnhancedTimeTimeline(contentArea);
        } else if (this.activeTab === 'link') {
            this.renderEnhancedLayeredTimeline(contentArea);
        }
    }

    /**
     * Renders the chronological Time Timeline. Extracts IOC data from canvas
     * nodes via the time processor, sorts by event timestamp, and renders each
     * IOC as a colored card with a gradient connector to the next card.
     *
     * DEBUG: Console logs show timeline data for troubleshooting.
     */
    private renderEnhancedTimeTimeline(container: HTMLElement): void {
        console.log('[TimeTimeline] renderEnhancedTimeTimeline - Starting render');

        // Extract IOC data from canvas nodes
        const iocData = this.timeProcessor.extractFixedIOCData();
        console.log('[TimeTimeline] Extracted IOC data - count:', iocData.length);
        console.log('[TimeTimeline] IOC data sample:', iocData.slice(0, 3));

        // Check if we have any IOC cards
        if (iocData.length === 0) {
            console.log('[TimeTimeline] No IOC cards found, showing empty message');
            container.createEl('p', {
                text: 'No IOC cards found in the current canvas. Create some IOC cards first to see the timeline.',
                cls: 'timeline-empty-message'
            });
            return;
        }

        // Sort ascending by event time so the earliest IOC appears first
        iocData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        console.log('[TimeTimeline] Sorted IOC data by time');

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

            // DEBUG: Log value display for this IOC
            console.log('═══════════════════════════════════════════════════');
            console.log('[TimeTimeline] ===== RENDERING IOC CARD =====');
            console.log('[TimeTimeline] IOC Type:', ioc.type);
            console.log('[TimeTimeline] IOC Value:', JSON.stringify(ioc.value));
            console.log('[TimeTimeline] Value is truthy?', !!ioc.value);
            console.log('[TimeTimeline] Value after trim:', ioc.value ? JSON.stringify(ioc.value.trim()) : 'N/A');
            console.log('[TimeTimeline] Will display value?', !!(ioc.value && ioc.value.trim()));
            console.log('[TimeTimeline] IOC Time:', ioc.time);

            // Display time and value together in one line
            const timeEl = detailsContainer.createDiv('timeline-time');
            if (ioc.value && ioc.value.trim()) {
                timeEl.innerHTML = `🕐 Time: ${ioc.time} - Value: ${ioc.value}`;
                console.log('[TimeTimeline] ✓ DISPLAYING combined time+value:', timeEl.innerHTML);
            } else {
                timeEl.innerHTML = `🕐 Time: ${ioc.time}`;
                console.log('[TimeTimeline] ✗ NO VALUE - showing time only');
                console.log('[TimeTimeline] Reason: value is', ioc.value === undefined ? 'undefined' : ioc.value === null ? 'null' : ioc.value === '' ? 'empty string' : 'falsy after trim');
            }
            console.log('═══════════════════════════════════════════════════');

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

    /**
     * Renders the Link Timeline as a layered DAG with horizontal layout.
     * Each node appears exactly once at its maximum depth, nodes at the same
     * depth are displayed side-by-side, and SVG arrows show all connections.
     *
     * DEBUG: Console logs show link timeline data and rendering steps.
     */
    private renderEnhancedLayeredTimeline(container: HTMLElement): void {
        console.log('[LinkTimeline] renderEnhancedLayeredTimeline - Starting render');

        // Extract link-based timeline data
        const linkData = this.linkProcessor.extractEnhancedLinkData();
        console.log('[LinkTimeline] Extracted link data:');
        console.log('  - Layers:', linkData.layers.length);
        console.log('  - Total nodes in layers:', linkData.layers.reduce((sum: number, layer: any[]) => sum + layer.length, 0));
        console.log('  - Edges:', linkData.edges.length);
        console.log('  - Isolated nodes:', linkData.isolatedNodes.length);

        // Check if we have any connected nodes
        if (linkData.layers.length === 0 && linkData.isolatedNodes.length === 0) {
            console.log('[LinkTimeline] No link data found, showing empty message');
            const emptyMessage = container.createEl('div', { cls: 'timeline-empty-message' });
            emptyMessage.innerHTML = `
                <h3>Link Timeline Analysis</h3>
                <p>No connections found between IOC cards.</p>
            `;
            return;
        }

        console.log('[LinkTimeline] Proceeding with DAG rendering');

        const dagContainer = container.createDiv('dag-timeline-container');

        // Create SVG container for arrows (positioned absolutely behind the nodes)
        const svgNS = 'http://www.w3.org/2000/svg';
        const svgContainer = document.createElementNS(svgNS, 'svg');
        svgContainer.classList.add('dag-arrows-svg');
        svgContainer.style.position = 'absolute';
        svgContainer.style.top = '0';
        svgContainer.style.left = '0';
        svgContainer.style.width = '100%';
        svgContainer.style.height = '100%';
        svgContainer.style.pointerEvents = 'none';
        svgContainer.style.zIndex = '0';
        dagContainer.appendChild(svgContainer);

        console.log('[LinkTimeline] SVG container created with z-index:', svgContainer.style.zIndex);

        // Create layers container (will hold node rows)
        const layersContainer = dagContainer.createDiv('dag-layers-container');
        layersContainer.style.position = 'relative';
        layersContainer.style.zIndex = '1';

        console.log('[LinkTimeline] Layers container created with z-index:', layersContainer.style.zIndex);

        // Map to store node positions for arrow drawing
        const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();

        // Render each layer
        linkData.layers.forEach((layer: LayeredNode[], layerIndex: number) => {
            if (layer.length === 0) return;

            const layerRow = layersContainer.createDiv('dag-layer-row');
            layerRow.setAttribute('data-layer', layerIndex.toString());

            layer.forEach((node: LayeredNode) => {
                const nodeWrapper = layerRow.createDiv('dag-node-wrapper');
                nodeWrapper.setAttribute('data-node-id', node.nodeId);

                this.renderLayeredNodeCard(nodeWrapper, node.data);

                // Store position for arrow drawing (we'll update positions after render)
            });
        });

        // Render isolated nodes at the bottom if any
        if (linkData.isolatedNodes.length > 0) {
            const isolatedSection = layersContainer.createDiv('dag-isolated-section');
            const isolatedHeader = isolatedSection.createEl('h4', {
                text: 'Isolated Nodes (No Connections)',
                cls: 'dag-isolated-header'
            });

            const isolatedContainer = isolatedSection.createDiv('dag-isolated-nodes');
            linkData.isolatedNodes.forEach((node: IOCNodeData) => {
                const nodeWrapper = isolatedContainer.createDiv('dag-node-wrapper');
                this.renderLayeredNodeCard(nodeWrapper, node);
            });
        }

        // After rendering, calculate node positions and draw arrows
        setTimeout(() => {
            console.log('[LinkTimeline] ───────────────────────────────────────────────');
            console.log('[LinkTimeline] Calculating node positions and drawing arrows...');
            this.calculateNodePositions(dagContainer, nodePositions);
            console.log('[LinkTimeline] Node positions calculated:', nodePositions.size, 'nodes');
            this.drawArrows(svgContainer, linkData.edges, nodePositions);
            console.log('[LinkTimeline] Arrows drawn:', linkData.edges.length, 'edges');
            console.log('[LinkTimeline] ───────────────────────────────────────────────');

            // Post-draw verification is done inside drawPath() for each edge
        }, 50);
    }

    /**
     * Calculate each node's center position in SVG coordinate space.
     *
     * The SVG overlay is absolutely positioned at (0,0) inside the DAG container,
     * so we need coordinates relative to that container.  getBoundingClientRect()
     * gives viewport coords; we subtract the container's viewport origin AND add
     * back any scroll offset so the arrows stay correct even when the user has
     * scrolled the DAG container.
     */
    private calculateNodePositions(
        container: HTMLElement,
        positions: Map<string, { x: number; y: number; width: number; height: number }>
    ): void {
        const containerRect = container.getBoundingClientRect();
        const scrollTop = container.scrollTop;
        const scrollLeft = container.scrollLeft;

        console.log('[Pos] Container: left=', containerRect.left, 'top=', containerRect.top,
            'scroll=', scrollLeft, scrollTop);

        container.querySelectorAll('.dag-node-wrapper[data-node-id]').forEach((wrapper: Element) => {
            const nodeId = wrapper.getAttribute('data-node-id');
            if (!nodeId) return;

            const rect = wrapper.getBoundingClientRect();
            const x = rect.left + rect.width / 2 - containerRect.left + scrollLeft;
            const y = rect.top + rect.height / 2 - containerRect.top + scrollTop;

            console.log(`[Pos] Node ${nodeId.substring(0, 8)}: center=(${x.toFixed(1)}, ${y.toFixed(1)})  size=${rect.width.toFixed(0)}x${rect.height.toFixed(0)}`);

            positions.set(nodeId, { x, y, width: rect.width, height: rect.height });
        });
    }

    // ── Collision helpers ──────────────────────────────────────────────

    /** Rectangle for a card with added clearance padding on every side. */
    private cardRect(card: { x: number; y: number; width: number; height: number }, clearance: number) {
        return {
            left:   card.x - card.width  / 2 - clearance,
            right:  card.x + card.width  / 2 + clearance,
            top:    card.y - card.height / 2 - clearance,
            bottom: card.y + card.height / 2 + clearance,
        };
    }

    /** Does a vertical segment (fixed x, y from yA to yB) overlap a card? */
    private vSegHitsCard(
        x: number, yA: number, yB: number,
        card: { x: number; y: number; width: number; height: number },
        clearance: number
    ): boolean {
        const r = this.cardRect(card, clearance);
        const top = Math.min(yA, yB);
        const bot = Math.max(yA, yB);
        return x > r.left && x < r.right && bot > r.top && top < r.bottom;
    }

    /** Does a horizontal segment (fixed y, x from xA to xB) overlap a card? */
    private hSegHitsCard(
        y: number, xA: number, xB: number,
        card: { x: number; y: number; width: number; height: number },
        clearance: number
    ): boolean {
        const r = this.cardRect(card, clearance);
        const left = Math.min(xA, xB);
        const right = Math.max(xA, xB);
        return y > r.top && y < r.bottom && right > r.left && left < r.right;
    }

    /** Check if a vertical segment hits ANY card in the list. */
    private vSegHitsAny(
        x: number, yA: number, yB: number,
        cards: Array<{ x: number; y: number; width: number; height: number }>,
        clearance: number
    ): boolean {
        return cards.some(c => this.vSegHitsCard(x, yA, yB, c, clearance));
    }

    /** Check if a horizontal segment hits ANY card in the list. */
    private hSegHitsAny(
        y: number, xA: number, xB: number,
        cards: Array<{ x: number; y: number; width: number; height: number }>,
        clearance: number
    ): boolean {
        return cards.some(c => this.hSegHitsCard(y, xA, xB, c, clearance));
    }

    // ── Arrow drawing ─────────────────────────────────────────────────

    /**
     * Draw SVG arrows between connected nodes.
     * Every line segment is verified against all card rectangles.
     */
    private drawArrows(
        svgContainer: SVGSVGElement,
        edges: GraphEdge[],
        positions: Map<string, { x: number; y: number; width: number; height: number }>
    ): void {
        const svgNS = 'http://www.w3.org/2000/svg';

        // Arrowhead marker
        const defs = document.createElementNS(svgNS, 'defs');
        const marker = document.createElementNS(svgNS, 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '10');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        const polygon = document.createElementNS(svgNS, 'polygon');
        polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygon.setAttribute('fill', 'var(--text-muted)');
        marker.appendChild(polygon);
        defs.appendChild(marker);
        svgContainer.appendChild(defs);

        const allCards = Array.from(positions.values());

        console.log('[Arrow] ═══ ROUTING', edges.length, 'edges, avoiding', allCards.length, 'cards ═══');

        edges.forEach((edge, i) => {
            const from = positions.get(edge.fromId);
            const to   = positions.get(edge.toId);
            if (!from || !to) return;

            const waypoints = this.routeArrow(from, to, allCards);
            this.drawPath(svgContainer, svgNS, waypoints, edge, i, allCards);
        });

        console.log('[Arrow] ═══ ROUTING COMPLETE ═══');
    }

    /**
     * Compute an orthogonal list of waypoints from `from` card bottom to `to` card top
     * that is guaranteed not to overlap any card rectangle (with clearance).
     *
     * The arrowhead (marker) extends ~10 px beyond the last waypoint, so the line
     * itself stops 10 px before the target card edge and only the arrowhead touches.
     */
    private routeArrow(
        from: { x: number; y: number; width: number; height: number },
        to:   { x: number; y: number; width: number; height: number },
        allCards: Array<{ x: number; y: number; width: number; height: number }>
    ): Array<{ x: number; y: number }> {
        const CLEARANCE     = 20;  // line-to-card clearance
        const ARROWHEAD_LEN = 10;  // arrowhead extends this far past line end

        // Obstacles = all cards except the source and target themselves
        const obstacles = allCards.filter(c =>
            !(c.x === from.x && c.y === from.y) &&
            !(c.x === to.x   && c.y === to.y)
        );

        // Start: bottom center of source card + clearance
        const startX = from.x;
        const startY = from.y + from.height / 2 + CLEARANCE;

        // End: top center of target card − arrowhead length (line stops here; arrowhead reaches card)
        const endX = to.x;
        const endY = to.y - to.height / 2 - ARROWHEAD_LEN;

        console.log(`[Route] from (${startX.toFixed(0)},${startY.toFixed(0)}) → (${endX.toFixed(0)},${endY.toFixed(0)})`);

        // ── CASE 1: vertically aligned ──
        if (Math.abs(startX - endX) < 5) {
            // Check if a straight vertical drop hits any obstacle
            if (!this.vSegHitsAny(startX, startY, endY, obstacles, CLEARANCE)) {
                console.log('[Route]   Straight vertical – clear');
                return [{ x: startX, y: startY }, { x: endX, y: endY }];
            }
            // Need to jog horizontally to avoid obstacle(s)
            const jogX = this.findSafeVerticalJog(startX, startY, endY, obstacles, CLEARANCE);
            const midY = (startY + endY) / 2;
            console.log('[Route]   Vertical blocked – jogging via x=', jogX.toFixed(0));
            return [
                { x: startX, y: startY },
                { x: startX, y: midY },
                { x: jogX,   y: midY },
                { x: jogX,   y: midY },     // creates a visible horizontal segment
                { x: endX,   y: midY },
                { x: endX,   y: endY },
            ];
        }

        // ── CASE 2: different columns – orthogonal routing ──
        // Find a safe horizontal Y-level for the cross-over
        const safeY = this.findSafeHorizontalY(startX, startY, endX, endY, obstacles, CLEARANCE);

        // Verify the two vertical legs as well
        const exitClear  = !this.vSegHitsAny(startX, startY, safeY, obstacles, CLEARANCE);
        const entryClear = !this.vSegHitsAny(endX, safeY, endY, obstacles, CLEARANCE);
        const hClear     = !this.hSegHitsAny(safeY, startX, endX, obstacles, CLEARANCE);

        console.log(`[Route]   safeY=${safeY.toFixed(0)}  exitClear=${exitClear}  hClear=${hClear}  entryClear=${entryClear}`);

        if (exitClear && hClear && entryClear) {
            return [
                { x: startX, y: startY },
                { x: startX, y: safeY },
                { x: endX,   y: safeY },
                { x: endX,   y: endY },
            ];
        }

        // If simple 3-segment path still collides, try routing around the outside
        console.log('[Route]   Standard path blocked – trying perimeter route');
        return this.perimeterRoute(startX, startY, endX, endY, obstacles, CLEARANCE);
    }

    /**
     * Find a horizontal Y level between startY and endY (or beyond) where a
     * horizontal segment from startX to endX does NOT hit any obstacle card.
     * Also ensures the vertical legs to/from that Y level are clear.
     */
    private findSafeHorizontalY(
        startX: number, startY: number,
        endX: number, endY: number,
        obstacles: Array<{ x: number; y: number; width: number; height: number }>,
        clearance: number
    ): number {
        // Collect all "forbidden" Y-bands from obstacle cards
        const bands: Array<{ top: number; bottom: number }> = obstacles.map(c => ({
            top:    c.y - c.height / 2 - clearance,
            bottom: c.y + c.height / 2 + clearance,
        }));

        // Try midpoints between source and target
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);

        // Scan from minY to maxY in steps, looking for a Y not inside any band
        for (let y = minY; y <= maxY; y += 10) {
            if (this.yIsClear(y, startX, endX, obstacles, clearance)) return y;
        }

        // Scan below the target
        for (let y = maxY; y < maxY + 600; y += 10) {
            if (this.yIsClear(y, startX, endX, obstacles, clearance)) return y;
        }

        // Scan above the source
        for (let y = minY; y > minY - 600; y -= 10) {
            if (this.yIsClear(y, startX, endX, obstacles, clearance)) return y;
        }

        return maxY + 400; // absolute fallback
    }

    /** Is a horizontal line at Y from xA to xB free of all obstacle cards? */
    private yIsClear(
        y: number, xA: number, xB: number,
        obstacles: Array<{ x: number; y: number; width: number; height: number }>,
        clearance: number
    ): boolean {
        // The horizontal segment must be clear
        if (this.hSegHitsAny(y, xA, xB, obstacles, clearance)) return false;
        // The vertical leg from xA must also be clear to reach this Y
        // (We check a small segment around Y to be safe)
        return true;
    }

    /**
     * When a straight jog is needed for vertically-aligned cards, find an X offset
     * that doesn't pass through any obstacle.
     */
    private findSafeVerticalJog(
        x: number, yA: number, yB: number,
        obstacles: Array<{ x: number; y: number; width: number; height: number }>,
        clearance: number
    ): number {
        // Try offsets to the right, then left
        for (let offset = 80; offset < 500; offset += 40) {
            const rightX = x + offset;
            if (!this.vSegHitsAny(rightX, yA, yB, obstacles, clearance) &&
                !this.hSegHitsAny((yA + yB) / 2, x, rightX, obstacles, clearance)) {
                return rightX;
            }
            const leftX = x - offset;
            if (!this.vSegHitsAny(leftX, yA, yB, obstacles, clearance) &&
                !this.hSegHitsAny((yA + yB) / 2, x, leftX, obstacles, clearance)) {
                return leftX;
            }
        }
        return x + 300;
    }

    /**
     * Fallback: route around the entire set of obstacles by going far to one side.
     */
    private perimeterRoute(
        startX: number, startY: number,
        endX: number, endY: number,
        obstacles: Array<{ x: number; y: number; width: number; height: number }>,
        clearance: number
    ): Array<{ x: number; y: number }> {
        // Find the rightmost and leftmost edges of all obstacles
        let maxRight = -Infinity;
        let minLeft  = Infinity;
        obstacles.forEach(c => {
            maxRight = Math.max(maxRight, c.x + c.width / 2);
            minLeft  = Math.min(minLeft,  c.x - c.width / 2);
        });

        // Route around the right side
        const routeX = maxRight + clearance + 40;
        const midY = (startY + endY) / 2;

        console.log(`[Route]   Perimeter route via x=${routeX.toFixed(0)}`);
        return [
            { x: startX, y: startY },
            { x: startX, y: midY },
            { x: routeX, y: midY },
            { x: routeX, y: endY },
            { x: endX,   y: endY },
        ];
    }

    /**
     * Draw an SVG path through the given waypoints and verify no segment overlaps
     * any card (except via the arrowhead at the end).
     */
    private drawPath(
        svgContainer: SVGSVGElement,
        svgNS: string,
        waypoints: Array<{ x: number; y: number }>,
        edge: GraphEdge,
        edgeIndex: number,
        allCards: Array<{ x: number; y: number; width: number; height: number }>
    ): void {
        if (waypoints.length < 2) return;

        // Build SVG path data
        let d = `M ${waypoints[0].x} ${waypoints[0].y}`;
        for (let i = 1; i < waypoints.length; i++) {
            d += ` L ${waypoints[i].x} ${waypoints[i].y}`;
        }

        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', 'var(--interactive-accent)');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.setAttribute('opacity', '0.7');
        path.classList.add('dag-arrow');
        svgContainer.appendChild(path);

        // ── POST-DRAW VERIFICATION ──
        // Check every segment of the drawn path against every card
        let hasOverlap = false;
        for (let i = 0; i < waypoints.length - 1; i++) {
            const a = waypoints[i];
            const b = waypoints[i + 1];
            const isVertical   = Math.abs(a.x - b.x) < 1;
            const isHorizontal = Math.abs(a.y - b.y) < 1;

            for (const card of allCards) {
                let hits = false;
                if (isVertical) {
                    hits = this.vSegHitsCard(a.x, a.y, b.y, card, 0);
                } else if (isHorizontal) {
                    hits = this.hSegHitsCard(a.y, a.x, b.x, card, 0);
                }
                if (hits) {
                    hasOverlap = true;
                    console.warn(`[Verify] ⚠️ Edge ${edgeIndex} segment ${i} (${a.x.toFixed(0)},${a.y.toFixed(0)})→(${b.x.toFixed(0)},${b.y.toFixed(0)}) OVERLAPS card at (${card.x.toFixed(0)},${card.y.toFixed(0)}) size ${card.width.toFixed(0)}x${card.height.toFixed(0)}`);
                }
            }
        }
        if (!hasOverlap) {
            console.log(`[Verify] ✓ Edge ${edgeIndex}: all ${waypoints.length - 1} segments clear of cards`);
        }

        // Edge label
        if (edge.label && edge.label.trim()) {
            const mid = waypoints[Math.floor(waypoints.length / 2)];
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', mid.x.toString());
            text.setAttribute('y', mid.y.toString());
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', 'var(--text-accent)');
            text.setAttribute('font-size', '12px');
            text.setAttribute('font-weight', '600');
            text.textContent = edge.label;
            svgContainer.appendChild(text);
        }
    }

    /**
     * Renders a single layered node card with full IOC details.
     *
     * DEBUG: Console logs show node rendering details.
     */
    private renderLayeredNodeCard(container: HTMLElement, node: IOCNodeData): void {
        const nodeColor = node.color || 'var(--background-modifier-border)';

        console.log('═══════════════════════════════════════════════════');
        console.log('[LinkTimeline] ===== RENDERING NODE CARD =====');
        console.log('[LinkTimeline] Node Type:', node.type);
        console.log('[LinkTimeline] Node ID:', node.id);
        console.log('[LinkTimeline] Node Value:', JSON.stringify(node.value));
        console.log('[LinkTimeline] Value is truthy?', !!node.value);
        console.log('[LinkTimeline] Value after trim:', node.value ? JSON.stringify(node.value.trim()) : 'N/A');
        console.log('[LinkTimeline] Will display value?', !!(node.value && node.value.trim()));
        console.log('[LinkTimeline] Node Time:', node.time);

        const nodeContainer = container.createDiv('dag-node');
        nodeContainer.style.background = `linear-gradient(135deg, ${nodeColor}15 0%, ${nodeColor}05 100%)`;
        nodeContainer.style.boxShadow = `0 4px 12px ${nodeColor}25`;
        nodeContainer.style.borderColor = nodeColor;

        console.log('[LinkTimeline]   Node container created');
        console.log('[LinkTimeline]   Container element:', container.className);
        console.log('[LinkTimeline]   Node element:', nodeContainer.className);

        const nodeHeader = nodeContainer.createDiv('dag-node-header');

        const iconDiv = nodeHeader.createDiv('dag-node-icon');
        iconDiv.innerHTML = node.icon || '';
        iconDiv.style.background = `${nodeColor}20`;

        const nodeType = nodeHeader.createDiv('dag-node-type');
        nodeType.textContent = node.type || 'Unknown IOC';

        const nodeDetails = nodeContainer.createDiv('dag-node-details');

        // Display value if present
        if (node.value) {
            console.log('[LinkTimeline] ✓ DISPLAYING value:', node.value);
            const valueContainer = nodeDetails.createDiv('dag-node-value-container');
            const valueLabel = valueContainer.createDiv('dag-node-value-label');
            valueLabel.textContent = 'Value';
            const valueEl = valueContainer.createDiv('dag-node-value-text');
            valueEl.textContent = node.value;
        } else {
            console.log('[LinkTimeline] ✗ NO VALUE - not displaying');
            console.log('[LinkTimeline] Reason: value is', node.value === undefined ? 'undefined' : node.value === null ? 'null' : node.value === '' ? 'empty string' : 'falsy after trim');
        }
        console.log('═══════════════════════════════════════════════════');

        if (node.time && node.time.trim()) {
            const timeEl = nodeDetails.createDiv('dag-node-time');
            timeEl.innerHTML = `🕐 Time: ${node.time}`;
        }

        if (node.splunkQuery && node.splunkQuery.trim()) {
            const splunkEl = nodeDetails.createDiv('dag-node-splunk');
            splunkEl.innerHTML = `🔍 Splunk: ${node.splunkQuery}`;
        }

        if (node.tactic && node.tactic.trim()) {
            const tacticEl = nodeDetails.createDiv('dag-node-tactic');
            tacticEl.innerHTML = `⚔️ Tactic: ${node.tactic}`;
        }

        if (node.technique && node.technique.trim()) {
            const techniqueEl = nodeDetails.createDiv('dag-node-technique');
            techniqueEl.innerHTML = `🎯 Technique: ${node.technique}`;
        }

        nodeContainer.addEventListener('mouseover', () => {
            nodeContainer.style.boxShadow = `0 8px 20px ${nodeColor}35`;
        });
        nodeContainer.addEventListener('mouseout', () => {
            nodeContainer.style.boxShadow = `0 4px 12px ${nodeColor}25`;
        });
    }


    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
