import { App } from 'obsidian';
import { IOCCardsTypes } from './IOCCardsTypes';
import { IOC_TYPES } from './IOCCardsTypes';

export class LinkTimelineProcessor {
    private app: App;
    private plugin: any;
    private IOCCardsTypes: IOCCardsTypes;

    constructor(app: App, plugin: any, IOCCardsTypes: IOCCardsTypes) {
        this.app = app;
        this.plugin = plugin;
        this.IOCCardsTypes = IOCCardsTypes;
    }

    extractEnhancedLinkData(): any {
        console.log('🔍 Starting enhanced comprehensive canvas analysis...');
        const activeLeaf = this.app.workspace.activeLeaf;
        
        if (!activeLeaf || !activeLeaf.view) {
            console.log('❌ No active workspace leaf found');
            return { chains: [], isolatedNodes: [], canvasFound: false, totalNodes: 0, totalEdges: 0, iocNodes: 0, validConnections: 0, sourceNodes: 0 };
        }

        if (activeLeaf.view.getViewType() !== 'canvas') {
            console.log('❌ Not a canvas view');
            return { chains: [], isolatedNodes: [], canvasFound: false, totalNodes: 0, totalEdges: 0, iocNodes: 0, validConnections: 0, sourceNodes: 0 };
        }

        const canvasView = activeLeaf.view as any;
        const canvas = canvasView.canvas;
        
        if (!canvas) {
            console.log('❌ No canvas object in view');
            return { chains: [], isolatedNodes: [], canvasFound: false, totalNodes: 0, totalEdges: 0, iocNodes: 0, validConnections: 0, sourceNodes: 0 };
        }

        // Get nodes and edges
        let nodes = [];
        let edges = [];
        
        if (canvas.nodes && Array.isArray(canvas.nodes)) {
            nodes = canvas.nodes;
        } else if (canvas.data && canvas.data.nodes) {
            nodes = canvas.data.nodes;
        }

        if (canvas.edges && Array.isArray(canvas.edges)) {
            edges = canvas.edges;
        } else if (canvas.data && canvas.data.edges) {
            edges = canvas.data.edges;
        }

        console.log(`📊 Final counts: ${nodes.length} nodes, ${edges.length} edges`);
        
        if (nodes.length === 0) {
            return { chains: [], isolatedNodes: [], canvasFound: true, totalNodes: 0, totalEdges: edges.length, iocNodes: 0, validConnections: 0, sourceNodes: 0 };
        }

        // Build IOC node map with fixed parsing
        const iocNodeMap = new Map();
        const incomingConnections = new Map();
        const outgoingConnections = new Map();
        const edgeLabels = new Map(); // key: "fromId->toId", value: label text
        let iocNodeCount = 0;

        if (nodes.length != 0) {
            canvas.nodes.forEach((node: any) => {
                if (node.text) {
                    const nodeData = this.parseFixedIOCNode(node);
                    if (nodeData.type) {
                        iocNodeMap.set(node.id, nodeData);
                        outgoingConnections.set(node.id, []);
                        incomingConnections.set(node.id, []);
                        iocNodeCount++;
                        console.log(`✅ IOC node identified: ${node.id} - ${nodeData.type}`);
                    }
                }
            });
        }

        console.log(`📊 IOC nodes identified: ${iocNodeCount}`);
        
        if (iocNodeCount === 0) {
            return {
                chains: [],
                isolatedNodes: [],
                canvasFound: true,
                totalNodes: nodes.length,
                totalEdges: edges.length,
                iocNodes: 0,
                validConnections: 0,
                sourceNodes: 0
            };
        }

        let validConnectionCount = 0;
        
        // Process edges
        console.log(`🔍 Starting edge processing... Found ${edges.length} edges`);
        if (nodes.length != 0) {
            edges.forEach((edge: any, edgeIndex: number) => {
                const possibleFromProps = ['fromNode', 'from', 'source', 'sourceId', 'fromId'];
                const possibleToProps = ['toNode', 'to', 'target', 'targetId', 'toId'];
                let fromId: string | null = null;
                let toId: string | null = null;

                for (const prop of possibleFromProps) {
                    if (edge[prop] !== undefined && edge[prop] !== null) {
                        fromId = edge[prop];
                        break;
                    }
                }

                for (const prop of possibleToProps) {
                    if (edge[prop] !== undefined && edge[prop] !== null) {
                        toId = edge[prop];
                        break;
                    }
                }

                if (!fromId || !toId) return;

                // Extract edge label/text
                let edgeLabel = '';
                if (edge.label) {
                    edgeLabel = edge.label;
                } else if (edge.text) {
                    edgeLabel = edge.text;
                }

                console.log(`🔍 Edge ${edgeIndex}: ${fromId} -> ${toId}, Label: "${edgeLabel}"`);

                // Only process if both nodes are IOC nodes
                if (iocNodeMap.has(fromId) && iocNodeMap.has(toId)) {
                    const fromConnections = outgoingConnections.get(fromId);
                    const toConnections = incomingConnections.get(toId);

                    if (fromConnections && toConnections) {
                        fromConnections.push(toId);
                        toConnections.push(fromId);
                        
                        // Store edge label
                        const edgeKey = `${fromId}->${toId}`;
                        edgeLabels.set(edgeKey, edgeLabel);
                        
                        validConnectionCount++;
                        console.log(`✅ Valid IOC connection added: ${fromId} → ${toId} (Label: "${edgeLabel}")`);
                    }
                }
            });
        }

        console.log(`📊 Valid connections processed: ${validConnectionCount}`);

        // Find source nodes
        const sourceNodeIds: string[] = [];
        iocNodeMap.forEach((nodeData, nodeId) => {
            const nodeOutgoing = outgoingConnections.get(nodeId) || [];
            const nodeIncoming = incomingConnections.get(nodeId) || [];
            const hasOutgoing = nodeOutgoing.length > 0;
            const hasIncoming = nodeIncoming.length > 0;

            if (hasOutgoing && !hasIncoming) {
                sourceNodeIds.push(nodeId);
                console.log(`🎯 Source node identified: ${nodeId}`);
            }
        });

        console.log(`📊 Source nodes found: ${sourceNodeIds.length}`);

        // Build enhanced attack chains
        const chains: any[] = [];
        const visited = new Set();

        sourceNodeIds.forEach((sourceId: string) => {
            if (!visited.has(sourceId)) {
                const sourceOutgoing = outgoingConnections.get(sourceId) || [];

                if (sourceOutgoing.length === 1) {
                    const chain = this.buildEnhancedAttackChain(sourceId, outgoingConnections, iocNodeMap, edgeLabels, new Set());
                    if (chain.length > 1) {
                        chains.push(chain);
                    }
                } else if (sourceOutgoing.length > 1) {
                    sourceOutgoing.forEach((targetId: string) => {
                        const partialChain = this.buildEnhancedAttackChain(targetId, outgoingConnections, iocNodeMap, edgeLabels, new Set());
                        const sourceNode = iocNodeMap.get(sourceId);
                        const fullChain = [
                            { ...sourceNode, edgeLabel: edgeLabels.get(`${sourceId}->${targetId}`) || '' },
                            ...partialChain
                        ];
                        if (fullChain.length > 1) {
                            chains.push(fullChain);
                        }
                    });
                }
                visited.add(sourceId);
            }
        });

        // Find truly isolated nodes
        const isolatedNodeIds: string[] = [];
        iocNodeMap.forEach((nodeData, nodeId) => {
            const nodeOutgoing = outgoingConnections.get(nodeId) || [];
            const nodeIncoming = incomingConnections.get(nodeId) || [];
            const hasAnyConnections = nodeOutgoing.length > 0 || nodeIncoming.length > 0;

            if (!hasAnyConnections) {
                isolatedNodeIds.push(nodeId);
                console.log(`🏝️ Isolated node identified: ${nodeId}`);
            }
        });

        const isolatedNodes = isolatedNodeIds.map((nodeId: string) => iocNodeMap.get(nodeId)).filter(Boolean);

        const result = {
            chains: chains,
            isolatedNodes: isolatedNodes,
            canvasFound: true,
            totalNodes: nodes.length,
            totalEdges: edges.length,
            iocNodes: iocNodeCount,
            validConnections: validConnectionCount,
            sourceNodes: sourceNodeIds.length
        };

        console.log('📊 Final enhanced comprehensive result:', result);
        return result;
    }

