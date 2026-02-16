/**
 * IOCNodeData.ts - Structured data interface for parsed IOC canvas nodes
 *
 * Defines the shape of data extracted from a single IOC card on the canvas.
 * Used by IOCParser (producer), timeline processors, and MITRE modules (consumers).
 * Extracted into its own file to break the IOCParser → MitreAggregator import
 * chain and allow modules to depend on the interface without pulling in parser logic.
 */

/**
 * Structured data extracted from a single IOC canvas node.
 * Returned by `parseIOCNode` when the node text matches a known IOC type.
 */
export interface IOCNodeData {
    /** Canvas node ID */
    id: string;
    /** Timestamp-based card ID (e.g. "#20260214-1534") */
    cardId?: string;
    /** IOC type name (e.g. "IP Address", "File Hash") */
    type: string;
    /** Primary value extracted from the first code block */
    value: string;
    /** Time of Event timestamp string */
    time: string;
    /** Splunk query string */
    splunkQuery: string;
    /** MITRE ATT&CK tactic */
    tactic: string;
    /** MITRE ATT&CK technique */
    technique: string;
    /** Inline SVG string for the IOC type icon */
    icon: string;
    /** Hex color string for the IOC type */
    color: string;
    /** Whether this is a child card (true) or parent card (false/undefined) */
    isChild?: boolean;
}
