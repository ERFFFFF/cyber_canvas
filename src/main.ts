/**
 * IOC Canvas Plugin - Main entry point
 *
 * This is the core plugin class that Obsidian instantiates when the plugin is
 * enabled. It is responsible for:
 *   1. Registering commands and ribbon icons that open the timeline/IOC modals.
 *   2. Injecting floating control buttons into every canvas view so the user
 *      can access plugin features without the command palette.
 *   3. Persisting and loading user settings via Obsidian's data store.
 *
 * Canvas integration note:
 *   Obsidian does not expose a public API for canvas views. We rely on the
 *   internal `(view as any).canvas` object which exposes `.nodes` (Map),
 *   `.edges`, and `.wrapperEl`. This is inherently fragile and every access
 *   is guarded with null checks so the plugin degrades gracefully if the
 *   internal API changes.
 */

import { Plugin, Notice, TFile, ItemView } from 'obsidian';
import { RenderTimelinesModal } from './RenderTimelinesModal';
import { RenderMitreModal } from './RenderMitreModal';
import { RenderIOCCardsModal } from './RenderIOCCardsModal';
import { RenderIOCCards } from './RenderIOCCards';
import { IOC_TYPES } from './IOCCardsTypes';
import { PluginSettings, IOCCanvasPluginSettings, DEFAULT_SETTINGS } from './PluginSettings';

export default class IOCCanvasPlugin extends Plugin {
    /** Typed settings object persisted to data.json. */
    settings: IOCCanvasPluginSettings = DEFAULT_SETTINGS;

    /** Whether the canvas IOC cards are currently in compact/reduced view. */
    isReducedView: boolean = false;

    // ---------------------------------------------------------------
    // Plugin lifecycle
    // ---------------------------------------------------------------

