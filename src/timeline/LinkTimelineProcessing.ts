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
 * Children can be either leaf nodes (IOCNodeData) or nested parent groups,
 * allowing for true hierarchical structures (parent → child → grandchild).
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
    /** Cards marked [P] but have incoming arrows (bad directional arrows) */
    badDirectionalCards: IOCNodeData[];
}

/**
 * Build parent-child groups from IOC data and canvas edges.
 *
 * Algorithm (respects [P]/[C] badges for hierarchical nesting):
 *   1. Index IOC nodes by their canvas node ID
 *   2. Build edge maps (parent→children and node→hasIncoming)
 *   3. Identify root parents: nodes with [P] badge OR nodes with outgoing edges but no incoming
 *   4. For each root parent, recursively build child hierarchy:
 *      - Cards marked [P] are NEVER nested (appear as separate root groups)
 *      - Cards marked [C] CAN be nested hierarchically
 *   5. Sort groups by parent time, children by time within each group
 *   6. Detect error cases: cards marked [P] that have incoming arrows FROM [C] cards
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
     *   - Are marked [P] (isChild !== true) OR have no incoming arrows
     */
    function isRootParent(nodeId: string): boolean {
        const node = nodeMap.get(nodeId);
        if (!node || !outgoingEdges.has(nodeId)) return false;

        // Cards marked [P] are ALWAYS root parents, never nested
        if (!node.isChild) return true;

        // Cards marked [C] can only be root if they have no incoming arrows
        return !hasIncomingEdge.has(nodeId);
    }

    /**
     * Recursively build child hierarchy for a parent node.
     * Prevents infinite loops with visited set (DAG cycle detection).
     *
     * @param parentId - Canvas node ID of the parent
     * @param visited - Set of already-visited node IDs (prevents cycles)
     * @returns Array of children (can be leaf nodes or nested groups)
     */
    function buildChildHierarchy(
        parentId: string,
        visited: Set<string>
    ): (IOCNodeData | ParentChildGroup)[] {
        const childIds = outgoingEdges.get(parentId);
        if (!childIds || childIds.size === 0) return [];

        const children: (IOCNodeData | ParentChildGroup)[] = [];

        for (const childId of childIds) {
            // Prevent cycles
            if (visited.has(childId)) continue;

            const childNode = nodeMap.get(childId);
            if (!childNode) continue;

            // Cards marked [P] are NEVER nested - they appear as separate root groups
            if (!childNode.isChild) continue;

            // Mark as visited to prevent cycles
            const newVisited = new Set(visited);
            newVisited.add(childId);

            // If this child has its own children, recursively build nested group
            if (outgoingEdges.has(childId)) {
                const grandchildren = buildChildHierarchy(childId, newVisited);
                children.push({
                    parent: childNode,
                    children: grandchildren
                });
            } else {
                // Leaf node (no children)
                children.push(childNode);
            }
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

    // Identify cards with bad directional arrows:
    // Cards marked [P] that have incoming arrows FROM [C] cards (Child→Parent violations)
    const badDirectionalCards: IOCNodeData[] = [];

    for (const ioc of iocData) {
        // Skip child cards - they're allowed to have incoming arrows
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
            badDirectionalCards.push(ioc);
        }
    }

    // Sort by time
    badDirectionalCards.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return { groups, badDirectionalCards };
}
