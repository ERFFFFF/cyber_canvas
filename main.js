const { Plugin, Notice, Modal, Setting, PluginSettingTab } = require('obsidian');

class IOCCanvasPlugin extends Plugin {
  constructor() {
    super(...arguments);
    this.iocTypes = {
      ip_address: {
        name: 'IP Address',
        icon: 'network',
        color: '#FF6B6B',
        fields: ['value', 'source', 'time_of_event', 'splunk_query', 'tactic', 'technique', 'country', 'asn'],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="3"/>
  <circle cx="12" cy="1" r="1"/>
  <circle cx="12" cy="23" r="1"/>
  <circle cx="1" cy="12" r="1"/>
  <circle cx="23" cy="12" r="1"/>
  <circle cx="18.364" cy="5.636" r="1"/>
  <circle cx="18.364" cy="18.364" r="1"/>
  <circle cx="5.636" cy="5.636" r="1"/>
  <circle cx="5.636" cy="18.364" r="1"/>
</svg>`
      },
      domain: {
        name: 'Domain Name',
        icon: 'globe',
        color: '#4ECDC4',
        fields: ['value', 'source', 'time_of_event', 'splunk_query', 'tactic', 'technique', 'registrar', 'whois'],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <line x1="2" y1="12" x2="22" y2="12"/>
  <path d="m4.93 4.93 4.24 4.24"/>
  <path d="m14.83 9.17 4.24-4.24"/>
  <path d="m14.83 14.83 4.24 4.24"/>
  <path d="m9.17 14.83-4.24 4.24"/>
</svg>`
      },
      file_hash: {
        name: 'File Hash',
        icon: 'hash',
        color: '#45B7D1',
        fields: ['value', 'hash_type', 'filename', 'file_size', 'source', 'time_of_event', 'splunk_query', 'tactic', 'technique'],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
  <text x="12" y="16" text-anchor="middle" font-size="8" fill="currentColor">#</text>
</svg>`
      },
      url: {
        name: 'URL',
        icon: 'link',
        color: '#96CEB4',
        fields: ['value', 'domain', 'source', 'time_of_event', 'splunk_query', 'tactic', 'technique', 'category'],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="m9 15 6-6"/>
  <path d="m21 3-6 6"/>
  <path d="m21 3-3 6"/>
  <path d="m21 3-6 3"/>
  <path d="m9 9a3 3 0 0 0-6 0c0 1.657 1.343 3 3 3h2"/>
  <path d="M15 15a3 3 0 0 0 6 0c0-1.657-1.343-3-3-3h-2"/>
</svg>`
      },
      email: {
        name: 'Email Address',
        icon: 'mail',
        color: '#FECA57',
        fields: ['value', 'domain', 'source', 'time_of_event', 'splunk_query', 'tactic', 'technique', 'campaign'],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
  <polyline points="22,6 12,13 2,6"/>
</svg>`
      },
      hostname: {
        name: 'Hostname',
        icon: 'monitor',
        color: '#9C27B0',
        fields: ['value', 'os_type', 'domain', 'source', 'time_of_event', 'splunk_query', 'tactic', 'technique'],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
  <line x1="8" y1="21" x2="16" y2="21"/>
  <line x1="12" y1="17" x2="12" y2="21"/>
</svg>`,
        os_icons: {
          windows: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
  <path d="M0,0 L10,1.375 L10,11.5 L0,11.5 Z M11,1.688 L24,0 L24,11.5 L11,11.5 Z M0,12.5 L10,12.5 L10,22.625 L0,24 Z M11,12.5 L24,12.5 L24,24 L11,22.313 Z"/>
</svg>`,
          macos: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
</svg>`,
          linux: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
  <path d="M12.504 0c-.155 0-.315.008-.480.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.050 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489.1.654.3 1.2.6 1.6.3.4.7.7 1.1.8.4.1.8 0 1.2-.2.4-.2.7-.5.9-.9.2-.4.3-.8.3-1.2 0-.2 0-.4-.1-.6-.1-.2-.2-.4-.3-.5-.1-.1-.2-.2-.3-.3-.1-.1-.2-.2-.2-.3 0-.1 0-.2.1-.3.1-.1.2-.2.3-.2.1 0 .2 0 .3.1.1.1.2.2.3.3.1.1.2.2.2.3.1.1.1.2.1.3 0 .2-.1.4-.2.6-.1.2-.3.4-.5.5-.2.1-.4.2-.6.2-.2 0-.4 0-.6-.1-.2-.1-.4-.2-.5-.4-.1-.2-.2-.4-.2-.6 0-.2.1-.4.2-.6.1-.2.3-.4.5-.5.2-.1.4-.2.6-.2.2 0 .4 0 .6.1.2.1.4.2.5.4.1.2.2.4.2.6 0 .4-.1.8-.3 1.2-.2.4-.5.7-.9.9-.4.2-.8.3-1.2.2-.4-.1-.7-.4-1-.7-.3-.3-.5-.7-.6-1.1-.1-.4-.1-.8 0-1.2.1-.4.3-.8.6-1.1.3-.3.7-.5 1.1-.6.4-.1.8-.1 1.2 0 .8.2 1.5.7 2 1.4.5.7.8 1.5.8 2.4 0 .5-.1 1-.3 1.4-.2.4-.5.8-.9 1.1-.4.3-.9.5-1.4.6-.5.1-1 .1-1.5-.1-.5-.2-.9-.5-1.3-.9-.4-.4-.7-.9-.9-1.4-.2-.5-.3-1-.2-1.5.1-.5.3-1 .6-1.4.3-.4.7-.7 1.2-.9.5-.2 1-.3 1.5-.2.5.1 1 .3 1.4.6.4.3.7.7.9 1.2.2.5.3 1 .2 1.5-.1.5-.3 1-.6 1.4-.3.4-.7.7-1.2.9-.5.2-1 .3-1.5.2-.5-.1-1-.3-1.4-.6-.4-.3-.7-.7-.9-1.2-.2-.5-.3-1-.2-1.5.1-.5.3-1 .6-1.4.3-.4.7-.7 1.2-.9"/>
</svg>`
        }
      },
      yara_rule: {
        name: 'YARA Rule',
        icon: 'shield',
        color: '#FF9FF3',
        fields: ['rule_name', 'rule_content', 'time_of_event', 'splunk_query', 'tactic', 'technique', 'malware_family'],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  <text x="12" y="14" text-anchor="middle" font-size="10" fill="currentColor" font-weight="bold">Y</text>
</svg>`
      },
      sigma_rule: {
        name: 'Sigma Rule',
        icon: 'search',
        color: '#A8E6CF',
        fields: ['rule_name', 'rule_content', 'time_of_event', 'splunk_query', 'tactic', 'technique'],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <text x="12" y="16" text-anchor="middle" font-size="12" fill="currentColor" font-weight="bold">Σ</text>
</svg>`
      },
      registry_key: {
        name: 'Registry Key',
        icon: 'settings',
        color: '#FFB74D',
        fields: ['key_path', 'value_name', 'value_data', 'source', 'time_of_event', 'splunk_query', 'tactic', 'technique'],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
  <circle cx="12" cy="16" r="1"/>
  <path d="m7 11 0-7a5 5 0 0 1 10 0v7"/>
</svg>`
      },
      process_name: {
        name: 'Process Name',
        icon: 'cpu',
        color: '#81C784',
        fields: ['process_name', 'command_line', 'pid', 'source', 'time_of_event', 'splunk_query', 'tactic', 'technique'],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="3"/>
  <path d="M12 1v6"/>
  <path d="M12 17v6"/>
  <path d="m4.2 4.2 1.4 1.4"/>
  <path d="m18.4 18.4 1.4 1.4"/>
  <path d="M1 12h6"/>
  <path d="M17 12h6"/>
  <path d="m4.2 19.8 1.4-1.4"/>
  <path d="m18.4 5.6 1.4-1.4"/>
</svg>`
      },
      network_traffic: {
        name: 'Network Traffic',
        icon: 'activity',
        color: '#9575CD',
        fields: ['pattern', 'protocol', 'port', 'direction', 'source', 'time_of_event', 'splunk_query', 'tactic', 'technique'],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="22 12 18 8 18 11 14 11 14 8 10 12 14 16 14 13 18 13 18 16 22 12"/>
  <polyline points="2 12 6 8 6 11 10 11"/>
  <polyline points="6 16 6 13 10 13"/>
</svg>`
      },
      command_line: {
        name: 'Command Line',
        icon: 'terminal',
        color: '#2E8B57',
        fields: ['command', 'arguments', 'working_directory', 'user_context', 'source', 'time_of_event', 'splunk_query', 'tactic', 'technique'],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="4 17 10 11 4 5"/>
  <line x1="12" y1="19" x2="20" y2="19"/>
</svg>`
      }
    };
  }

  async onload() {
    console.log('Loading IOC Canvas Plugin');

    // Add ribbon icon
    this.addRibbonIcon('shield', 'IOC Canvas Plugin', () => {
      new Notice('IOC Canvas Plugin activated! Create IOC cards in any canvas.');
    });

    // Add timeline button
    this.addRibbonIcon('clock', 'IOC Timeline', () => {
      this.showTimelineModal();
    });

    // Add commands for each IOC type
    Object.keys(this.iocTypes).forEach(iocTypeId => {
      const iocType = this.iocTypes[iocTypeId];
      this.addCommand({
        id: `create-ioc-${iocTypeId}`,
        name: `Create ${iocType.name} IOC`,
        callback: () => this.createIOCCard(iocTypeId)
      });
    });

    // Add general IOC creation command
    this.addCommand({
      id: 'create-ioc-menu',
      name: 'Create IOC Card',
      callback: () => this.showIOCTypeSelector()
    });

    // Add timeline command
    this.addCommand({
      id: 'show-timeline',
      name: 'Show Attack Timeline',
      callback: () => this.showTimelineModal()
    });

    // Add settings tab
    this.addSettingTab(new IOCCanvasSettingTab(this.app, this));

    // Hook into canvas events if possible
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.enhanceCanvasToolbars();
      })
    );

    // Initial enhancement
    this.enhanceCanvasToolbars();
  }

  enhanceCanvasToolbars() {
    // Find all canvas views and add IOC buttons to their toolbars
    const canvasViews = this.app.workspace.getLeavesOfType('canvas');

    canvasViews.forEach(leaf => {
      if (leaf.view && leaf.view.canvas) {
        this.addIOCButtonsToCanvas(leaf.view);
      }
    });
  }

  addIOCButtonsToCanvas(canvasView) {
    // Find the canvas toolbar
    const canvasEl = canvasView.containerEl;
    const toolbar = canvasEl.querySelector('.canvas-controls');

    if (toolbar && !toolbar.querySelector('.ioc-toolbar')) {
      const iocToolbar = document.createElement('div');
      iocToolbar.className = 'ioc-toolbar';
      iocToolbar.innerHTML = `
                <div class="canvas-control-item" title="Add IOC Card">
                    <div class="clickable-icon ioc-add-button" aria-label="Add IOC Card">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                    </div>
                </div>
                <div class="canvas-control-item" title="Show Timeline">
                    <div class="clickable-icon timeline-button" aria-label="Show Timeline">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12,6 12,12 16,14"/>
                        </svg>
                    </div>
                </div>
            `;

      const addButton = iocToolbar.querySelector('.ioc-add-button');
      const timelineButton = iocToolbar.querySelector('.timeline-button');

      addButton.addEventListener('click', () => {
        this.showIOCTypeSelector(canvasView);
      });

      timelineButton.addEventListener('click', () => {
        this.showTimelineModal();
      });

      toolbar.appendChild(iocToolbar);
    }
  }

  showIOCTypeSelector(canvasView = null) {
    new IOCTypeSelectorModal(this.app, this.iocTypes, (selectedType, osType = null) => {
      this.createIOCCard(selectedType, canvasView, osType);
    }).open();
  }

  showTimelineModal() {
    new FullScreenTimelineModal(this.app, this).open();
  }

  createIOCCard(iocTypeId, canvasView = null, osType = null) {
    const iocType = this.iocTypes[iocTypeId];
    if (!iocType) return;

    // If no canvas view provided, try to find active canvas
    if (!canvasView) {
      const activeLeaf = this.app.workspace.activeLeaf;
      if (activeLeaf && activeLeaf.view && activeLeaf.view.canvas) {
        canvasView = activeLeaf.view;
      } else {
        new Notice('Please open a canvas to create IOC cards');
        return;
      }
    }

    // Create IOC card data
    const iocCardData = {
      id: `ioc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'text',
      text: this.createIOCCardContent(iocType, iocTypeId, osType),
      x: Math.random() * 200,
      y: Math.random() * 200,
      width: 400,
      height: 320,
      color: iocType.color
    };

    // Add to canvas if possible
    if (canvasView && canvasView.canvas && canvasView.canvas.createTextNode) {
      const node = canvasView.canvas.createTextNode({
        pos: { x: iocCardData.x, y: iocCardData.y },
        size: { width: iocCardData.width, height: iocCardData.height },
        text: iocCardData.text,
        color: iocType.color
      });

      new Notice(`Created ${iocType.name} IOC card`);
    } else {
      new Notice(`Please ensure you're in a canvas view to create IOC cards`);
    }
  }

  // Canvas view shows visual icons, but editing is clean text
  createIOCCardContent(iocType, iocTypeId, osType = null) {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19); // YYYY-MM-DD HH:MM:SS

    // Get the appropriate icon
    let iconSvg = iocType.svg;
    if (iocTypeId === 'hostname' && osType && iocType.os_icons && iocType.os_icons[osType]) {
      iconSvg = iocType.os_icons[osType];
    }

    // Create content with HTML for display but structured for clean editing
    let content = `<div class="ioc-card-container">`;
    content += `<div class="ioc-card-header" style="display: flex; align-items: center; gap: 16px; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, ${iocType.color}22, transparent); border-radius: 8px; border-bottom: 3px solid ${iocType.color};">`;
    content += `<div class="ioc-icon" style="flex-shrink: 0;">${iconSvg}</div>`;
    content += `<h2 style="margin: 0; color: ${iocType.color}; font-size: 24px; font-weight: 700;">${iocType.name}</h2>`;
    content += `</div>`;

    content += `<div class="ioc-card-content" style="padding: 0 20px;">`;
    content += `</div></div>`;

    // Add fields based on IOC type with clean data structure
    // Canvas Card display
    iocType.fields.forEach(field => {
      const displayField = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      if (field === 'value' || field === 'rule_name' || field === 'process_name' || field === 'pattern' || field === 'key_path' || field === 'command') {
        content += `\n${displayField}: \n\n`;
      } else if (field === 'time_of_event') {
        content += `Time of Event: ${timestamp}\n\n`;
      } else if (field === 'os_type' && iocTypeId === 'hostname') {
        content += `OS Type: ${osType || 'Unknown'}\n\n`;
      } else if (field === 'splunk_query') {
        content += `Splunk Query: \n\n`;
      } else if (field === 'tactic') {
        content += `MITRE Tactic: \n\n`;
      } else if (field === 'technique') {
        content += `MITRE Technique: \n\n`;
      } else {
        content += `${displayField}: \n\n`;
      }
    });

    return content;
  }

  onunload() {
    console.log('Unloading IOC Canvas Plugin');
  }
}

class IOCTypeSelectorModal extends Modal {
  constructor(app, iocTypes, onSelect) {
    super(app);
    this.iocTypes = iocTypes;
    this.onSelect = onSelect;
  }