    private buildEnhancedAttackChain(
        startNodeId: string,
        outgoingConnections: Map<string, string[]>,
        nodeMap: Map<string, any>,
        edgeLabels: Map<string, string>,
        visited: Set<string>,
        currentChain: any[] = []
    ): any[] {
        if (visited.has(startNodeId)) {
            return currentChain;
        }

        visited.add(startNodeId);
        const nodeData = nodeMap.get(startNodeId);
        const outgoing = outgoingConnections.get(startNodeId) || [];

        if (nodeData) {
            // Get the edge label for the NEXT connection (if exists)
            const edgeLabel = outgoing.length > 0 ? (edgeLabels.get(`${startNodeId}->${outgoing[0]}`) || '') : '';
            
            // Add node with its outgoing edge label
            currentChain.push({
                ...nodeData,
                edgeLabel: edgeLabel
            });
        }

        if (outgoing.length > 0) {
            const nextNodeId = outgoing[0];
            return this.buildEnhancedAttackChain(nextNodeId, outgoingConnections, nodeMap, edgeLabels, visited, currentChain);
        }

        return currentChain;
    }

    private parseFixedIOCNode(node: any): any {
        if (!node.text) return { type: '', value: '', time: '', splunkQuery: '', icon: '', color: '#333' };

        const text = node.text;
        let iocType = '';
        let value = '';
        let time = '';
        let splunkQuery = '';
        let tactic = '';
        let technique = '';
        let icon = '';
        let color = '#333';

        console.log('🔍 DEBUG: Looking for IOC type in text:', text.substring(0, 100));

        const iocTypePatterns = [
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
            { pattern: /Network Traffic/i, type: "Network Traffic" },
            { pattern: /Command Line/i, type: "Command Line" },
            { pattern: /File/i, type: "File" },
            { pattern: /Note/i, type: "Note" },
            { pattern: /DLL/i, type: "DLL" },
            { pattern: /C2/i, type: "C2" }
        ];

        for (const { pattern, type } of iocTypePatterns) {
            if (pattern.test(text)) {
                iocType = type;
                console.log(`🔍 DEBUG: IOC type detected: ${iocType}`);
                break;
            }
        }

        if (!iocType) {
            console.log('🔍 DEBUG: No IOC type found in text');
            return { type: '', value: '', time: '', splunkQuery: '', icon: '', color: '#333' };
        }

        // Value extraction
        const valueMatch = text.match(/```([^`]+)```/i);
        if (valueMatch && valueMatch[1] && valueMatch[1].trim()) {
            value = valueMatch[1].trim();
        }

        // Time extraction
        const timePatterns = [
            /\\*\\*Time of Event:\\*\\*\\s*(\\d{4}-\\d{2}-\\d{2}\\s\\d{2}:\\d{2}:\\d{2})/i,
            /\\*\\*Time:\\*\\*\\s*(\\d{4}-\\d{2}-\\d{2}\\s\\d{2}:\\d{2}:\\d{2})/i,
            /(\\d{4}-\\d{2}-\\d{2}\\s\\d{2}:\\d{2}:\\d{2})/i
        ];

        for (const pattern of timePatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                time = match[1].trim();
                break;
            }
        }

        // Splunk query extraction
        const splunkMatch = text.match(/\\*\\*Splunk Query:\\*\\*[:\\s]*([\\s\\S]*?)(?=\\*\\*|$)/i);
        if (splunkMatch && splunkMatch[1]) {
            splunkQuery = splunkMatch[1].trim();
        }

        // Tactic extraction
        const tacticMatch = text.match(/\\*\\*Tactic:\\*\\*\\s*([^\\n]+)/i);
        if (tacticMatch && tacticMatch[1]) {
            tactic = tacticMatch[1].trim();
        }

        // Technique extraction
        const techniqueMatch = text.match(/\\*\\*Technique:\\*\\*\\s*([^\\n]+)/i);
        if (techniqueMatch && techniqueMatch[1]) {
            technique = techniqueMatch[1].trim();
        }

        // Get icon and color from IOCCardsTypes
        console.log('🔍 DEBUG: Using direct IOC_TYPES import');
        Object.keys(IOC_TYPES).forEach((key: string) => {
            console.log('🔍 DEBUG: Checking key:', key, 'name:', IOC_TYPES[key].name, 'vs iocType:', iocType);
            if (IOC_TYPES[key].name === iocType) {
                icon = IOC_TYPES[key].svg;
                color = IOC_TYPES[key].color;
                console.log('🔍 DEBUG: MATCH! Color set to:', color);
            }
        });

        return {
            id: node.id,
            type: iocType,
            value: value,
            time: time,
            splunkQuery: splunkQuery,
            tactic: tactic,
            technique: technique,
            icon: icon,
            color: color
        };
    }
}