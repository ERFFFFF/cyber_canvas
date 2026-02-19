/**
 * LinkTimelineProcessing.ts - Parent-child grouping from canvas edges
 *
 * Builds parent-child groups by matching canvas edges (arrows) to IOC nodes.
 * Arrow direction: parent → child (fromNode = parent, toNode = child).
 * Parents are sorted by time (oldest first), children within each group
 * are also sorted by time.
 */

import { IOCNodeData } from '../types/IOCNodeData';
import { EdgeData } from '../canvas/CanvasEdges';

/**
 * A parent IOC card and its linked child cards.
 * Children are always leaf nodes (IOCNodeData) - no nested parent groups allowed.
 * This creates a flat 2-level hierarchy: [P] → [C] (all children at same level).
 */
export interface ParentChildGroup {
    parent: IOCNodeData;
    children: (IOCNodeData | ParentChildGroup)[];
}

/**
 * Return value for buildParentChildGroups with error detection.
 */
export interface LinkTimelineResult {
    /** Valid parent-child groups with correct arrow direction */
    groups: ParentChildGroup[];
    /** Cards with bad directional arrows: C→P or C→C violations */
    badDirectionalCards: IOCNodeData[];
}

/**
 * Build parent-child groups from IOC data and canvas edges.
 *
 * Algorithm (flat 2-level hierarchy):
 *   1. Index IOC nodes by their canvas node ID
 *   2. Build edge maps (parent→children and node→hasIncoming)
 *   3. Identify root parents: only [P] cards with outgoing edges (never [C] cards)
 *   4. For each root parent, recursively collect all [C] descendants:
 *      - Direct [C] children are added, then their [C] children, and so on
 *      - All [C] descendants are flattened into the same array (no nesting)
 *      - Cards marked [P] are NEVER nested (appear as separate root groups)
 *      - Visited set prevents cycles/duplicates in C→C chains
 *   5. Sort groups by parent time, children by time within each group
 *   6. Detect error cases:
 *      - Cards marked [P] that have incoming arrows FROM [C] cards (C→P violations)
 *      - Orphaned [C]→[C] chains with no [P] upstream (no root parent)
 *
 * @param iocData - All parsed IOC node data from the canvas
 * @param edges - Canvas edges (arrows) between nodes
 * @returns LinkTimelineResult with valid groups and error cards
 */
