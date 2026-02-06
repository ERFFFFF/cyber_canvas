import { App, Modal, Notice } from 'obsidian';
import { LinkTimelineProcessor } from './LinkTimelineProcessing';
import { TimeTimelineProcessor } from './TimeTimelineProcessing';

export class RenderTimelinesModal extends Modal {
    private plugin: any;
    private activeTab: 'time' | 'link';
    private collapsedChains: Set<number>;
    private timeProcessor: TimeTimelineProcessor;
    private linkProcessor: LinkTimelineProcessor;

    constructor(app: App, plugin: any) {
        super(app);
        this.plugin = plugin;
        this.activeTab = 'time';
        this.collapsedChains = new Set();
        this.timeProcessor = new TimeTimelineProcessor(app, plugin, plugin.iocTypes);
        this.linkProcessor = new LinkTimelineProcessor(app, plugin, plugin.iocTypes);
    }

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

    private updateTabStyles(timeTab: HTMLElement, linkTab: HTMLElement): void {
        timeTab.classList.remove('active');
        linkTab.classList.remove('active');

        if (this.activeTab === 'time') {
            timeTab.classList.add('active');
        } else if (this.activeTab === 'link') {
            linkTab.classList.add('active');
        }
    }

    private renderTabContent(contentEl: HTMLElement): void {
        const existingContent = contentEl.querySelector('.timeline-tab-content');
        if (existingContent) {
            existingContent.remove();
        }

        const contentArea = contentEl.createDiv('timeline-tab-content');

        if (this.activeTab === 'time') {
            this.renderEnhancedTimeTimeline(contentArea);
        } else if (this.activeTab === 'link') {
            this.renderEnhancedTreeLinkTimeline(contentArea);
        }
    }

    private renderEnhancedTimeTimeline(container: HTMLElement): void {
        const iocData = this.timeProcessor.extractFixedIOCData();

        if (iocData.length === 0) {
            container.createEl('p', {
                text: 'No IOC cards found in the current canvas. Create some IOC cards first to see the timeline.',
                cls: 'timeline-empty-message'
            });
            return;
        }

        iocData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        const timelineContainer = container.createDiv('timeline-container');

        iocData.forEach((ioc, index) => {
            const timelineItem = timelineContainer.createDiv('timeline-item');

            timelineItem.style.setProperty('--ioc-color', ioc.color);
            timelineItem.style.setProperty('--ioc-color-30', `${ioc.color}30`);
            timelineItem.style.background = `linear-gradient(135deg, ${ioc.color}15 0%, ${ioc.color}05 100%)`;
            timelineItem.style.boxShadow = `0 4px 12px ${ioc.color}25`;

            if (index < iocData.length - 1) {
                const connector = timelineItem.createDiv('timeline-connector');
                connector.style.background = `linear-gradient(180deg, ${ioc.color} 0%, ${iocData[index + 1].color} 100%)`;
            }

            const iconContainer = timelineItem.createDiv('timeline-icon');
            iconContainer.innerHTML = ioc.icon;
            iconContainer.style.background = `${ioc.color}20`;

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

    private renderEnhancedTreeLinkTimeline(container: HTMLElement): void {
        console.log('🔍 Starting enhanced tree-like link timeline analysis...');
        const linkData = this.linkProcessor.extractEnhancedLinkData();

        if (linkData.chains.length === 0 && linkData.isolatedNodes.length === 0) {
            const emptyMessage = container.createEl('div', { cls: 'timeline-empty-message' });
            emptyMessage.innerHTML = `
                <h3>🔗 Link Timeline Analysis</h3>
                <p>No connections found between IOC cards.</p>
            `;
            return;
        }

        const treeContainer = container.createDiv('tree-timeline-container');

        if (linkData.chains.length > 0) {
            linkData.chains.forEach((chain: any, chainIndex: number) => {
                this.renderEnhancedTreeChain(treeContainer, chain, chainIndex);
            });
        }
    }

    private renderEnhancedTreeChain(container: HTMLElement, chain: any[], chainIndex: number): void {
        const isCollapsed = this.collapsedChains.has(chainIndex);
        const chainColor = chain[0]?.color || 'var(--interactive-accent)';

        const chainHeader = container.createDiv('tree-chain-header');
        chainHeader.style.setProperty('--chain-color', chainColor);
        chainHeader.style.background = `linear-gradient(135deg, ${chainColor}15 0%, ${chainColor}05 100%)`;
        chainHeader.style.boxShadow = `0 4px 12px ${chainColor}25`;

        const triangle = chainHeader.createDiv('chain-triangle');
        triangle.textContent = isCollapsed ? '▶' : '▼';

        const chainTitle = chainHeader.createDiv('chain-title');
        chainTitle.textContent = `Chain ${chainIndex + 1}: ${chain.length} nodes`;

        const chainContent = container.createDiv('tree-chain-content');
        chainContent.setAttribute('data-collapsed', isCollapsed.toString());

        chainHeader.addEventListener('click', () => {
            if (this.collapsedChains.has(chainIndex)) {
                this.collapsedChains.delete(chainIndex);
                triangle.textContent = '▼';
                chainContent.setAttribute('data-collapsed', 'false');
            } else {
                this.collapsedChains.add(chainIndex);
                triangle.textContent = '▶';
                chainContent.setAttribute('data-collapsed', 'true');
            }
        });

        chain.forEach((node: any, nodeIndex: number) => {
            this.renderEnhancedTreeNode(chainContent, node, nodeIndex, chain.length);
        });
    }

    private renderEnhancedTreeNode(container: HTMLElement, node: any, nodeIndex: number, totalNodes: number): void {
        const nodeContainer = container.createDiv('tree-node');
        const nodeColor = node.color || 'var(--background-modifier-border)';

        nodeContainer.style.setProperty('--node-color', nodeColor);
        nodeContainer.style.background = `linear-gradient(135deg, ${nodeColor}15 0%, ${nodeColor}05 100%)`;
        nodeContainer.style.boxShadow = `0 4px 12px ${nodeColor}25`;

        if (nodeIndex < totalNodes - 1) {
            const connector = nodeContainer.createDiv('tree-connector');

            const edgeLabel = node.edgeLabel;
            if (edgeLabel && edgeLabel.trim()) {
                const labelDiv = nodeContainer.createDiv('edge-label');
                labelDiv.textContent = edgeLabel;
            }
        }

        const nodeHeader = nodeContainer.createDiv('tree-node-header');

        const iconDiv = nodeHeader.createDiv('tree-node-icon');
        iconDiv.innerHTML = node.icon || '📄';
        iconDiv.style.background = `${nodeColor}20`;

        const nodeType = nodeHeader.createDiv('tree-node-type');
        nodeType.textContent = node.type || 'Unknown IOC';

        const nodeDetails = nodeContainer.createDiv('tree-node-details');

        if (node.value && node.value.trim()) {
            const valueContainer = nodeDetails.createDiv('tree-value-container');
            const valueLabel = valueContainer.createDiv('tree-value-label');
            valueLabel.textContent = 'Value';
            const valueEl = valueContainer.createDiv('tree-value-text');
            valueEl.textContent = node.value;
        }

        if (node.time && node.time.trim()) {
            const timeContainer = nodeDetails.createDiv('tree-time-container');
            timeContainer.innerHTML = `🕐 ${node.time}`;
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
