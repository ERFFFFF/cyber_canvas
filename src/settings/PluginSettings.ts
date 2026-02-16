import { App, PluginSettingTab, Setting } from 'obsidian';
import IOCCanvasPlugin from '../main';

/**
 * Default settings values applied when the plugin loads for the first time
 * or when a setting has not yet been configured by the user.
 */
export const DEFAULT_SETTINGS: IOCCanvasPluginSettings = {
  cardSize: 'medium',
  showTimelineButton: true,
};

/**
 * Typed interface for all persisted plugin settings.
 * Obsidian serialises this to `data.json` inside the plugin directory.
 */
export interface IOCCanvasPluginSettings {
  /** Default width preset for newly-created IOC cards ('small' | 'medium' | 'large'). */
  cardSize: string;
  /** Whether the floating timeline button is shown on canvas views. */
  showTimelineButton: boolean;
}

/**
 * Settings tab rendered in Obsidian's Settings -> Community Plugins section.
 * This is the single authoritative settings UI for the plugin.
 */
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

    // Card size dropdown - controls the default dimensions of new IOC cards
    new Setting(containerEl)
      .setName('Default card size')
      .setDesc('Set the default size for IOC cards')
      .addDropdown(dropdown => dropdown
        .addOption('small', 'Small')
        .addOption('medium', 'Medium')
        .addOption('large', 'Large')
        .setValue(this.plugin.settings.cardSize)
        .onChange(async (value: string) => {
          this.plugin.settings.cardSize = value;
          await this.plugin.saveSettings();
        })
      );

    // Timeline button toggle - hides or shows the floating clock button on canvas views
    new Setting(containerEl)
      .setName('Show timeline button')
      .setDesc('Display timeline button in canvas toolbar')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showTimelineButton)
        .onChange(async (value: boolean) => {
          this.plugin.settings.showTimelineButton = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
