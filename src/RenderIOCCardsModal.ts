import { App, Modal } from 'obsidian';

interface IOCField {
    name: string;
    icon: string;
    color: string;
    fields: string[];
    svg: string;
    os_icons?: {
        [key: string]: string;
    };
}

interface IOCTypes {
    [key: string]: IOCField;
}

type OnSelectCallback = (iocTypeId: string, osType?: string) => void;

export class RenderIOCCardsModal extends Modal {
    private iocTypes: IOCTypes;
    private onSelect: OnSelectCallback;

    constructor(app: App, iocTypes: IOCTypes, onSelect: OnSelectCallback) {
        super(app);
        this.iocTypes = iocTypes;
        this.onSelect = onSelect;
    }

    onOpen(): void {
        const { contentEl } = this;
        
        this.modalEl.classList.add('ioc-type-selector-modal');
        
        contentEl.createEl('h2', { text: 'Select IOC Type' });
        
        const container = contentEl.createDiv('ioc-type-container');
        
        Object.keys(this.iocTypes).forEach((iocTypeId: string) => {
            const iocType = this.iocTypes[iocTypeId];
            const button = container.createEl('button', { cls: 'ioc-type-button' });
            
            // Use data attribute and CSS variable for dynamic color
            button.setAttribute('data-ioc-type', iocTypeId);
            button.style.borderLeft = `4px solid ${iocType.color}`;
            
            const iconContainer = button.createDiv('ioc-button-icon');
            iconContainer.innerHTML = iocType.svg;
            
            const textContainer = button.createDiv('ioc-button-text');
            textContainer.textContent = iocType.name;
            
            button.addEventListener('click', () => {
                if (iocTypeId === 'hostname') {
                    this.showOSSelector(iocTypeId);
                } else {
                    this.onSelect(iocTypeId);
                    this.close();
                }
            });
        });
    }

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
        
        const backButton = contentEl.createEl('button', {
            text: '← Back to IOC Types',
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