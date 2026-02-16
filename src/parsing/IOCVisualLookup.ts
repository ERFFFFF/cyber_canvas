/**
 * IOCVisualLookup.ts - IOC type visual metadata lookup
 *
 * Resolves the SVG icon and hex color for a detected IOC type name by
 * searching the IOC_TYPES registry. Used by IOCParser after type detection
 * to attach display metadata to parsed node data.
 */

import { IOC_TYPES } from '../types/IOCCardsTypes';

/**
 * Look up the SVG icon and hex color for a given IOC type name.
 *
 * Searches the IOC_TYPES constant (from IOCCardsTypes.ts) by comparing
 * each entry's `name` property against the detected type string.
 * Returns defaults if no match is found (empty icon, fallback color).
 *
 * @param iocType - Detected IOC type name (e.g., "IP Address")
 * @param fallbackColor - Color to use if the type is not found in IOC_TYPES
 * @returns Object with `icon` (SVG string) and `color` (hex string)
 */
export function lookupTypeVisuals(iocType: string, fallbackColor: string): { icon: string; color: string } {
    let icon = '';
    let color = fallbackColor;

    if (IOC_TYPES && typeof IOC_TYPES === 'object') {
        for (const key of Object.keys(IOC_TYPES)) {
            if (IOC_TYPES[key].name === iocType) {
                icon = IOC_TYPES[key].svg;
                color = IOC_TYPES[key].color;
                break;
            }
        }
    }

    return { icon, color };
}
