import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, ItemView } from 'obsidian';
import { RenderTimelinesModal } from './RenderTimelinesModal';
import { RenderIOCCardsModal } from './RenderIOCCardsModal';
import { MinimalistRenderer } from './MinimalistRenderer';
import { IOC_TYPES } from './IOCCardsTypes';

interface IOCType {
    name: string;
    icon: string;
    color: string;
}

export default class IOCCanvasPlugin extends Plugin {
    settings: any;
    iocTypes: IOCType[] = [];
    minimalistOverlay: HTMLElement | null = null;
    isMinimalistView: boolean = false;

    async onload() {
        console.log('Loading IOC Canvas Plugin');

        await this.loadSettings();
        await this.loadIOCTypes();

        // Add ribbon icon for timeline analysis
        this.addRibbonIcon('clock', 'Show Attack Timelines', () => {
            new RenderTimelinesModal(this.app, this).open();
        });

        // Add command for timeline analysis
        this.addCommand({
            id: 'show-timelines',
            name: 'Show Attack Timelines',
            callback: () => {
                new RenderTimelinesModal(this.app, this).open();
            }
        });

        // Add command for IOC cards modal
        this.addCommand({
            id: 'show-ioc-cards',
            name: 'Show All IOC Cards',
            callback: () => {
                new RenderIOCCardsModal(
                    this.app,
                    IOC_TYPES,
                    (iocTypeId: string, osType?: string) => {
                        console.log('Selected IOC type:', iocTypeId, osType);
                        new Notice(`Selected: ${iocTypeId}${osType ? ' (' + osType + ')' : ''}`);
                    }
                ).open();
            }
        });

        // Add command for minimalist toggle
        this.addCommand({
            id: 'toggle-minimalist-view',
            name: 'Toggle Minimalist View',
            callback: () => {
                this.toggleMinimalistView();
            }
        });

        // Add settings tab
        this.addSettingTab(new IOCCanvasSettingTab(this.app, this));

        // Register canvas menu
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                if (file instanceof TFile && file.extension === 'canvas') {
                    menu.addItem((item) => {
                        item
                            .setTitle('Show Attack Timelines')
                            .setIcon('clock')
                            .onClick(() => {
                                new RenderTimelinesModal(this.app, this).open();
                            });
                    });
                }
            })
        );

        // Add canvas buttons when canvas loads
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.addCanvasButtons();
            })
        );

        // Initial check for canvas view
        this.addCanvasButtons();
    }

    addCanvasButtons() {
        const activeView = this.app.workspace.getActiveViewOfType(ItemView);

        if (!activeView || activeView.getViewType() !== 'canvas') {
            return;
        }

        // Check if buttons already exist
        if (document.querySelector('.canvas-control-buttons')) {
            return;
        }

        const canvasView = activeView.containerEl;

        // Create Timeline Button (Bottom-Left)
        const timelineButton = document.createElement('button');
        timelineButton.className = 'canvas-timeline-button';
        timelineButton.innerHTML = '🕐';
        timelineButton.setAttribute('aria-label', 'Show Attack Timelines');
        timelineButton.setAttribute('title', 'Show Attack Timelines');
        timelineButton.addEventListener('click', () => {
            new RenderTimelinesModal(this.app, this).open();
        });

        // Create IOC Cards Button (Bottom-Center)
        const cardsButton = document.createElement('button');
        cardsButton.className = 'canvas-cards-button';
        cardsButton.innerHTML = '📇';
        cardsButton.setAttribute('aria-label', 'Show IOC Cards');
        cardsButton.setAttribute('title', 'Show IOC Cards');
        cardsButton.addEventListener('click', () => {
            new RenderIOCCardsModal(
                this.app,
                IOC_TYPES,
                (iocTypeId: string, osType?: string) => {
                    console.log('Selected IOC type:', iocTypeId, osType);
                    new Notice(`Selected: ${iocTypeId}${osType ? ' (' + osType + ')' : ''}`);
                }
            ).open();
        });

        // Create Minimalist Toggle Button (Right side, below toolbar)
        const minimalistButton = document.createElement('button');
        minimalistButton.className = 'canvas-minimalist-button';
        minimalistButton.innerHTML = '🎨';
        minimalistButton.setAttribute('aria-label', 'Toggle Minimalist View');
        minimalistButton.setAttribute('title', 'Toggle Minimalist View');
        minimalistButton.addEventListener('click', () => {
            this.toggleMinimalistView();
        });

        // Create container for bottom buttons
        const bottomButtonsContainer = document.createElement('div');
        bottomButtonsContainer.className = 'canvas-bottom-buttons';
        bottomButtonsContainer.appendChild(timelineButton);
        bottomButtonsContainer.appendChild(cardsButton);

        // Add buttons to canvas
        canvasView.appendChild(bottomButtonsContainer);
        canvasView.appendChild(minimalistButton);

        // Mark that buttons exist
        const marker = document.createElement('div');
        marker.className = 'canvas-control-buttons';
        marker.style.display = 'none';
        canvasView.appendChild(marker);
    }

    toggleMinimalistView() {
        const activeView = this.app.workspace.getActiveViewOfType(ItemView);

        if (!activeView || activeView.getViewType() !== 'canvas') {
            new Notice('Please open a canvas first');
            return;
        }

        const canvas = (activeView as any).canvas;
        if (!canvas) {
            new Notice('Canvas not found');
            return;
        }

        if (this.isMinimalistView) {
            this.hideMinimalistView();
        } else {
            this.showMinimalistView(canvas, activeView);
        }
    }

    showMinimalistView(canvas: any, activeView: ItemView) {
        console.log('🎨 Showing minimalist view...');

        // Hide normal canvas
        const canvasContent = canvas.wrapperEl;
        if (canvasContent) {
            canvasContent.style.display = 'none';
        }

        // Create overlay
        this.minimalistOverlay = document.createElement('div');
        this.minimalistOverlay.className = 'minimalist-overlay';

        // Extract canvas data
        const canvasData = this.extractCanvasData(canvas);

        // Render minimalist view
        MinimalistRenderer.renderMinimalist(this.minimalistOverlay, canvasData);

        // Add to view
        activeView.containerEl.appendChild(this.minimalistOverlay);

        // Update button state
        const button = document.querySelector('.canvas-minimalist-button');
        if (button) {
            button.classList.add('active');
            button.innerHTML = '🖼️';
            (button as HTMLElement).setAttribute('title', 'Show Normal Canvas');
        }

        this.isMinimalistView = true;
    }

    hideMinimalistView() {
        console.log('🖼️ Showing normal canvas...');

        const activeView = this.app.workspace.getActiveViewOfType(ItemView);
        if (!activeView) return;

        const canvas = (activeView as any).canvas;
        if (!canvas) return;

        // Show normal canvas
        const canvasContent = canvas.wrapperEl;
        if (canvasContent) {
            canvasContent.style.display = '';
        }

        // Remove overlay
        if (this.minimalistOverlay) {
            this.minimalistOverlay.remove();
            this.minimalistOverlay = null;
        }

        // Update button state
        const button = document.querySelector('.canvas-minimalist-button');
        if (button) {
            button.classList.remove('active');
            button.innerHTML = '🎨';
            (button as HTMLElement).setAttribute('title', 'Toggle Minimalist View');
        }

        this.isMinimalistView = false;
    }

    extractCanvasData(canvas: any): any {
        const nodes: any[] = [];
        const connections: any[] = [];
        const nodeData = new Map();

        // Extract nodes
        if (canvas.nodes) {
            canvas.nodes.forEach((node: any) => {
                if (node.unknownData && node.unknownData.type) {
                    const iocType = this.iocTypes.find((t: IOCType) => t.name === node.unknownData.type);

                    const nodeInfo = {
                        id: node.id,
                        type: node.unknownData.type,
                        icon: iocType?.icon || '📄',
                        color: node.color || iocType?.color || '#888888',
                        value: node.unknownData.value || '',
                        time: node.unknownData.time || null,
                        x: node.x,
                        y: node.y,
                        width: node.width,
                        height: node.height
                    };

                    nodeData.set(node.id, nodeInfo);
                    nodes.push(nodeInfo);
                }
            });
        }

        // Extract connections
        if (canvas.edges) {
            canvas.edges.forEach((edge: any) => {
                const fromId = edge.from?.node?.id;
                const toId = edge.to?.node?.id;

                if (fromId && toId && nodeData.has(fromId) && nodeData.has(toId)) {
                    connections.push({
                        from: fromId,
                        to: toId,
                        label: edge.label || ''
                    });
                }
            });
        }

        return { nodes, connections };
    }

    async loadIOCTypes() {
        const defaultIOCTypes: IOCType[] = [
            { name: 'IP Address', icon: '🌐', color: '#FF5722' },
            { name: 'Domain', icon: '🌍', color: '#2196F3' },
            { name: 'URL', icon: '🔗', color: '#4CAF50' },
            { name: 'Email', icon: '📧', color: '#9C27B0' },
            { name: 'File Hash', icon: '#', color: '#00BCD4' },
            { name: 'Registry Key', icon: '🗝️', color: '#FF9800' },
            { name: 'Process', icon: '⚙️', color: '#795548' },
            { name: 'User Account', icon: '👤', color: '#607D8B' },
            { name: 'Command Line', icon: '💻', color: '#8BC34A' },
            { name: 'C2 Server', icon: '🎯', color: '#F44336' }
        ];

        this.iocTypes = this.settings.iocTypes || defaultIOCTypes;
    }

    async loadSettings() {
        this.settings = Object.assign({}, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        console.log('Unloading IOC Canvas Plugin');

        // Clean up minimalist view
        if (this.minimalistOverlay) {
            this.minimalistOverlay.remove();
        }

        // Remove all canvas buttons
        document.querySelectorAll('.canvas-timeline-button, .canvas-cards-button, .canvas-minimalist-button, .canvas-bottom-buttons, .canvas-control-buttons').forEach(el => el.remove());
    }
}

class IOCCanvasSettingTab extends PluginSettingTab {
    plugin: IOCCanvasPlugin;

    constructor(app: App, plugin: IOCCanvasPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'IOC Canvas Settings' });

        new Setting(containerEl)
            .setName('IOC Types')
            .setDesc('Configure IOC card types and their properties')
            .addButton(button => button
                .setButtonText('Manage IOC Types')
                .onClick(() => {
                    new Notice('IOC Types management coming soon!');
                })
            );
    }
}
