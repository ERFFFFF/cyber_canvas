/**
 * Global debug flag — controls console.debug() output across all modules.
 * Toggled at runtime via the plugin settings panel.
 */
export let DEBUG = false;

/** Update the debug flag at runtime. All importing modules see the new value immediately. */
export function setDebug(val: boolean): void {
    DEBUG = val;
}
