import { App } from 'obsidian';
import { IOCCardsTypes, IOC_TYPES } from './IOCCardsTypes';

export class TimeTimelineProcessor {
    private app: App;
    private plugin: any;
    private IOCCardsTypes: IOCCardsTypes;

    constructor(app: App, plugin: any, IOCCardsTypes: IOCCardsTypes) {
        this.app = app;
        this.plugin = plugin;
        this.IOCCardsTypes = IOCCardsTypes;
    }

    extractFixedIOCData(): any[] {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (!activeLeaf || !activeLeaf.view || activeLeaf.view.getViewType() !== 'canvas') {
            return [];
        }

        const canvasView = activeLeaf.view as any;
        const canvas = canvasView.canvas;
        if (!canvas || !canvas.nodes) {
            return [];
        }

        const iocData: any[] = [];
        canvas.nodes.forEach((node: any) => {
            if (node.text) {
                const parsedData = this.parseFixedIOCNode(node);
                if (parsedData.type) {
                    iocData.push(parsedData);
                }
            }
        });
        return iocData;
    }

    private parseFixedIOCNode(node: any): any {
        if (!node.text) return { type: '', value: '', time: '', splunkQuery: '', icon: '', color: node.color || '#333' };

        const text = node.text;
        console.log(`📋 Parsing node ${node.id} text:`, text.substring(0, 200));

        let iocType = '';
        let value = '';
        let time = '';
        let splunkQuery = '';
        let tactic = '';
        let technique = '';
        let icon = '';
        let color = node.color || '#333';

        // IOC TYPE DETECTION
        const iocTypePatterns = [
            { pattern: /IP Address/i, type: "IP Address" },
            { pattern: /Domain Name/i, type: "Domain Name" },
            { pattern: /File Hash/i, type: "File Hash" },
            { pattern: /URL/i, type: "URL" },
            { pattern: /Email Address/i, type: "Email Address" },
            { pattern: /Hostname/i, type: "Hostname" },
            { pattern: /YARA Rule/i, type: "YARA Rule" },
            { pattern: /Sigma Rule/i, type: "Sigma Rule" },
            { pattern: /Registry Key/i, type: "Registry Key" },
            { pattern: /Process Name/i, type: "Process Name" },
            { pattern: /Network Traffic/i, type: "Network Traffic" },
            { pattern: /Command Line/i, type: "Command Line" },
            { pattern: /File/i, type: "File" },
            { pattern: /Note/i, type: "Note" },
            { pattern: /DLL/i, type: "DLL" },
            { pattern: /C2/i, type: "C2" }
        ];

        for (const { pattern, type } of iocTypePatterns) {
            if (pattern.test(text)) {
                iocType = type;
                console.log(`🎯 IOC type detected: ${iocType}`);
                break;
            }
        }

        if (!iocType) {
            console.log(`❌ No IOC type detected in node ${node.id}`);
            return { type: '', value: '', time: '', splunkQuery: '', icon: '', color };
        }

        // Extract all dynamic values in the card inside a code block ```
        const valuePatterns = [
            /```([\s\S]*?)```/i
        ];

        for (const pattern of valuePatterns) {
            const match = text.match(pattern);
            if (match && match && match.trim()) {[1]
                value = match.trim();[1]
                console.log(`📝 Value extracted: ${value}`);
                break;
            }
        }

        // Time extraction
        const timePatterns = [
            /Time of Event[:\s]*(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/i,
            /Time of Event[:\s]*(\d{4}-\d{2}-\d{2})/i,
            /Time[:\s]*(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/i,
            /(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/i
        ];

        for (const pattern of timePatterns) {
            const match = text.match(pattern);
            if (match && match) {[1]
                time = match.trim();[1]
                console.log(`⏰ Time extracted: ${time}`);
                break;
            }
        }

        // Splunk query extraction
        const splunkMatch = text.match(/\*\*Splunk Query:\*\*[:\s]*([\s\S]*?)(?=\*\*|$)/i);
        if (splunkMatch && splunkMatch && splunkMatch.trim()) {[1]
            splunkQuery = splunkMatch.trim();[1]
            console.log(`🔍 Splunk query extracted: ${splunkQuery}`);
        }

        // Tactic and technique extraction
        const tacticMatch = text.match(/\*\*Mitre Tactic:\*\*[:\s]*([\s\S]*?)(?=\*\*|$)/i);
        if (tacticMatch && tacticMatch) {[1]
            tactic = tacticMatch.trim();[1]
        }

        const techniqueMatch = text.match(/\*\*Mitre Technique:\*\*[:\s]*([\s\S]*?)(?=\*\*|$)/i);
        if (techniqueMatch && techniqueMatch) {[1]
            technique = techniqueMatch.trim();[1]
        }

        // Get icon and color for this IOC type - FIX: Use IOC_TYPES constant
        if (IOC_TYPES && typeof IOC_TYPES === 'object') {
            Object.keys(IOC_TYPES).forEach((key: string) => {
                if (IOC_TYPES[key].name === iocType) {
                    icon = IOC_TYPES[key].svg;
                    color = IOC_TYPES[key].color;
                }
            });
        }

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

        console.log(`✅ Final parsed result:`, result);
        return result;
    }
}