    /**
     * Called by Obsidian when the plugin is activated.
     *
     * Order of operations:
     *   1. Load persisted settings from data.json.
     *   2. Register ribbon icons (sidebar shortcuts).
     *   3. Register commands (accessible via Ctrl/Cmd+P).
     *   4. Register the single settings tab from PluginSettings.ts.
     *   5. Register the canvas context-menu entry.
     *   6. Listen for active-leaf changes to inject floating buttons.
     *   7. Perform an initial button injection for the currently open leaf.
     */
    async onload() {
        console.log('Loading IOC Canvas Plugin');

        await this.loadSettings();

        // --- Ribbon icon: quick access from the left sidebar ---
        this.addRibbonIcon('clock', 'Show Attack Timelines', () => {
            new RenderTimelinesModal(this.app, this).open();
        });

        // --- Commands: accessible via the command palette (Ctrl/Cmd+P) ---

        this.addCommand({
            id: 'show-timelines',
            name: 'Show Attack Timelines',
            callback: () => {
                new RenderTimelinesModal(this.app, this).open();
            }
        });

        this.addCommand({
            id: 'show-ioc-cards',
            name: 'Show All IOC Cards',
            callback: () => {
                this.openIOCCardSelector();
            }
        });

        // --- Settings tab: single source of truth from PluginSettings.ts ---
        this.addSettingTab(new PluginSettings(this.app, this));

        // --- Canvas context menu: right-click a .canvas file in the file explorer ---
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

        // --- Canvas button injection ---
        // Obsidian fires 'active-leaf-change' whenever the user switches tabs.
        // We hook into this to inject floating control buttons when a canvas
        // view becomes active.
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.addCanvasButtons();
            })
        );

        // Inject buttons into whatever view is already open at plugin load time.
        this.addCanvasButtons();
    }

    /**
     * Called by Obsidian when the plugin is deactivated or Obsidian closes.
     * Cleans up all DOM elements injected by the plugin so they do not
     * persist after disable/uninstall.
     */
    onunload() {
        console.log('Unloading IOC Canvas Plugin');

        // Remove all injected toolbar elements from canvas controls
        document.querySelectorAll('.ioc-toolbar').forEach(el => el.remove());

        // Remove reduce view class from any canvas wrappers
        document.querySelectorAll('.ioc-reduced').forEach(el => el.classList.remove('ioc-reduced'));
    }

    // ---------------------------------------------------------------
    // Settings persistence
    // ---------------------------------------------------------------

    /** Load settings from data.json, falling back to defaults for any missing keys. */
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    /** Persist the current settings object to data.json. */
    async saveSettings() {
        await this.saveData(this.settings);
    }

    // ---------------------------------------------------------------
    // Canvas floating button injection
    // ---------------------------------------------------------------

    /**
     * Injects control buttons into Obsidian's native canvas control bar.
     *
     * Buttons added:
     *   - Timeline button: opens the attack-timeline modal.
     *   - IOC Cards button: opens the IOC card selector.
     *
     * Uses the .ioc-toolbar class as a duplicate-injection guard.
     *
     * The entire method is wrapped in a try/catch so a failure in button
     * creation never takes down the plugin.
     */
    addCanvasButtons() {
        try {
            const activeView = this.app.workspace.getActiveViewOfType(ItemView);

            // Only inject into canvas views
            if (!activeView || activeView.getViewType() !== 'canvas') {
                return;
            }

            const canvasView = activeView.containerEl;
            if (!canvasView) {
                return;
            }

            // Find Obsidian's native canvas controls bar
            const canvasControls = canvasView.querySelector('.canvas-controls');
            if (!canvasControls) {
                return;
            }

            // Prevent duplicate injection
            if (canvasControls.querySelector('.ioc-toolbar')) {
                return;
            }

            const iocToolbar = document.createElement('div');
            iocToolbar.className = 'ioc-toolbar';

            // --- Timeline button ---
            const timelineItem = document.createElement('div');
            timelineItem.className = 'canvas-control-item';
            timelineItem.setAttribute('aria-label', 'Show Attack Timelines');
            timelineItem.setAttribute('title', 'Show Attack Timelines');
            timelineItem.addEventListener('click', () => {
                new RenderTimelinesModal(this.app, this).open();
            });
            const timelineIcon = document.createElement('div');
            timelineIcon.className = 'clickable-icon';
            timelineIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
            timelineItem.appendChild(timelineIcon);

            // --- IOC Cards button ---
            const cardsItem = document.createElement('div');
            cardsItem.className = 'canvas-control-item';
            cardsItem.setAttribute('aria-label', 'Add IOC Card');
            cardsItem.setAttribute('title', 'Add IOC Card');
            cardsItem.addEventListener('click', () => {
                this.openIOCCardSelector();
            });
            const cardsIcon = document.createElement('div');
            cardsIcon.className = 'clickable-icon';
            cardsIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
            cardsItem.appendChild(cardsIcon);

            // --- Reduce toggle button ---
            const reduceItem = document.createElement('div');
            reduceItem.className = 'canvas-control-item';
            reduceItem.setAttribute('aria-label', 'Toggle Reduce View');
            reduceItem.setAttribute('title', 'Toggle Reduce View');
            reduceItem.addEventListener('click', () => {
                this.toggleReduceView();
                // Toggle active visual state on the icon
                const icon = reduceItem.querySelector('.clickable-icon');
                if (icon) {
                    icon.classList.toggle('is-active', this.isReducedView);
                }
            });
            const reduceIcon = document.createElement('div');
            reduceIcon.className = 'clickable-icon';
            // Minimize/compress SVG icon
            reduceIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
            reduceItem.appendChild(reduceIcon);

            // --- MITRE ATT&CK Mapper button ---
            const mitreItem = document.createElement('div');
            mitreItem.className = 'canvas-control-item';
            mitreItem.setAttribute('aria-label', 'MITRE ATT&CK Mapper');
            mitreItem.setAttribute('title', 'MITRE ATT&CK Mapper');
            mitreItem.addEventListener('click', () => {
                new RenderMitreModal(this.app, this).open();
            });
            const mitreIcon = document.createElement('div');
            mitreIcon.className = 'clickable-icon';
            // Target/crosshair SVG icon for MITRE
            mitreIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
            mitreItem.appendChild(mitreIcon);

            iocToolbar.appendChild(timelineItem);
            iocToolbar.appendChild(cardsItem);
            iocToolbar.appendChild(reduceItem);
            iocToolbar.appendChild(mitreItem);
            canvasControls.appendChild(iocToolbar);
        } catch (err) {
            // Button injection is non-critical; log and continue
            console.error('IOC Canvas: failed to inject canvas buttons', err);
        }
    }

    // ---------------------------------------------------------------
    // Reduce view toggle
    // ---------------------------------------------------------------

    /**
     * Toggles the reduced/compact view for IOC cards on the active canvas.
     * When reduced, CSS hides everything except the code block value, and
     * nodes are resized to a compact single-line height.
     */
    toggleReduceView() {
        const activeView = this.app.workspace.getActiveViewOfType(ItemView);
        if (!activeView || activeView.getViewType() !== 'canvas') return;

        const canvas = (activeView as any).canvas;
        if (!canvas) return;

        this.isReducedView = !this.isReducedView;

        // Add/remove CSS class on the canvas wrapper for CSS-based content hiding
        const wrapperEl = canvas.wrapperEl;
        if (wrapperEl) {
            if (this.isReducedView) {
                wrapperEl.classList.add('ioc-reduced');
            } else {
                wrapperEl.classList.remove('ioc-reduced');
            }
        }

        // Resize all text nodes
        if (canvas.nodes) {
            canvas.nodes.forEach((node: any) => {
                if (!node.text) return; // only text nodes (IOC cards have text)
                if (this.isReducedView) {
                    // Store original dimensions before reducing
                    if (!node._iocOriginalHeight) {
                        node._iocOriginalHeight = node.height;
                    }
                    // Resize to compact single-line height
                    if (node.resize) {
                        node.resize({ width: node.width, height: 60 });
                    } else {
                        node.height = 60;
                    }
                } else {
                    // Restore original height
                    const originalH = node._iocOriginalHeight || 400;
                    if (node.resize) {
                        node.resize({ width: node.width, height: originalH });
                    } else {
                        node.height = originalH;
                    }
                }
            });
        }

        canvas.requestFrame();
        canvas.requestSave();
    }

    // ---------------------------------------------------------------
    // IOC card creation helpers
    // ---------------------------------------------------------------

    /**
     * Opens the IOC card selector modal. The callback creates the card on
     * the active canvas.
     */
    openIOCCardSelector() {
        new RenderIOCCardsModal(
            this.app,
            IOC_TYPES,
            (iocTypeId: string, osType?: string) => {
                this.createIOCCard(iocTypeId, osType);
            }
        ).open();
    }

    /**
     * Creates an IOC card on the active canvas.
     * @param iocTypeId - The snake_case IOC type key from IOC_TYPES
     * @param osType    - Optional OS variant for hostname cards
     */
    createIOCCard(iocTypeId: string, osType?: string) {
        const activeView = this.app.workspace.getActiveViewOfType(ItemView);
        if (!activeView || activeView.getViewType() !== 'canvas') {
            new Notice('Please open a canvas first');
            return;
        }

        const canvas = (activeView as any).canvas;
        if (!canvas) {
            new Notice('Please open a canvas first');
            return;
        }

        const iocType = IOC_TYPES[iocTypeId];
        if (!iocType) {
            new Notice('Unknown IOC type: ' + iocTypeId);
            return;
        }

        // Generate timestamp-based card ID (format: #YYYYMMDD-HHMM)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const cardId = `#${year}${month}${day}-${hours}${minutes}`;

        const content = RenderIOCCards.createCardContent(iocType, iocTypeId, osType || null, cardId);

        canvas.createTextNode({
            pos: { x: Math.random() * 400, y: Math.random() * 400 },
            size: { width: 400, height: 400 },
            text: content
        });
        canvas.requestSave();

        new Notice(`Created ${iocType.name} card`);
    }

}
