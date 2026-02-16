/**
 * TimelineCopyExport.ts - Copy-to-clipboard text generation for timeline data
 *
 * Generates tab-separated text from IOC timeline data for clipboard export.
 * Format: Time\tTactic\tTechnique\tValue (one line per card).
 */

import { IOCNodeData } from '../types/IOCNodeData';

/**
 * Generate tab-separated text from IOC data for clipboard copy.
 *
 * Each line contains: time, tactic, technique, value separated by tabs.
 * Empty fields are represented as empty strings.
 * Data should be pre-sorted chronologically by the caller.
 *
 * @param iocData - Array of parsed IOC node data, sorted chronologically
 * @param startTime - Optional start timestamp for filtering (inclusive)
 * @param endTime - Optional end timestamp for filtering (inclusive)
 * @returns Tab-separated text string ready for clipboard
 */
export function generateCopyText(iocData: IOCNodeData[], startTime?: number, endTime?: number): string {
    // Filter by time range if provided
    let filteredData = iocData;
    if (startTime !== undefined && endTime !== undefined) {
        filteredData = iocData.filter(ioc => {
            const ts = new Date(ioc.time).getTime();
            return !isNaN(ts) && ts >= startTime && ts <= endTime;
        });
    }

    const header = 'Time\tTactic\tTechnique\tValue';
    const lines = filteredData.map(ioc =>
        `${ioc.time || ''}\t${ioc.tactic || ''}\t${ioc.technique || ''}\t${ioc.value || ''}`
    );
    return [header, ...lines].join('\n');
}
