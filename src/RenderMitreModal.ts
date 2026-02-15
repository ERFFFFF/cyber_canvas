/**
 * RenderMitreModal.ts - MITRE ATT&CK Technique Mapper
 *
 * Aggregates tactics and techniques from IOC cards and displays them
 * in a compact view grouped by tactic. Allows export to MITRE ATT&CK
 * Navigator format for visualization.
 */
import { App, Modal } from 'obsidian';
import { TimeTimelineProcessor } from './TimeTimelineProcessing';
import { IOCNodeData } from './IOCParser';
import { IOC_TYPES } from './IOCCardsTypes';
import {
    loadMitreDataset,
    validateTechniqueTactic,
    MitreDataset
} from './MitreLoader';

interface MitreTechnique {
    id: string;           // e.g., "T1566"
    name: string;         // e.g., "Phishing"
    tactic: string;       // e.g., "Initial Access" (original from IOC)
    tacticId: string;     // e.g., "TA0006" (MITRE tactic ID)
    count: number;        // How many IOC cards reference this
    iocCards: string[];   // IOC card IDs that use this technique
    severity: 'valid' | 'unknown_technique' | 'unknown_tactic' | 'mismatch' | 'empty_tactic' | 'not_found'; // Validation severity
    validationMessage?: string; // Error message if invalid
    description?: string; // Technique description
    isFound: boolean;     // Whether this technique has IOC cards
}

interface MitreTactic {
    name: string;
    displayName?: string;
    techniques: MitreTechnique[];
}

interface SearchState {
    query: string;
    keywords: string[];
    phrases: string[];
    isActive: boolean;
}

interface SearchMatch {
    matched: boolean;
    matchType?: 'id' | 'name' | 'description' | 'subtechnique';
    matchText?: string;
}

interface ValidationError {
    techniqueId: string;
    techniqueName: string;
    severity: 'unknown_technique' | 'unknown_tactic' | 'mismatch' | 'empty_tactic';
    message: string;
    iocCards: Array<{
        cardId: string;
        iocType: string;
        nodeId: string;
    }>;
}

export class RenderMitreModal extends Modal {
    private plugin: any;
    private timeProcessor: TimeTimelineProcessor;
    private mitreDataset: MitreDataset | null = null;
    private subtechniquesMap: Map<string, MitreTechnique[]> = new Map();
    private currentSearchState: SearchState | null = null;
    private currentTactics: MitreTactic[] | null = null;
    private searchBar: HTMLInputElement | null = null;
    private searchClearButton: HTMLElement | null = null;
    private searchMatchCount: HTMLElement | null = null;
    private validationErrors: ValidationError[] = [];

    // Truncation limits
    private readonly TECHNIQUE_TRUNCATE_LIMIT = 180;
    private readonly SUBTECHNIQUE_TRUNCATE_LIMIT = 100;

    /**
     * Whether the severity represents a critical error (red indicator).
     */
    private isCriticalSeverity(severity: string): boolean {
        return severity === 'unknown_technique'
            || severity === 'unknown_tactic'
            || severity === 'empty_tactic';
    }

    /**
     * Get the appropriate icon for a validation severity level.
     */
    private getSeverityIcon(severity: string): string {
        return this.isCriticalSeverity(severity) ? '🔴' : '⚠️';
    }

    /**
     * Apply the appropriate CSS validation class based on severity.
     */
    private applySeverityClass(element: HTMLElement, severity: string): void {
        if (this.isCriticalSeverity(severity)) {
            element.addClass('mitre-technique-error');
        } else if (severity === 'mismatch') {
            element.addClass('mitre-technique-warning');
        }
    }

    constructor(app: App, plugin: any) {
        super(app);
        this.plugin = plugin;
        this.timeProcessor = new TimeTimelineProcessor(app, plugin, IOC_TYPES);
        this.loadDataset();
    }

    /**
     * Clean MITRE description text by removing markdown links and square brackets.
     *
     * @param description - Raw description from MITRE dataset
     * @returns Cleaned description text
     */
    private cleanDescription(description: string): string {
        if (!description) return '';

        let cleaned = description;

        // Remove markdown links [text](url) - remove entirely
        cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '');

