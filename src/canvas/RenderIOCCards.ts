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
import { IOCField } from '../types/IOCCardsTypes';

export class RenderIOCCards {
    /**
     * Builds the full markdown+HTML string for a new IOC card.
     * @param iocType  - The IOCField definition from the type registry
     * @param iocTypeId - The snake_case key (needed to detect "hostname" special case)
     * @param osType   - If iocTypeId is "hostname", which OS variant was selected
     * @param cardId   - Timestamp-based unique ID for the card (format: #YYYYMMDD-HHMM)
     * @param isChild  - If true, card gets [C] prefix; if false, gets [P] prefix
     */
    static createCardContent(
        iocType: IOCField,
        iocTypeId: string,
        osType: string | null = null,
        cardId: string = '',
        isChild: boolean = false
    ): string {
        const now = new Date();
        const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

        // For hostname cards, swap in the OS-specific icon if the analyst picked one
        let iconSvg = iocType.svg;
        if (iocTypeId === 'hostname' && osType && iocType.os_icons) {
            iconSvg = iocType.os_icons[osType as keyof typeof iocType.os_icons] || iocType.svg;
        }

        // Role badge: [P] for parent cards, [C] for child cards
        const roleLabel = isChild ? '[C]' : '[P]';
        const roleClass = isChild ? 'ioc-role-child' : 'ioc-role-parent';
        const roleBadge = `<span class="ioc-card-role ${roleClass}" style="font-size: 12px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">${roleLabel}</span>`;

        // The HTML header uses inline styles so the card is self-contained -- no
        // external CSS needed for the header to render correctly inside Obsidian's
        // canvas markdown preview.
        let content = `<div class="ioc-card-container"><div class="ioc-card-header"
        style="display: flex; align-items: center; gap: 16px; margin-bottom: 30px; padding: 20px;
        background: linear-gradient(135deg, ${iocType.color}22, transparent);
        border-radius: 8px; border-bottom: 3px solid ${iocType.color};">
        <div class="ioc-header-content" style="display: flex; align-items: center; gap: 16px; width: 100%;">
        <div class="ioc-icon" style="flex-shrink: 0;">${iconSvg}</div><h2 style="margin: 0;
        color: ${iocType.color}; font-size: 24px; font-weight: 700;">${roleBadge}${iocType.name}</h2>
        <span class="ioc-card-id" style="margin-left: auto; padding: 2px 8px; font-size: 11px; font-weight: 600; background: var(--background-modifier-border); color: var(--text-muted); border-radius: 4px; font-family: var(--font-monospace);">${cardId}</span>
        </div><!-- IOC_CARD_ID:${cardId} --></div></div>\n`;

        // Type-specific fields: field label with space for user to fill in values
        // Delimiters (------------) mark clear value boundaries for reliable parsing
        // Parser will extract content between field label and the delimiter
        iocType.fields.forEach((field: string) => {
            content += `${field}: \n\n\n------------\n`;
        });

        // Fixed forensic metadata fields appended to every card type.
        // "Time of Event" is pre-filled with the creation timestamp; the rest
        // are left blank for the analyst.
        // Delimiters ensure reliable value extraction even with multi-line content.
        content += `Time of Event: ${timestamp}\n\n\n------------\n`;
        content += `Splunk Query: \n\n\n------------\n`;
        content += `Mitre Tactic: \n\n\n------------\n`;
        content += `Mitre Technique: \n\n\n------------\n`;

        return content;
    }
}
