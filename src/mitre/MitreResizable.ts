/**
 * MitreResizable.ts - 8-handle drag-to-resize for MITRE modal
 *
 * Creates 8 resize handles (4 corners + 4 edges) on the modal element
 * and attaches drag listeners for interactive resizing.
 *
 * **Coordinate Math:**
 * - East (E): Drag right increases width by deltaX
 * - West (W): Drag left decreases width, shifts modal left
 * - South (S): Drag down increases height by deltaY
 * - North (N): Drag up decreases height, shifts modal up
 * - Corners: Combine two directions (e.g., NE = North + East)
 *
 * **Constraints:**
 * - MIN_WIDTH: 600px (prevents crushing tactic columns)
 * - MIN_HEIGHT: 400px (prevents hiding header/controls)
 * - MAX: 95% of viewport (prevents overflow)
 */

import { DEBUG } from '../debug';

/**
 * Add drag handles and resize functionality to a modal element.
 *
 * @param modal - The modal DOM element to make resizable
 */
export function makeResizable(modal: HTMLElement): void {
    if (DEBUG) console.debug('[MitreResizable] Attaching resize handles');

    const MIN_WIDTH = 600;   // Narrower would crush tactic columns
    const MIN_HEIGHT = 400;  // Shorter would hide header/controls
    const MAX_WIDTH = window.innerWidth * 0.95;   // Leave 5% viewport margin
    const MAX_HEIGHT = window.innerHeight * 0.95;

    // Resize handle positions: [className, cursor, isCorner]
    // N=North, S=South, E=East, W=West
    const handles: Array<[string, string, boolean]> = [
        ['resize-handle-n', 'ns-resize', false],    // Top edge
        ['resize-handle-s', 'ns-resize', false],    // Bottom edge
        ['resize-handle-e', 'ew-resize', false],    // Right edge
        ['resize-handle-w', 'ew-resize', false],    // Left edge
        ['resize-handle-ne', 'nesw-resize', true],  // Top-right corner
        ['resize-handle-nw', 'nwse-resize', true],  // Top-left corner
        ['resize-handle-se', 'nwse-resize', true],  // Bottom-right corner
        ['resize-handle-sw', 'nesw-resize', true],  // Bottom-left corner
    ];

    handles.forEach(([className, cursor, isCorner]) => {
        const handle = modal.createDiv(`mitre-resize-handle ${className}`);
        handle.style.cursor = cursor;

        let startX = 0, startY = 0, startWidth = 0, startHeight = 0, startLeft = 0, startTop = 0;

        const onMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            startX = e.clientX;
            startY = e.clientY;

            const rect = modal.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;
            startLeft = rect.left;
            startTop = rect.top;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            modal.addClass('mitre-modal-resizing');
        };

        const onMouseMove = (e: MouseEvent) => {
            // Calculate mouse movement since drag started
            const deltaX = e.clientX - startX;  // Positive = moved right
            const deltaY = e.clientY - startY;  // Positive = moved down

            // Initialize new dimensions from starting values
            let newWidth = startWidth;
            let newHeight = startHeight;
            let newLeft = startLeft;
            let newTop = startTop;

            // ---------------------------------------------------------------
            // Calculate new dimensions based on handle direction
            // ---------------------------------------------------------------

            if (className.includes('-e')) {
                // East (right edge): drag right increases width
                newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + deltaX));
            }
            if (className.includes('-w')) {
                // West (left edge): drag left increases width, shifts modal left
                newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth - deltaX));
                newLeft = startLeft + (startWidth - newWidth);
            }
            if (className.includes('-s')) {
                // South (bottom edge): drag down increases height
                newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + deltaY));
            }
            if (className.includes('-n')) {
                // North (top edge): drag up increases height, shifts modal up
                newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight - deltaY));
                newTop = startTop + (startHeight - newHeight);
            }

            // Apply new dimensions with !important to override CSS
            modal.style.setProperty('width', `${newWidth}px`, 'important');
            modal.style.setProperty('height', `${newHeight}px`, 'important');
            modal.style.setProperty('max-width', `${newWidth}px`, 'important');
            modal.style.setProperty('max-height', `${newHeight}px`, 'important');

            // Update position if resizing from top or left
            if (className.includes('-w') || className.includes('-n')) {
                modal.style.left = `${newLeft}px`;
                modal.style.top = `${newTop}px`;
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            modal.removeClass('mitre-modal-resizing');
            if (DEBUG) console.debug('[MitreResizable] Resize complete');
        };

        handle.addEventListener('mousedown', onMouseDown);
    });
}
