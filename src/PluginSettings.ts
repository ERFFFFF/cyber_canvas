import { App, PluginSettingTab, Setting } from 'obsidian';
import IOCCanvasPlugin from './main';

export class PluginSettings extends PluginSettingTab {
  plugin: IOCCanvasPlugin;

  constructor(app: App, plugin: IOCCanvasPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
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
        .setValue(this.plugin.settings?.cardSize || 'medium')
        .onChange(async (value: string) => {
          this.plugin.settings.cardSize = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Show timeline button')
      .setDesc('Display timeline button in canvas toolbar')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings?.showTimelineButton ?? true)
        .onChange(async (value: boolean) => {
          this.plugin.settings.showTimelineButton = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
