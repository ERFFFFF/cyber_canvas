/**
 * RenderMitreModal.ts - MITRE ATT&CK Technique Mapper (class shell)
 *
 * Full-screen modal that displays the complete MITRE ATT&CK matrix. This file
 * contains the class lifecycle (constructor, onOpen, onClose) and the core
 * renderMitreMapping method that coordinates data extraction and aggregation.
 *
 * Rendering is delegated to extracted modules:
 *   - MitreModalHelpers: context interface, toggleExpansion, isActiveTechnique
 *   - MitreModalTacticRenderer: tactic columns, technique items, subtechniques
 *   - MitreModalValidation: validation errors section
 *   - MitreModalSearch: search bar and input handling
 *   - MitreStatsBar: coverage, active tactics, IOC count, missing field warnings
 *   - MitreAggregator: 5-step IOC-to-matrix aggregation
 *   - MitreExport: Navigator JSON export
 *   - MitreResizable: 8-handle drag-to-resize
 */
import { App, Modal } from 'obsidian';
import { extractFixedIOCData } from '../timeline/TimeTimelineProcessing';
import { loadMitreDataset, MitreDataset } from './MitreLoader';
import { DEBUG } from '../debug';

import type { IOCNodeData } from '../types/IOCNodeData';
import { MitreTechnique, MitreTactic, SearchState, ValidationError } from './MitreTypes';
import { aggregateTacticsTechniques } from './MitreAggregator';
import { exportToNavigator } from './MitreExport';
import { makeResizable } from './MitreResizable';
import { renderStatsBar } from './MitreStatsBar';

// Extracted modal modules
import { MitreModalContext } from './MitreModalHelpers';
import { renderTacticSection } from './MitreModalTacticRenderer';
import { renderSubtechniques } from './MitreSubtechniqueRenderer';
import { renderValidationErrors } from './MitreModalValidation';
import { renderSearchBar, handleSearchInput, SearchUIElements } from './MitreModalSearch';

export class RenderMitreModal extends Modal {
    private plugin: any;
    private mitreDataset: MitreDataset | null = null;
    private subtechniquesMap: Map<string, MitreTechnique[]> = new Map();
    private currentSearchState: SearchState | null = null;
    private currentTactics: MitreTactic[] | null = null;
    private validationErrors: ValidationError[] = [];
    private activeTechniqueId: string | null = null;
    private iocDataMap: Map<string, IOCNodeData> = new Map();
    private iocCount: number = 0;
    private searchUI: SearchUIElements = { searchBar: null, searchClearButton: null, searchMatchCount: null };

    // Truncation limits
    private readonly TECHNIQUE_TRUNCATE_LIMIT = 180;
    private readonly SUBTECHNIQUE_TRUNCATE_LIMIT = 100;

    constructor(app: App, plugin: any, activeTechniqueId?: string | null) {
        super(app);
        this.plugin = plugin;
        this.activeTechniqueId = activeTechniqueId || null;
        this.loadDataset();
    }

    // ---------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------

    private async loadDataset() {
        try {
            this.mitreDataset = await loadMitreDataset(this.app);
            if (DEBUG) console.debug('[MitreModal] Dataset loaded:', this.mitreDataset.version, '- Techniques:', Object.keys(this.mitreDataset.techniques).length);
        } catch (err) {
            console.error('[MitreModal] Failed to load dataset:', err);
            this.mitreDataset = null;
        }
    }

    onOpen(): void {
        if (DEBUG) console.debug('[MitreModal] ===== MODAL OPENED =====');
        const { contentEl } = this;
        this.modalEl.classList.add('mitre-modal-fullscreen');

        // Add resize functionality
        makeResizable(this.modalEl);

        const headerContainer = contentEl.createDiv('mitre-modal-header');

        const titleRow = headerContainer.createDiv('mitre-title-row');
        titleRow.createEl('h2', { text: '🎯 MITRE ATT&CK Technique Mapper' });

        const exportBtn = titleRow.createEl('button', {
            text: 'Export to Navigator',
            cls: 'mitre-export-button'
        });
        exportBtn.addEventListener('click', () => {
            if (this.currentTactics && this.mitreDataset) {
                exportToNavigator(this.currentTactics, this.iocCount, this.mitreDataset);
            }
        });

        // Render search bar using extracted module
        this.searchUI = renderSearchBar(headerContainer, (query) => {
            this.currentSearchState = handleSearchInput(
                query,
                this.modalEl,
                this.currentTactics,
                this.getContext(),
                this.searchUI
            );
        });

        const statsContainer = contentEl.createDiv('mitre-stats');
        const contentArea = contentEl.createDiv('mitre-content-area');
        this.renderMitreMapping(contentArea, statsContainer);
    }

