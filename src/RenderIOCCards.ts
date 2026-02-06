import { IOCField } from './IOCCardsTypes';

export class RenderIOCCards {
    static createCardContent(
        iocType: IOCField,
        iocTypeId: string,
        osType: string | null = null
    ): string {
        const now = new Date();
        const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

        // Get the appropriate icon
        let iconSvg = iocType.svg;
        if (iocTypeId === 'hostname' && osType && iocType.os_icons) {
            iconSvg = iocType.os_icons[osType as keyof typeof iocType.os_icons] || iocType.svg;
        }

        // Build beautiful HTML header matching the original format
        let content = `<div class="ioc-card-container"><div class="ioc-card-header" 
        style="display: flex; align-items: center; gap: 16px; margin-bottom: 30px; padding: 20px; 
        background: linear-gradient(135deg, ${iocType.color}22, transparent); 
        border-radius: 8px; border-bottom: 3px solid ${iocType.color};">
        <div class="ioc-icon" style="flex-shrink: 0;">${iconSvg}</div><h2 style="margin: 0; 
        color: ${iocType.color}; font-size: 24px; font-weight: 700;">${iocType.name}</h2></div>
        <div class="ioc-card-content" style="padding: 0 20px;"></div></div>\n`;

        // Add fields with labels
        iocType.fields.forEach((field: string) => {
            content += `\n**${field}:**\n` + '```\n\n```'+`\n`;
        });

        content += `**Time of Event:** ${timestamp}\n\n`;
        content += `**Splunk Query:** \n\n`;
        content += `**Mitre Tactic:** \n\n`;
        content += `**Mitre Technique:** \n\n`;

        return content;
    }
}
