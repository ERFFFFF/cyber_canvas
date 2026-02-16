/**
 * MitreSearch.ts - Search query parsing, matching, and highlight rendering
 *
 * Handles the search functionality in the MITRE modal. Supports both
 * keyword-based search and quoted phrase matching. Provides DOM text
 * highlighting for visual feedback on matched terms.
 */

import { SearchState, SearchMatch, MitreTechnique } from './MitreTypes';
import { DEBUG } from '../debug';

/**
 * Parse search query into keywords and phrases.
 *
 * Supports two types of search terms:
 * 1. **Keywords**: Space-separated words (e.g., "spear phishing" -> ["spear", "phishing"])
 * 2. **Phrases**: Quoted strings (e.g., '"spear phishing"' -> ["spear phishing"])
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
export function parseSearchQuery(query: string): SearchState {
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
    const quoteCount = (trimmedQuery.match(/"/g) || []).length;
    let processedQuery = trimmedQuery;
    if (quoteCount % 2 !== 0) {
        const lastQuoteIndex = processedQuery.lastIndexOf('"');
        processedQuery = processedQuery.substring(0, lastQuoteIndex) + processedQuery.substring(lastQuoteIndex + 1);
    }

    // Extract quoted phrases using regex
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

    if (DEBUG) console.debug('[MitreSearch] Parsed query:', { query: trimmedQuery, keywords, phrases });

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
export function textMatchesQuery(text: string, searchState: SearchState): boolean {
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
 * 3. **Technique Description** - finds techniques by behavior description
 * 4. **Subtechniques** - if child matches, show the parent for context
 *
 * Returns as soon as a match is found (short-circuits).
 *
 * @param technique - Technique to check
 * @param searchState - Parsed search state with keywords/phrases
 * @param subtechniquesMap - Map of parent technique IDs to their subtechniques
 * @returns SearchMatch result with match details
 */
export function matchesSearch(
    technique: MitreTechnique,
    searchState: SearchState,
    subtechniquesMap: Map<string, MitreTechnique[]>
): SearchMatch {
    if (!searchState.isActive) {
        return { matched: true };
    }

    // 1. Check technique ID
    if (textMatchesQuery(technique.id, searchState)) {
        return { matched: true, matchType: 'id', matchText: technique.id };
    }

    // 2. Check technique name
    if (textMatchesQuery(technique.name, searchState)) {
        return { matched: true, matchType: 'name', matchText: technique.name };
    }

    // 3. Check technique description
    if (technique.description && textMatchesQuery(technique.description, searchState)) {
        return { matched: true, matchType: 'description', matchText: technique.description };
    }

    // 4. Check subtechniques (if child matches, show parent for context)
    const subtechniques = subtechniquesMap.get(technique.id) || [];
    for (const subtech of subtechniques) {
        if (textMatchesQuery(subtech.id, searchState) ||
            textMatchesQuery(subtech.name, searchState) ||
            (subtech.description && textMatchesQuery(subtech.description, searchState))) {
            return { matched: true, matchType: 'subtechnique', matchText: subtech.name };
        }
    }

    return { matched: false };
}

/**
 * Escape HTML special characters to prevent XSS injection.
 */
export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Escape special regex metacharacters.
 */
export function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight search matches in a DOM text element.
 *
 * Replaces matching text segments with <mark> elements.
 * Phrases are highlighted first (longer matches), then keywords.
 * Uses negative lookahead to avoid double-wrapping inside existing marks.
 *
 * @param element - DOM element to highlight
 * @param originalText - Original text content
 * @param searchState - Parsed search state
 */
export function highlightMatches(
    element: HTMLElement,
    originalText: string,
    searchState: SearchState
): void {
    if (!searchState.isActive || !originalText) {
        return;
    }

    let escapedText = escapeHtml(originalText);

    // Highlight phrases first (longer matches)
    searchState.phrases.forEach(phrase => {
        const escapedPhrase = escapeRegex(phrase);
        const regex = new RegExp(`(${escapedPhrase})`, 'gi');
        escapedText = escapedText.replace(regex, '<mark class="mitre-search-highlight">$1</mark>');
    });

    // Highlight keywords (avoid double-wrapping inside existing marks)
    searchState.keywords.forEach(keyword => {
        const escapedKeyword = escapeRegex(keyword);
        const regex = new RegExp(`(?!<mark[^>]*>)(${escapedKeyword})(?![^<]*<\/mark>)`, 'gi');
        escapedText = escapedText.replace(regex, '<mark class="mitre-search-highlight">$1</mark>');
    });

    element.innerHTML = escapedText;
}
