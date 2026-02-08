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
     */
    private renderEnhancedTimeTimeline(container: HTMLElement): void {
        const iocData = this.timeProcessor.extractFixedIOCData();

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

            if (ioc.value) {
                const valueContainer = detailsContainer.createDiv('timeline-value-container');
                const valueLabel = valueContainer.createDiv('timeline-value-label');
                valueLabel.textContent = 'Value';
                const valueEl = valueContainer.createDiv('timeline-value-text');
                valueEl.textContent = ioc.value;
            }

            const timeEl = detailsContainer.createDiv('timeline-time');
            timeEl.innerHTML = `🕐 Time: ${ioc.time}`;

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
     */
    private renderEnhancedLayeredTimeline(container: HTMLElement): void {
        console.log('Starting layered DAG link timeline rendering...');
        const linkData = this.linkProcessor.extractEnhancedLinkData();

        if (linkData.layers.length === 0 && linkData.isolatedNodes.length === 0) {
            const emptyMessage = container.createEl('div', { cls: 'timeline-empty-message' });
            emptyMessage.innerHTML = `
                <h3>Link Timeline Analysis</h3>
                <p>No connections found between IOC cards.</p>
            `;
            return;
        }

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
     * Draw SVG arrows between connected nodes
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

        // Draw each edge
        edges.forEach((edge: GraphEdge) => {
            const fromPos = positions.get(edge.fromId);
            const toPos = positions.get(edge.toId);

            if (!fromPos || !toPos) return;

            // Calculate start and end points (from bottom of source to top of target)
            const x1 = fromPos.x;
            const y1 = fromPos.y + fromPos.height / 2;
            const x2 = toPos.x;
            const y2 = toPos.y - toPos.height / 2;

            // Create curved path for better visualization
            const midY = (y1 + y2) / 2;
            const path = document.createElementNS(svgNS, 'path');
            const pathData = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

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
                const text = document.createElementNS(svgNS, 'text');
                text.setAttribute('x', ((x1 + x2) / 2).toString());
                text.setAttribute('y', midY.toString());
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
     */
    private renderLayeredNodeCard(container: HTMLElement, node: IOCNodeData): void {
        const nodeColor = node.color || 'var(--background-modifier-border)';

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

        if (node.value && node.value.trim()) {
            const valueContainer = nodeDetails.createDiv('dag-node-value-container');
            const valueLabel = valueContainer.createDiv('dag-node-value-label');
            valueLabel.textContent = 'Value';
            const valueEl = valueContainer.createDiv('dag-node-value-text');
            valueEl.textContent = node.value;
        }

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
