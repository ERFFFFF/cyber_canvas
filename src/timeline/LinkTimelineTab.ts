/**
 * LinkTimelineTab.ts - Expandable parent-child timeline view
 *
 * Renders IOC cards grouped by canvas arrow connections. Each parent card
 * has an expand/collapse toggle to show its linked child cards. Children
 * are rendered indented with a vertical connector line.
 *
 * Uses flat 2-level hierarchy: [P] → [C] (all children at same indentation).
 * Orphaned C→C arrows (no [P] upstream) are flagged as errors.
 */

import { ParentChildGroup, LinkTimelineResult } from './LinkTimelineProcessing';
import { IOCNodeData } from '../types/IOCNodeData';
import { renderIOCCardRow } from './LinkTimelineCardRow';

/**
 * Type guard to check if an item is a ParentChildGroup (nested) or IOCNodeData (leaf).
 */
function isParentChildGroup(item: IOCNodeData | ParentChildGroup): item is ParentChildGroup {
    return 'children' in item && Array.isArray((item as any).children);
}

/**
 * Render the link-based timeline tab content.
 *
 * For each parent-child group:
 *   - Parent card header with [P] badge, type, time, value, expand toggle
 *   - Collapsible children section with [C] badges and vertical connector
 *   - Flat 2-level hierarchy: all [C] cards at same indentation under [P]
 *   - Default state: collapsed (children hidden)
 *   - Error section for cards with bad directional arrows (C→P and C→C)
 *
 * @param container - Parent DOM element to render into
 * @param result - LinkTimelineResult with valid groups and error cards
 */
