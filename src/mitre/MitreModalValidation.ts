/**
 * MitreModalValidation.ts - Validation errors section rendering
 *
 * Renders the collapsible validation errors section at the top of the MITRE
 * modal. Groups errors by type (Missing Tactic, Unknown Tactic, Technique
 * Errors, Mismatches) and shows affected IOC card references.
 */

import { ValidationError } from './MitreTypes';
import { isCriticalSeverity } from './MitreSeverity';
import { DEBUG } from '../debug';

// ---------------------------------------------------------------
// Validation errors section
// ---------------------------------------------------------------

/**
 * Render validation errors section with card references.
 * Groups errors by type and provides a collapsible UI.
 *
 * Groups errors into 3 categories:
 * - Unknown Tactic: Tactic abbreviation/name not recognized
 * - Technique Errors: Technique ID not found in dataset
 * - Validation Mismatches: Both valid but don't belong together
 *
 * NOTE: Cards with missing fields are NOT shown here - they appear
 * in the statistics bar as informational counts with hover tooltips.
 *
 * @param container - Parent container element
 * @param validationErrors - Array of validation errors from aggregation
 */
export function renderValidationErrors(
    container: HTMLElement,
    validationErrors: ValidationError[]
): void {
    if (validationErrors.length === 0) return;

    if (DEBUG) console.debug('[MitreModalValidation] Rendering', validationErrors.length, 'validation errors');

    // Group errors by type (only 3 categories now - empty_tactic removed)
    const tacticErrors = validationErrors.filter(e => e.severity === 'unknown_tactic');
    const techniqueErrors = validationErrors.filter(e => e.severity === 'unknown_technique');
    const mismatchErrors = validationErrors.filter(e => e.severity === 'mismatch');

    const errorSection = container.createDiv('mitre-validation-errors');

    // Header with total count
    const header = errorSection.createDiv('mitre-errors-header');
    header.createEl('h3', {
        text: `⚠️ Validation Issues (${validationErrors.length})`
    });

    // Collapsible toggle
    const toggleBtn = header.createEl('button', {
        text: 'Hide',
        cls: 'mitre-errors-toggle'
    });

    const errorsList = errorSection.createDiv('mitre-errors-list');
    errorSection.addClass('expanded');

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

    // Render each error category (Missing Tactic category removed)
    if (tacticErrors.length > 0) {
        renderErrorCategory(errorsList, 'Unknown Tactic', tacticErrors, '🔴');
    }
    if (techniqueErrors.length > 0) {
        renderErrorCategory(errorsList, 'Technique Errors', techniqueErrors, '🔴');
    }
    if (mismatchErrors.length > 0) {
        renderErrorCategory(errorsList, 'Validation Mismatches', mismatchErrors, '⚠️');
    }
}

// ---------------------------------------------------------------
// Error category rendering
// ---------------------------------------------------------------

/**
 * Render a category of validation errors with header and items.
 *
 * @param container - Parent container element
 * @param categoryTitle - Display title for this category
 * @param errors - Array of errors in this category
 * @param icon - Emoji icon for the category header
 */
function renderErrorCategory(
    container: HTMLElement,
    categoryTitle: string,
    errors: ValidationError[],
    icon: string
): void {
    const categorySection = container.createDiv('mitre-error-category');
    const categoryHeader = categorySection.createDiv('mitre-error-category-header');
    categoryHeader.createEl('h4', {
        text: `${icon} ${categoryTitle} (${errors.length})`
    });

    errors.forEach(error => {
        const errorItem = categorySection.createDiv('mitre-error-item');

        // Apply severity styling
        if (isCriticalSeverity(error.severity)) {
            errorItem.addClass('mitre-error-critical');
        } else if (error.severity === 'mismatch') {
            errorItem.addClass('mitre-error-warning');
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

            cardBadge.createEl('span', {
                text: card.iocType,
                cls: 'mitre-error-card-type'
            });
            cardBadge.createEl('span', {
                text: ` ${card.cardId}`,
                cls: 'mitre-error-card-id'
            });

            if (index < error.iocCards.length - 1) {
                cardsSection.createEl('span', { text: ', ' });
            }
        });
    });
}
