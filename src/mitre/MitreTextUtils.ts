/**
 * MitreTextUtils.ts - Description text cleaning and truncation
 *
 * Utility functions for processing MITRE technique descriptions.
 * Removes markdown formatting artifacts and truncates long text
 * for compact display in the matrix view.
 */

/**
 * Clean MITRE description text by removing markdown links and square brackets.
 *
 * Removes two types of markdown artifacts:
 * 1. Full markdown links: [text](url) → removed entirely
 * 2. Square bracket references: [anything] → removed entirely
 *
 * @param description - Raw description from MITRE dataset
 * @returns Cleaned description text with normalized whitespace
 */
export function cleanDescription(description: string): string {
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
 * Truncates at word boundary to avoid cutting words mid-way.
 *
 * @param description - Cleaned description text
 * @param maxChars - Maximum characters (default: 180)
 * @returns Truncated description with "..." if needed
 */
export function truncateDescription(description: string, maxChars: number = 180): string {
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
