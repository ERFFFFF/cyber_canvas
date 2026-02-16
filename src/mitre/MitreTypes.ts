/**
 * MitreTypes.ts - Shared interfaces and type aliases for MITRE modules
 *
 * Defines the core data structures used across MitreAggregator, MitreSearch,
 * MitreSeverity, MitreExport, and RenderMitreModal. This module has no
 * dependencies and serves as the foundation of the MITRE module graph.
 */

// ---------------------------------------------------------------
// Severity type aliases
// ---------------------------------------------------------------

/** Full severity spectrum including 'not_found' for unfound techniques. */
export type SeverityLevel =
    | 'valid'
    | 'unknown_technique'
    | 'unknown_tactic'
    | 'mismatch'
    | 'empty_tactic'
    | 'not_found';

/** Severity values returned by validation (excludes 'not_found'). */
export type ValidationSeverity =
    | 'valid'
    | 'unknown_technique'
    | 'unknown_tactic'
    | 'mismatch'
    | 'empty_tactic';

/** Severity values that represent errors (excludes 'valid' and 'not_found'). */
export type ErrorSeverity =
    | 'unknown_technique'
    | 'unknown_tactic'
    | 'mismatch'
    | 'empty_tactic';

// ---------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------

/** A single technique in the MITRE matrix with validation and card tracking. */
export interface MitreTechnique {
    id: string;           // e.g., "T1566"
    name: string;         // e.g., "Phishing"
    tactic: string;       // e.g., "Initial Access" (original from IOC)
    tacticId: string;     // e.g., "TA0006" (MITRE tactic ID)
    count: number;        // How many IOC cards reference this
    iocCards: string[];   // IOC card IDs that use this technique
    severity: SeverityLevel; // Validation severity
    validationMessage?: string; // Error message if invalid
    description?: string; // Technique description from dataset
    isFound: boolean;     // Whether this technique has IOC cards
}

/** A tactic column in the MITRE matrix containing its techniques. */
export interface MitreTactic {
    name: string;
    displayName?: string;
    techniques: MitreTechnique[];
}

/** Parsed search query state with separated keywords and quoted phrases. */
export interface SearchState {
    query: string;
    keywords: string[];
    phrases: string[];
    isActive: boolean;
}

/** Result of matching a technique against a search query. */
export interface SearchMatch {
    matched: boolean;
    matchType?: 'id' | 'name' | 'description' | 'subtechnique';
    matchText?: string;
}

/** A validation error for display in the errors section, grouped by technique+severity. */
export interface ValidationError {
    techniqueId: string;
    techniqueName: string;
    severity: ErrorSeverity;
    message: string;
    iocCards: Array<{
        cardId: string;
        iocType: string;
        nodeId: string;
    }>;
}

/**
 * Information about IOC cards with missing MITRE fields.
 * Used for informational display in statistics bar, not validation errors.
 */
export interface MissingFieldInfo {
    /** Card ID (timestamp-based like "#20240215-1430") */
    cardId: string;
    /** IOC type name (e.g., "IP Address", "File Hash") */
    iocType: string;
    /** Canvas node ID (fallback if cardId not present) */
    nodeId: string;
    /** Which field(s) are missing */
    missing: 'tactic' | 'technique' | 'both';
}

/**
 * Tracks cards with missing MITRE fields (not errors, just informational).
 */
export interface MissingFieldsResult {
    /** Cards missing tactic field (technique may or may not be filled) */
    missingTactic: MissingFieldInfo[];
    /** Cards missing technique field (tactic may or may not be filled) */
    missingTechnique: MissingFieldInfo[];
}