        // Remove all square brackets and their content [anything]
        cleaned = cleaned.replace(/\[[^\]]*\]/g, '');

        // Clean up multiple spaces and trim
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        return cleaned;
    }

    /**
     * Truncate description to maximum character length with ellipsis.
     *
     * @param description - Cleaned description text
     * @param maxChars - Maximum characters (default: 180)
     * @returns Truncated description with "..." if needed
     */
    private truncateDescription(description: string, maxChars: number = 180): string {
        if (!description || description.length <= maxChars) {
            return description;
        }

        // Truncate at last space before maxChars to avoid cutting words
        const truncated = description.substring(0, maxChars);
        const lastSpace = truncated.lastIndexOf(' ');

        if (lastSpace > 0) {
            return truncated.substring(0, lastSpace) + '...';
        }

        return truncated + '...';
    }

    /**
     * Toggle expansion (expand/collapse) for techniques or subtechniques.
     * Handles description swap and optional subtechniques rendering.
     *
     * @param element - The technique/subtechnique DOM element
     * @param subtechniques - Subtechniques to render (only for parent techniques)
     */
    private toggleExpansion(
        element: HTMLElement,
        subtechniques?: MitreTechnique[]
    ): void {
        const isCollapsed = element.hasClass('collapsed');
        const expandIcon = element.querySelector('.mitre-expand-icon') as HTMLElement;
        const descEl = element.querySelector('.mitre-technique-description') as HTMLElement;

        if (isCollapsed) {
            // EXPAND
            element.removeClass('collapsed');
            element.addClass('expanded');
            element.setAttribute('data-is-expanded', 'true');
            if (expandIcon) expandIcon.setText('▼');

            // Render subtechniques if provided (only for parent techniques)
            if (subtechniques && subtechniques.length > 0) {
                this.renderSubtechniques(element, subtechniques, this.currentSearchState);
            }

            // Show full description
            if (descEl) {
                const fullDesc = element.getAttribute('data-full-description');
                if (fullDesc) {
                    descEl.textContent = fullDesc;
                    if (this.currentSearchState?.isActive) {
                        this.highlightMatches(descEl, fullDesc, this.currentSearchState);
                    }
                }
            }
        } else {
            // COLLAPSE
            element.removeClass('expanded');
            element.addClass('collapsed');
            element.setAttribute('data-is-expanded', 'false');
            if (expandIcon) expandIcon.setText('▶');

            // Remove subtechniques container if present
            element.querySelector('.mitre-subtechniques-container')?.remove();

            // Show truncated description
            if (descEl) {
                const fullDesc = element.getAttribute('data-full-description');
                const truncatedDesc = element.getAttribute('data-truncated-description');
                const displayText = truncatedDesc || (fullDesc ? this.truncateDescription(fullDesc) : null);
                if (displayText) {
                    descEl.textContent = displayText;
                    if (this.currentSearchState?.isActive) {
                        this.highlightMatches(descEl, displayText, this.currentSearchState);
                    }
                }
            }
        }
    }

    /**
     * Load MITRE dataset asynchronously
     */
    private async loadDataset() {
        try {
            this.mitreDataset = await loadMitreDataset(this.app);
            console.debug('[MitreModal] Dataset loaded:', this.mitreDataset.version, '- Techniques:', Object.keys(this.mitreDataset.techniques).length);
        } catch (err) {
            console.error('[MitreModal] Failed to load dataset:', err);
            this.mitreDataset = null;
            // Error will be displayed in renderMitreMapping when dataset is null
        }
    }

    onOpen(): void {
        console.debug('[MitreModal] ===== MODAL OPENED =====');
        const { contentEl } = this;
        this.modalEl.classList.add('mitre-modal-fullscreen');

        // Add resize functionality
        this.makeResizable();

        const headerContainer = contentEl.createDiv('mitre-modal-header');

        const titleRow = headerContainer.createDiv('mitre-title-row');
        titleRow.createEl('h2', { text: '🎯 MITRE ATT&CK Technique Mapper' });

        const exportBtn = titleRow.createEl('button', {
            text: 'Export to Navigator',
            cls: 'mitre-export-button'
        });
        exportBtn.addEventListener('click', () => this.exportToNavigator());

        // Render search bar
        this.renderSearchBar(headerContainer);

        const statsContainer = contentEl.createDiv('mitre-stats');
        const contentArea = contentEl.createDiv('mitre-content-area');
        this.renderMitreMapping(contentArea, statsContainer);
    }

    /**
     * Render search bar in modal header.
     *
     * @param headerContainer - Header container element
     */
    private renderSearchBar(headerContainer: HTMLElement): void {
        const searchContainer = headerContainer.createDiv('mitre-search-container');

        const searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: 'Search techniques (use "quotes" for exact phrases)...',
            cls: 'mitre-search-input'
        });

        const clearButton = searchContainer.createEl('button', {
            text: '✕',
            cls: 'mitre-search-clear',
            attr: { 'aria-label': 'Clear search' }
        });
        clearButton.style.display = 'none';

        const matchCount = searchContainer.createDiv('mitre-search-match-count');
        matchCount.style.display = 'none';

        this.searchBar = searchInput;
        this.searchClearButton = clearButton;
        this.searchMatchCount = matchCount;

        // Debounced search handler
        let debounceTimer: number | null = null;
        searchInput.addEventListener('input', () => {
            if (debounceTimer !== null) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = window.setTimeout(() => {
                this.handleSearchInput(searchInput.value);
            }, 300);
        });

        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            this.handleSearchInput('');
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                this.handleSearchInput('');
            }
        });
    }

    /**
     * Handle search input changes and re-render content.
     *
     * @param query - Search query string
     */
    private handleSearchInput(query: string): void {
        const searchState = this.parseSearchQuery(query);
        this.currentSearchState = searchState;

        console.debug('[MitreModal] Search query:', query, '- Parsed:', searchState);

        // Update clear button visibility
        if (this.searchClearButton) {
            this.searchClearButton.style.display = searchState.isActive ? 'block' : 'none';
        }

        // Re-render content area with search filter
        const container = this.modalEl.querySelector('.mitre-content-area') as HTMLElement;
        if (container && this.currentTactics) {
            container.empty();

            let matchCount = 0;
            this.currentTactics.forEach(tactic => {
                // Filter techniques by search
                const matchingTechniques = tactic.techniques.filter(tech => {
                    if (!searchState.isActive) return true;
                    const match = this.matchesSearch(tech, searchState);
                    if (match.matched) matchCount++;
                    return match.matched;
                });

                // Only render tactic if it has matching techniques
                if (matchingTechniques.length > 0) {
                    const filteredTactic = { ...tactic, techniques: matchingTechniques };
                    this.renderTacticSection(container, filteredTactic, searchState);
                }
            });

            // Update match count display
            if (this.searchMatchCount) {
                if (searchState.isActive) {
                    this.searchMatchCount.textContent = `${matchCount} technique${matchCount !== 1 ? 's' : ''} found`;
                    this.searchMatchCount.style.display = 'block';
                } else {
                    this.searchMatchCount.style.display = 'none';
                }
            }

            // Show "no results" message if no matches
            if (matchCount === 0 && searchState.isActive) {
                container.createDiv({
                    cls: 'mitre-no-results',
                    text: 'No techniques match your search'
                });
            }
        }
    }

    private async renderMitreMapping(container: HTMLElement, statsContainer: HTMLElement): Promise<void> {
        console.debug('[MitreModal] ===== STARTING DATA EXTRACTION =====');
        // Extract IOC data
        const iocData = this.timeProcessor.extractFixedIOCData();
        console.debug('[MitreModal] Extracted IOC count:', iocData.length);

        if (iocData.length === 0) {
            container.createEl('p', {
                text: 'No IOC cards found in the current canvas.',
                cls: 'mitre-empty-message'
            });
            return;
        }

        // Aggregate tactics and techniques (async now)
        const tactics = await this.aggregateTacticsTechniques(iocData);
        console.debug('[MitreModal] ===== AGGREGATION COMPLETE =====');
        console.debug('[MitreModal] Tactics:', tactics.length);

        // Show error if dataset couldn't be loaded
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

        if (tactics.length === 0) {
            container.createEl('p', {
                text: 'No MITRE tactics or techniques found in IOC cards. Add "Mitre Tactic" and "Mitre Technique" fields to your cards.',
                cls: 'mitre-empty-message'
            });
            return;
        }

        // Summary stats with coverage (render into passed statsContainer)

        const totalTechniques = tactics.reduce((sum, t) => sum + t.techniques.length, 0);
        const foundTechniques = tactics.reduce((sum, t) => sum + t.techniques.filter(tech => tech.isFound).length, 0);
        const coveragePercent = totalTechniques > 0 ? Math.round((foundTechniques / totalTechniques) * 100) : 0;

        statsContainer.createEl('div', {
            text: `📊 Coverage: ${foundTechniques}/${totalTechniques} techniques (${coveragePercent}%)`,
            cls: 'mitre-stat-item'
        });

        const activeTactics = tactics.filter(t => t.techniques.some(tech => tech.isFound)).length;
        statsContainer.createEl('div', {
            text: `⚔️ Tactics: ${activeTactics}/${tactics.length} active`,
            cls: 'mitre-stat-item'
        });

        statsContainer.createEl('div', {
            text: `📇 IOC Cards: ${iocData.length} total`,
            cls: 'mitre-stat-item'
        });

        // Store tactics for search filtering
        this.currentTactics = tactics;

        // Render validation errors section if any exist
        this.renderValidationErrors(container);

        // Render tactics as columns
        tactics.forEach(tactic => {
            this.renderTacticSection(container, tactic, this.currentSearchState);
        });
    }

    /**
     * Render validation errors section with card references.
     * Groups errors by type (Tactic Errors, Technique Errors, Validation Mismatches).
     *
     * @param container - Container element for error section
     */
    private renderValidationErrors(container: HTMLElement): void {
        if (this.validationErrors.length === 0) {
            return; // No errors to display
        }

        console.debug('[MitreModal] Rendering', this.validationErrors.length, 'validation errors');

        // Group errors by type
        const emptyTacticErrors = this.validationErrors.filter(e => e.severity === 'empty_tactic');
        const tacticErrors = this.validationErrors.filter(e => e.severity === 'unknown_tactic');
        const techniqueErrors = this.validationErrors.filter(e => e.severity === 'unknown_technique');
        const mismatchErrors = this.validationErrors.filter(e => e.severity === 'mismatch');

        const errorSection = container.createDiv('mitre-validation-errors');

        // Header with total count
        const header = errorSection.createDiv('mitre-errors-header');
        header.createEl('h3', {
            text: `⚠️ Validation Issues (${this.validationErrors.length})`
        });

        // Collapsible toggle
        const toggleBtn = header.createEl('button', {
            text: 'Hide',
            cls: 'mitre-errors-toggle'
        });

        const errorsList = errorSection.createDiv('mitre-errors-list');
        errorSection.addClass('expanded');

        // Toggle collapse/expand
        toggleBtn.addEventListener('click', () => {
            if (errorSection.hasClass('expanded')) {
                errorSection.removeClass('expanded');
                errorSection.addClass('collapsed');
                toggleBtn.setText('Show');
                errorsList.style.display = 'none';
            } else {
                errorSection.removeClass('collapsed');
                errorSection.addClass('expanded');
                toggleBtn.setText('Hide');
                errorsList.style.display = 'block';
            }
        });

        // Render each error category with its own section (empty_tactic before unknown_tactic)
        if (emptyTacticErrors.length > 0) {
            this.renderErrorCategory(errorsList, 'Missing Tactic', emptyTacticErrors, '🔴');
        }

        if (tacticErrors.length > 0) {
            this.renderErrorCategory(errorsList, 'Unknown Tactic', tacticErrors, '🔴');
        }

        if (techniqueErrors.length > 0) {
            this.renderErrorCategory(errorsList, 'Technique Errors', techniqueErrors, '🔴');
        }

        if (mismatchErrors.length > 0) {
            this.renderErrorCategory(errorsList, 'Validation Mismatches', mismatchErrors, '⚠️');
        }
    }

    /**
     * Render a category of validation errors with header and items.
     *
     * @param container - Parent container element
     * @param categoryTitle - Display title for this error category
     * @param errors - Array of errors in this category
     * @param icon - Icon to use for this category
     */
    private renderErrorCategory(
        container: HTMLElement,
        categoryTitle: string,
        errors: ValidationError[],
        icon: string
    ): void {
        // Category header
        const categorySection = container.createDiv('mitre-error-category');
        const categoryHeader = categorySection.createDiv('mitre-error-category-header');
        categoryHeader.createEl('h4', {
            text: `${icon} ${categoryTitle} (${errors.length})`
        });

        // Render each error in this category
        errors.forEach(error => {
            const errorItem = categorySection.createDiv('mitre-error-item');

            // Apply severity styling
            if (this.isCriticalSeverity(error.severity)) {
                errorItem.addClass('mitre-error-critical');  // Red
            } else if (error.severity === 'mismatch') {
                errorItem.addClass('mitre-error-warning');   // Orange
            }

            // Error header with technique ID and name
            const errorHeader = errorItem.createDiv('mitre-error-header');
            errorHeader.createEl('span', {
                text: error.techniqueId,
                cls: 'mitre-error-technique-id'
            });
            errorHeader.createEl('span', {
                text: error.techniqueName,
                cls: 'mitre-error-technique-name'
            });

            // Error message
            errorItem.createDiv({
                text: error.message,
                cls: 'mitre-error-message'
            });

            // Card references
            const cardsSection = errorItem.createDiv('mitre-error-cards');
            cardsSection.createEl('span', {
                text: 'Affected cards: ',
                cls: 'mitre-error-cards-label'
            });

            error.iocCards.forEach((card, index) => {
                const cardBadge = cardsSection.createEl('span', {
                    cls: 'mitre-error-card-badge',
                    attr: { 'title': `Node ID: ${card.nodeId}` }
                });

                // Format: "IP Address #20260214-1534"
                cardBadge.createEl('span', {
                    text: card.iocType,
                    cls: 'mitre-error-card-type'
                });
                cardBadge.createEl('span', {
                    text: ` ${card.cardId}`,
                    cls: 'mitre-error-card-id'
                });

                // Add comma separator except for last card
                if (index < error.iocCards.length - 1) {
                    cardsSection.createEl('span', { text: ', ' });
                }
            });
        });
    }

    /**
     * Determines if newSeverity should override existingSeverity when aggregating.
     *
     * When multiple IOC cards reference the same technique with different validation
     * results, we need to decide which severity to display in the matrix. This uses
     * a priority ranking system where more critical errors override less critical ones.
     *
     * **Ranking (highest to lowest priority):**
     * 1. `unknown_technique` (5) - Technique ID not in dataset (CRITICAL - red)
     * 2. `unknown_tactic` (4) - Tactic name not recognized (CRITICAL - red)
     * 3. `empty_tactic` (3) - Technique filled but tactic empty (CRITICAL - red)
     * 4. `mismatch` (2) - Both valid but don't belong together (WARNING - orange)
     * 5. `valid` (1) - Correct pairing (SUCCESS - green)
     *
     * **Example:** If 3 cards reference T1566, one with valid pairing, one with mismatch,
     * and one with unknown_tactic, the final severity shown is `unknown_tactic` (highest rank).
     *
     * @param newSeverity - Severity from newly processed card
     * @param existingSeverity - Current aggregated severity for this technique
     * @returns true if newSeverity should replace existingSeverity
     */
    private shouldOverrideSeverity(
        newSeverity: 'valid' | 'unknown_technique' | 'unknown_tactic' | 'mismatch' | 'empty_tactic',
        existingSeverity: 'valid' | 'unknown_technique' | 'unknown_tactic' | 'mismatch' | 'empty_tactic'
    ): boolean {
        // Numerical ranking: higher number = more critical error
        const severityRank = {
            'unknown_technique': 5,  // Red - technique doesn't exist
            'unknown_tactic': 4,     // Red - tactic name/abbrev not found
            'empty_tactic': 3,       // Red - missing required field
            'mismatch': 2,           // Orange - wrong tactic for technique
            'valid': 1               // Green - correct pairing
        };
        return severityRank[newSeverity] > severityRank[existingSeverity];
    }

    /**
     * Aggregate MITRE tactics and techniques from IOC cards into full matrix structure.
     *
     * This is the core aggregation algorithm that builds the complete MITRE ATT&CK matrix
     * showing ALL 14 tactics and ALL ~800+ techniques, with found techniques highlighted
     * and validated. Uses a 5-step process for building the matrix and collecting errors.
     *
     * **Algorithm Overview:**
     * 1. Build map of found techniques from IOC cards (with validation per card)
     * 2. Build full tactic structure from dataset (all 14 tactics)
     * 3. Populate ALL techniques from dataset (found and unfound)
     * 4. Convert to array and sort by kill chain order
     * 5. Collect validation errors for display
     *
     * @param iocData - Array of parsed IOC nodes from canvas
     * @returns Array of MitreTactic objects with nested techniques
     */
    private async aggregateTacticsTechniques(iocData: IOCNodeData[]): Promise<MitreTactic[]> {
        // Wait for dataset to load
        if (!this.mitreDataset) {
            await this.loadDataset();
        }

        // If dataset is still null after loading, show error in UI
        if (!this.mitreDataset) {
            console.error('[MitreModal] Failed to load dataset');
            return [];
        }

        console.log('[MitreModal] Starting full matrix aggregation with', iocData.length, 'IOC cards');
        console.log('[MitreModal] Dataset has', Object.keys(this.mitreDataset!.techniques).length, 'techniques');

        // ---------------------------------------------------------------
        // STEP 1: Build map of found techniques from IOC cards
        // ---------------------------------------------------------------
        // Loop through all IOC cards and extract MITRE tactic/technique fields.
        // For each unique technique ID, track:
        //   - count: how many IOC cards reference it
        //   - iocCards: array of node IDs
        //   - severity: worst validation result (using shouldOverrideSeverity)
        //   - validationMessage: error message if invalid
        //   - userProvidedTactic: original tactic string from IOC card
        //
        // Also build cardValidations map for per-card error reporting.
        const foundTechniques = new Map<string, {
            count: number;
            iocCards: string[];
            severity: 'valid' | 'unknown_technique' | 'unknown_tactic' | 'mismatch' | 'empty_tactic';
            validationMessage?: string;
            userProvidedTactic: string; // Original tactic string from IOC card
        }>();

        // NEW: Track validation per card for accurate error reporting
        const cardValidations = new Map<string, {
            cardId: string;
            techniqueId: string;
            techniqueName: string;
            tactic: string;
            severity: 'valid' | 'unknown_technique' | 'unknown_tactic' | 'mismatch' | 'empty_tactic';
            validationMessage?: string;
            iocType: string;
            nodeId: string;
        }>();

        iocData.forEach(ioc => {
            // Explicitly trim and convert falsy values to empty string
            const rawTactic = (ioc.tactic || '').trim();
            const rawTechnique = (ioc.technique || '').trim();

            // ---------------------------------------------------------------
            // VALIDATION CASE 1: Empty technique - always skip
            // ---------------------------------------------------------------
            // If the technique field is empty, we cannot validate anything.
            // These cards are silently ignored (not counted as errors) because
            // an empty technique means the analyst hasn't filled in the MITRE
            // fields yet. We only validate cards where the analyst has provided
            // at least a technique ID.
            if (!rawTechnique) {
                console.debug('[MitreModal] Skipping IOC card with empty technique:', {
                    id: ioc.id,
                    cardId: ioc.cardId || '(no ID)',
                    type: ioc.type,
                    hasTactic: !!rawTactic,
                    hasTechnique: false,
                    tacticValue: rawTactic || '(empty)',
                    techniqueValue: '(empty)'
                });
                return;
            }

            const technique = rawTechnique;
            const techniqueId = this.extractTechniqueId(technique);
            const techniqueName = this.extractTechniqueName(technique);

            // ---------------------------------------------------------------
            // VALIDATION CASE 2: Filled technique but empty tactic - error
            // ---------------------------------------------------------------
            // The analyst provided a technique but left the tactic field empty.
            // This is an ERROR because we cannot validate the technique-tactic
            // pairing without both fields. The technique will be shown in the
            // matrix with "empty_tactic" severity (red) and an explicit error
            // message: "Tactic field is empty".
            //
            // This is different from Case 1 (both empty) where we silently skip.
            // Here, the analyst has started filling in MITRE fields but forgot
            // the tactic, so we flag it as an issue.
            if (!rawTactic) {
                console.debug('[MitreModal] Found IOC card with empty tactic:', {
                    id: ioc.id,
                    cardId: ioc.cardId || '(no ID)',
                    type: ioc.type,
                    techniqueId: techniqueId,
                    technique: technique
                });

                // Create validation result with empty_tactic severity
                const validation = {
                    severity: 'empty_tactic' as const,
                    message: 'Tactic field is empty',
                    tacticId: undefined
                };

                // NEW: Store individual card validation
                cardValidations.set(ioc.id, {
                    cardId: ioc.cardId || ioc.id,
                    techniqueId: techniqueId,
                    techniqueName: techniqueName,
                    tactic: '(empty)',
                    severity: validation.severity,
                    validationMessage: validation.message,
                    iocType: ioc.type,
                    nodeId: ioc.id
                });

                // Add to foundTechniques map (for technique-level aggregation)
                if (foundTechniques.has(techniqueId)) {
                    const existing = foundTechniques.get(techniqueId)!;
                    existing.count++;
                    existing.iocCards.push(ioc.id);
                    // Keep worst severity using helper function
                    if (this.shouldOverrideSeverity(validation.severity, existing.severity)) {
                        existing.severity = validation.severity;
                        existing.validationMessage = validation.message;
                    }
                } else {
                    foundTechniques.set(techniqueId, {
                        count: 1,
                        iocCards: [ioc.id],
                        severity: validation.severity,
                        validationMessage: validation.message,
                        userProvidedTactic: '(empty)'
                    });
                }
                return;
            }

            // ---------------------------------------------------------------
            // VALIDATION CASE 3: Both tactic and technique filled - normal validation
            // ---------------------------------------------------------------
            // This is the standard validation path. Both fields are filled, so
            // we can check:
            //   1. Does the technique ID exist in the dataset? (unknown_technique)
            //   2. Does the tactic name/abbreviation exist? (unknown_tactic)
            //   3. Does this technique belong to this tactic? (mismatch)
            //   4. If all checks pass, mark as valid
            //
            // Validation is performed by MitreLoader.validateTechniqueTactic()
            // which returns a severity enum and optional error message.
            const tactic = rawTactic;

            // Validate technique-tactic mapping using MitreLoader
            const validation = validateTechniqueTactic(techniqueId, tactic, this.mitreDataset!);

            console.debug('[MitreModal] Found technique:', {
                techniqueId,
                tactic,
                severity: validation.severity
            });

            // NEW: Always store individual card validation
            cardValidations.set(ioc.id, {
                cardId: ioc.cardId || ioc.id,
                techniqueId: techniqueId,
                techniqueName: techniqueName,
                tactic: tactic,
                severity: validation.severity,
                validationMessage: validation.message,
                iocType: ioc.type,
                nodeId: ioc.id
            });

            // Existing foundTechniques aggregation (for matrix coloring)
            if (foundTechniques.has(techniqueId)) {
                const existing = foundTechniques.get(techniqueId)!;
                existing.count++;
                existing.iocCards.push(ioc.id);
                // Keep worst severity using helper function
                if (this.shouldOverrideSeverity(validation.severity, existing.severity)) {
                    existing.severity = validation.severity;
                    existing.validationMessage = validation.message;
                }
            } else {
                foundTechniques.set(techniqueId, {
                    count: 1,
                    iocCards: [ioc.id],
                    severity: validation.severity,
                    validationMessage: validation.message,
                    userProvidedTactic: tactic
                });
            }
        });

        console.log('[MitreModal] Found', foundTechniques.size, 'unique techniques in IOC cards');

        // ---------------------------------------------------------------
        // STEP 2: Build full tactic structure from dataset
        // ---------------------------------------------------------------
        // Create a MitreTactic entry for ALL 14 tactics in the ATT&CK framework,
        // regardless of whether any IOC cards reference them. This ensures the
        // modal displays the complete matrix with empty tactics shown for context.
        //
        // Each tactic starts with an empty techniques array that will be populated
        // in STEP 3.
        const tacticMap = new Map<string, MitreTactic>();

        // Initialize ALL 14 tactics from the dataset
        Object.values(this.mitreDataset!.tactics).forEach(tacticData => {
            tacticMap.set(tacticData.id, {
                name: tacticData.id,
                displayName: `${tacticData.name} (${tacticData.id})`,
                techniques: []
            });
        });

        // ---------------------------------------------------------------
        // STEP 3: Populate ALL techniques from dataset
        // ---------------------------------------------------------------
        // Loop through ALL ~800+ techniques in the MITRE dataset and add them
        // to their respective tactics. This creates the complete matrix showing
        // both found and unfound techniques.
        //
        // For each technique:
        //   - Check if it was found in IOC cards (using foundTechniques map)
        //   - If found: use aggregated count/severity/validation from STEP 1
        //   - If not found: mark as severity='not_found' (will render gray)
        //   - If subtechnique: store separately in subtechniquesMap
        //   - If parent technique: add to ALL tactics it belongs to
        //
        // Clear subtechniques map for fresh aggregation
        this.subtechniquesMap.clear();

        Object.values(this.mitreDataset!.techniques).forEach(techData => {
            const foundData = foundTechniques.get(techData.id);
            const isFound = !!foundData;

            const techniqueObj: MitreTechnique = {
                id: techData.id,
                name: techData.name,
                tactic: '', // Will be set per-tactic below
                tacticId: '', // Will be set per-tactic below
                count: foundData?.count || 0,
                iocCards: foundData?.iocCards || [],
                severity: foundData?.severity || 'not_found',
                validationMessage: foundData?.validationMessage,
                description: techData.description,
                isFound: isFound
            };

            // If this is a subtechnique, store it separately
            if (techData.parent) {
                if (!this.subtechniquesMap.has(techData.parent)) {
                    this.subtechniquesMap.set(techData.parent, []);
                }
                // Store subtechnique with first tactic (for rendering context)
                if (techData.tactics.length > 0) {
                    techniqueObj.tactic = foundData?.userProvidedTactic || techData.tactics[0];
                    techniqueObj.tacticId = techData.tactics[0];
                }
                this.subtechniquesMap.get(techData.parent)!.push(techniqueObj);
                return; // Skip adding to main tactic list
            }

            // Add parent techniques to ALL their valid tactics
            techData.tactics.forEach(tacticId => {
                if (!tacticMap.has(tacticId)) {
                    console.warn('[MitreModal] Unknown tactic ID in dataset:', tacticId);
                    return;
                }

                const tactic = tacticMap.get(tacticId)!;

                tactic.techniques.push({
                    ...techniqueObj,
                    tactic: foundData?.userProvidedTactic || tacticId,
                    tacticId: tacticId
                });
            });
        });

        // ---------------------------------------------------------------
        // STEP 4: Convert to array and sort
        // ---------------------------------------------------------------
        // Convert the tacticMap into an array and sort tactics by the official
        // MITRE kill chain order (Reconnaissance → Impact). This ensures the
        // matrix columns appear in the correct sequence matching the standard
        // ATT&CK framework visualization.
        //
        // Within each tactic, techniques are sorted so:
        //   1. Found techniques appear first (isFound=true)
        //   2. Then sorted alphabetically by technique ID
        const tactics = Array.from(tacticMap.values());

        // Sort tactics by MITRE kill chain order (14 tactics from left to right)
        const tacticOrder = [
            'TA0043', // Reconnaissance
            'TA0042', // Resource Development
            'TA0001', // Initial Access
            'TA0002', // Execution
            'TA0003', // Persistence
            'TA0004', // Privilege Escalation
            'TA0005', // Defense Evasion
            'TA0006', // Credential Access
            'TA0007', // Discovery
            'TA0008', // Lateral Movement
            'TA0009', // Collection
            'TA0011', // Command and Control
            'TA0010', // Exfiltration
            'TA0040'  // Impact
        ];

        tactics.sort((a, b) => {
            const indexA = tacticOrder.indexOf(a.name);
            const indexB = tacticOrder.indexOf(b.name);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        // Sort techniques within each tactic by ID
        tactics.forEach(tactic => {
            tactic.techniques.sort((a, b) => {
                // Found techniques come first
                if (a.isFound && !b.isFound) return -1;
                if (!a.isFound && b.isFound) return 1;
                // Then sort by technique ID
                return a.id.localeCompare(b.id);
            });
        });

        console.log('[MitreModal] Full matrix built:', {
            totalTactics: tactics.length,
            totalTechniques: tactics.reduce((sum, t) => sum + t.techniques.length, 0),
            foundTechniques: foundTechniques.size
        });

        // ---------------------------------------------------------------
        // STEP 5: Collect validation errors for display
        // ---------------------------------------------------------------
        // Build the validation errors array for rendering at the top of the modal.
        // Uses the per-card validation data collected in STEP 1 to show which
        // specific IOC cards have errors.
        //
        // Groups errors by technique+severity to avoid duplicates:
        //   - Each unique technique+severity combo gets one error entry
        //   - Lists all affected IOC cards under that error
        //   - Categorized by severity for display (Missing Tactic, Unknown Tactic,
        //     Technique Errors, Validation Mismatches)
        console.log('[MitreModal] Collecting validation errors from card-level validation...');
        this.validationErrors = [];

        // Group cards by technique+severity for display
        const errorsByTechnique = new Map<string, {
            techniqueId: string;
            techniqueName: string;
            severity: 'unknown_technique' | 'unknown_tactic' | 'mismatch' | 'empty_tactic';
            message: string;
            cards: Array<{
                cardId: string;
                iocType: string;
                nodeId: string;
            }>;
        }>();

        // NEW: Filter errors by card-level validation (not technique-level)
        cardValidations.forEach((cardValidation, cardId) => {
            // Only include cards with actual errors
            if (cardValidation.severity !== 'valid') {
                const key = `${cardValidation.techniqueId}-${cardValidation.severity}`;

                if (!errorsByTechnique.has(key)) {
                    errorsByTechnique.set(key, {
                        techniqueId: cardValidation.techniqueId,
                        techniqueName: cardValidation.techniqueName,
                        severity: cardValidation.severity as any,
                        message: cardValidation.validationMessage || 'Validation error',
                        cards: []
                    });
                }

                errorsByTechnique.get(key)!.cards.push({
                    cardId: cardValidation.cardId,
                    iocType: cardValidation.iocType,
                    nodeId: cardValidation.nodeId
                });
            }
        });

        // Convert to validation errors array
        errorsByTechnique.forEach((errorData) => {
            this.validationErrors.push({
                techniqueId: errorData.techniqueId,
                techniqueName: errorData.techniqueName,
                severity: errorData.severity,
                message: errorData.message,
                iocCards: errorData.cards
            });
        });

        console.log('[MitreModal] Found', this.validationErrors.length, 'validation error groups from', cardValidations.size, 'cards');
        console.log('[MitreModal] Cards with errors:', Array.from(cardValidations.values()).filter(v => v.severity !== 'valid').length);

        return tactics;
    }

    /**
     * Extract technique ID from various formats.
     *
     * Supported formats:
     * - "T1566" -> "T1566"
     * - "T1566.001" -> "T1566.001"
     * - "T1566 - Phishing" -> "T1566"
     * - "Phishing (T1566)" -> "T1566"
     * - "T1566.001 - Spearphishing Attachment" -> "T1566.001"
     * - "Phishing" (name only) -> "Phishing" (fallback, will fail validation)
     *
     * NOTE: Technique field is already uppercased by IOCParser for consistency
     */
    private extractTechniqueId(technique: string): string {
        // Try to match full technique ID with optional sub-technique
        // Case-insensitive match since input is uppercased
        const idMatch = technique.match(/T\d{4}(?:\.\d{3})?/i);
        if (idMatch) {
            // Ensure returned ID is uppercase
            const techniqueId = idMatch[0].toUpperCase();
            console.debug('[MitreModal] Extracted technique ID:', techniqueId, 'from:', technique);
            return techniqueId;
        }

        // If no ID found, return the raw string (will be flagged as invalid)
        console.debug('[MitreModal] No technique ID found in:', technique, '- using raw string');
        return technique.trim();
    }

    /**
     * Extract technique name from various formats.
     *
     * Supported formats:
     * - "T1566 - Phishing" -> "Phishing"
     * - "Phishing (T1566)" -> "Phishing"
     * - "T1566.001 - Spearphishing Attachment" -> "Spearphishing Attachment"
     * - "T1566" (ID only) -> lookup name from MitreData
     * - "Phishing" (name only) -> "Phishing"
     */
    private extractTechniqueName(technique: string): string {
        // Format: "T1566 - Phishing" or "T1566.001 - Spearphishing Attachment"
        const dashMatch = technique.match(/T\d{4}(?:\.\d{3})?\s*-\s*(.+)/);
        if (dashMatch) {
            const name = dashMatch[1].trim();
            console.debug('[MitreModal] Extracted name from dash format:', name);
            return name;
        }

        // Format: "Phishing (T1566)" or "Spearphishing Attachment (T1566.001)"
        const parenMatch = technique.match(/(.+?)\s*\(T\d{4}(?:\.\d{3})?\)/);
        if (parenMatch) {
            const name = parenMatch[1].trim();
            console.debug('[MitreModal] Extracted name from paren format:', name);
            return name;
        }

        // If format is just ID, try to look up the name from loaded dataset
        const idOnlyMatch = technique.match(/^T\d{4}(?:\.\d{3})?$/);
        if (idOnlyMatch && this.mitreDataset) {
            const techData = this.mitreDataset.techniques[idOnlyMatch[0]];
            if (techData) {
                console.debug('[MitreModal] Looked up name for ID:', idOnlyMatch[0], '->', techData.name);
                return techData.name;
            }
        }

        // Otherwise return as-is (might be name-only format)
        console.debug('[MitreModal] Using raw technique string as name:', technique);
        return technique.trim();
    }

    private renderTacticSection(
        container: HTMLElement,
        tactic: MitreTactic,
        searchState?: SearchState | null
    ): void {
        const tacticColumn = container.createDiv('mitre-tactic-column');

        // Show found vs total count
        const foundCount = tactic.techniques.filter(t => t.isFound).length;
        const totalCount = tactic.techniques.length;

        const tacticHeader = tacticColumn.createDiv('mitre-tactic-header');
        tacticHeader.createEl('h3', { text: `⚔️ ${tactic.displayName || tactic.name}` });
        tacticHeader.createEl('span', {
            text: `${foundCount}/${totalCount} techniques covered`,
            cls: 'mitre-technique-count'
        });

        const techniqueList = tacticColumn.createDiv('mitre-technique-list');

        tactic.techniques.forEach(technique => {
            const techItem = techniqueList.createDiv('mitre-technique-item');

            // Check if this technique has subtechniques
            const subtechniques = this.subtechniquesMap.get(technique.id) || [];
            const hasSubtechniques = subtechniques.length > 0;

            // Check if description is long
            const cleanedDesc = this.cleanDescription(technique.description || '');
            const isLongDescription = cleanedDesc.length > 180;

            // Expandable if long description OR has subtechniques
            const isExpandable = isLongDescription || hasSubtechniques;

            // Add data attributes for state management
            techItem.setAttribute('data-technique-id', technique.id);
            techItem.setAttribute('data-subtechnique-count', subtechniques.length.toString());
            techItem.setAttribute('data-is-expandable', isExpandable.toString());
            techItem.setAttribute('data-full-description', cleanedDesc);
            if (isLongDescription) {
                const truncated = this.truncateDescription(cleanedDesc);
                techItem.setAttribute('data-truncated-description', truncated);
            }

            // Apply styling based on isFound and severity
            if (!technique.isFound) {
                techItem.addClass('mitre-technique-unfound'); // Gray, no validation
            } else {
                // Apply validation styling for found techniques
                this.applySeverityClass(techItem, technique.severity);
                // else: valid techniques get default green styling
            }

            const techInfo = techItem.createDiv('mitre-technique-info');

            // Add expand icon if expandable (long description OR subtechniques)
            if (isExpandable) {
                const expandIcon = techInfo.createEl('span', {
                    cls: 'mitre-expand-icon',
                    text: '▶'
                });
                techItem.addClass('has-expandable');  // Updated class name
                techItem.addClass('collapsed');

                // Click handler for expand/collapse
                techItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleExpansion(techItem, subtechniques);
                });
            }

            // Show validation icon ONLY for found techniques with issues
            if (technique.isFound && technique.severity !== 'valid' && technique.severity !== 'not_found') {
                const warningEl = techInfo.createEl('span', {
                    cls: 'mitre-validation-icon',
                    attr: {
                        'title': technique.validationMessage || 'Warning'
                    }
                });
                warningEl.innerHTML = this.getSeverityIcon(technique.severity);
            }

            techInfo.createEl('span', {
                text: technique.id,
                cls: 'mitre-technique-id'
            });

            // Add subtechnique count to name if present
            const nameText = hasSubtechniques
                ? `${technique.name} (${subtechniques.length})`
                : technique.name;
            const nameEl = techInfo.createEl('span', {
                text: nameText,
                cls: 'mitre-technique-name'
            });

            // Apply search highlighting to name if active
            if (searchState?.isActive) {
                this.highlightMatches(nameEl, technique.name, searchState);
            }

            // Show description for ALL techniques
            if (technique.description) {
                const descEl = techItem.createDiv('mitre-technique-description');

                // Show truncated or full description based on state
                const isExpanded = techItem.hasClass('expanded');
                let displayText: string;

                if (isExpanded || !isExpandable) {
                    // Show full description if expanded or not expandable
                    displayText = cleanedDesc;
                } else {
                    // Show truncated description if collapsed and expandable
                    displayText = this.truncateDescription(cleanedDesc);
                }

                descEl.textContent = displayText;

                // Apply search highlighting to description if active
                if (searchState?.isActive) {
                    this.highlightMatches(descEl, displayText, searchState);
                }
            }

            // Show count badge ONLY for found techniques
            if (technique.isFound) {
                const techCount = techItem.createDiv('mitre-technique-count-badge');
                techCount.textContent = `${technique.count} card${technique.count > 1 ? 's' : ''}`;
            }
        });
    }

    private renderSubtechniques(
        parentEl: HTMLElement,
        subtechniques: MitreTechnique[],
        searchState?: SearchState | null
    ): void {
        const container = parentEl.createDiv({ cls: 'mitre-subtechniques-container' });

        subtechniques.forEach(subtech => {
            const subItem = container.createDiv('mitre-technique-item mitre-subtechnique');

            // Check if subtechnique description is long
            const cleanedDesc = this.cleanDescription(subtech.description || '');
            const isLongDescription = cleanedDesc.length > this.SUBTECHNIQUE_TRUNCATE_LIMIT;

            // Add data attributes for state management
            subItem.setAttribute('data-technique-id', subtech.id);
            subItem.setAttribute('data-full-description', cleanedDesc);
            if (isLongDescription) {
                const truncated = this.truncateDescription(cleanedDesc, this.SUBTECHNIQUE_TRUNCATE_LIMIT);
                subItem.setAttribute('data-truncated-description', truncated);
            }

            // Apply styling based on isFound and severity
            if (!subtech.isFound) {
                subItem.addClass('mitre-technique-unfound');
            } else {
                this.applySeverityClass(subItem, subtech.severity);
            }

            const subInfo = subItem.createDiv('mitre-technique-info');

            // Add expand icon if description is long
            if (isLongDescription) {
                const expandIcon = subInfo.createEl('span', {
                    cls: 'mitre-expand-icon',
                    text: '▶'
                });
                subItem.addClass('has-expandable');
                subItem.addClass('collapsed');

                // Click handler for expand/collapse
                subItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleExpansion(subItem);
                });
            }

            // Show validation icon for found subtechniques with issues
            if (subtech.isFound && subtech.severity !== 'valid' && subtech.severity !== 'not_found') {
                const warningEl = subInfo.createEl('span', {
                    cls: 'mitre-validation-icon',
                    attr: {
                        'title': subtech.validationMessage || 'Warning'
                    }
                });
                warningEl.innerHTML = this.getSeverityIcon(subtech.severity);
            }

            subInfo.createEl('span', {
                text: subtech.id,
                cls: 'mitre-technique-id'
            });

            const nameEl = subInfo.createEl('span', {
                text: subtech.name,
                cls: 'mitre-technique-name'
            });

            // Apply search highlighting to name if active
            if (searchState?.isActive) {
                this.highlightMatches(nameEl, subtech.name, searchState);
            }

            // Show description with truncation
            if (subtech.description) {
                const descEl = subItem.createDiv('mitre-technique-description');

                // Show truncated or full based on expandable state
                let displayText: string;
                if (isLongDescription) {
                    // Start collapsed with truncated text
                    displayText = this.truncateDescription(cleanedDesc, this.SUBTECHNIQUE_TRUNCATE_LIMIT);
                } else {
                    // Short descriptions show in full
                    displayText = cleanedDesc;
                }

                descEl.textContent = displayText;

                // Apply search highlighting if active
                if (searchState?.isActive) {
                    this.highlightMatches(descEl, displayText, searchState);
                }
            }

            // Show count badge for found subtechniques
            if (subtech.isFound) {
                const subCount = subItem.createDiv('mitre-technique-count-badge');
                subCount.textContent = `${subtech.count} card${subtech.count > 1 ? 's' : ''}`;
            }
        });
    }

    /**
     * Parse search query into keywords and phrases.
     *
     * Supports two types of search terms:
     * 1. **Keywords**: Space-separated words (e.g., "spear phishing" → ["spear", "phishing"])
     * 2. **Phrases**: Quoted strings (e.g., "spear phishing" → ["spear phishing"])
     *
     * **Phrase Syntax:**
     * - Quoted phrases match exact sequences: "lateral movement" only matches that phrase
     * - Keywords match anywhere: lateral movement matches both separately
     * - Unmatched quotes are automatically removed (e.g., "spear phishing becomes spear phishing)
     *
     * **Algorithm:**
     * 1. Check for unmatched quotes and remove the last one
     * 2. Extract all quoted phrases using regex: /"([^"]+)"/g
     * 3. Remove phrases from query and split remaining text into keywords
     * 4. Normalize all terms to lowercase for case-insensitive matching
     *
     * @param query - Raw search query string
     * @returns SearchState object with parsed keywords and phrases
     */
    private parseSearchQuery(query: string): SearchState {
        if (!query || !query.trim()) {
            return {
                query: '',
                keywords: [],
                phrases: [],
                isActive: false
            };
        }

        const trimmedQuery = query.trim();

        // Handle unmatched quotes (odd number of quotes)
        // Example: user types "spear phishing without closing quote
        const quoteCount = (trimmedQuery.match(/"/g) || []).length;
        let processedQuery = trimmedQuery;
        if (quoteCount % 2 !== 0) {
            // Remove the last unmatched quote to prevent regex issues
            const lastQuoteIndex = processedQuery.lastIndexOf('"');
            processedQuery = processedQuery.substring(0, lastQuoteIndex) + processedQuery.substring(lastQuoteIndex + 1);
        }

        // Extract quoted phrases using regex
        // Regex: /"([^"]+)"/g matches "text" and captures text in group 1
        const phrases: string[] = [];
        const phraseRegex = /"([^"]+)"/g;
        let match;
        while ((match = phraseRegex.exec(processedQuery)) !== null) {
            phrases.push(match[1].toLowerCase());
        }

        // Remove quoted phrases from query and split remaining into keywords
        const remainingQuery = processedQuery.replace(/"[^"]+"/g, ' ');
        const keywords = remainingQuery
            .split(/\s+/)
            .map(k => k.trim().toLowerCase())
            .filter(k => k.length > 0);

        return {
            query: trimmedQuery,
            keywords,
            phrases,
            isActive: keywords.length > 0 || phrases.length > 0
        };
    }

    /**
     * Check if text matches all keywords and phrases in search state.
     *
     * @param text - Text to check
     * @param searchState - Parsed search state
     * @returns True if text matches all search terms
     */
    private textMatchesQuery(text: string, searchState: SearchState): boolean {
        if (!searchState.isActive) return true;

        const lowerText = text.toLowerCase();

        // Check all keywords are present
        const allKeywordsMatch = searchState.keywords.every(keyword =>
            lowerText.includes(keyword)
        );

        // Check all phrases are present
        const allPhrasesMatch = searchState.phrases.every(phrase =>
            lowerText.includes(phrase)
        );

        return allKeywordsMatch && allPhrasesMatch;
    }

    /**
     * Check if a technique matches the search query.
     *
     * **Search Hierarchy (checked in order):**
     * 1. **Technique ID** (e.g., "T1566") - highest priority, exact match
     * 2. **Technique Name** (e.g., "Phishing") - common use case
     * 3. **Technique Description** - finds techniques by their behavior description
     * 4. **Subtechniques** - if any subtechnique matches, show the parent too
     *
     * **Parent/Subtechnique Logic:**
     * When a subtechnique matches the search, the parent technique is also
     * included in results so the user can expand it and see the matching
     * subtechnique. For example, searching "spearphishing" will show T1566
     * (Phishing) with T1566.001 (Spearphishing Attachment) as an expandable child.
     *
     * **Match Precedence:**
     * Returns as soon as a match is found (short-circuits), prioritizing
     * more specific matches (ID > name > description > subtechnique).
     *
     * @param technique - Technique to check
     * @param searchState - Parsed search state with keywords/phrases
     * @returns SearchMatch result with match details
     */
    private matchesSearch(technique: MitreTechnique, searchState: SearchState): SearchMatch {
        if (!searchState.isActive) {
            return { matched: true };
        }

        // 1. Check technique ID (e.g., "T1566")
        if (this.textMatchesQuery(technique.id, searchState)) {
            return {
                matched: true,
                matchType: 'id',
                matchText: technique.id
            };
        }

        // 2. Check technique name (e.g., "Phishing")
        if (this.textMatchesQuery(technique.name, searchState)) {
            return {
                matched: true,
                matchType: 'name',
                matchText: technique.name
            };
        }

        // 3. Check technique description (e.g., "adversary sends email")
        if (technique.description && this.textMatchesQuery(technique.description, searchState)) {
            return {
                matched: true,
                matchType: 'description',
                matchText: technique.description
            };
        }

        // 4. Check subtechniques (if child matches, show parent for context)
        const subtechniques = this.subtechniquesMap.get(technique.id) || [];
        for (const subtech of subtechniques) {
            if (this.textMatchesQuery(subtech.id, searchState) ||
                this.textMatchesQuery(subtech.name, searchState) ||
                (subtech.description && this.textMatchesQuery(subtech.description, searchState))) {
                return {
                    matched: true,
                    matchType: 'subtechnique',
                    matchText: subtech.name
                };
            }
        }

        return { matched: false };
    }

    /**
     * Escape HTML to prevent XSS injection.
     *
     * @param text - Text to escape
     * @returns HTML-escaped text
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Escape special regex characters.
     *
     * @param text - Text to escape
     * @returns Regex-escaped text
     */
    private escapeRegex(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Highlight search matches in text element.
     *
     * @param element - DOM element to highlight
     * @param originalText - Original text content
     * @param searchState - Parsed search state
     */
    private highlightMatches(element: HTMLElement, originalText: string, searchState: SearchState): void {
        if (!searchState.isActive || !originalText) {
            return;
        }

        let escapedText = this.escapeHtml(originalText);

        // Highlight phrases first (longer matches)
        searchState.phrases.forEach(phrase => {
            const escapedPhrase = this.escapeRegex(phrase);
            const regex = new RegExp(`(${escapedPhrase})`, 'gi');
            escapedText = escapedText.replace(regex, '<mark class="mitre-search-highlight">$1</mark>');
        });

        // Highlight keywords (avoid double-wrapping inside existing marks)
        searchState.keywords.forEach(keyword => {
            const escapedKeyword = this.escapeRegex(keyword);
            // Use negative lookahead to avoid matching inside existing <mark> tags
            const regex = new RegExp(`(?!<mark[^>]*>)(${escapedKeyword})(?![^<]*<\/mark>)`, 'gi');
            escapedText = escapedText.replace(regex, '<mark class="mitre-search-highlight">$1</mark>');
        });

        element.innerHTML = escapedText;
    }

    private async exportToNavigator(): Promise<void> {
        console.debug('[MitreModal] ===== EXPORTING =====');
        const iocData = this.timeProcessor.extractFixedIOCData();
        const tactics = await this.aggregateTacticsTechniques(iocData);

        // Build MITRE ATT&CK Navigator layer format
        const layer = {
            name: "Cyber Canvas IOC Analysis",
            versions: {
                attack: "14",
                navigator: "4.9.4",
                layer: "4.5"
            },
            domain: "enterprise-attack",
            description: `Generated from ${iocData.length} IOC cards in Obsidian Canvas`,
            filters: {
                platforms: ["windows", "linux", "macos"]
            },
            sorting: 0,
            layout: {
                layout: "side",
                aggregateFunction: "average",
                showID: true,
                showName: true,
                showAggregateScores: false,
                countUnscored: false
            },
            hideDisabled: false,
            techniques: [] as any[],
            gradient: {
                colors: ["#ff6666", "#ffe766", "#8ec843"],
                minValue: 0,
                maxValue: 100
            },
            legendItems: [] as any[],
            metadata: [] as any[],
            links: [] as any[],
            showTacticRowBackground: true,
            tacticRowBackground: "#dddddd",
            selectTechniquesAcrossTactics: true,
            selectSubtechniquesWithParent: false
        };

        // Add techniques to layer (only found techniques)
        tactics.forEach(tactic => {
            tactic.techniques.forEach(technique => {
                // Skip unfound techniques in export
                if (!technique.isFound) {
                    return;
                }

                // Use tactic short name from dataset
                const tacticData = this.mitreDataset?.tactics[technique.tacticId];
                const tacticShortName = tacticData?.short_name
                    || tactic.name.toLowerCase().replace(/\s+/g, '-');

                // Set color based on severity
                let color: string;
                if (technique.severity === 'valid') {
                    color = "#66bb6a";  // Green - valid
                } else if (this.isCriticalSeverity(technique.severity)) {
                    color = "#f44336";  // Red - unknown
                } else if (technique.severity === 'mismatch') {
                    color = "#ffa500";  // Orange - wrong tactic
                } else {
                    color = "#66bb6a";  // Default green
                }

                // Build comment with validation status
                let comment = `Used in ${technique.count} IOC card${technique.count > 1 ? 's' : ''}`;
                if (technique.severity !== 'valid' && technique.validationMessage) {
                    comment += `\n${this.getSeverityIcon(technique.severity)} ${technique.validationMessage}`;
                }

                layer.techniques.push({
                    techniqueID: technique.id,
                    tactic: tacticShortName,
                    color: color,
                    comment: comment,
                    enabled: true,
                    metadata: [
                        {
                            name: 'severity',
                            value: technique.severity
                        },
                        {
                            name: 'ioc_cards',
                            value: technique.iocCards.join(', ')
                        }
                    ],
                    links: [],
                    showSubtechniques: false,
                    score: technique.count * 10 // Scale count for visual weight
                });
            });
        });

        // Create download
        const jsonString = JSON.stringify(layer, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `mitre-navigator-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    onClose(): void {
        console.debug('[MitreModal] ===== MODAL CLOSED =====');
        const { contentEl } = this;
        contentEl.empty();
    }

    /**
     * Add drag handles and resize functionality to the modal.
     *
     * Creates 8 resize handles (4 corners + 4 edges) and attaches drag listeners.
     * Each handle calculates new dimensions based on mouse movement direction:
     *
     * **Coordinate Math:**
     * - **East (E):** Drag right increases width by deltaX
     * - **West (W):** Drag left decreases width, shifts modal left
     * - **South (S):** Drag down increases height by deltaY
     * - **North (N):** Drag up decreases height, shifts modal up
     * - **Corners:** Combine two directions (e.g., NE = North + East)
     *
     * **Constraints:**
     * - MIN_WIDTH: 600px (prevents crushing tactic columns)
     * - MIN_HEIGHT: 400px (prevents hiding header/controls)
     * - MAX_WIDTH/MAX_HEIGHT: 95% of viewport (prevents overflow)
     *
     * **Position Updates:**
     * When resizing from North or West edges, the modal position must shift
     * to maintain the opposite edge's position. For example, dragging the West
     * edge left by 50px must also move the modal left by 50px.
     */
    private makeResizable(): void {
        const modal = this.modalEl;

        // Minimum and maximum constraints for modal dimensions
        const MIN_WIDTH = 600;   // Narrower would crush tactic columns
        const MIN_HEIGHT = 400;  // Shorter would hide header/controls
        const MAX_WIDTH = window.innerWidth * 0.95;   // Leave 5% viewport margin
        const MAX_HEIGHT = window.innerHeight * 0.95;

        // Resize handle positions: [className, cursor, isCorner]
        // N=North, S=South, E=East, W=West
        const handles: Array<[string, string, boolean]> = [
            ['resize-handle-n', 'ns-resize', false],    // Top edge
            ['resize-handle-s', 'ns-resize', false],    // Bottom edge
            ['resize-handle-e', 'ew-resize', false],    // Right edge
            ['resize-handle-w', 'ew-resize', false],    // Left edge
            ['resize-handle-ne', 'nesw-resize', true],  // Top-right corner
            ['resize-handle-nw', 'nwse-resize', true],  // Top-left corner
            ['resize-handle-se', 'nwse-resize', true],  // Bottom-right corner
            ['resize-handle-sw', 'nesw-resize', true],  // Bottom-left corner
        ];

        handles.forEach(([className, cursor, isCorner]) => {
            const handle = modal.createDiv(`mitre-resize-handle ${className}`);
            handle.style.cursor = cursor;

            let startX = 0, startY = 0, startWidth = 0, startHeight = 0, startLeft = 0, startTop = 0;

            const onMouseDown = (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();

                startX = e.clientX;
                startY = e.clientY;

                const rect = modal.getBoundingClientRect();
                startWidth = rect.width;
                startHeight = rect.height;
                startLeft = rect.left;
                startTop = rect.top;

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);

                modal.addClass('mitre-modal-resizing');
            };

            const onMouseMove = (e: MouseEvent) => {
                // Calculate mouse movement since drag started
                const deltaX = e.clientX - startX;  // Positive = moved right, negative = moved left
                const deltaY = e.clientY - startY;  // Positive = moved down, negative = moved up

                // Initialize new dimensions/position from starting values
                let newWidth = startWidth;
                let newHeight = startHeight;
                let newLeft = startLeft;
                let newTop = startTop;

                // ---------------------------------------------------------------
                // Calculate new dimensions based on handle direction
                // ---------------------------------------------------------------
                // Each handle direction updates different dimensions:
                //   - East/West affect width
                //   - North/South affect height
                //   - Corners combine both
                //
                // Constraints (MIN/MAX) are applied to prevent invalid sizes.

                if (className.includes('-e')) {
                    // East (right edge): drag right increases width
                    newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + deltaX));
                }
                if (className.includes('-w')) {
                    // West (left edge): drag left increases width, shifts modal left
                    // Note: deltaX is negative when dragging left, so subtract it
                    newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth - deltaX));
                    // Shift modal left by the difference to keep right edge stationary
                    newLeft = startLeft + (startWidth - newWidth);
                }
                if (className.includes('-s')) {
                    // South (bottom edge): drag down increases height
                    newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + deltaY));
                }
                if (className.includes('-n')) {
                    // North (top edge): drag up increases height, shifts modal up
                    // Note: deltaY is negative when dragging up, so subtract it
                    newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight - deltaY));
                    // Shift modal up by the difference to keep bottom edge stationary
                    newTop = startTop + (startHeight - newHeight);
                }

                // Apply new dimensions with !important to override any CSS
                modal.style.setProperty('width', `${newWidth}px`, 'important');
                modal.style.setProperty('height', `${newHeight}px`, 'important');
                modal.style.setProperty('max-width', `${newWidth}px`, 'important');
                modal.style.setProperty('max-height', `${newHeight}px`, 'important');

                // Update position if resizing from top or left
                if (className.includes('-w') || className.includes('-n')) {
                    modal.style.left = `${newLeft}px`;
                    modal.style.top = `${newTop}px`;
                }
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                modal.removeClass('mitre-modal-resizing');
            };

            handle.addEventListener('mousedown', onMouseDown);
        });
    }
}
