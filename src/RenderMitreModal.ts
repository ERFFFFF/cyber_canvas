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
    getTacticDisplayName,
    getTechniqueInfo,
    MITRE_TACTICS
} from './MitreData';
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
    severity: 'valid' | 'unknown_technique' | 'unknown_tactic' | 'mismatch' | 'not_found'; // Validation severity
    validationMessage?: string; // Error message if invalid
    description?: string; // Technique description
    isFound: boolean;     // Whether this technique has IOC cards
}

interface MitreTactic {
    name: string;
    displayName?: string;
    techniques: MitreTechnique[];
}

export class RenderMitreModal extends Modal {
    private plugin: any;
    private timeProcessor: TimeTimelineProcessor;
    private mitreDataset: MitreDataset | null = null;
    private subtechniquesMap: Map<string, MitreTechnique[]> = new Map();

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
     * Load MITRE dataset asynchronously
     */
    private async loadDataset() {
        try {
            this.mitreDataset = await loadMitreDataset(this.app);
            console.debug('[MitreModal] Dataset loaded:', this.mitreDataset.version, '- Techniques:', Object.keys(this.mitreDataset.techniques).length);
        } catch (err) {
            console.error('[MitreModal] Failed to load dataset:', err);
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

        const statsContainer = contentEl.createDiv('mitre-stats');
        const contentArea = contentEl.createDiv('mitre-content-area');
        this.renderMitreMapping(contentArea, statsContainer);
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

        // Render tactics as columns
        tactics.forEach(tactic => {
            this.renderTacticSection(container, tactic);
        });
    }

    private async aggregateTacticsTechniques(iocData: IOCNodeData[]): Promise<MitreTactic[]> {
        // Wait for dataset to load
        if (!this.mitreDataset) {
            await this.loadDataset();
            if (!this.mitreDataset) {
                console.error('[MitreModal] Failed to load dataset');
                return [];
            }
        }

        console.log('[MitreModal] Starting full matrix aggregation with', iocData.length, 'IOC cards');
        console.log('[MitreModal] Dataset has', Object.keys(this.mitreDataset!.techniques).length, 'techniques');

        // STEP 1: Build map of found techniques from IOC cards
        const foundTechniques = new Map<string, {
            count: number;
            iocCards: string[];
            severity: 'valid' | 'unknown_technique' | 'unknown_tactic' | 'mismatch';
            validationMessage?: string;
            userProvidedTactic: string; // Original tactic string from IOC card
        }>();

        iocData.forEach(ioc => {
            if (!ioc.tactic || !ioc.technique) {
                return;
            }

            const tactic = ioc.tactic.trim();
            const technique = ioc.technique.trim();
            if (!tactic || !technique) return;

            const techniqueId = this.extractTechniqueId(technique);
            const techniqueName = this.extractTechniqueName(technique);

            // Validate technique-tactic mapping
            const validation = validateTechniqueTactic(techniqueId, tactic, this.mitreDataset!);

            console.debug('[MitreModal] Found technique:', {
                techniqueId,
                tactic,
                severity: validation.severity
            });

            if (foundTechniques.has(techniqueId)) {
                const existing = foundTechniques.get(techniqueId)!;
                existing.count++;
                existing.iocCards.push(ioc.id);
                // Keep worst severity
                if (validation.severity === 'unknown_technique' ||
                    validation.severity === 'unknown_tactic' ||
                    (validation.severity === 'mismatch' && existing.severity === 'valid')) {
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

        // STEP 2: Build full tactic structure from dataset
        const tacticMap = new Map<string, MitreTactic>();

        // Initialize ALL 14 tactics
        Object.values(this.mitreDataset!.tactics).forEach(tacticData => {
            tacticMap.set(tacticData.id, {
                name: tacticData.id,
                displayName: `${tacticData.name} (${tacticData.id})`,
                techniques: []
            });
        });

        // STEP 3: Populate ALL techniques from dataset
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

        // STEP 4: Convert to array and sort
        const tactics = Array.from(tacticMap.values());

        // Sort tactics by MITRE kill chain order
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
     */
    private extractTechniqueId(technique: string): string {
        // Try to match full technique ID with optional sub-technique
        const idMatch = technique.match(/T\d{4}(?:\.\d{3})?/);
        if (idMatch) {
            console.debug('[MitreModal] Extracted technique ID:', idMatch[0], 'from:', technique);
            return idMatch[0];
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

        // If format is just ID, try to look up the name
        const idOnlyMatch = technique.match(/^T\d{4}(?:\.\d{3})?$/);
        if (idOnlyMatch) {
            const info = getTechniqueInfo(idOnlyMatch[0]);
            if (info) {
                console.debug('[MitreModal] Looked up name for ID:', idOnlyMatch[0], '->', info.name);
                return info.name;
            }
        }

        // Otherwise return as-is (might be name-only format)
        console.debug('[MitreModal] Using raw technique string as name:', technique);
        return technique.trim();
    }

    private renderTacticSection(container: HTMLElement, tactic: MitreTactic): void {
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

            // Apply styling based on isFound and severity
            if (!technique.isFound) {
                techItem.addClass('mitre-technique-unfound'); // Gray, no validation
            } else {
                // Apply validation styling for found techniques
                if (technique.severity === 'unknown_technique' ||
                    technique.severity === 'unknown_tactic') {
                    techItem.addClass('mitre-technique-error');      // Red
                } else if (technique.severity === 'mismatch') {
                    techItem.addClass('mitre-technique-warning');    // Orange
                }
                // else: valid techniques get default green styling
            }

            const techInfo = techItem.createDiv('mitre-technique-info');

            // Add expand icon if has subtechniques
            if (hasSubtechniques) {
                const expandIcon = techInfo.createEl('span', {
                    cls: 'mitre-expand-icon',
                    text: '▶'
                });
                techItem.addClass('has-subtechniques');
                techItem.addClass('collapsed');

                // Click handler for expand/collapse
                techItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isCollapsed = techItem.hasClass('collapsed');
                    const descEl = techItem.querySelector('.mitre-technique-description') as HTMLElement;

                    if (isCollapsed) {
                        // EXPAND
                        techItem.removeClass('collapsed');
                        techItem.addClass('expanded');
                        expandIcon.setText('▼');
                        this.renderSubtechniques(techItem, subtechniques);

                        // Show full description
                        if (descEl) {
                            const fullDesc = descEl.getAttribute('data-full-description');
                            if (fullDesc) {
                                descEl.textContent = fullDesc;
                            }
                        }
                    } else {
                        // COLLAPSE
                        techItem.removeClass('expanded');
                        techItem.addClass('collapsed');
                        expandIcon.setText('▶');
                        techItem.querySelector('.mitre-subtechniques-container')?.remove();

                        // Show truncated description
                        if (descEl) {
                            const fullDesc = descEl.getAttribute('data-full-description');
                            if (fullDesc) {
                                descEl.textContent = this.truncateDescription(fullDesc);
                            }
                        }
                    }
                });
            }

            // Show validation icon ONLY for found techniques with issues
            if (technique.isFound && technique.severity !== 'valid' && technique.severity !== 'not_found') {
                const icon = (technique.severity === 'unknown_technique' || technique.severity === 'unknown_tactic')
                    ? '🔴'
                    : '⚠️';
                const warningEl = techInfo.createEl('span', {
                    cls: 'mitre-validation-icon',
                    attr: {
                        'aria-label': technique.validationMessage || 'Warning',
                        'title': technique.validationMessage || 'Warning'
                    }
                });
                warningEl.innerHTML = icon;
            }

            techInfo.createEl('span', {
                text: technique.id,
                cls: 'mitre-technique-id'
            });
            techInfo.createEl('span', {
                text: technique.name,
                cls: 'mitre-technique-name'
            });

            // Show description for ALL techniques
            if (technique.description) {
                const descEl = techItem.createDiv('mitre-technique-description');
                const cleanedDesc = this.cleanDescription(technique.description);

                // Store full description for expand/collapse
                descEl.setAttribute('data-full-description', cleanedDesc);

                // Show truncated version initially (collapsed state)
                const isExpanded = techItem.hasClass('expanded');
                if (isExpanded || !hasSubtechniques) {
                    // Show full description if expanded or no subtechniques
                    descEl.textContent = cleanedDesc;
                } else {
                    // Show truncated description if collapsed
                    descEl.textContent = this.truncateDescription(cleanedDesc);
                }
            }

            // Show count badge ONLY for found techniques
            if (technique.isFound) {
                const techCount = techItem.createDiv('mitre-technique-count-badge');
                techCount.textContent = `${technique.count} card${technique.count > 1 ? 's' : ''}`;
            }
        });
    }

    private renderSubtechniques(parentEl: HTMLElement, subtechniques: MitreTechnique[]): void {
        const container = parentEl.createDiv({ cls: 'mitre-subtechniques-container' });

        subtechniques.forEach(subtech => {
            const subItem = container.createDiv('mitre-technique-item mitre-subtechnique');

            // Apply styling based on isFound and severity
            if (!subtech.isFound) {
                subItem.addClass('mitre-technique-unfound');
            } else {
                if (subtech.severity === 'unknown_technique' ||
                    subtech.severity === 'unknown_tactic') {
                    subItem.addClass('mitre-technique-error');
                } else if (subtech.severity === 'mismatch') {
                    subItem.addClass('mitre-technique-warning');
                }
            }

            const subInfo = subItem.createDiv('mitre-technique-info');

            // Show validation icon for found subtechniques with issues
            if (subtech.isFound && subtech.severity !== 'valid' && subtech.severity !== 'not_found') {
                const icon = (subtech.severity === 'unknown_technique' || subtech.severity === 'unknown_tactic')
                    ? '🔴'
                    : '⚠️';
                const warningEl = subInfo.createEl('span', {
                    cls: 'mitre-validation-icon',
                    attr: {
                        'aria-label': subtech.validationMessage || 'Warning',
                        'title': subtech.validationMessage || 'Warning'
                    }
                });
                warningEl.innerHTML = icon;
            }

            subInfo.createEl('span', {
                text: subtech.id,
                cls: 'mitre-technique-id'
            });
            subInfo.createEl('span', {
                text: subtech.name,
                cls: 'mitre-technique-name'
            });

            // Show description (full text, no truncation for subtechniques)
            if (subtech.description) {
                const descEl = subItem.createDiv('mitre-technique-description');
                const cleanedDesc = this.cleanDescription(subtech.description);
                descEl.textContent = cleanedDesc;
            }

            // Show count badge for found subtechniques
            if (subtech.isFound) {
                const subCount = subItem.createDiv('mitre-technique-count-badge');
                subCount.textContent = `${subtech.count} card${subtech.count > 1 ? 's' : ''}`;
            }
        });
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
                } else if (technique.severity === 'unknown_technique' || technique.severity === 'unknown_tactic') {
                    color = "#f44336";  // Red - unknown
                } else if (technique.severity === 'mismatch') {
                    color = "#ffa500";  // Orange - wrong tactic
                } else {
                    color = "#66bb6a";  // Default green
                }

                // Build comment with validation status
                let comment = `Used in ${technique.count} IOC card${technique.count > 1 ? 's' : ''}`;
                if (technique.severity !== 'valid' && technique.validationMessage) {
                    const icon = (technique.severity === 'unknown_technique' || technique.severity === 'unknown_tactic') ? '🔴' : '⚠️';
                    comment += `\n${icon} ${technique.validationMessage}`;
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
     * Creates 8 resize handles (4 corners + 4 edges) and attaches drag listeners.
     */
    private makeResizable(): void {
        const modal = this.modalEl;

        // Minimum and maximum constraints
        const MIN_WIDTH = 600;
        const MIN_HEIGHT = 400;
        const MAX_WIDTH = window.innerWidth * 0.95;
        const MAX_HEIGHT = window.innerHeight * 0.95;

        // Resize handle positions: [className, cursor, isCorner]
        const handles: Array<[string, string, boolean]> = [
            ['resize-handle-n', 'ns-resize', false],
            ['resize-handle-s', 'ns-resize', false],
            ['resize-handle-e', 'ew-resize', false],
            ['resize-handle-w', 'ew-resize', false],
            ['resize-handle-ne', 'nesw-resize', true],
            ['resize-handle-nw', 'nwse-resize', true],
            ['resize-handle-se', 'nwse-resize', true],
            ['resize-handle-sw', 'nesw-resize', true],
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
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                let newWidth = startWidth;
                let newHeight = startHeight;
                let newLeft = startLeft;
                let newTop = startTop;

                // Calculate new dimensions based on handle direction
                if (className.includes('-e')) {
                    newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + deltaX));
                }
                if (className.includes('-w')) {
                    newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth - deltaX));
                    newLeft = startLeft + (startWidth - newWidth);
                }
                if (className.includes('-s')) {
                    newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + deltaY));
                }
                if (className.includes('-n')) {
                    newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight - deltaY));
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