    onClose(): void {
        if (DEBUG) console.debug('[MitreModal] ===== MODAL CLOSED =====');
        const { contentEl } = this;
        contentEl.empty();
    }

    // ---------------------------------------------------------------
    // Context builder
    // ---------------------------------------------------------------

    /**
     * Build a MitreModalContext from current class state.
     * Passed to extracted rendering functions instead of `this`.
     */
    private getContext(): MitreModalContext {
        return {
            activeTechniqueId: this.activeTechniqueId,
            currentSearchState: this.currentSearchState,
            subtechniquesMap: this.subtechniquesMap,
            iocDataMap: this.iocDataMap,
            TECHNIQUE_TRUNCATE_LIMIT: this.TECHNIQUE_TRUNCATE_LIMIT,
            SUBTECHNIQUE_TRUNCATE_LIMIT: this.SUBTECHNIQUE_TRUNCATE_LIMIT,
            renderSubtechniques: (parentEl, subtechniques, searchState) => {
                renderSubtechniques(parentEl, subtechniques, this.getContext(), searchState);
            }
        };
    }

    // ---------------------------------------------------------------
    // Core rendering (stays as class method - mutates 5+ properties)
    // ---------------------------------------------------------------

    /**
     * Main rendering entry point. Extracts IOC data, runs aggregation,
     * and renders the full MITRE matrix.
     */
    private async renderMitreMapping(container: HTMLElement, statsContainer: HTMLElement): Promise<void> {
        if (DEBUG) console.debug('[MitreModal] ===== STARTING DATA EXTRACTION =====');

        // Extract IOC data
        const iocData = extractFixedIOCData(this.app);
        if (DEBUG) console.debug('[MitreModal] Extracted IOC count:', iocData.length);
        this.iocCount = iocData.length;

        if (iocData.length === 0) {
            container.createEl('p', {
                text: 'No IOC cards found in the current canvas.',
                cls: 'mitre-empty-message'
            });
            return;
        }

        // Ensure dataset is loaded
        if (!this.mitreDataset) {
            await this.loadDataset();
        }

        if (!this.mitreDataset) {
            container.createEl('div', {
                cls: 'mitre-error-message',
                text: '❌ MITRE ATT&CK dataset could not be loaded.'
            });
            container.createEl('p', {
                text: 'Please ensure enterprise-attack.json exists in the MITRE folder.'
            });
            container.createEl('a', {
                text: 'Download dataset from MITRE',
                attr: { href: 'https://github.com/mitre-attack/attack-stix-data', target: '_blank' }
            });
            return;
        }

        // Run aggregation
        const result = aggregateTacticsTechniques(iocData, this.mitreDataset);
        const tactics = result.tactics;
        this.subtechniquesMap = result.subtechniquesMap;
        this.validationErrors = result.validationErrors;
        this.iocDataMap = result.iocDataMap;
        this.iocCount = result.iocCount;
        const missingFields = result.missingFields;

        if (DEBUG) console.debug('[MitreModal] ===== AGGREGATION COMPLETE =====');

        if (tactics.length === 0) {
            container.createEl('p', {
                text: 'No MITRE tactics or techniques found in IOC cards. Add "Mitre Tactic" and "Mitre Technique" fields to your cards.',
                cls: 'mitre-empty-message'
            });
            return;
        }

        // Render stats bar (coverage, active tactics, IOC count, missing fields)
        renderStatsBar(statsContainer, tactics, result.iocCount, missingFields);

        // Store tactics for search filtering
        this.currentTactics = tactics;

        // Build context for extracted rendering functions
        const ctx = this.getContext();

        // Render validation errors section
        renderValidationErrors(container, this.validationErrors);

        if (DEBUG) console.debug('[MitreModal] Rendering MITRE matrix -', tactics.length, 'tactics');

        // Render tactics as columns
        tactics.forEach(tactic => {
            renderTacticSection(container, tactic, ctx, this.currentSearchState);
        });

        if (DEBUG) console.debug('[MitreModal] Matrix rendering complete:', {
            tactics: tactics.length,
            iocCards: result.iocCount
        });
    }
}
