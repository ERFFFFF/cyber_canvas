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
import { parseIOCNode } from './IOCParser';
import { runDiagnostics } from './DiagnosticTests';
import { loadMitreDataset } from './MitreLoader';

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

        this.addCommand({
            id: 'run-diagnostics',
            name: 'Run Diagnostic Tests',
            callback: async () => {
                new Notice('Running diagnostic tests... Check console for results.');
                const dataset = await loadMitreDataset(this.app);
                runDiagnostics(dataset);
                new Notice('Diagnostic tests complete. Check console (Ctrl+Shift+I).');
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

            // SVG icons
            const TIMELINE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
            const CARDS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
            const REDUCE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
            const MITRE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';

            const timelineBtn = this.createToolbarButton('Show Attack Timelines', TIMELINE_SVG,
                () => new RenderTimelinesModal(this.app, this).open());

            const cardsBtn = this.createToolbarButton('Add IOC Card', CARDS_SVG,
                () => this.openIOCCardSelector());

            const reduceBtn = this.createToolbarButton('Toggle Reduce View', REDUCE_SVG, () => {
                this.toggleReduceView();
                const icon = reduceBtn.querySelector('.clickable-icon');
                if (icon) icon.classList.toggle('is-active', this.isReducedView);
            });

            const mitreBtn = this.createToolbarButton('MITRE ATT&CK Mapper', MITRE_SVG,
                () => {
                    const activeTechniqueId = this.getSelectedTechniqueId();
                    new RenderMitreModal(this.app, this, activeTechniqueId).open();
                });

            iocToolbar.appendChild(timelineBtn);
            iocToolbar.appendChild(cardsBtn);
            iocToolbar.appendChild(reduceBtn);
            iocToolbar.appendChild(mitreBtn);
            canvasControls.appendChild(iocToolbar);
        } catch (err) {
            // Button injection is non-critical; log and continue
            console.error('IOC Canvas: failed to inject canvas buttons', err);
        }
    }

    /**
     * Creates a single toolbar button with SVG icon for the canvas control bar.
     */
    private createToolbarButton(label: string, svgIcon: string, onClick: () => void): HTMLElement {
        const item = document.createElement('div');
        item.className = 'canvas-control-item';
        item.setAttribute('aria-label', label);
        item.setAttribute('title', label);
        item.addEventListener('click', onClick);

        const icon = document.createElement('div');
        icon.className = 'clickable-icon';
        icon.innerHTML = svgIcon;
        item.appendChild(icon);

        return item;
    }

    /**
     * Extract MITRE technique ID from the currently selected canvas node.
     *
     * Tries multiple approaches to detect canvas selection since the API is internal:
     * 1. canvas.selection (likely a Set)
     * 2. canvas.selectedNodes (array or Set)
     * 3. Iterate nodes and check node.selected flag
     *
     * @returns Technique ID (e.g., "T1566.001") or null if no selection or no technique
     */
    private getSelectedTechniqueId(): string | null {
        try {
            const activeView = this.app.workspace.getActiveViewOfType(ItemView);
            if (!activeView || activeView.getViewType() !== 'canvas') {
                return null;
            }

            const canvas = (activeView as any).canvas;
            if (!canvas) {
                return null;
            }

            // Try multiple approaches to find selected node
            let selectedNode: any = null;

            // Approach 1: canvas.selection (likely a Set)
            if (canvas.selection && canvas.selection.size > 0) {
                const firstSelectedId = Array.from(canvas.selection)[0];
                selectedNode = canvas.nodes.get(firstSelectedId);
            }

            // Approach 2: canvas.selectedNodes
            if (!selectedNode && canvas.selectedNodes) {
                if (Array.isArray(canvas.selectedNodes) && canvas.selectedNodes.length > 0) {
                    selectedNode = canvas.selectedNodes[0];
                } else if (canvas.selectedNodes.size > 0) {
                    selectedNode = Array.from(canvas.selectedNodes)[0];
                }
            }

            // Approach 3: Iterate nodes and check selected flag
            if (!selectedNode && canvas.nodes) {
                canvas.nodes.forEach((node: any) => {
                    if (node.selected || node.isSelected) {
                        selectedNode = node;
                        return;
                    }
                });
            }

            if (!selectedNode || !selectedNode.text) {
                return null;
            }

            // Parse IOC card using existing parser
            const parsedData = parseIOCNode(selectedNode);
            if (!parsedData || !parsedData.technique || !parsedData.technique.trim()) {
                return null;
            }

            // Extract technique ID (same logic as RenderMitreModal.extractTechniqueId)
            const technique = parsedData.technique.toUpperCase();
            const idMatch = technique.match(/T\d{4}(?:\.\d{3})?/i);
            if (idMatch) {
                return idMatch[0].toUpperCase();
            }

            return null;

        } catch (err) {
            console.error('[IOC Canvas] Error getting selected technique:', err);
            return null;
        }
    }

    // ---------------------------------------------------------------
    // Reduce view toggle
    // ---------------------------------------------------------------

    /**
     * Toggles the reduced/compact view for IOC cards on the active canvas.
     *
     * **Two-part implementation:**
     *
     * **1. CSS-based content hiding** (via `.ioc-reduced` class):
     * - Hides IOC card headers, field labels, and metadata
     * - Shows only the primary value field
     * - Defined in styles.css (`.ioc-reduced .canvas-node-content`)
     *
     * **2. Node height reduction** (via canvas API):
     * - Stores original height in node._iocOriginalHeight custom property
     * - Resizes all text nodes to 60px height (single-line compact view)
     * - Restores original heights when toggled off
     *
     * **Why 60px?**
     * Enough to show a single line of text with padding, matches typical
     * single-line card height in canvas views.
     *
     * **Algorithm:**
     * 1. Toggle isReducedView flag
     * 2. Add/remove `.ioc-reduced` class on canvas wrapper
     * 3. Loop through all canvas nodes:
     *    - If reducing: store original height, resize to 60px
     *    - If restoring: read stored height, restore original dimensions
     * 4. Call canvas.requestFrame() and canvas.requestSave() to persist
     *
     * **Obsidian Canvas API:**
     * - `canvas.nodes` is a Map of all nodes on the canvas
     * - `node.resize({width, height})` or `node.height =` to change dimensions
     * - `node._iocOriginalHeight` is a custom property we add for state tracking
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
     *
     * **Card Creation Flow:**
     * 1. **Validate canvas view** - Ensure user is in a canvas view (not markdown/reading)
     * 2. **Access internal canvas API** - Get canvas object from (view as any).canvas
     * 3. **Generate timestamp-based card ID** - Format: #YYYYMMDD-HHMM (e.g., #20260214-1534)
     * 4. **Generate card content** - Call RenderIOCCards.createCardContent()
     * 5. **Create canvas text node** - Use canvas.createTextNode() with random position
     * 6. **Persist to disk** - Call canvas.requestSave() to write .canvas file
     *
     * **Card ID Format:**
     * - Timestamp-based for uniqueness: #YYYYMMDD-HHMM
     * - Example: #20260214-1534 (February 14, 2026 at 3:34 PM)
     * - Displayed as metadata field at bottom of card
     * - Used for referencing cards in validation errors
     *
     * **Random Positioning:**
     * - New cards are placed at random coordinates within a 400x400 area
     * - User can drag cards to desired position after creation
     * - Prevents cards from stacking exactly on top of each other
     *
     * **Obsidian Canvas API:**
     * - `canvas.createTextNode()` creates a markdown text node
     * - `pos`: {x, y} coordinates on the infinite canvas
     * - `size`: {width, height} in pixels (default 400x400)
     * - `text`: Markdown content (generated by RenderIOCCards)
     *
     * @param iocTypeId - The snake_case IOC type key from IOC_TYPES (e.g., "ip_address")
     * @param osType - Optional OS variant for hostname cards ("windows", "macos", "linux")
     */
    createIOCCard(iocTypeId: string, osType?: string) {
        const activeView = this.app.workspace.getActiveViewOfType(ItemView);
        if (!activeView || activeView.getViewType() !== 'canvas') {
            new Notice('Please open a canvas first');
            return;
        }

        // Access internal canvas API (not publicly documented by Obsidian)
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
        // Example: #20260214-1534 for February 14, 2026 at 3:34 PM
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const cardId = `#${year}${month}${day}-${hours}${minutes}`;

        // Generate markdown content for the IOC card
        const content = RenderIOCCards.createCardContent(iocType, iocTypeId, osType || null, cardId);

        // Create text node on canvas with random position
        canvas.createTextNode({
            pos: { x: Math.random() * 400, y: Math.random() * 400 },  // Random placement
            size: { width: 400, height: 400 },  // Standard card size
            text: content  // Markdown with HTML header
        });
        canvas.requestSave();  // Persist to .canvas file

        new Notice(`Created ${iocType.name} card`);
    }

}
