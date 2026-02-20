/**
 * IOC Canvas Plugin - Main entry point
 *
 * Thin plugin shell that Obsidian instantiates when the plugin is enabled.
 * Delegates all canvas operations to extracted modules in canvas/:
 *   - CanvasToolbar: button injection into canvas controls
 *   - CanvasSelection: technique extraction from selected node
 *   - ReduceView: compact view toggle
 *   - IOCCardCreation: card selector modal and card creation
 *
 * Keeps only lifecycle methods (onload/onunload), settings persistence,
 * and thin delegation wrappers that pass `this.app` and `this.isReducedView`
 * to the standalone functions.
 */

import { Plugin, TFile, ItemView } from 'obsidian';
import { RenderTimelinesModal } from './timeline/RenderTimelinesModal';
import { RenderMitreModal } from './mitre/RenderMitreModal';
import { PluginSettings, IOCCanvasPluginSettings, DEFAULT_SETTINGS } from './settings/PluginSettings';

// Canvas modules
import { addCanvasButtons } from './canvas/CanvasToolbar';
import { getSelectedTechniqueId } from './canvas/CanvasSelection';
import { toggleReduceView } from './canvas/ReduceView';
import { openIOCCardSelector, createIOCCard } from './canvas/IOCCardCreation';
import { setupCanvasContextMenu, removeCanvasContextMenu } from './canvas/CanvasContextMenu';

export default class IOCCanvasPlugin extends Plugin {
    /** Typed settings object persisted to data.json. */
    settings: IOCCanvasPluginSettings = DEFAULT_SETTINGS;

    /** Whether the canvas IOC cards are currently in compact/reduced view. */
    isReducedView: boolean = false;

    /** Tracked canvas wrapper element for context menu cleanup on unload. */
    private canvasWrapperEl: HTMLElement | null = null;

    // ---------------------------------------------------------------
    // Plugin lifecycle
    // ---------------------------------------------------------------

    async onload() {
        console.log('Loading IOC Canvas Plugin');

        await this.loadSettings();

        // Ribbon icon: quick access from the left sidebar
        this.addRibbonIcon('clock', 'Show Attack Timelines', () => {
            new RenderTimelinesModal(this.app, this).open();
        });

        // Commands: accessible via the command palette (Ctrl/Cmd+P)
        this.addCommand({
            id: 'show-timelines',
            name: 'Show Attack Timelines',
            callback: () => {
                new RenderTimelinesModal(this.app, this).open();
            }
        });

        this.addCommand({
            id: 'show-ioc-cards',
            name: 'Add Parent IOC Card',
            callback: () => {
                openIOCCardSelector(this.app, (id, os) => createIOCCard(this.app, id, os, false), 'Select Parent IOC Type');
            }
        });

        this.addCommand({
            id: 'add-child-card',
            name: 'Add Child IOC Card',
            callback: () => {
                openIOCCardSelector(this.app, (id, os) => createIOCCard(this.app, id, os, true), 'Select Child IOC Type');
            }
        });

        // Settings tab
        this.addSettingTab(new PluginSettings(this.app, this));

        // Canvas context menu: right-click a .canvas file in the file explorer
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

        // Canvas button injection on leaf change + initial injection
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.injectCanvasButtons();
            })
        );
        this.injectCanvasButtons();
    }

    onunload() {
        console.log('Unloading IOC Canvas Plugin');
        document.querySelectorAll('.ioc-toolbar').forEach(el => el.remove());
        document.querySelectorAll('.ioc-reduced').forEach(el => el.classList.remove('ioc-reduced'));
        if (this.canvasWrapperEl) {
            removeCanvasContextMenu(this.canvasWrapperEl);
            this.canvasWrapperEl = null;
        }
    }

    // ---------------------------------------------------------------
    // Settings persistence
    // ---------------------------------------------------------------

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // ---------------------------------------------------------------
    // Thin delegation to canvas modules
    // ---------------------------------------------------------------

    /** Inject toolbar buttons and context menu into the active canvas view. */
    private injectCanvasButtons(): void {
        addCanvasButtons({
            app: this.app,
            isReducedView: this.isReducedView,
            onTimeline: () => new RenderTimelinesModal(this.app, this).open(),
            onAddCard: () => openIOCCardSelector(this.app, (id, os) => createIOCCard(this.app, id, os, false), 'Select Parent IOC Type'),
            onChildCard: () => openIOCCardSelector(this.app, (id, os) => createIOCCard(this.app, id, os, true), 'Select Child IOC Type'),
            onReduce: () => {
                this.isReducedView = toggleReduceView(this.app, this.isReducedView);
                return this.isReducedView;
            },
            onMitre: () => {
                const activeTechniqueId = getSelectedTechniqueId(this.app);
                new RenderMitreModal(this.app, this, activeTechniqueId).open();
            }
        });

        // Set up right-click context menu for IOC card role conversion
        try {
            const activeView = this.app.workspace.getActiveViewOfType(ItemView);
            if (activeView && activeView.getViewType() === 'canvas') {
                const canvas = (activeView as any).canvas;
                if (canvas?.wrapperEl) {
                    this.canvasWrapperEl = canvas.wrapperEl;
                    setupCanvasContextMenu(this.app, canvas);
                }
            }
        } catch (err) {
            console.error('IOC Canvas: failed to set up context menu', err);
        }
    }
}
