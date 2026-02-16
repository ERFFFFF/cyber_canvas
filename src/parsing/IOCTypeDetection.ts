/**
 * IOCTypeDetection.ts - IOC type detection from canvas node text
 *
 * Matches raw node text against ordered regex patterns to determine the IOC
 * card type. Pattern order is critical: more-specific types must appear before
 * less-specific ones to avoid false positives (e.g., "File Hash" before "File").
 */

// ---------------------------------------------------------------
// Pattern table
// ---------------------------------------------------------------

/**
 * IOC type detection patterns.
 *
 * ORDER MATTERS: More specific patterns must come before less specific ones.
 * For example:
 *   - "File Hash" must appear before "File" to avoid "File" matching first
 *   - "Domain Name" must appear before generic patterns
 *   - "IP Address" and "Email Address" must appear before generic words
 *   - "Network" matches the IOC_TYPES constant key name (not "Network Traffic")
 *   - "Command Line" must appear before short generic patterns
 *
 * Each pattern uses case-insensitive matching against the full node text.
 */
export const IOC_TYPE_PATTERNS: { pattern: RegExp; type: string }[] = [
    { pattern: /IP Address/i, type: "IP Address" },
    { pattern: /Domain Name/i, type: "Domain Name" },
    { pattern: /File Hash/i, type: "File Hash" },
    { pattern: /URL/i, type: "URL" },
    { pattern: /Email Address/i, type: "Email Address" },
    { pattern: /Hostname/i, type: "Hostname" },
    { pattern: /YARA Rule/i, type: "YARA Rule" },
    { pattern: /Sigma Rule/i, type: "Sigma Rule" },
    { pattern: /Registry Key/i, type: "Registry Key" },
    { pattern: /Process Name/i, type: "Process Name" },
    // FIX: The IOC_TYPES constant uses "Network" (not "Network Traffic").
    // The old code used "Network Traffic" which would never match the
    // IOC_TYPES lookup, so color and icon were never resolved for this type.
    { pattern: /Network/i, type: "Network" },
    { pattern: /Command Line/i, type: "Command Line" },
    { pattern: /File/i, type: "File" },
    { pattern: /Note/i, type: "Note" },
    { pattern: /DLL/i, type: "DLL" },
    { pattern: /C2/i, type: "C2" }
];

// ---------------------------------------------------------------
// Detection function
// ---------------------------------------------------------------

/**
 * Detect the IOC type from node text content.
 *
 * Iterates through IOC_TYPE_PATTERNS in order, returning the first match.
 * Because patterns are tested in sequence, specificity ordering prevents
 * false positives (e.g. "File Hash" node won't match generic "File").
 *
 * @param text - Raw canvas node text content
 * @returns Matched IOC type name, or empty string if no match
 */
export function detectIOCType(text: string): string {
    for (const { pattern, type } of IOC_TYPE_PATTERNS) {
        if (pattern.test(text)) {
            return type;
        }
    }
    return '';
}