export function buildParentChildGroups(iocData: IOCNodeData[], edges: EdgeData[]): LinkTimelineResult {
    // Index IOC data by canvas node ID for fast lookup
    const nodeMap = new Map<string, IOCNodeData>();
    for (const ioc of iocData) {
        nodeMap.set(ioc.id, ioc);
    }

    // Build edge maps
    const outgoingEdges = new Map<string, Set<string>>(); // parent → Set of child IDs
    const hasIncomingEdge = new Set<string>(); // nodes that have incoming arrows
    const incomingFrom = new Map<string, Set<string>>(); // nodeId → Set of source node IDs

    for (const edge of edges) {
        // Only process edges where both nodes are IOC cards
        if (!nodeMap.has(edge.fromNodeId) || !nodeMap.has(edge.toNodeId)) continue;

        if (!outgoingEdges.has(edge.fromNodeId)) {
            outgoingEdges.set(edge.fromNodeId, new Set());
        }
        outgoingEdges.get(edge.fromNodeId)!.add(edge.toNodeId);

        hasIncomingEdge.add(edge.toNodeId);

        // Track incoming sources for error detection
        if (!incomingFrom.has(edge.toNodeId)) {
            incomingFrom.set(edge.toNodeId, new Set());
        }
        incomingFrom.get(edge.toNodeId)!.add(edge.fromNodeId);
    }

    /**
     * Check if a node is a root parent.
     * Root parents are nodes that:
     *   - Have outgoing arrows (children), AND
     *   - Are marked [P] (isChild !== true)
     * [C] cards are NEVER root parents — they are always children.
     */
    function isRootParent(nodeId: string): boolean {
        const node = nodeMap.get(nodeId);
        if (!node || !outgoingEdges.has(nodeId)) return false;

        // Only [P] cards can be root parents — [C] cards are always children
        return !node.isChild;
    }

    /**
     * Recursively collect all [C] descendants of a node.
     * Follows C→C chains to gather the full tree, flattened into one array.
     * For P → C1 → C2 → C3, returns [C1, C2, C3] all at the same level.
     *
     * @param parentId - Canvas node ID to collect children from
     * @param visited - Set of already-visited node IDs (prevents cycles/duplicates)
     * @returns Flat array of all [C] descendants (IOCNodeData only)
     */
    function buildChildHierarchy(
        parentId: string,
        visited: Set<string>
    ): (IOCNodeData | ParentChildGroup)[] {
        const childIds = outgoingEdges.get(parentId);
        if (!childIds || childIds.size === 0) return [];

        const children: (IOCNodeData | ParentChildGroup)[] = [];

        for (const childId of childIds) {
            if (visited.has(childId)) continue;

            const childNode = nodeMap.get(childId);
            if (!childNode) continue;

            // Cards marked [P] are NEVER nested - they appear as separate root groups
            if (!childNode.isChild) continue;

            // Mark visited before recursing to prevent cycles/duplicates
            visited.add(childId);

            // Add this [C] card as a leaf node
            children.push(childNode);

            // Recursively collect [C] descendants through C→C chains (flat, same level)
            const descendants = buildChildHierarchy(childId, visited);
            children.push(...descendants);
        }

        // Sort children by time (oldest first)
        children.sort((a, b) => {
            const aTime = 'time' in a ? new Date(a.time).getTime() : new Date(a.parent.time).getTime();
            const bTime = 'time' in b ? new Date(b.time).getTime() : new Date(b.parent.time).getTime();
            return aTime - bTime;
        });

        return children;
    }

    // Build root groups
    const groups: ParentChildGroup[] = [];

    for (const [parentId, _] of outgoingEdges) {
        if (!isRootParent(parentId)) continue;

        const parent = nodeMap.get(parentId)!;
        const visited = new Set<string>([parentId]);
        const children = buildChildHierarchy(parentId, visited);

        groups.push({ parent, children });
    }

    // Sort groups by parent time (oldest first)
    groups.sort((a, b) => new Date(a.parent.time).getTime() - new Date(b.parent.time).getTime());

    /**
     * Check if a node has a Parent [P] card anywhere in its upstream chain.
     * Traverses backwards through incoming arrows to find ancestry.
     *
     * @param nodeId - Canvas node ID to check
     * @param visited - Set of already-visited node IDs (prevents cycles)
     * @returns true if a [P] card exists upstream, false otherwise
     */
    function hasParentInUpstream(nodeId: string, visited: Set<string> = new Set()): boolean {
        // Prevent infinite loops in cyclic graphs
        if (visited.has(nodeId)) return false;
        visited.add(nodeId);

        const node = nodeMap.get(nodeId);
        if (!node) return false;

        // If this node itself is a Parent, return true
        if (!node.isChild) return true;

        // Get all incoming sources (nodes pointing to this one)
        const sources = incomingFrom.get(nodeId);
        if (!sources || sources.size === 0) return false;

        // Recursively check if any source has a parent upstream
        for (const sourceId of sources) {
            if (hasParentInUpstream(sourceId, visited)) {
                return true;
            }
        }

        return false;
    }

    // Identify cards with bad directional arrows:
    // 1. Cards marked [P] that have incoming arrows FROM [C] cards (Child→Parent violations)
    // 2. Orphaned [C] cards with no [P] parent in upstream chain (orphaned Child→Child violations)
    const badDirectionalCardSet = new Set<string>();

    // Error Detection 1: Child → Parent arrows
    for (const ioc of iocData) {
        // Skip child cards for this check
        if (ioc.isChild) continue;

        // Get all incoming sources for this [P] card
        const incomingSources = incomingFrom.get(ioc.id);
        if (!incomingSources || incomingSources.size === 0) continue;

        // Check if ANY incoming source is a [C] card
        let hasChildSource = false;
        for (const sourceId of incomingSources) {
            const sourceNode = nodeMap.get(sourceId);
            if (sourceNode && sourceNode.isChild) {
                hasChildSource = true;
                break;
            }
        }

        // Only flag if at least one incoming arrow is from a [C] card
        if (hasChildSource) {
            badDirectionalCardSet.add(ioc.id);
        }
    }

    // Error Detection 2: Child → Child arrows without parent upstream
    for (const [childId, sources] of incomingFrom.entries()) {
        const childNode = nodeMap.get(childId);
        if (!childNode || !childNode.isChild) continue; // Only check [C] cards

        // Check if ANY source is also a [C] card
        for (const sourceId of sources) {
            const sourceNode = nodeMap.get(sourceId);
            if (sourceNode && sourceNode.isChild) {
                // [C] → [C] arrow found - check if parent exists upstream
                const hasParent = hasParentInUpstream(childId);

                // Only flag as error if NO parent exists in upstream chain
                if (!hasParent) {
                    badDirectionalCardSet.add(sourceId); // The source [C]
                    badDirectionalCardSet.add(childId);  // The target [C]
                }
            }
        }
    }

    // Convert Set to array and sort by time
    const badDirectionalCards = Array.from(badDirectionalCardSet)
        .map(id => nodeMap.get(id)!)
        .filter(Boolean)
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return { groups, badDirectionalCards };
}
