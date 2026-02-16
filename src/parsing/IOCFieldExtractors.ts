/**
 * IOCFieldExtractors.ts - Field value extraction from IOC card text
 *
 * Provides functions to extract structured data from the raw markdown text
 * of IOC canvas nodes. Each extractor targets a specific field:
 * - extractValue: primary IOC value (first field after header)
 * - extractTime: "Time of Event" timestamp
 * - extractSplunkQuery: Splunk query string
 * - extractMitreField: MITRE tactic or technique (generic)
 * - extractCardId: timestamp-based card ID
 *
 * All functions are pure (no side effects beyond debug logging).
 */

import { DEBUG } from '../debug';

// ---------------------------------------------------------------
// Primary value extraction
// ---------------------------------------------------------------

/**
 * Extract the primary value from IOC card text.
 *
 * The FIRST FIELD of each card is always considered the "value" for timeline
 * display, regardless of what the field is named (IP, Domain, Hash, etc.).
 *
 * Delimiter precedence:
 *   1. Legacy code blocks (```...```)
 *   2. "-----" separator between fields
 *   3. Next field label (text ending with colon)
 *   4. "Time of Event:" as final boundary
 *
 * @param text - Raw canvas node text content
 * @returns Extracted primary value, or empty string
 */
export function extractValue(text: string): string {
    if (DEBUG) console.debug('[IOCFieldExtractors] extractValue - input length:', text.length);

    // First try code blocks (legacy format for backward compatibility)
    const codeBlockMatch = text.match(/```([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1] && codeBlockMatch[1].trim()) {
        const value = codeBlockMatch[1].trim();
        if (DEBUG) console.debug('[IOCFieldExtractors] extractValue - found code block:', value);
        return value;
    }

    // Split by HTML header closing tag to get content after header
    const parts = text.split('</div></div>');
    if (parts.length < 2) {
        if (DEBUG) console.debug('[IOCFieldExtractors] extractValue - no HTML header found');
        return '';
    }

    let afterHeader = parts[1].trim();
    if (DEBUG) console.debug('[IOCFieldExtractors] extractValue - content after header length:', afterHeader.length);

    // Find first field label (text ending with colon)
    const fieldMatch = afterHeader.match(/[^:\n]+:\s*/);
    if (!fieldMatch) {
        if (DEBUG) console.debug('[IOCFieldExtractors] extractValue - no field label found');
        return '';
    }

    if (DEBUG) console.debug('[IOCFieldExtractors] extractValue - first field:', fieldMatch[0].trim());

    // Get content after the field label
    const afterFieldLabel = afterHeader.substring(fieldMatch.index! + fieldMatch[0].length);

    // Find the first "-----" separator OR the first newline followed by another field
    const separatorMatch = afterFieldLabel.match(/\n?-----/);
    const nextFieldMatch = afterFieldLabel.match(/\n([^:\n]+:\s*)/);

    let value: string;
    let delimiterIndex: number | undefined;

    // Determine which delimiter comes first
    if (separatorMatch && separatorMatch.index !== undefined) {
        delimiterIndex = separatorMatch.index;
    }

    if (nextFieldMatch && nextFieldMatch.index !== undefined) {
        if (delimiterIndex === undefined || nextFieldMatch.index < delimiterIndex) {
            delimiterIndex = nextFieldMatch.index;
        }
    }

    if (delimiterIndex === undefined) {
        // No separator or next field found - extract everything until Time of Event
        const timeIndex = afterFieldLabel.indexOf('Time of Event:');
        value = timeIndex === -1 ? afterFieldLabel : afterFieldLabel.substring(0, timeIndex);
    } else {
        // Extract content before first delimiter
        value = afterFieldLabel.substring(0, delimiterIndex);
    }

    const trimmedValue = value.trim();
    if (DEBUG) console.debug('[IOCFieldExtractors] extractValue - result:', trimmedValue || '(empty)');
    return trimmedValue;
}

// ---------------------------------------------------------------
// Timestamp extraction
// ---------------------------------------------------------------

/**
 * Extract the "Time of Event" timestamp from node text.
 *
 * Tries progressively less specific patterns:
 *   1. **Time of Event:** followed by datetime (YYYY-MM-DD HH:MM:SS)
 *   2. **Time of Event:** followed by date only (YYYY-MM-DD)
 *   3. Bare "Time" label followed by datetime
 *   4. Any standalone datetime pattern in the text
 *
 * @param text - Raw canvas node text content
 * @returns Extracted timestamp string, or empty string
 */
export function extractTime(text: string): string {
    const timePatterns = [
        /\*\*Time of Event:\*\*\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i,
        /\*\*Time of Event:\*\*\s*(\d{4}-\d{2}-\d{2})/i,
        /Time of Event[:\s]*(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/i,
        /Time of Event[:\s]*(\d{4}-\d{2}-\d{2})/i,
        /Time[:\s]*(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/i,
        /(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/i
    ];

    for (const pattern of timePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return '';
}

// ---------------------------------------------------------------
// Splunk query extraction
// ---------------------------------------------------------------

/**
 * Extract the Splunk query from node text.
 *
 * Matches: **Splunk Query:** <query text>
 * Captures everything after the label up to the next bold marker or end of string.
 *
 * @param text - Raw canvas node text content
 * @returns Extracted Splunk query string, or empty string
 */
export function extractSplunkQuery(text: string): string {
    const match = text.match(/\*\*Splunk Query:\*\*[:\s]*([\s\S]*?)(?=\*\*|$)/i);
    if (match && match[1] && match[1].trim()) {
        return match[1].trim();
    }
    return '';
}

// ---------------------------------------------------------------
// MITRE field extraction
// ---------------------------------------------------------------

/**
 * Extract a MITRE ATT&CK field (tactic or technique) from node text.
 *
 * Uses the same pattern approach as extractSplunkQuery - captures everything
 * after the field label until hitting a separator line, next MITRE field, or end.
 *
 * Supports values on:
 *   - Same line: "Mitre Tactic: Initial Access"
 *   - Next line: "Mitre Tactic:\nInitial Access"
 *   - After blank lines: "Mitre Tactic:\n\n\nInitial Access"
 *
 * @param text - Raw node text content
 * @param fieldName - "Tactic" or "Technique"
 * @returns Normalized value in UPPERCASE for consistent matching
 */
export function extractMitreField(text: string, fieldName: string): string {
    if (DEBUG) console.debug(`[IOCFieldExtractors] Extracting ${fieldName}...`);

    // Pattern matches like Splunk Query: capture until separator line, next Mitre field, or end
    // Stops at: \n---- (separator), or "Mitre " (next field), or end of string
    // IMPORTANT: Use [ \t]* (spaces/tabs only) after colon, NOT \s* which would consume
    // newlines and prevent the lookahead from seeing \n-{4,} separators when field is empty
    const pattern = new RegExp(
        `Mitre ${fieldName}:[ \\t]*([\\s\\S]*?)(?=\\n-{4,}|Mitre |$)`,
        'i'
    );
    const match = text.match(pattern);

    if (match && match[1]?.trim()) {
        const value = match[1].trim().toUpperCase();
        if (DEBUG) console.debug(`[IOCFieldExtractors] Found ${fieldName}:`, value);
        return value;
    }

    if (DEBUG) console.debug(`[IOCFieldExtractors] No ${fieldName} found`);
    return '';
}

/** Convenience wrapper: extract MITRE tactic from card text. */
export const extractTactic = (text: string) => extractMitreField(text, 'Tactic');

/** Convenience wrapper: extract MITRE technique from card text. */
export const extractTechnique = (text: string) => extractMitreField(text, 'Technique');

// ---------------------------------------------------------------
// Card role extraction (Parent/Child)
// ---------------------------------------------------------------

/**
 * Detect the card role from the HTML header.
 *
 * Looks for [P] or [C] badges inside the card header's `<span class="ioc-card-role">`.
 * Falls back to plain-text pattern matching for `[P]` / `[C]` near the type name.
 *
 * @param text - Raw canvas node text content
 * @returns 'parent' | 'child' | '' (empty if no role badge found)
 */
export function extractCardRole(text: string): 'parent' | 'child' | '' {
    if (/\[P\]/.test(text)) return 'parent';
    if (/\[C\]/.test(text)) return 'child';
    return '';
}

// ---------------------------------------------------------------
// Card ID extraction
// ---------------------------------------------------------------

/**
 * Extract the Card ID field from IOC card markdown.
 *
 * Supports two formats:
 *   - HTML comment (new): <!-- IOC_CARD_ID:#YYYYMMDD-HHMM -->
 *   - Legacy field (backward compat): "Card ID: #YYYYMMDD-HHMM"
 *
 * @param text - Raw canvas node text content
 * @returns Extracted card ID string, or empty string
 */
export function extractCardId(text: string): string {
    if (DEBUG) console.debug('[IOCFieldExtractors] Extracting Card ID...');

    // NEW FORMAT: Try HTML comment first (preferred)
    const commentMatch = text.match(/<!-- IOC_CARD_ID:([^>]+) -->/);
    if (commentMatch && commentMatch[1]) {
        const cardId = commentMatch[1].trim();
        if (DEBUG) console.debug('[IOCFieldExtractors] Found Card ID in HTML comment:', cardId);
        return cardId;
    }

    // LEGACY FORMAT: Fall back to markdown field for backward compatibility
    const cardIdMatch = text.match(/Card ID:\s*([^\n]+)/i);
    if (cardIdMatch && cardIdMatch[1]) {
        const cardId = cardIdMatch[1].trim();
        if (DEBUG) console.debug('[IOCFieldExtractors] Found Card ID in legacy field format:', cardId);
        return cardId;
    }

    if (DEBUG) console.debug('[IOCFieldExtractors] No Card ID found');
    return '';
}
