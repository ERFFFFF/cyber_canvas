/**
 * MitreModalSearch.ts - Search bar rendering and input handling
 *
 * Manages the search UI in the MITRE modal header: input field, clear button,
 * match count display, and debounced re-render on input changes.
 */

import { MitreTactic, SearchState } from './MitreTypes';
import { parseSearchQuery, matchesSearch } from './MitreSearch';
import { MitreModalContext } from './MitreModalHelpers';
import { renderTacticSection } from './MitreModalTacticRenderer';
import { DEBUG } from '../debug';

// ---------------------------------------------------------------
// Search UI elements
// ---------------------------------------------------------------

/**
 * References to the search bar DOM elements, stored by the modal
 * for state updates during search input handling.
 */
export interface SearchUIElements {
    searchBar: HTMLInputElement | null;
    searchClearButton: HTMLElement | null;
    searchMatchCount: HTMLElement | null;
}

// ---------------------------------------------------------------
// Search bar rendering
// ---------------------------------------------------------------

/**
 * Render search bar in modal header.
 *
 * @param headerContainer - Header container element to add search bar to
 * @param onSearchChange - Callback invoked with new search query after debounce
 * @returns SearchUIElements for external state management
 */
export function renderSearchBar(
    headerContainer: HTMLElement,
    onSearchChange: (query: string) => void
): SearchUIElements {
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

    // Debounced search handler (300ms delay)
    let debounceTimer: number | null = null;
    searchInput.addEventListener('input', () => {
        if (debounceTimer !== null) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = window.setTimeout(() => {
            onSearchChange(searchInput.value);
        }, 300);
    });

    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        onSearchChange('');
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            onSearchChange('');
        }
    });

    return {
        searchBar: searchInput,
        searchClearButton: clearButton,
        searchMatchCount: matchCount
    };
}

// ---------------------------------------------------------------
// Search input handling
// ---------------------------------------------------------------

/**
 * Handle search input changes and re-render content area.
 *
 * Parses the query, filters techniques by match, re-renders visible tactics,
 * and updates the match count display.
 *
 * @param query - Raw search query string
 * @param modalEl - Modal root element (for finding .mitre-content-area)
 * @param currentTactics - Current tactics array to filter
 * @param ctx - Modal context for rendering
 * @param searchUI - Search UI element references
 * @returns The new SearchState for storage by the caller
 */
export function handleSearchInput(
    query: string,
    modalEl: HTMLElement,
    currentTactics: MitreTactic[] | null,
    ctx: MitreModalContext,
    searchUI: SearchUIElements
): SearchState {
    const searchState = parseSearchQuery(query);

    if (DEBUG) console.debug('[MitreModalSearch] Search query:', query, '- Parsed:', searchState);

    // Update clear button visibility
    if (searchUI.searchClearButton) {
        searchUI.searchClearButton.style.display = searchState.isActive ? 'block' : 'none';
    }

    // Re-render content area with search filter
    const container = modalEl.querySelector('.mitre-content-area') as HTMLElement;
    if (container && currentTactics) {
        container.empty();

        // Update context with new search state
        const updatedCtx = { ...ctx, currentSearchState: searchState };

        let matchCount = 0;
        currentTactics.forEach(tactic => {
            // Filter techniques by search
            const matchingTechniques = tactic.techniques.filter(tech => {
                if (!searchState.isActive) return true;
                const match = matchesSearch(tech, searchState, ctx.subtechniquesMap);
                if (match.matched) matchCount++;
                return match.matched;
            });

            // Only render tactic if it has matching techniques
            if (matchingTechniques.length > 0) {
                const filteredTactic = { ...tactic, techniques: matchingTechniques };
                renderTacticSection(container, filteredTactic, updatedCtx, searchState);
            }
        });

        // Update match count display
        if (searchUI.searchMatchCount) {
            if (searchState.isActive) {
                searchUI.searchMatchCount.textContent = `${matchCount} technique${matchCount !== 1 ? 's' : ''} found`;
                searchUI.searchMatchCount.style.display = 'block';
            } else {
                searchUI.searchMatchCount.style.display = 'none';
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

    return searchState;
}
