import { App, PluginSettingTab, Setting } from 'obsidian';
import IOCCanvasPlugin from '../main';
import { setDebug } from '../debug';

/**
 * Typed interface for all persisted plugin settings.
 * Obsidian serialises this to `data.json` inside the plugin directory.
 */
export interface IOCCanvasPluginSettings {
    /** Auto-fit all canvas card nodes to their content height. */
    displayFullCardHeight: boolean;
    /** Toggle runtime DEBUG flag for verbose console output. */
    enableDebugMode: boolean;
}

/**
 * Default settings values applied when the plugin loads for the first time
 * or when a setting has not yet been configured by the user.
 */
export const DEFAULT_SETTINGS: IOCCanvasPluginSettings = {
    displayFullCardHeight: false,
    enableDebugMode: false,
};

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
        containerEl.createEl('h2', { text: 'Cyber Canvas Settings' });

        // Toggle: auto-fit card nodes to their content height
        new Setting(containerEl)
            .setName('Display full card height')
            .setDesc('Auto-fit all IOC card nodes on the canvas to their content height.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.displayFullCardHeight)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.displayFullCardHeight = value;
                    await this.plugin.saveSettings();
                    this.plugin.applyFullCardHeight(value);
                })
            );

        // Toggle: enable verbose debug logging to browser console
        new Setting(containerEl)
            .setName('Enable debug mode')
            .setDesc('Print verbose debug messages to the browser console (F12).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableDebugMode)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.enableDebugMode = value;
                    await this.plugin.saveSettings();
                    setDebug(value);
                })
            );

        // Link: GitHub repository
        new Setting(containerEl)
            .setName('GitHub repository')
            .setDesc(createFragment(frag => {
                frag.createEl('a', {
                    text: 'ERFFFFF/cyber_canvas',
                    href: 'https://github.com/ERFFFFF/cyber_canvas',
                });
            }));
    }
}