  onOpen() {
    const { contentEl } = this;

    // Full width modal for better display
    this.modalEl.style.maxWidth = '1200px';
    this.modalEl.style.width = '90vw';

    contentEl.createEl('h2', { text: 'Select IOC Type' });

    const container = contentEl.createDiv('ioc-type-container');
    // NOW 3 COLUMNS INSTEAD OF 1
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(3, 1fr)';
    container.style.gap = '16px';
    container.style.marginTop = '20px';

    Object.keys(this.iocTypes).forEach(iocTypeId => {
      const iocType = this.iocTypes[iocTypeId];
      const button = container.createEl('button', {
        cls: 'ioc-type-button'
      });

      // Add SVG icon and text to button
      const iconContainer = button.createDiv('ioc-button-icon');
      iconContainer.innerHTML = iocType.svg;

      const textContainer = button.createDiv('ioc-button-text');
      textContainer.textContent = iocType.name;

      button.style.borderLeft = `4px solid ${iocType.color}`;
      button.style.display = 'flex';
      button.style.alignItems = 'center';
      button.style.gap = '16px';
      button.style.padding = '20px';
      button.style.minHeight = '80px';

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

  showOSSelector(iocTypeId) {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Select Operating System' });
    contentEl.createEl('p', { text: 'Choose the operating system for this hostname:' });

    const container = contentEl.createDiv('os-selector-container');
    const iocType = this.iocTypes[iocTypeId];

    Object.keys(iocType.os_icons).forEach(osType => {
      const osButton = container.createEl('button', {
        cls: 'os-type-button'
      });

      // Add OS icon
      const iconContainer = osButton.createDiv('os-button-icon');
      iconContainer.innerHTML = iocType.os_icons[osType];

      const textContainer = osButton.createDiv('os-button-text');
      textContainer.textContent = osType.charAt(0).toUpperCase() + osType.slice(1);

      osButton.style.display = 'flex';
      osButton.style.alignItems = 'center';
      osButton.style.gap = '16px';
      osButton.style.margin = '8px 0';
      osButton.style.padding = '16px 20px';
      osButton.style.borderRadius = '8px';
      osButton.style.border = '1px solid var(--background-modifier-border)';
      osButton.style.background = 'var(--background-primary)';
      osButton.style.cursor = 'pointer';

      osButton.addEventListener('click', () => {
        this.onSelect(iocTypeId, osType);
        this.close();
      });

      osButton.addEventListener('mouseover', () => {
        osButton.style.background = 'var(--background-modifier-hover)';
      });

      osButton.addEventListener('mouseout', () => {
        osButton.style.background = 'var(--background-primary)';
      });
    });

    // Add back button
    const backButton = contentEl.createEl('button', {
      text: '← Back to IOC Types',
      cls: 'back-button'
    });
    backButton.style.marginTop = '16px';
    backButton.addEventListener('click', () => {
      contentEl.empty();
      this.onOpen();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// Enhanced timeline modal with proper HTML parsing
class FullScreenTimelineModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.activeTab = 'time';
    // Track collapsed state for each chain
    this.collapsedChains = new Set();
  }

  onOpen() {
    const { contentEl } = this;

    // MAKE MODAL FULL SCREEN
    this.modalEl.style.maxWidth = '95vw';
    this.modalEl.style.maxHeight = '95vh';
    this.modalEl.style.width = '95vw';
    this.modalEl.style.height = '95vh';
    this.modalEl.style.margin = '2.5vh auto';

    // Modal header
    const headerContainer = contentEl.createDiv('timeline-modal-header');
    headerContainer.style.marginBottom = '20px';
    headerContainer.style.borderBottom = '2px solid var(--background-modifier-border)';
    headerContainer.style.paddingBottom = '16px';

    const title = headerContainer.createEl('h2', { text: '🕐 Attack Timeline Analysis - Full Screen View' });
    title.style.margin = '0 0 16px 0';
    title.style.fontSize = '28px';
    title.style.textAlign = 'center';

    // Tab buttons
    const tabContainer = headerContainer.createDiv('timeline-tabs');
    tabContainer.style.display = 'flex';
    tabContainer.style.gap = '8px';
    tabContainer.style.justifyContent = 'center';
    tabContainer.style.marginTop = '16px';

    const timeTab = tabContainer.createEl('button', { text: '🕒 Time Timeline' });
    timeTab.className = 'timeline-tab-button';
    timeTab.style.padding = '12px 24px';
    timeTab.style.borderRadius = '8px';
    timeTab.style.border = 'none';
    timeTab.style.cursor = 'pointer';
    timeTab.style.fontSize = '16px';
    timeTab.style.fontWeight = '600';

    const linkTab = tabContainer.createEl('button', { text: '🔗 Link Timeline' });
    linkTab.className = 'timeline-tab-button';
    linkTab.style.padding = '12px 24px';
    linkTab.style.borderRadius = '8px';
    linkTab.style.border = 'none';
    linkTab.style.cursor = 'pointer';
    linkTab.style.fontSize = '16px';
    linkTab.style.fontWeight = '600';

    // Set initial active states
    this.updateTabStyles(timeTab, linkTab);

    // Tab event listeners
    timeTab.addEventListener('click', () => {
      this.activeTab = 'time';
      this.updateTabStyles(timeTab, linkTab);
      this.renderTabContent(contentEl);
    });

    linkTab.addEventListener('click', () => {
      this.activeTab = 'link';
      this.updateTabStyles(timeTab, linkTab);
      this.renderTabContent(contentEl);
    });

    // Content area
    this.renderTabContent(contentEl);
  }

  updateTabStyles(timeTab, linkTab) {
    // Reset both tabs
    timeTab.style.background = this.activeTab === 'time' ? 'var(--interactive-accent)' : 'var(--background-secondary)';
    timeTab.style.color = this.activeTab === 'time' ? 'var(--text-on-accent)' : 'var(--text-normal)';

    linkTab.style.background = this.activeTab === 'link' ? 'var(--interactive-accent)' : 'var(--background-secondary)';
    linkTab.style.color = this.activeTab === 'link' ? 'var(--text-on-accent)' : 'var(--text-normal)';
  }

  renderTabContent(contentEl) {
    // Remove existing content area if it exists
    const existingContent = contentEl.querySelector('.timeline-tab-content');
    if (existingContent) {
      existingContent.remove();
    }

    const contentArea = contentEl.createDiv('timeline-tab-content');
    contentArea.style.marginTop = '24px';
    contentArea.style.height = 'calc(95vh - 180px)'; // Full screen height minus header
    contentArea.style.overflowY = 'auto';

    if (this.activeTab === 'time') {
      this.renderEnhancedTimeTimeline(contentArea);
    } else {
      this.renderEnhancedTreeLinkTimeline(contentArea);
    }
  }

  // Enhanced timeline with proper HTML parsing
  renderEnhancedTimeTimeline(container) {
    // Get all IOC cards from active canvas
    const iocData = this.extractFixedIOCData();

    if (iocData.length === 0) {
      container.createEl('p', {
        text: 'No IOC cards found in the current canvas. Create some IOC cards first to see the timeline.',
        cls: 'timeline-empty-message'
      });
      return;
    }

    // Sort IOCs by time
    iocData.sort((a, b) => new Date(a.time) - new Date(b.time));

    const timelineContainer = container.createDiv('timeline-container');
    timelineContainer.style.height = '100%';
    timelineContainer.style.overflowY = 'auto';
    timelineContainer.style.padding = '20px';

    iocData.forEach((ioc, index) => {
      const timelineItem = timelineContainer.createDiv('timeline-item');
      timelineItem.style.display = 'flex';
      timelineItem.style.alignItems = 'flex-start';
      timelineItem.style.gap = '16px';
      timelineItem.style.padding = '16px';
      timelineItem.style.borderRadius = '10px';
      timelineItem.style.marginBottom = '12px';
      timelineItem.style.background = 'var(--background-secondary)';
      timelineItem.style.border = `2px solid ${ioc.color}`;
      timelineItem.style.position = 'relative';
      timelineItem.style.maxWidth = '600px';
      timelineItem.style.marginLeft = 'auto';
      timelineItem.style.marginRight = 'auto';

      // Timeline connector
      if (index < iocData.length - 1) {
        const connector = timelineItem.createDiv('timeline-connector');
        connector.style.position = 'absolute';
        connector.style.left = '32px';
        connector.style.top = '100%';
        connector.style.width = '3px';
        connector.style.height = '20px';
        connector.style.background = 'var(--text-muted)';
        connector.style.zIndex = '1';
      }

      // IOC icon
      const iconContainer = timelineItem.createDiv('timeline-icon');
      iconContainer.innerHTML = ioc.icon;
      iconContainer.style.flexShrink = '0';
      iconContainer.style.width = '40px';
      iconContainer.style.height = '40px';

      // IOC details
      const detailsContainer = timelineItem.createDiv('timeline-details');
      detailsContainer.style.flex = '1';

      const titleEl = detailsContainer.createEl('h3', { text: ioc.type });
      titleEl.style.margin = '0 0 10px 0';
      titleEl.style.color = ioc.color;
      titleEl.style.fontSize = '18px';
      titleEl.style.fontWeight = '700';

      // ALWAYS SHOW: Value, Time, Splunk Query (if present)
      // Display of the fields values in the timeline
      if (ioc.value) {
        const valueEl = detailsContainer.createEl('p', { text: `Value: ${ioc.value}\n` });
        valueEl.style.margin = '0 0 6px 0';
        valueEl.style.fontSize = '14px';
        valueEl.style.fontFamily = 'var(--font-monospace)';
        valueEl.style.fontWeight = '600';
      }

      const timeEl = detailsContainer.createEl('p', { text: `Time: ${ioc.time}\n` });
      timeEl.style.margin = '0 0 6px 0';
      timeEl.style.fontSize = '13px';
      timeEl.style.color = 'var(--text-muted)';
      timeEl.style.fontWeight = '500';

      console.log('ioc.splunkQuery ', ioc.splunkQuery)
      if (ioc.splunkQuery && ioc.splunkQuery.trim()) {
        const splunkContainer = detailsContainer.createEl('p');
        splunkContainer.style.margin = '0 0 6px 0';
        splunkContainer.style.fontSize = '13px';

        const splunkLabel = splunkContainer.createEl('span', { text: 'Splunk Query: ' });
        splunkLabel.style.color = 'var(--text-accent)';

        // Make splunk query clickable
        const splunkLink = splunkContainer.createEl('a', { text: ioc.splunkQuery + '\n' });
        splunkLink.style.color = 'var(--interactive-accent)';
        splunkLink.style.cursor = 'pointer';
        splunkLink.style.textDecoration = 'underline';
        splunkLink.style.fontSize = '12px';
        splunkLink.style.fontFamily = 'var(--font-monospace)';
        splunkLink.addEventListener('click', () => {
          navigator.clipboard.writeText(ioc.splunkQuery);
          new Notice('Splunk query copied to clipboard');
        });
      }

      // Additional fields if available
      if (ioc.tactic) {
        const tacticEl = detailsContainer.createEl('p', { text: `Tactic: ${ioc.tactic}\n` });
        tacticEl.style.margin = '4px 0 0 0';
        tacticEl.style.fontSize = '12px';
        tacticEl.style.color = 'var(--text-accent)';
      }

      if (ioc.technique) {
        const techniqueEl = detailsContainer.createEl('p', { text: `Technique: ${ioc.technique}` });
        techniqueEl.style.margin = '3px 0 0 0';
        techniqueEl.style.fontSize = '12px';
        techniqueEl.style.color = 'var(--text-accent)';
      }
    });

  }

  // Enhanced tree timeline with proper parsing
  renderEnhancedTreeLinkTimeline(container) {
    console.log('🔍 Starting enhanced tree-like link timeline analysis...');
    const linkData = this.extractEnhancedLinkData();
    console.log('📊 Final enhanced link data:', linkData);

    if (linkData.chains.length === 0 && linkData.isolatedNodes.length === 0) {
      const emptyMessage = container.createEl('div', {
        cls: 'timeline-empty-message'
      });
      emptyMessage.innerHTML = `
                <h3>🔗 Link Timeline Analysis</h3>
                <p><strong>No connections found between IOC cards.</strong></p>
                <div style="text-align: left; max-width: 600px; margin: 20px auto; padding: 30px; background: var(--background-secondary); border-radius: 12px;">
                    <h4>📊 Debug Information:</h4>
                    <ul style="font-size: 16px; line-height: 1.6;">
                        <li><strong>Canvas Found:</strong> ${linkData.canvasFound ? '✅ Yes' : '❌ No'}</li>
                        <li><strong>Total Nodes:</strong> ${linkData.totalNodes || 0}</li>
                        <li><strong>Total Edges:</strong> ${linkData.totalEdges || 0}</li>
                        <li><strong>IOC Nodes:</strong> ${linkData.iocNodes || 0}</li>
                        <li><strong>Valid Connections:</strong> ${linkData.validConnections || 0}</li>
                        <li><strong>Source Nodes:</strong> ${linkData.sourceNodes || 0}</li>
                    </ul>
                    <h4>🔧 How to Create Links:</h4>
                    <ol style="font-size: 16px; line-height: 1.8;">
                        <li>Create 2+ IOC cards using the shield button</li>
                        <li><strong>Draw arrows</strong> by dragging from the <strong>edge</strong> of one card to another</li>
                        <li>Ensure arrows are between IOC cards (not other elements)</li>
                        <li>Click this timeline button again to see connections</li>
                    </ol>
                </div>
            `;
      return;
    }

    // TREE STRUCTURE LAYOUT
    const treeContainer = container.createDiv('tree-timeline-container');
    treeContainer.style.padding = '30px';
    treeContainer.style.height = '100%';
    treeContainer.style.overflowY = 'auto';
    treeContainer.style.background = 'var(--background-primary)';

    // RENDER EACH CHAIN AS A COLLAPSIBLE TREE WITH ENHANCED DETAILS
    if (linkData.chains.length > 0) {
      linkData.chains.forEach((chain, chainIndex) => {
        this.renderEnhancedTreeChain(treeContainer, chain, chainIndex);
      });
    }
  }

  // Enhanced tree chain with proper parsing
  renderEnhancedTreeChain(container, chain, chainIndex) {
    const chainId = `chain-${chainIndex}`;
    const isCollapsed = this.collapsedChains.has(chainId);

    // Chain header with collapse/expand triangle
    const chainHeader = container.createDiv('tree-chain-header');
    chainHeader.style.display = 'flex';
    chainHeader.style.alignItems = 'center';
    chainHeader.style.gap = '10px';
    chainHeader.style.padding = '14px 18px';
    chainHeader.style.marginBottom = '14px';
    chainHeader.style.background = 'var(--background-secondary)';
    chainHeader.style.borderRadius = '6px';
    chainHeader.style.border = '2px solid var(--interactive-accent)';
    chainHeader.style.cursor = 'pointer';
    chainHeader.style.fontSize = '16px';
    chainHeader.style.fontWeight = '700';
    chainHeader.style.color = 'var(--interactive-accent)';
    chainHeader.style.transition = 'all 0.2s ease';
    chainHeader.style.maxWidth = '500px';

    // Collapse/Expand triangle
    const triangle = chainHeader.createDiv('chain-triangle');
    triangle.textContent = isCollapsed ? '▶' : '▼';
    triangle.style.fontSize = '12px';
    triangle.style.color = 'var(--interactive-accent)';
    triangle.style.transition = 'transform 0.2s ease';
    triangle.style.userSelect = 'none';

    // Chain title
    const chainTitle = chainHeader.createDiv('chain-title');
    chainTitle.textContent = `Chain${chainIndex + 1}:`;
    chainTitle.style.flex = '1';

    // Toggle collapse/expand on click
    chainHeader.addEventListener('click', () => {
      if (this.collapsedChains.has(chainId)) {
        this.collapsedChains.delete(chainId);
        triangle.textContent = '▼';
        chainContent.style.display = 'block';
      } else {
        this.collapsedChains.add(chainId);
        triangle.textContent = '▶';
        chainContent.style.display = 'none';
      }
    });

    chainHeader.addEventListener('mouseover', () => {
      chainHeader.style.background = 'var(--background-modifier-hover)';
    });

    chainHeader.addEventListener('mouseout', () => {
      chainHeader.style.background = 'var(--background-secondary)';
    });

    // Chain content (collapsible)
    const chainContent = container.createDiv('tree-chain-content');
    chainContent.style.display = isCollapsed ? 'none' : 'block';
    chainContent.style.marginLeft = '28px';
    chainContent.style.marginBottom = '30px';
    chainContent.style.paddingLeft = '16px';
    chainContent.style.borderLeft = '2px solid var(--background-modifier-border)';

    // Render chain nodes in tree structure with enhanced details
    chain.forEach((node, nodeIndex) => {
      this.renderEnhancedTreeNode(chainContent, node, nodeIndex, chain.length);
    });
  }

  // Enhanced tree node with proper parsing
  renderEnhancedTreeNode(container, node, nodeIndex, totalNodes) {
    const nodeContainer = container.createDiv('tree-node');
    nodeContainer.style.display = 'block';
    nodeContainer.style.padding = '10px 14px';
    nodeContainer.style.marginBottom = '6px';
    nodeContainer.style.background = 'var(--background-primary)';
    nodeContainer.style.borderRadius = '6px';
    nodeContainer.style.border = `2px solid ${node.color || 'var(--background-modifier-border)'}`;
    nodeContainer.style.position = 'relative';
    nodeContainer.style.transition = 'all 0.2s ease';
    nodeContainer.style.maxWidth = '380px';

    // Tree connector lines
    if (nodeIndex < totalNodes - 1) {
      const connector = nodeContainer.createDiv('tree-connector');
      connector.style.position = 'absolute';
      connector.style.left = '18px';
      connector.style.top = '100%';
      connector.style.width = '2px';
      connector.style.height = '10px';
      connector.style.background = 'var(--text-muted)';
      connector.style.zIndex = '1';
    }

    // Node header with icon and type
    const nodeHeader = nodeContainer.createDiv('tree-node-header');
    nodeHeader.style.display = 'flex';
    nodeHeader.style.alignItems = 'center';
    nodeHeader.style.gap = '10px';
    nodeHeader.style.marginBottom = '6px';

    // Node icon
    const iconDiv = nodeHeader.createDiv('tree-node-icon');
    iconDiv.innerHTML = node.icon || '📄';
    iconDiv.style.width = '22px';
    iconDiv.style.height = '22px';
    iconDiv.style.flexShrink = '0';
    iconDiv.style.display = 'flex';
    iconDiv.style.alignItems = 'center';
    iconDiv.style.justifyContent = 'center';

    // Node type
    const nodeType = nodeHeader.createDiv('tree-node-type');
    nodeType.textContent = node.type || 'Unknown IOC';
    nodeType.style.fontWeight = '600';
    nodeType.style.fontSize = '14px';
    nodeType.style.color = node.color || 'var(--text-normal)';

    // Node details
    const nodeDetails = nodeContainer.createDiv('tree-node-details');
    nodeDetails.style.marginLeft = '32px';
    nodeDetails.style.fontSize = '12px';

    // ALWAYS SHOW: Value, Time, Splunk Query (if present)
    if (node.value) {
      const valueEl = nodeDetails.createEl('div', { text: `Value: ${node.value}` });
      valueEl.style.fontFamily = 'var(--font-monospace)';
      valueEl.style.fontWeight = '600';
      valueEl.style.marginBottom = '3px';
      valueEl.style.wordBreak = 'break-all';
    }

    if (node.time) {
      const timeEl = nodeDetails.createEl('div', { text: `Time: ${node.time}` });
      timeEl.style.color = 'var(--text-muted)';
      timeEl.style.marginBottom = '3px';
    }

    if (node.splunkQuery && node.splunkQuery.trim()) {
      const splunkContainer = nodeDetails.createEl('div');
      splunkContainer.style.marginBottom = '3px';

      const splunkLabel = splunkContainer.createEl('span', { text: 'Splunk: ' });
      splunkLabel.style.color = 'var(--text-accent)';

      // Make splunk query clickable
      const splunkLink = splunkContainer.createEl('a', { text: node.splunkQuery });
      splunkLink.style.color = 'var(--interactive-accent)';
      splunkLink.style.cursor = 'pointer';
      splunkLink.style.textDecoration = 'underline';
      splunkLink.style.fontSize = '11px';
      splunkLink.style.fontFamily = 'var(--font-monospace)';
      splunkLink.style.wordBreak = 'break-all';
      splunkLink.addEventListener('click', () => {
        navigator.clipboard.writeText(node.splunkQuery);
        new Notice('Splunk query copied to clipboard');
      });
    }

    // Hover effects
    nodeContainer.addEventListener('mouseover', () => {
      nodeContainer.style.background = 'var(--background-modifier-hover)';
      nodeContainer.style.transform = 'translateX(3px)';
    });

    nodeContainer.addEventListener('mouseout', () => {
      nodeContainer.style.background = 'var(--background-primary)';
      nodeContainer.style.transform = 'translateX(0)';
    });
  }

  // Enhanced IOC data extraction with proper HTML parsing
  extractFixedIOCData() {
    const activeLeaf = this.app.workspace.activeLeaf;
    if (!activeLeaf || !activeLeaf.view || activeLeaf.view.getViewType() !== 'canvas') {
      return [];
    }

    const canvasView = activeLeaf.view;
    const canvas = canvasView.canvas;
    if (!canvas || !canvas.nodes) {
      return [];
    }

    const iocData = [];

    canvas.nodes.forEach(node => {
      if (node.text) {
        const parsedData = this.parseFixedIOCNode(node);
        if (parsedData.type) {
          iocData.push(parsedData);
        }
      }
    });

    return iocData;
  }

  // IOC node parsing that handles HTML properly + Fields extractions for timeline
  parseFixedIOCNode(node) {
    if (!node.text) {
      return { type: '', value: '', time: '', splunkQuery: '', icon: '', color: node.color || '#333' };
    }

    const text = node.text;
    console.log(`🔍 Parsing node ${node.id} text:`, text.substring(0, 200));

    let iocType = '';
    let value = '';
    let time = '';
    let splunkQuery = '';
    let tactic = '';
    let technique = '';
    let icon = '';
    let color = node.color || '#333';

    // IOC TYPE DETECTION - Handle both HTML and text formats
    const iocTypePatterns = [
      { pattern: /<h2[^>]*>([^<]*IP Address[^<]*)<\/h2>/i, type: 'IP Address' },
      { pattern: /<h2[^>]*>([^<]*Domain Name[^<]*)<\/h2>/i, type: 'Domain Name' },
      { pattern: /<h2[^>]*>([^<]*File Hash[^<]*)<\/h2>/i, type: 'File Hash' },
      { pattern: /<h2[^>]*>([^<]*URL[^<]*)<\/h2>/i, type: 'URL' },
      { pattern: /<h2[^>]*>([^<]*Email Address[^<]*)<\/h2>/i, type: 'Email Address' },
      { pattern: /<h2[^>]*>([^<]*Hostname[^<]*)<\/h2>/i, type: 'Hostname' },
      { pattern: /<h2[^>]*>([^<]*YARA Rule[^<]*)<\/h2>/i, type: 'YARA Rule' },
      { pattern: /<h2[^>]*>([^<]*Sigma Rule[^<]*)<\/h2>/i, type: 'Sigma Rule' },
      { pattern: /<h2[^>]*>([^<]*Registry Key[^<]*)<\/h2>/i, type: 'Registry Key' },
      { pattern: /<h2[^>]*>([^<]*Process Name[^<]*)<\/h2>/i, type: 'Process Name' },
      { pattern: /<h2[^>]*>([^<]*Network Traffic[^<]*)<\/h2>/i, type: 'Network Traffic' },
      { pattern: /<h2[^>]*>([^<]*Command Line[^<]*)<\/h2>/i, type: 'Command Line' },
      // Fallback to plain text
      { pattern: /IP Address/i, type: 'IP Address' },
      { pattern: /Domain Name/i, type: 'Domain Name' },
      { pattern: /File Hash/i, type: 'File Hash' },
      { pattern: /\bURL\b/i, type: 'URL' },
      { pattern: /Email Address/i, type: 'Email Address' },
      { pattern: /Hostname/i, type: 'Hostname' },
      { pattern: /YARA Rule/i, type: 'YARA Rule' },
      { pattern: /Sigma Rule/i, type: 'Sigma Rule' },
      { pattern: /Registry Key/i, type: 'Registry Key' },
      { pattern: /Process Name/i, type: 'Process Name' },
      { pattern: /Network Traffic/i, type: 'Network Traffic' },
      { pattern: /Command Line/i, type: 'Command Line' }
    ];

    for (const { pattern, type } of iocTypePatterns) {
      if (pattern.test(text)) {
        iocType = type;
        console.log(`✅ IOC type detected: ${iocType}`);
        break;
      }
    }

    if (!iocType) {
      console.log(`⚠️ No IOC type detected in node ${node.id}`);
      return { type: '', value: '', time: '', splunkQuery: '', icon: '', color };
    }

    // Enhanced value extraction that handles HTML and placeholders
    const valuePatterns = [
      // Look for actual filled values first
      /\*\*Value:\*\*\s*([^\n<\[]+)/i,
      /\*\*Rule Name:\*\*\s*([^\n<\[]+)/i,
      /\*\*Process Name:\*\*\s*([^\n<\[]+)/i,
      /\*\*Command:\*\*\s*([^\n<\[]+)/i,
      /\*\*Key Path:\*\*\s*([^\n<\[]+)/i,
      /\*\*Pattern:\*\*\s*([^\n<\[]+)/i,
      // Look in next lines after field labels
      /Value:\s*\n\s*([^\n<\[\*]+)/i,
      /Rule Name:\s*\n\s*([^\n<\[\*]+)/i,
      /Process Name:\s*\n\s*([^\n<\[\*]+)/i,
      /Command:\s*\n\s*([^\n<\[\*]+)/i
    ];

    for (const pattern of valuePatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].trim() && !match[1].includes('FIELD_VALUE')) {
        value = match[1].trim();
        console.log(`✅ Value extracted: "${value}"`);
        break;
      }
    }

    // Time extraction that handles HTML and different formats  
    const timePatterns = [
      /\*\*Time of Event:\*\*\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i,
      /Time of Event:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i,
      /Time:\s*\*\*\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i,
      /\*\*\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*\*\*/i
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        time = match[1].trim();
        console.log(`✅ Time extracted: "${time}"`);
        break;
      }
    }

    // Splunk query extraction that handles HTML and placeholders
    const splunkPatterns = [
      // Look for the query in the same line
      /\*{0,2}Splunk Query:\*{0,2}\s*((?:(?!MITRE|\n).)+)/i
    ];

    for (const pattern of splunkPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].trim() && !match[1].includes('FIELD_VALUE') && !match[1].includes('</div>')) {
        splunkQuery = match[1].trim();
        console.log(`✅ Splunk query extracted: "${splunkQuery}"`);
        break;
      }
    }

    // Tactic and technique extraction
    const tacticMatch = text.match(/\*\*(?:MITRE )?Tactic:\*\*\s*([^\n<\[]+)/i);
    if (tacticMatch && tacticMatch[1] && !tacticMatch[1].includes('FIELD_VALUE')) {
      tactic = tacticMatch[1].trim();
    }

    const techniqueMatch = text.match(/\*\*(?:MITRE )?Technique:\*\*\s*([^\n<\[]+)/i);
    if (techniqueMatch && techniqueMatch[1] && !techniqueMatch[1].includes('FIELD_VALUE')) {
      technique = techniqueMatch[1].trim();
    }

    // Get icon and color for this IOC type
    Object.keys(this.plugin.iocTypes).forEach(key => {
      if (this.plugin.iocTypes[key].name === iocType) {
        icon = this.plugin.iocTypes[key].svg;
        color = this.plugin.iocTypes[key].color;
      }
    });

    const result = {
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

    console.log(`📊 Final parsed result:`, result);
    return result;
  }

  // Enhanced link data extraction with proper parsing
  extractEnhancedLinkData() {
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

    const canvasView = activeLeaf.view;
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
    let iocNodeCount = 0;

    nodes.forEach(node => {
      if (node.text) {
        const nodeData = this.parseFixedIOCNode(node);
        if (nodeData.type) {
          iocNodeMap.set(node.id, nodeData);
          iocNodeCount++;
          console.log(`✅ IOC node identified: ${node.id} - ${nodeData.type}`);
        }
      }
    });

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

    // Build connection maps
    const incomingConnections = new Map();
    const outgoingConnections = new Map();
    let validConnectionCount = 0;

    // Initialize connection maps for all IOC nodes
    iocNodeMap.forEach((nodeData, nodeId) => {
      incomingConnections.set(nodeId, []);
      outgoingConnections.set(nodeId, []);
    });

    // Process edges
    edges.forEach((edge, edgeIndex) => {
      const possibleFromProps = ['fromNode', 'from', 'source', 'sourceId', 'fromId'];
      const possibleToProps = ['toNode', 'to', 'target', 'targetId', 'toId'];

      let fromId = null;
      let toId = null;

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

      if (!fromId || !toId) {
        return;
      }

      // Only process if both nodes are IOC nodes
      if (iocNodeMap.has(fromId) && iocNodeMap.has(toId)) {
        outgoingConnections.get(fromId).push(toId);
        incomingConnections.get(toId).push(fromId);
        validConnectionCount++;
        console.log(`✅ Valid IOC connection: ${fromId} → ${toId}`);
      }
    });

    console.log(`📊 Valid connections processed: ${validConnectionCount}`);

    // Find source nodes
    const sourceNodeIds = [];
    iocNodeMap.forEach((nodeData, nodeId) => {
      const hasOutgoing = outgoingConnections.get(nodeId).length > 0;
      const hasIncoming = incomingConnections.get(nodeId).length > 0;

      if (hasOutgoing && !hasIncoming) {
        sourceNodeIds.push(nodeId);
        console.log(`🎯 Source node identified: ${nodeId}`);
      }
    });

    console.log(`📊 Source nodes found: ${sourceNodeIds.length}`);

    // Build enhanced attack chains with multi-connection support
    const chains = [];
    const visited = new Set();

    sourceNodeIds.forEach(sourceId => {
      if (!visited.has(sourceId)) {
        const sourceOutgoing = outgoingConnections.get(sourceId) || [];

        if (sourceOutgoing.length === 1) {
          // Single chain from this source
          const chain = this.buildEnhancedAttackChain(sourceId, outgoingConnections, iocNodeMap, new Set());
          if (chain.length > 1) {
            chains.push(chain);
          }
        } else if (sourceOutgoing.length > 1) {
          // Multiple chains from this source
          sourceOutgoing.forEach(targetId => {
            const partialChain = this.buildEnhancedAttackChain(targetId, outgoingConnections, iocNodeMap, new Set());
            const fullChain = [iocNodeMap.get(sourceId), ...partialChain];
            if (fullChain.length > 1) {
              chains.push(fullChain);
            }
          });
        }

        visited.add(sourceId);
      }
    });

    const isolatedNodes = sourceNodeIds.map(nodeId => iocNodeMap.get(nodeId)).filter(Boolean);

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

  // Enhanced attack chain building
  buildEnhancedAttackChain(startNodeId, outgoingConnections, nodeMap, visited, currentChain = []) {
    if (visited.has(startNodeId)) {
      return currentChain;
    }

    visited.add(startNodeId);
    const nodeData = nodeMap.get(startNodeId);
    if (nodeData) {
      currentChain.push(nodeData);
    }

    const outgoing = outgoingConnections.get(startNodeId) || [];

    if (outgoing.length > 0) {
      const nextNodeId = outgoing[0];
      return this.buildEnhancedAttackChain(nextNodeId, outgoingConnections, nodeMap, visited, currentChain);
    }

    return currentChain;
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class IOCCanvasSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'IOC Canvas Plugin Settings' });

    new Setting(containerEl)
      .setName('Default card size')
      .setDesc('Set the default size for IOC cards')
      .addDropdown(dropdown => dropdown
        .addOption('small', 'Small')
        .addOption('medium', 'Medium')
        .addOption('large', 'Large')
        .setValue('medium')
        .onChange(async (value) => {
          // Save setting logic here
        })
      );

    new Setting(containerEl)
      .setName('Show timeline button')
      .setDesc('Display timeline button in canvas toolbar')
      .addToggle(toggle => toggle
        .setValue(true)
        .onChange(async (value) => {
          // Save setting logic here
        })
      );
  }
}

module.exports = IOCCanvasPlugin;
