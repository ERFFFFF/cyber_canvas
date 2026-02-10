/**
 * RenderIOCCards.ts - Generates the markdown content for new IOC canvas cards.
 *
 * Each card is a standard Obsidian canvas text node whose content is a mix of
 * HTML (for the styled header with inline SVG icon) and markdown (for the
 * analyst-editable fields). This hybrid format lets the canvas renderer display
 * a rich header while keeping the field values in plain markdown that the
 * timeline processors can parse with regex.
 *
 * Card structure:
 *   1. HTML header div -- gradient background, colored border, inline SVG + type name
 *   2. Type-specific fields -- each rendered as a bold label with inline value
 *   3. Fixed forensic fields -- Time of Event (auto-filled), Splunk Query,
 *      MITRE Tactic, and MITRE Technique (left blank for the analyst)
 */
import { IOCField } from './IOCCardsTypes';

export class RenderIOCCards {
    /**
     * Builds the full markdown+HTML string for a new IOC card.
     * @param iocType  - The IOCField definition from the type registry
     * @param iocTypeId - The snake_case key (needed to detect "hostname" special case)
     * @param osType   - If iocTypeId is "hostname", which OS variant was selected
     */
    static createCardContent(
        iocType: IOCField,
        iocTypeId: string,
        osType: string | null = null
    ): string {
        const now = new Date();
        const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

        // For hostname cards, swap in the OS-specific icon if the analyst picked one
        let iconSvg = iocType.svg;
        if (iocTypeId === 'hostname' && osType && iocType.os_icons) {
            iconSvg = iocType.os_icons[osType as keyof typeof iocType.os_icons] || iocType.svg;
        }

        // The HTML header uses inline styles so the card is self-contained -- no
        // external CSS needed for the header to render correctly inside Obsidian's
        // canvas markdown preview.
        let content = `<div class="ioc-card-container"><div class="ioc-card-header"
        style="display: flex; align-items: center; gap: 16px; margin-bottom: 30px; padding: 20px;
        background: linear-gradient(135deg, ${iocType.color}22, transparent);
        border-radius: 8px; border-bottom: 3px solid ${iocType.color};">
        <div class="ioc-icon" style="flex-shrink: 0;">${iconSvg}</div><h2 style="margin: 0;
        color: ${iocType.color}; font-size: 24px; font-weight: 700;">${iocType.name}</h2></div>
        <div class="ioc-card-content" style="padding: 0 20px;"></div></div>\n`;

        // Type-specific fields: field label with space for user to fill in values
        // No separators in template - users can type values directly after the label
        // Parser will extract content between field label and next field or metadata section
        iocType.fields.forEach((field: string) => {
            content += `${field}: \n\n\n\n`;
        });

        // Fixed forensic metadata fields appended to every card type.
        // "Time of Event" is pre-filled with the creation timestamp; the rest
        // are left blank for the analyst.
        content += `Time of Event: ${timestamp}\n\n`;
        content += `Splunk Query: \n\n`;
        content += `Mitre Tactic: \n\n`;
        content += `Mitre Technique: \n\n`;

        return content;
    }
}
