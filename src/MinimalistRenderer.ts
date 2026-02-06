import { Notice } from 'obsidian';

interface CanvasNode {
    id: string;
    type: string;
    icon: string;
    color: string;
    value: string;
    time: string | null;
    connections: { targetId: string; label: string }[];
}

export class MinimalistRenderer {
    
    public static renderMinimalist(container: HTMLElement, canvasData: any): void {
        if (!canvasData || (!canvasData.nodes || canvasData.nodes.length === 0)) {
            const emptyMessage = container.createEl('div', { cls: 'minimalist-empty' });
            emptyMessage.innerHTML = '<h3>📊 Minimalist Representation</h3><p>No IOC cards found in canvas.</p>';
            return;
        }
        
        const minimalistContainer = container.createDiv('minimalist-container');
        const canvasView = minimalistContainer.createDiv('minimalist-canvas-view');
        
        // Create SVG for connections
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('minimalist-connections');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '1';
        
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.appendChild(defs);
        canvasView.appendChild(svg);
        
        // Organize nodes by levels (simple vertical layout)
        const { levels, nodeMap } = this.organizeNodes(canvasData.nodes, canvasData.connections);
        const nodeElements = new Map<string, HTMLElement>();
        
        // Render nodes level by level
        levels.forEach((levelNodes, levelIndex) => {
            const levelDiv = canvasView.createDiv('minimalist-level');
            
            levelNodes.forEach((node, columnIndex) => {
                const nodeEl = this.renderNode(levelDiv, node);
                nodeElements.set(node.id, nodeEl);
            });
        });
        
        // Draw connections after layout
        setTimeout(() => {
            this.drawConnections(svg, defs, canvasData.connections, nodeElements, nodeMap, canvasView);
        }, 100);
    }
    
    private static organizeNodes(nodes: any[], connections: any[]): { levels: CanvasNode[][], nodeMap: Map<string, CanvasNode> } {
        const nodeMap = new Map<string, CanvasNode>();
        
        // Build node map with connections
        nodes.forEach(node => {
            const canvasNode: CanvasNode = {
                id: node.id,
                type: node.type || 'Unknown',
                icon: node.icon || '📄',
                color: node.color || '#888888',
                value: node.value || '',
                time: node.time || null,
                connections: []
            };
            nodeMap.set(node.id, canvasNode);
        });
        
        // Add connections to nodes
        connections.forEach(conn => {
            const sourceNode = nodeMap.get(conn.from);
            if (sourceNode) {
                sourceNode.connections.push({
                    targetId: conn.to,
                    label: conn.label || ''
                });
            }
        });
        
        // Calculate levels (nodes with no incoming = level 0)
        const incomingCount = new Map<string, number>();
        nodes.forEach(n => incomingCount.set(n.id, 0));
        
        connections.forEach(conn => {
            incomingCount.set(conn.to, (incomingCount.get(conn.to) || 0) + 1);
        });
        
        const levels: CanvasNode[][] = [];
        const assigned = new Set<string>();
        
        // Level 0: nodes with no incoming connections
        const level0: CanvasNode[] = [];
        nodeMap.forEach((node, id) => {
            if (incomingCount.get(id) === 0) {
                level0.push(node);
                assigned.add(id);
            }
        });
        if (level0.length > 0) levels.push(level0);
        
        // Subsequent levels: nodes whose all parents are assigned
        let maxIterations = 20;
        while (assigned.size < nodeMap.size && maxIterations-- > 0) {
            const nextLevel: CanvasNode[] = [];
            
            nodeMap.forEach((node, id) => {
                if (assigned.has(id)) return;
                
                // Check if all incoming connections are from assigned nodes
                const incomingConnections = connections.filter(c => c.to === id);
                const allParentsAssigned = incomingConnections.every(c => assigned.has(c.from));
                
                if (allParentsAssigned) {
                    nextLevel.push(node);
                    assigned.add(id);
                }
            });
            
            if (nextLevel.length > 0) {
                levels.push(nextLevel);
            } else {
                break;
            }
        }
        
        // Add remaining unassigned nodes
        const remaining: CanvasNode[] = [];
        nodeMap.forEach((node, id) => {
            if (!assigned.has(id)) {
                remaining.push(node);
            }
        });
        if (remaining.length > 0) levels.push(remaining);
        
        return { levels, nodeMap };
    }
    
