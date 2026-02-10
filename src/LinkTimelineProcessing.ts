/**
 * LinkTimelineProcessing.ts - Attack chain extraction via canvas edges
 *
 * This processor analyzes the directed graph formed by canvas edges between
 * IOC nodes. It builds a layered DAG structure where nodes are organized by
 * their maximum depth from root nodes (nodes with no incoming edges).
 *
 * The result is consumed by RenderTimelinesModal's "Link Timeline" tab,
 * which renders a horizontal layered graph with nodes at the same depth
 * displayed side-by-side and SVG arrows showing all edge connections.
 */

import { App } from 'obsidian';
import { IOCCardsTypes } from './IOCCardsTypes';
import { parseIOCNode, IOCNodeData } from './IOCParser';

/** Edge between two nodes in the DAG */
export interface GraphEdge {
    fromId: string;
    toId: string;
    label: string;
}

/** Node in a layer with its depth and associated data */
export interface LayeredNode {
    data: IOCNodeData;
    nodeId: string;
    depth: number;
}

export class LinkTimelineProcessor {
    private app: App;
    private plugin: any;
    private IOCCardsTypes: IOCCardsTypes;

    constructor(app: App, plugin: any, IOCCardsTypes: IOCCardsTypes) {
        this.app = app;
        this.plugin = plugin;
        this.IOCCardsTypes = IOCCardsTypes;
    }

