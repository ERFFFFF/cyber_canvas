/**
 * RenderIOCCardsModal.ts - IOC type picker modal.
 *
 * Presents a 3-column grid of all registered IOC types. When the analyst clicks
 * a type, the modal fires the `onSelect` callback with the chosen type ID and
 * (for Hostname) the OS variant, then closes. The parent code (main.ts) uses
 * the callback to create the actual canvas text node via RenderIOCCards.
 *
 * Special case: clicking "Hostname" does NOT immediately select -- it replaces
 * the grid with an OS sub-selector (Windows Workstation / Windows Server /
 * macOS / Linux) so the card gets the correct platform icon.
 *
 * Uses IOCField and IOCCardsTypes interfaces imported from IOCCardsTypes.ts.
 */
import { App, Modal } from 'obsidian';
import { IOCField, IOCCardsTypes } from '../types/IOCCardsTypes';

/** Callback signature: receives the selected IOC type key and optional OS variant. */
type OnSelectCallback = (iocTypeId: string, osType?: string) => void;

export class RenderIOCCardsModal extends Modal {
    private iocTypes: IOCCardsTypes;
    private onSelect: OnSelectCallback;
    private title: string;

    constructor(app: App, iocTypes: IOCCardsTypes, onSelect: OnSelectCallback, title?: string) {
        super(app);
        this.iocTypes = iocTypes;
        this.onSelect = onSelect;
        this.title = title || 'Select IOC Type';
    }

    /** Builds the primary IOC type grid view. */
    onOpen(): void {
        const { contentEl } = this;

        this.modalEl.classList.add('ioc-type-selector-modal');
        this.modalEl.style.maxWidth = '900px';
        this.modalEl.style.width = '90vw';

        contentEl.createEl('h2', { text: this.title });

        const container = contentEl.createDiv('ioc-type-container');

        const typeCount = Object.keys(this.iocTypes).length;
        // Calculate columns: aim for roughly square grid
        const cols = Math.min(Math.ceil(Math.sqrt(typeCount)), 5);
        container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

        Object.keys(this.iocTypes).forEach((iocTypeId: string) => {
            const iocType = this.iocTypes[iocTypeId];
            const button = container.createEl('button', { cls: 'ioc-type-button' });

            // Color-coded left border lets analysts visually associate types with
            // the same colors used on timeline items and card headers
            button.setAttribute('data-ioc-type', iocTypeId);
            button.style.borderLeft = `4px solid ${iocType.color}`;

            const iconContainer = button.createDiv('ioc-button-icon');
            iconContainer.innerHTML = iocType.svg;

            const textContainer = button.createDiv('ioc-button-text');
            textContainer.textContent = iocType.name;

            button.addEventListener('click', () => {
                // Hostname needs a second step -- picking the OS variant
                if (iocTypeId === 'hostname') {
                    this.showOSSelector(iocTypeId);
                } else {
                    this.onSelect(iocTypeId);
                    this.close();
                }
            });
        });
    }

    /**
     * Replaces the type grid with an OS selector sub-view.
     * Only reachable when iocTypeId === 'hostname' and the type has os_icons.
     */
    private showOSSelector(iocTypeId: string): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Select Operating System' });
        contentEl.createEl('p', { text: 'Choose the operating system for this hostname:' });

        const container = contentEl.createDiv('os-selector-container');
        const iocType = this.iocTypes[iocTypeId];

        if (iocType.os_icons) {
            Object.keys(iocType.os_icons).forEach((osType: string) => {
                const osButton = container.createEl('button', { cls: 'os-type-button' });
                osButton.setAttribute('data-os-type', osType);

                const iconContainer = osButton.createDiv('os-button-icon');
                iconContainer.innerHTML = iocType.os_icons![osType];

                const textContainer = osButton.createDiv('os-button-text');
                textContainer.textContent = osType.charAt(0).toUpperCase() + osType.slice(1);

                osButton.addEventListener('click', () => {
                    this.onSelect(iocTypeId, osType);
                    this.close();
                });
            });
        }

        // Back button lets the analyst return to the main grid without closing
        const backButton = contentEl.createEl('button', {
            text: '\u2190 Back to IOC Types',
            cls: 'back-button'
        });

        backButton.addEventListener('click', () => {
            contentEl.empty();
            this.onOpen();
        });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}