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

        // Create layers container (will hold node rows)
        const layersContainer = dagContainer.createDiv('dag-layers-container');
        layersContainer.style.position = 'relative';
        layersContainer.style.zIndex = '1';

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
            this.calculateNodePositions(dagContainer, nodePositions);
            this.drawArrows(svgContainer, linkData.edges, nodePositions);
        }, 50);
    }

    /**
     * Calculate the center position of each node for arrow drawing
     */
    private calculateNodePositions(
        container: HTMLElement,
        positions: Map<string, { x: number; y: number; width: number; height: number }>
    ): void {
        const containerRect = container.getBoundingClientRect();
        const nodeWrappers = container.querySelectorAll('.dag-node-wrapper[data-node-id]');

        nodeWrappers.forEach((wrapper: Element) => {
            const nodeId = wrapper.getAttribute('data-node-id');
            if (!nodeId) return;

            const rect = wrapper.getBoundingClientRect();
            positions.set(nodeId, {
                x: rect.left + rect.width / 2 - containerRect.left,
                y: rect.top + rect.height / 2 - containerRect.top,
                width: rect.width,
                height: rect.height
            });
        });
    }

    /**
     * Draw SVG arrows between connected nodes with improved routing to prevent overlap
     */
    private drawArrows(
        svgContainer: SVGSVGElement,
        edges: GraphEdge[],
        positions: Map<string, { x: number; y: number; width: number; height: number }>
    ): void {
        const svgNS = 'http://www.w3.org/2000/svg';

        // Create arrow marker definition
        const defs = document.createElementNS(svgNS, 'defs');
        const marker = document.createElementNS(svgNS, 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '10');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3');
        marker.setAttribute('orient', 'auto');
        marker.setAttribute('markerUnits', 'strokeWidth');

        const polygon = document.createElementNS(svgNS, 'polygon');
        polygon.setAttribute('points', '0 0, 10 3, 0 6');
        polygon.setAttribute('fill', 'var(--text-muted)');
        marker.appendChild(polygon);
        defs.appendChild(marker);
        svgContainer.appendChild(defs);

        // Group edges by source node for merging
        const edgesBySource = new Map<string, GraphEdge[]>();
        edges.forEach((edge: GraphEdge) => {
            if (!edgesBySource.has(edge.fromId)) {
                edgesBySource.set(edge.fromId, []);
            }
            edgesBySource.get(edge.fromId)!.push(edge);
        });

        // Draw edges with smart routing
        edgesBySource.forEach((sourceEdges: GraphEdge[], fromId: string) => {
            const fromPos = positions.get(fromId);
            if (!fromPos) return;

            // If single edge from this source, draw directly
            if (sourceEdges.length === 1) {
                const edge = sourceEdges[0];
                const toPos = positions.get(edge.toId);
                if (!toPos) return;

                this.drawSingleArrow(svgContainer, svgNS, fromPos, toPos, edge);
            } else {
                // Multiple edges from same source - draw with trunk and branches
                this.drawMergedArrows(svgContainer, svgNS, fromPos, sourceEdges, positions);
            }
        });
    }

    /**
     * Draw a single arrow where the arrowhead touches the card but the line doesn't.
     * The arrow LINE is kept clear of cards (12px minimum), and the arrowhead (~10px)
     * extends from there to touch the card edge (effectively 0-2px from card).
     *
     * DEBUG: Console logs show arrow routing calculations.
     */
    private drawSingleArrow(
        svgContainer: SVGSVGElement,
        svgNS: string,
        fromPos: { x: number; y: number; width: number; height: number },
        toPos: { x: number; y: number; width: number; height: number },
        edge: GraphEdge
    ): void {
        // CLEARANCE: Line endpoint is 12px from card edge, arrowhead (~10px) extends to touch card
        // This means LINE stays 12px clear, arrowhead tip reaches ~2px from card (visually touching)
        const LINE_CLEARANCE = 12; // Distance from card edge to line endpoint
        const ARROWHEAD_LENGTH = 10; // Arrowhead extends this much beyond line
        const HORIZONTAL_CLEARANCE = 50; // Extra horizontal clearance around cards

        // Start point: 12px below the bottom edge of source card
        const x1 = fromPos.x;
        const y1 = fromPos.y + fromPos.height / 2 + LINE_CLEARANCE;

        // End point: 12px above the top edge of target card (arrowhead will reach ~2px, touching)
        const x2 = toPos.x;
        const y2 = toPos.y - toPos.height / 2 - LINE_CLEARANCE;

        console.log('[Arrow] drawSingleArrow - From:', edge.fromId, 'To:', edge.toId);
        console.log('[Arrow]   Source pos:', fromPos.x, fromPos.y, 'size:', fromPos.width, 'x', fromPos.height);
        console.log('[Arrow]   Target pos:', toPos.x, toPos.y, 'size:', toPos.width, 'x', toPos.height);
        console.log('[Arrow]   Line start:', x1, y1, '(', LINE_CLEARANCE, 'px below source)');
        console.log('[Arrow]   Line end:', x2, y2, '(', LINE_CLEARANCE, 'px above target, arrowhead reaches', (LINE_CLEARANCE - ARROWHEAD_LENGTH), 'px)');

        // Calculate gaps and clearances
        const verticalGap = y2 - y1;
        const horizontalGap = Math.abs(x2 - x1);
        console.log('[Arrow]   Gaps: vertical=', verticalGap, 'horizontal=', horizontalGap);

        let pathData: string;

        if (verticalGap > 50) {
            // Use orthogonal routing with horizontal segment clear of cards
            // Exit vertically from source, route horizontally, enter vertically to target
            const exitLength = Math.max(30, verticalGap * 0.3);
            const entryLength = Math.max(30, verticalGap * 0.3);

            const midY1 = y1 + exitLength; // Exit point below source
            const midY2 = y2 - entryLength; // Entry point above target
            const midY = (midY1 + midY2) / 2; // Horizontal routing level - positioned between cards

            // For horizontal routing, ensure we route AROUND cards with extra clearance
            // Calculate if horizontal segment would pass near card boundaries
            const sourceBottom = fromPos.y + fromPos.height / 2;
            const targetTop = toPos.y - toPos.height / 2;

            // Ensure horizontal routing level is far enough from both cards
            const safeHorizontalY = Math.max(
                midY,
                sourceBottom + HORIZONTAL_CLEARANCE, // Well below source card
                Math.min(midY, targetTop - HORIZONTAL_CLEARANCE) // Well above target card
            );

            // Orthogonal path: down from source -> horizontal to target x -> down to target
            pathData = `M ${x1} ${y1} L ${x1} ${safeHorizontalY} L ${x2} ${safeHorizontalY} L ${x2} ${y2}`;
            console.log('[Arrow]   Using orthogonal routing at safeHorizontalY=', safeHorizontalY);
        } else {
            // Limited vertical space - use wide Bezier curve to route around cards
            const controlOffset = Math.max(60, horizontalGap * 0.5, verticalGap * 0.8);
            pathData = `M ${x1} ${y1} C ${x1} ${y1 + controlOffset}, ${x2} ${y2 - controlOffset}, ${x2} ${y2}`;
            console.log('[Arrow]   Using Bezier curve with controlOffset=', controlOffset);
        }

        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('stroke', 'var(--text-muted)');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.setAttribute('opacity', '0.6');
        path.classList.add('dag-arrow');

        svgContainer.appendChild(path);

        // Add edge label if present
        if (edge.label && edge.label.trim()) {
            const labelY = (y1 + y2) / 2;
            const labelX = (x1 + x2) / 2;

            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', labelX.toString());
            text.setAttribute('y', labelY.toString());
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', 'var(--text-muted)');
            text.setAttribute('font-size', '11px');
            text.setAttribute('font-weight', '600');
            text.textContent = edge.label;
            svgContainer.appendChild(text);
        }
    }

    /**
     * Draw multiple arrows from same source with trunk-and-branch pattern.
     * Trunk and branches keep lines clear of cards (12px), arrowheads touch card edges.
     *
     * DEBUG: Console logs show trunk and branch routing.
     */
    private drawMergedArrows(
        svgContainer: SVGSVGElement,
        svgNS: string,
        fromPos: { x: number; y: number; width: number; height: number },
        edges: GraphEdge[],
        positions: Map<string, { x: number; y: number; width: number; height: number }>
    ): void {
        const LINE_CLEARANCE = 12; // Distance from card edge to line endpoint
        const HORIZONTAL_CLEARANCE = 50; // Extra horizontal clearance around cards

        console.log('[Arrow] drawMergedArrows - Source:', edges[0].fromId, '- Branch count:', edges.length);

        // Start point: 12px below the bottom of source card
        const trunkX = fromPos.x;
        const trunkStartY = fromPos.y + fromPos.height / 2 + LINE_CLEARANCE;
        const trunkLength = 50; // Length of common trunk before branching
        const trunkEndY = trunkStartY + trunkLength;

        console.log('[Arrow]   Trunk: x=', trunkX, 'start y=', trunkStartY, 'end y=', trunkEndY, 'length=', trunkLength);

        // Draw main trunk line
        const trunk = document.createElementNS(svgNS, 'path');
        trunk.setAttribute('d', `M ${trunkX} ${trunkStartY} L ${trunkX} ${trunkEndY}`);
        trunk.setAttribute('stroke', 'var(--text-muted)');
        trunk.setAttribute('stroke-width', '3');
        trunk.setAttribute('fill', 'none');
        trunk.setAttribute('opacity', '0.7');
        trunk.classList.add('dag-arrow', 'dag-arrow-trunk');
        svgContainer.appendChild(trunk);

        // Draw branch to each target with 12px clearance (arrowhead touches card)
        edges.forEach((edge: GraphEdge, index: number) => {
            const toPos = positions.get(edge.toId);
            if (!toPos) {
                console.log('[Arrow]   Branch', index, '- Target not found:', edge.toId);
                return;
            }

            const targetX = toPos.x;
            const targetY = toPos.y - toPos.height / 2 - LINE_CLEARANCE; // 12px clearance above target card

            console.log('[Arrow]   Branch', index, '- Target:', edge.toId, 'at', targetX, targetY);

            // Calculate branch path from trunk end to target
            const horizontalOffset = targetX - trunkX;
            const verticalGap = targetY - trunkEndY;
            console.log('[Arrow]     Offsets: horizontal=', horizontalOffset, 'vertical=', verticalGap);

            let branchPath: string;

            if (verticalGap > 40) {
                // Orthogonal routing with horizontal segment clear of cards
                // Calculate safe horizontal routing level that avoids all cards in path
                const sourceBottom = fromPos.y + fromPos.height / 2;
                const targetTop = toPos.y - toPos.height / 2;

                // Position horizontal segment in the middle of safe zone
                const baseMidY = trunkEndY + Math.max(30, verticalGap * 0.4);
                const safeHorizontalY = Math.max(
                    baseMidY,
                    sourceBottom + HORIZONTAL_CLEARANCE // Well below source card
                );

                branchPath = `M ${trunkX} ${trunkEndY} L ${trunkX} ${safeHorizontalY} L ${targetX} ${safeHorizontalY} L ${targetX} ${targetY}`;
                console.log('[Arrow]     Using orthogonal branch routing at safeHorizontalY=', safeHorizontalY);
            } else {
                // Bezier curve with control offset to avoid overlap
                const controlOffset = Math.max(50, Math.abs(horizontalOffset) * 0.5, verticalGap * 0.7);
                branchPath = `M ${trunkX} ${trunkEndY} C ${trunkX} ${trunkEndY + controlOffset}, ${targetX} ${targetY - controlOffset}, ${targetX} ${targetY}`;
                console.log('[Arrow]     Using Bezier branch with controlOffset=', controlOffset);
            }

            const branch = document.createElementNS(svgNS, 'path');
            branch.setAttribute('d', branchPath);
            branch.setAttribute('stroke', 'var(--text-muted)');
            branch.setAttribute('stroke-width', '2');
            branch.setAttribute('fill', 'none');
            branch.setAttribute('marker-end', 'url(#arrowhead)');
            branch.setAttribute('opacity', '0.6');
            branch.classList.add('dag-arrow', 'dag-arrow-branch');
            svgContainer.appendChild(branch);

            // Add label on branch if present
            if (edge.label && edge.label.trim()) {
                const labelX = (trunkX + targetX) / 2;
                const labelY = (trunkEndY + targetY) / 2;

                const text = document.createElementNS(svgNS, 'text');
                text.setAttribute('x', labelX.toString());
                text.setAttribute('y', labelY.toString());
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', 'var(--text-muted)');
                text.setAttribute('font-size', '11px');
                text.setAttribute('font-weight', '600');
                text.textContent = edge.label;
                svgContainer.appendChild(text);
            }
        });
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

        const nodeHeader = nodeContainer.createDiv('dag-node-header');

        const iconDiv = nodeHeader.createDiv('dag-node-icon');
        iconDiv.innerHTML = node.icon || '';
        iconDiv.style.background = `${nodeColor}20`;

        const nodeType = nodeHeader.createDiv('dag-node-type');
        nodeType.textContent = node.type || 'Unknown IOC';

        const nodeDetails = nodeContainer.createDiv('dag-node-details');

        // Display value if present
        if (node.value && node.value.trim()) {
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