    /**
     * Extract link-based attack chain data from the active canvas.
     *
     * Algorithm overview:
     *   1. Parse all canvas text nodes for IOC data using the shared parser
     *   2. Build adjacency lists (incoming/outgoing) from canvas edges
     *   3. Use BFS to assign each node to its maximum depth from any root
     *   4. Each node appears exactly ONCE at its calculated depth layer
     *   5. Group nodes into layers by depth for horizontal visualization
     *   6. Collect all edges for arrow rendering
     *   7. Collect isolated IOC nodes (no edges at all)
     *
     * This creates a layered DAG layout where nodes at the same depth are
     * displayed side-by-side horizontally, with SVG arrows connecting parents
     * to children across layers.
     *
     * @returns Object with layers (array of LayeredNode arrays), edges, isolatedNodes, and diagnostic counters
     */
    extractEnhancedLinkData(): any {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[LinkProcessor] ===== STARTING LINK TIMELINE EXTRACTION =====');
        const activeLeaf = this.app.workspace.activeLeaf;

        if (!activeLeaf || !activeLeaf.view) {
            console.log('[LinkProcessor] ✗ No active workspace leaf found');
            console.log('[LinkProcessor] ===== EXTRACTION FAILED =====');
            return { layers: [], edges: [], isolatedNodes: [], canvasFound: false, totalNodes: 0, totalEdges: 0, iocNodes: 0, validConnections: 0, rootNodes: 0 };
        }

        if (activeLeaf.view.getViewType() !== 'canvas') {
            console.log('[LinkProcessor] ✗ Not a canvas view');
            console.log('[LinkProcessor] ===== EXTRACTION FAILED =====');
            return { layers: [], edges: [], isolatedNodes: [], canvasFound: false, totalNodes: 0, totalEdges: 0, iocNodes: 0, validConnections: 0, rootNodes: 0 };
        }

        const canvasView = activeLeaf.view as any;
        const canvas = canvasView.canvas;

        if (!canvas) {
            console.log('[LinkProcessor] ✗ No canvas object in view');
            console.log('[LinkProcessor] ===== EXTRACTION FAILED =====');
            return { layers: [], edges: [], isolatedNodes: [], canvasFound: false, totalNodes: 0, totalEdges: 0, iocNodes: 0, validConnections: 0, rootNodes: 0 };
        }

        // Retrieve nodes and edges from the canvas.
        // Obsidian's canvas API exposes nodes as a Map (canvas.nodes) and
        // edges as an iterable. Some versions store them under canvas.data.
        let nodes: any[] = [];
        let edges: any[] = [];

        // canvas.nodes is a Map in live canvas
        if (canvas.nodes instanceof Map) {
            canvas.nodes.forEach((node: any) => nodes.push(node));
        } else if (Array.isArray(canvas.nodes)) {
            nodes = canvas.nodes;
        } else if (canvas.data?.nodes) {
            nodes = Array.isArray(canvas.data.nodes) ? canvas.data.nodes : [];
        }

        if (canvas.edges instanceof Map) {
            canvas.edges.forEach((edge: any) => edges.push(edge));
        } else if (Array.isArray(canvas.edges)) {
            edges = canvas.edges;
        } else if (canvas.data?.edges) {
            edges = Array.isArray(canvas.data.edges) ? canvas.data.edges : [];
        }

        console.log('[LinkProcessor] ✓ Canvas data retrieved');
        console.log(`[LinkProcessor] Final counts: ${nodes.length} nodes, ${edges.length} edges`);

        if (nodes.length === 0) {
            console.log('[LinkProcessor] ✗ No nodes found in canvas');
            console.log('[LinkProcessor] ===== EXTRACTION COMPLETE (EMPTY) =====');
            return { layers: [], edges: [], isolatedNodes: [], canvasFound: true, totalNodes: 0, totalEdges: edges.length, iocNodes: 0, validConnections: 0, rootNodes: 0 };
        }

        // --- Step 1: Parse all canvas nodes and build the IOC node map ---
        console.log('[LinkProcessor] ───────────────────────────────────────────────');
        console.log('[LinkProcessor] STEP 1: Parsing IOC nodes...');

        const iocNodeMap = new Map<string, IOCNodeData>();
        const incomingConnections = new Map<string, string[]>();
        const outgoingConnections = new Map<string, string[]>();
        const edgeLabels = new Map<string, string>(); // key: "fromId->toId"
        let iocNodeCount = 0;
        let emptyValueCount = 0;

        if (nodes.length !== 0) {
            nodes.forEach((node: any, index: number) => {
                if (node.text) {
                    console.log(`[LinkProcessor]   Node ${index + 1}/${nodes.length}: ${node.id}`);
                    const nodeData = parseIOCNode(node);
                    if (nodeData) {
                        iocNodeMap.set(node.id, nodeData);
                        outgoingConnections.set(node.id, []);
                        incomingConnections.set(node.id, []);
                        iocNodeCount++;

                        console.log(`[LinkProcessor]   ✓ IOC detected: ${nodeData.type}`);
                        console.log(`[LinkProcessor]     Value: ${nodeData.value ? `"${nodeData.value}"` : '(EMPTY)'}`);

                        if (!nodeData.value || !nodeData.value.trim()) {
                            emptyValueCount++;
                            console.log('[LinkProcessor]     ⚠️  WARNING: This IOC has an EMPTY value!');
                        }
                    } else {
                        console.log(`[LinkProcessor]   ✗ Not an IOC node`);
                    }
                }
            });
        }

        console.log('[LinkProcessor] ───────────────────────────────────────────────');
        console.log(`[LinkProcessor] STEP 1 COMPLETE: ${iocNodeCount} IOC nodes identified`);
        console.log(`[LinkProcessor]   IOCs with values: ${iocNodeCount - emptyValueCount}`);
        console.log(`[LinkProcessor]   IOCs with EMPTY values: ${emptyValueCount}`);

        if (iocNodeCount === 0) {
            console.log('[LinkProcessor] ✗ No IOC nodes found in canvas');
            console.log('[LinkProcessor] ===== EXTRACTION COMPLETE (NO IOCs) =====');
            return {
                layers: [],
                edges: [],
                isolatedNodes: [],
                canvasFound: true,
                totalNodes: nodes.length,
                totalEdges: edges.length,
                iocNodes: 0,
                validConnections: 0,
                rootNodes: 0
            };
        }

        // --- Step 2: Process edges to build adjacency lists ---
        console.log('[LinkProcessor] ───────────────────────────────────────────────');
        console.log('[LinkProcessor] STEP 2: Processing edges...');
        // Canvas edges may use different property names depending on the
        // Obsidian version, so we check multiple possibilities.
        let validConnectionCount = 0;
        if (nodes.length !== 0) {
            edges.forEach((edge: any, edgeIndex: number) => {
                let fromId: string | null = null;
                let toId: string | null = null;

                // Nested format: edge.from.node.id (Obsidian live canvas)
                if (edge.from?.node?.id) {
                    fromId = edge.from.node.id;
                } else if (edge.from?.id) {
                    fromId = edge.from.id;
                } else if (typeof edge.from === 'string') {
                    fromId = edge.from;
                }
                // Flat format fallback (serialized JSON)
                if (!fromId) {
                    for (const prop of ['fromNode', 'fromId', 'source', 'sourceId']) {
                        if (edge[prop] && typeof edge[prop] === 'string') {
                            fromId = edge[prop];
                            break;
                        }
                    }
                }

                // Same for toId
                if (edge.to?.node?.id) {
                    toId = edge.to.node.id;
                } else if (edge.to?.id) {
                    toId = edge.to.id;
                } else if (typeof edge.to === 'string') {
                    toId = edge.to;
                }
                if (!toId) {
                    for (const prop of ['toNode', 'toId', 'target', 'targetId']) {
                        if (edge[prop] && typeof edge[prop] === 'string') {
                            toId = edge[prop];
                            break;
                        }
                    }
                }

                if (!fromId || !toId) return;

                // Extract edge label/text (used for connection annotations)
                let edgeLabel = '';
                if (edge.label) {
                    edgeLabel = edge.label;
                } else if (edge.text) {
                    edgeLabel = edge.text;
                }

                console.log(`[LinkProcessor]   Edge ${edgeIndex + 1}/${edges.length}: ${fromId} -> ${toId}`);
                if (edgeLabel) {
                    console.log(`[LinkProcessor]     Label: "${edgeLabel}"`);
                }

                // Only record edges between two IOC nodes
                if (iocNodeMap.has(fromId) && iocNodeMap.has(toId)) {
                    const fromConnections = outgoingConnections.get(fromId);
                    const toConnections = incomingConnections.get(toId);

                    if (fromConnections && toConnections) {
                        fromConnections.push(toId);
                        toConnections.push(fromId);

                        // Store edge label keyed by directed pair
                        const edgeKey = `${fromId}->${toId}`;
                        edgeLabels.set(edgeKey, edgeLabel);

                        validConnectionCount++;
                        console.log(`[LinkProcessor]     ✓ Valid IOC connection`);
                    }
                } else {
                    console.log(`[LinkProcessor]     ✗ Not an IOC-to-IOC edge (skipped)`);
                }
            });
        }

        console.log('[LinkProcessor] ───────────────────────────────────────────────');
        console.log(`[LinkProcessor] STEP 2 COMPLETE: ${validConnectionCount} valid connections`);

        // --- Step 3: Build layered DAG structure using BFS ---
        console.log('[LinkProcessor] ───────────────────────────────────────────────');
        console.log('[LinkProcessor] STEP 3: Building layered DAG structure...');

        // Each node appears exactly ONCE at its maximum depth from any root
        const nodeDepths = new Map<string, number>();

        // Find root nodes (no incoming edges)
        const rootNodeIds: string[] = [];
        iocNodeMap.forEach((nodeData, nodeId) => {
            const incoming = incomingConnections.get(nodeId) || [];
            if (incoming.length === 0) {
                rootNodeIds.push(nodeId);
                nodeDepths.set(nodeId, 0);
                console.log(`[LinkProcessor]   ✓ Root node: ${nodeId} (${nodeData.type})`);
            }
        });

        console.log(`[LinkProcessor] Found ${rootNodeIds.length} root nodes`);

        // BFS to calculate maximum depth for each node
        const queue: Array<{ nodeId: string; depth: number }> = rootNodeIds.map(id => ({ nodeId: id, depth: 0 }));
        const visited = new Set<string>();

        while (queue.length > 0) {
            const { nodeId, depth } = queue.shift()!;

            // Skip if already processed at a deeper level
            if (visited.has(nodeId)) {
                const currentDepth = nodeDepths.get(nodeId) || 0;
                if (depth > currentDepth) {
                    nodeDepths.set(nodeId, depth);
                }
                continue;
            }

            visited.add(nodeId);
            nodeDepths.set(nodeId, depth);

            // Add all children to the queue
            const children = outgoingConnections.get(nodeId) || [];
            for (const childId of children) {
                queue.push({ nodeId: childId, depth: depth + 1 });
            }
        }

        // Handle nodes not reachable from roots (cycles or orphaned components)
        iocNodeMap.forEach((_, nodeId) => {
            if (!nodeDepths.has(nodeId)) {
                const hasConn = (outgoingConnections.get(nodeId)?.length || 0) > 0 ||
                               (incomingConnections.get(nodeId)?.length || 0) > 0;
                if (hasConn) {
                    // Orphaned component - treat as new root
                    nodeDepths.set(nodeId, 0);
                    const orphanQueue: Array<{ nodeId: string; depth: number }> = [{ nodeId, depth: 0 }];
                    const orphanVisited = new Set<string>();

                    while (orphanQueue.length > 0) {
                        const { nodeId: currentId, depth: currentDepth } = orphanQueue.shift()!;

                        if (orphanVisited.has(currentId)) continue;
                        orphanVisited.add(currentId);

                        if (!nodeDepths.has(currentId)) {
                            nodeDepths.set(currentId, currentDepth);
                        }

                        const orphanChildren = outgoingConnections.get(currentId) || [];
                        for (const childId of orphanChildren) {
                            if (!nodeDepths.has(childId)) {
                                orphanQueue.push({ nodeId: childId, depth: currentDepth + 1 });
                            }
                        }
                    }
                }
            }
        });

        // --- Step 4: Group nodes into layers by depth ---
        const layerMap = new Map<number, LayeredNode[]>();
        let maxDepth = 0;

        nodeDepths.forEach((depth, nodeId) => {
            const nodeData = iocNodeMap.get(nodeId);
            if (nodeData) {
                if (!layerMap.has(depth)) {
                    layerMap.set(depth, []);
                }
                layerMap.get(depth)!.push({
                    data: nodeData,
                    nodeId: nodeId,
                    depth: depth
                });
                maxDepth = Math.max(maxDepth, depth);
            }
        });

        // Convert layer map to sorted array
        const layers: LayeredNode[][] = [];
        for (let i = 0; i <= maxDepth; i++) {
            layers.push(layerMap.get(i) || []);
        }

        // --- Step 5: Collect all edges for arrow rendering ---
        const graphEdges: GraphEdge[] = [];
        edges.forEach((edge: any) => {
            let fromId: string | null = null;
            let toId: string | null = null;

            if (edge.from?.node?.id) {
                fromId = edge.from.node.id;
            } else if (edge.from?.id) {
                fromId = edge.from.id;
            } else if (typeof edge.from === 'string') {
                fromId = edge.from;
            }
            if (!fromId) {
                for (const prop of ['fromNode', 'fromId', 'source', 'sourceId']) {
                    if (edge[prop] && typeof edge[prop] === 'string') {
                        fromId = edge[prop];
                        break;
                    }
                }
            }

            if (edge.to?.node?.id) {
                toId = edge.to.node.id;
            } else if (edge.to?.id) {
                toId = edge.to.id;
            } else if (typeof edge.to === 'string') {
                toId = edge.to;
            }
            if (!toId) {
                for (const prop of ['toNode', 'toId', 'target', 'targetId']) {
                    if (edge[prop] && typeof edge[prop] === 'string') {
                        toId = edge[prop];
                        break;
                    }
                }
            }

            if (fromId && toId && iocNodeMap.has(fromId) && iocNodeMap.has(toId)) {
                const edgeLabel = edge.label || edge.text || '';
                graphEdges.push({
                    fromId: fromId,
                    toId: toId,
                    label: edgeLabel
                });
            }
        });

        // --- Step 6: Collect isolated nodes ---
        const isolatedNodeIds: string[] = [];
        iocNodeMap.forEach((nodeData, nodeId) => {
            const nodeOutgoing = outgoingConnections.get(nodeId) || [];
            const nodeIncoming = incomingConnections.get(nodeId) || [];
            const hasAnyConnections = nodeOutgoing.length > 0 || nodeIncoming.length > 0;

            if (!hasAnyConnections) {
                isolatedNodeIds.push(nodeId);
                console.log(`Isolated node identified: ${nodeId}`);
            }
        });

        const isolatedNodes = isolatedNodeIds.map((nodeId: string) => iocNodeMap.get(nodeId)).filter(Boolean);

        const result = {
            layers: layers,
            edges: graphEdges,
            isolatedNodes: isolatedNodes,
            canvasFound: true,
            totalNodes: nodes.length,
            totalEdges: edges.length,
            iocNodes: iocNodeCount,
            validConnections: validConnectionCount,
            rootNodes: rootNodeIds.length
        };

        console.log('[LinkProcessor] ───────────────────────────────────────────────');
        console.log('[LinkProcessor] ===== EXTRACTION COMPLETE =====');
        console.log('[LinkProcessor] Result summary:');
        console.log(`[LinkProcessor]   Layers: ${layers.length}`);
        console.log(`[LinkProcessor]   Nodes in layers: ${layers.reduce((sum: number, layer: LayeredNode[]) => sum + layer.length, 0)}`);
        console.log(`[LinkProcessor]   Edges: ${graphEdges.length}`);
        console.log(`[LinkProcessor]   Isolated nodes: ${isolatedNodes.length}`);
        console.log(`[LinkProcessor]   Root nodes: ${rootNodeIds.length}`);

        // Log layer-by-layer breakdown
        layers.forEach((layer: LayeredNode[], index: number) => {
            if (layer.length > 0) {
                console.log(`[LinkProcessor]   Layer ${index}: ${layer.length} nodes`);
                layer.forEach((node: LayeredNode) => {
                    console.log(`[LinkProcessor]     - ${node.data.type}: ${node.data.value || '(empty)'}`);
                });
            }
        });

        console.log('═══════════════════════════════════════════════════════════════');
        return result;
    }
}