    private static renderNode(container: HTMLElement, node: CanvasNode): HTMLElement {
        const nodeCard = container.createDiv('minimalist-card');
        nodeCard.setAttribute('data-node-id', node.id);
        nodeCard.style.setProperty('--card-color', node.color);
        nodeCard.style.borderColor = node.color;
        nodeCard.style.background = `linear-gradient(135deg, ${node.color}15 0%, ${node.color}05 100%)`;
        
        // Time badge (if available)
        if (node.time) {
            const timeBadge = nodeCard.createDiv('minimalist-time');
            timeBadge.textContent = node.time;
            timeBadge.style.background = `${node.color}25`;
            timeBadge.style.color = node.color;
        }
        
        // Card header
        const header = nodeCard.createDiv('minimalist-header');
        
        const icon = header.createDiv('minimalist-icon');
        icon.innerHTML = node.icon;
        icon.style.background = `${node.color}20`;
        icon.style.borderColor = node.color;
        
        const title = header.createDiv('minimalist-title');
        title.textContent = node.type;
        title.style.color = node.color;
        
        // Card value
        if (node.value && node.value.trim()) {
            const valueDiv = nodeCard.createDiv('minimalist-value');
            valueDiv.textContent = node.value;
        }
        
        return nodeCard;
    }
    
    private static drawConnections(
        svg: SVGSVGElement,
        defs: SVGDefsElement,
        connections: any[],
        nodeElements: Map<string, HTMLElement>,
        nodeMap: Map<string, CanvasNode>,
        container: HTMLElement
    ): void {
        const containerRect = container.getBoundingClientRect();
        
        connections.forEach(conn => {
            const fromEl = nodeElements.get(conn.from);
            const toEl = nodeElements.get(conn.to);
            const fromNode = nodeMap.get(conn.from);
            
            if (!fromEl || !toEl || !fromNode) return;
            
            const fromRect = fromEl.getBoundingClientRect();
            const toRect = toEl.getBoundingClientRect();
            
            // Use source card color for the line
            const lineColor = fromNode.color;
            
            // Calculate connection points (bottom center to top center)
            const fromX = fromRect.left - containerRect.left + fromRect.width / 2;
            const fromY = fromRect.bottom - containerRect.top;
            
            const toX = toRect.left - containerRect.left + toRect.width / 2;
            const toY = toRect.top - containerRect.top;
            
            // Create path with smooth curve
            const midY = (fromY + toY) / 2;
            const pathData = `M ${fromX} ${fromY} Q ${fromX} ${midY}, ${(fromX + toX) / 2} ${midY} T ${toX} ${toY}`;
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            path.setAttribute('stroke', lineColor);
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-opacity', '0.8');
            
            // Add arrowhead
            const markerId = `arrow-${this.sanitizeColor(lineColor)}`;
            path.setAttribute('marker-end', `url(#${markerId})`);
            
            svg.appendChild(path);
            
            // Create arrowhead marker
            if (!defs.querySelector(`#${markerId}`)) {
                const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                marker.setAttribute('id', markerId);
                marker.setAttribute('markerWidth', '10');
                marker.setAttribute('markerHeight', '10');
                marker.setAttribute('refX', '9');
                marker.setAttribute('refY', '3');
                marker.setAttribute('orient', 'auto');
                
                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polygon.setAttribute('points', '0 0, 10 3, 0 6');
                polygon.setAttribute('fill', lineColor);
                
                marker.appendChild(polygon);
                defs.appendChild(marker);
            }
            
            // Add label if exists
            if (conn.label && conn.label.trim()) {
                const labelX = (fromX + toX) / 2;
                const labelY = midY;
                
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', String(labelX));
                text.setAttribute('y', String(labelY - 5));
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', lineColor);
                text.setAttribute('font-size', '11');
                text.setAttribute('font-weight', '600');
                text.textContent = conn.label;
                
                // Background for label
                const bbox = text.getBBox();
                const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bgRect.setAttribute('x', String(bbox.x - 3));
                bgRect.setAttribute('y', String(bbox.y - 1));
                bgRect.setAttribute('width', String(bbox.width + 6));
                bgRect.setAttribute('height', String(bbox.height + 2));
                bgRect.setAttribute('fill', 'var(--background-primary)');
                bgRect.setAttribute('rx', '3');
                
                svg.appendChild(bgRect);
                svg.appendChild(text);
            }
        });
    }
    
    private static sanitizeColor(color: string): string {
        return (color || 'default').replace(/[^a-zA-Z0-9]/g, '');
    }
}