export function renderLinkTimeline(container: HTMLElement, result: LinkTimelineResult): void {
    const { groups, badDirectionalCards } = result;

    if (groups.length === 0) {
        container.createEl('p', {
            text: 'No IOC cards found. Create parent and child cards, then draw arrows between them.',
            cls: 'timeline-empty-message'
        });
        return;
    }

    // Count groups that have children
    const linkedGroups = groups.filter(g => g.children.length > 0);
    if (linkedGroups.length === 0) {
        container.createEl('p', {
            text: 'No parent-child relationships found. Draw arrows between IOC cards to create links (arrow from parent to child).',
            cls: 'timeline-empty-message'
        });
    }

    /**
     * Render a child item (leaf node only in flat hierarchy).
     * Note: With flat hierarchy, child will always be IOCNodeData (never ParentChildGroup).
     *
     * @param childrenContainer - Parent DOM element to append the child to
     * @param child - Child item (IOCNodeData or ParentChildGroup, but always IOCNodeData in practice)
     * @param depth - Nesting depth (always 0 in flat hierarchy)
     */
    function renderChild(
        childrenContainer: HTMLElement,
        child: IOCNodeData | ParentChildGroup,
        depth: number
    ): void {
        if (isParentChildGroup(child)) {
            // Nested parent group - render as sub-parent with its own children
            renderNestedGroup(childrenContainer, child, depth);
        } else {
            // Leaf node - render as simple child
            renderLeafNode(childrenContainer, child, depth);
        }
    }

    /**
     * Render a leaf child node (no nested children).
     * Delegates to shared renderIOCCardRow helper.
     *
     * @param childrenContainer - Parent DOM element
     * @param child - Child IOC node data
     * @param depth - Nesting depth (for indentation)
     */
    function renderLeafNode(
        childrenContainer: HTMLElement,
        child: IOCNodeData,
        depth: number
    ): void {
        renderIOCCardRow({
            container: childrenContainer,
            ioc: child,
            showConnector: true,
            depth
        });
    }

    /**
     * Render a nested parent group (has its own children).
     *
     * @param childrenContainer - Parent DOM element
     * @param group - Nested parent-child group
     * @param depth - Nesting depth (for indentation)
     */
    function renderNestedGroup(
        childrenContainer: HTMLElement,
        group: ParentChildGroup,
        depth: number
    ): void {
        const nestedGroupEl = childrenContainer.createDiv('link-timeline-child link-timeline-nested-parent');
        nestedGroupEl.classList.add(`depth-${depth}`);
        nestedGroupEl.style.borderLeftColor = group.parent.color;
        nestedGroupEl.style.marginLeft = `${depth * 30}px`; // 30px per depth level

        // Connector line
        nestedGroupEl.createDiv('link-timeline-connector');

        // Expand toggle (nested parents are always expandable)
        const toggleEl = nestedGroupEl.createDiv('link-timeline-expand-toggle');
        toggleEl.textContent = '\u25B6'; // ▶
        toggleEl.classList.add('has-children');

        // Role badge
        nestedGroupEl.createEl('span', {
            text: group.parent.isChild ? '[C]' : '[P]',
            cls: `link-timeline-role-badge ${group.parent.isChild ? 'role-child' : 'role-parent'}`
        });

        // Icon
        const iconEl = nestedGroupEl.createDiv('link-timeline-icon');
        iconEl.innerHTML = group.parent.icon;
        iconEl.style.color = group.parent.color;

        // Details
        const detailsEl = nestedGroupEl.createDiv('link-timeline-details');
        detailsEl.createEl('strong', { text: group.parent.type });
        if (group.parent.time) {
            detailsEl.createEl('span', { text: ` | ${group.parent.time}`, cls: 'link-timeline-time' });
        }
        if (group.parent.cardId) {
            detailsEl.createEl('span', { text: ` | ${group.parent.cardId}`, cls: 'link-timeline-card-id' });
        }
        if (group.parent.value && group.parent.value.trim()) {
            detailsEl.createDiv({ text: group.parent.value, cls: 'link-timeline-value' });
        }

        // Children count badge
        nestedGroupEl.createEl('span', {
            text: String(group.children.length),
            cls: 'link-timeline-count'
        });

        // Nested children container (collapsed by default)
        const nestedChildrenEl = childrenContainer.createDiv('link-timeline-nested-children');
        nestedChildrenEl.style.display = 'none';

        // Recursively render nested children (depth + 1)
        group.children.forEach(nestedChild => {
            renderChild(nestedChildrenEl, nestedChild, depth + 1);
        });

        // Toggle expand/collapse on nested parent click
        nestedGroupEl.style.cursor = 'pointer';
        nestedGroupEl.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling to parent toggles
            const isExpanded = nestedChildrenEl.style.display !== 'none';
            nestedChildrenEl.style.display = isExpanded ? 'none' : 'block';
            toggleEl.textContent = isExpanded ? '\u25B6' : '\u25BC'; // ▶ / ▼
            toggleEl.classList.toggle('expanded', !isExpanded);
        });
    }

    // Render root-level groups
    groups.forEach(group => {
        const groupEl = container.createDiv('link-timeline-group');

        // Parent card row (root-level, depth 0)
        const parentEl = groupEl.createDiv('link-timeline-parent');
        parentEl.style.borderLeftColor = group.parent.color;

        // Expand toggle (only if has children)
        const hasChildren = group.children.length > 0;
        const toggleEl = parentEl.createDiv('link-timeline-expand-toggle');
        if (hasChildren) {
            toggleEl.textContent = '\u25B6'; // ▶
            toggleEl.classList.add('has-children');
        }

        // Role badge
        const roleBadge = parentEl.createEl('span', {
            text: group.parent.isChild ? '[C]' : '[P]',
            cls: `link-timeline-role-badge ${group.parent.isChild ? 'role-child' : 'role-parent'}`
        });

        // Icon
        const iconEl = parentEl.createDiv('link-timeline-icon');
        iconEl.innerHTML = group.parent.icon;
        iconEl.style.color = group.parent.color;

        // Details
        const detailsEl = parentEl.createDiv('link-timeline-details');
        detailsEl.createEl('strong', { text: group.parent.type });
        if (group.parent.time) {
            detailsEl.createEl('span', { text: ` | ${group.parent.time}`, cls: 'link-timeline-time' });
        }
        if (group.parent.cardId) {
            detailsEl.createEl('span', { text: ` | ${group.parent.cardId}`, cls: 'link-timeline-card-id' });
        }
        if (group.parent.value && group.parent.value.trim()) {
            detailsEl.createDiv({ text: group.parent.value, cls: 'link-timeline-value' });
        }

        // Children count badge
        if (hasChildren) {
            parentEl.createEl('span', {
                text: String(group.children.length),
                cls: 'link-timeline-count'
            });
        }

        // Children container (collapsed by default)
        const childrenEl = groupEl.createDiv('link-timeline-children');
        childrenEl.style.display = 'none';

        // Render children recursively (starting at depth 0)
        group.children.forEach(child => {
            renderChild(childrenEl, child, 0);
        });

        // Toggle expand/collapse on parent click
        if (hasChildren) {
            parentEl.style.cursor = 'pointer';
            parentEl.addEventListener('click', () => {
                const isExpanded = childrenEl.style.display !== 'none';
                childrenEl.style.display = isExpanded ? 'none' : 'block';
                toggleEl.textContent = isExpanded ? '\u25B6' : '\u25BC'; // ▶ / ▼
                toggleEl.classList.toggle('expanded', !isExpanded);
            });
        }
    });

    // ---------------------------------------------------------------
    // Error section: Cards with incorrect arrow direction
    // ---------------------------------------------------------------
    if (badDirectionalCards.length > 0) {
        const errorSection = container.createDiv('link-timeline-error-section');

        // Error header
        const errorHeader = errorSection.createDiv('link-timeline-error-header');
        errorHeader.textContent = '⚠️ Directional Errors: Child→Parent & Child→Child';

        // Error description
        const errorDesc = errorSection.createDiv('link-timeline-error-description');
        errorDesc.textContent = 'These cards have incorrect arrow connections: [P] cards with incoming arrows FROM [C] cards (Child→Parent), or orphaned [C] cards with no [P] parent in their upstream chain. C→C arrows are allowed when a parent exists above.';

        // Render each bad card
        badDirectionalCards.forEach(card => {
            const errorItem = errorSection.createDiv('link-timeline-error-item');
            errorItem.style.borderLeftColor = card.color;

            errorItem.createEl('span', {
                text: '[P]',
                cls: 'link-timeline-role-badge role-parent'
            });

            const iconEl = errorItem.createDiv('link-timeline-icon');
            iconEl.innerHTML = card.icon;
            iconEl.style.color = card.color;

            const detailsEl = errorItem.createDiv('link-timeline-details');
            detailsEl.createEl('strong', { text: card.type });
            if (card.time) {
                detailsEl.createEl('span', { text: ` | ${card.time}`, cls: 'link-timeline-time' });
            }
            if (card.cardId) {
                detailsEl.createEl('span', { text: ` | ${card.cardId}`, cls: 'link-timeline-card-id' });
            }
            if (card.value && card.value.trim()) {
                detailsEl.createDiv({ text: card.value, cls: 'link-timeline-value' });
            }
        });
    }
}
