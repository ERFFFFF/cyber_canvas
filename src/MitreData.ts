/**
 * MitreData.ts - MITRE ATT&CK Enterprise framework data for validation
 *
 * This file contains simplified MITRE ATT&CK framework mappings used for
 * validating technique-tactic combinations in IOC cards.
 *
 * Data source: https://attack.mitre.org/ (Enterprise ATT&CK v15)
 */

export interface TechniqueInfo {
    id: string;              // e.g., "T1566"
    name: string;            // e.g., "Phishing"
    tactics: string[];       // normalized tactic IDs (e.g., ["initialaccess"])
    subtechniques?: string[]; // e.g., ["T1566.001", "T1566.002"]
    description?: string;    // Short description of the technique
}

export interface TacticInfo {
    id: string;              // normalized: "initialaccess"
    displayName: string;     // "Initial Access"
    shortName: string;       // "initial-access" (for MITRE Navigator export)
    tacticId: string;        // "TA0001" (official MITRE tactic ID)
    abbreviations: string[]; // ["IA"] (common abbreviations)
}

/**
 * All 14 MITRE ATT&CK Enterprise tactics.
 * Keys are normalized (lowercase, no spaces) for consistent lookups.
 */
export const MITRE_TACTICS: Record<string, TacticInfo> = {
    'reconnaissance': {
        id: 'reconnaissance',
        displayName: 'Reconnaissance',
        shortName: 'reconnaissance',
        tacticId: 'TA0043',
        abbreviations: ['RE', 'RECON']
    },
    'resourcedevelopment': {
        id: 'resourcedevelopment',
        displayName: 'Resource Development',
        shortName: 'resource-development',
        tacticId: 'TA0042',
        abbreviations: ['RD', 'RESDEV']
    },
    'initialaccess': {
        id: 'initialaccess',
        displayName: 'Initial Access',
        shortName: 'initial-access',
        tacticId: 'TA0001',
        abbreviations: ['IA']
    },
    'execution': {
        id: 'execution',
        displayName: 'Execution',
        shortName: 'execution',
        tacticId: 'TA0002',
        abbreviations: ['EX', 'EXEC']
    },
    'persistence': {
        id: 'persistence',
        displayName: 'Persistence',
        shortName: 'persistence',
        tacticId: 'TA0003',
        abbreviations: ['PE', 'PERS']
    },
    'privilegeescalation': {
        id: 'privilegeescalation',
        displayName: 'Privilege Escalation',
        shortName: 'privilege-escalation',
        tacticId: 'TA0004',
        abbreviations: ['PR', 'PRIV']
    },
    'defenseevasion': {
        id: 'defenseevasion',
        displayName: 'Defense Evasion',
        shortName: 'defense-evasion',
        tacticId: 'TA0005',
        abbreviations: ['DE', 'DEF']
    },
    'credentialaccess': {
        id: 'credentialaccess',
        displayName: 'Credential Access',
        shortName: 'credential-access',
        tacticId: 'TA0006',
        abbreviations: ['CA', 'CRED']
    },
    'discovery': {
        id: 'discovery',
        displayName: 'Discovery',
        shortName: 'discovery',
        tacticId: 'TA0007',
        abbreviations: ['DI', 'DISC']
    },
    'lateralmovement': {
        id: 'lateralmovement',
        displayName: 'Lateral Movement',
        shortName: 'lateral-movement',
        tacticId: 'TA0008',
        abbreviations: ['LA', 'LAT']
    },
    'collection': {
        id: 'collection',
        displayName: 'Collection',
        shortName: 'collection',
        tacticId: 'TA0009',
        abbreviations: ['CO', 'COLL']
    },
    'commandandcontrol': {
        id: 'commandandcontrol',
        displayName: 'Command and Control',
        shortName: 'command-and-control',
        tacticId: 'TA0011',
        abbreviations: ['CC', 'C2']
    },
    'exfiltration': {
        id: 'exfiltration',
        displayName: 'Exfiltration',
        shortName: 'exfiltration',
        tacticId: 'TA0010',
        abbreviations: ['EF', 'EXFIL']
    },
    'impact': {
        id: 'impact',
        displayName: 'Impact',
        shortName: 'impact',
        tacticId: 'TA0040',
        abbreviations: ['IM', 'IMP']
    }
};

/**
 * Common MITRE ATT&CK techniques with their valid tactics.
 * This is a curated set of frequently-used techniques. Unknown techniques
 * will still be displayed but flagged as unvalidated.
 *
 * Note: Techniques can belong to multiple tactics (e.g., T1078 Valid Accounts
 * appears in Initial Access, Persistence, Privilege Escalation, and Defense Evasion).
 */
export const MITRE_TECHNIQUES: Record<string, TechniqueInfo> = {
    'T1566': {
        id: 'T1566',
        name: 'Phishing',
        tactics: ['initialaccess'],
        subtechniques: ['T1566.001', 'T1566.002', 'T1566.003', 'T1566.004'],
        description: 'Adversaries may send phishing messages to gain access to victim systems.'
    },
    'T1566.001': {
        id: 'T1566.001',
        name: 'Spearphishing Attachment',
        tactics: ['initialaccess'],
        description: 'Adversaries may send spearphishing emails with a malicious attachment.'
    },
    'T1566.002': {
        id: 'T1566.002',
        name: 'Spearphishing Link',
        tactics: ['initialaccess'],
        description: 'Adversaries may send spearphishing emails with a malicious link.'
    },
    'T1566.003': {
        id: 'T1566.003',
        name: 'Spearphishing via Service',
        tactics: ['initialaccess'],
        description: 'Adversaries may send spearphishing messages via third-party services.'
    },
    'T1566.004': {
        id: 'T1566.004',
        name: 'Spearphishing Voice',
        tactics: ['initialaccess'],
        description: 'Adversaries may use voice communications to ultimately gain access.'
    },
    'T1059': {
        id: 'T1059',
        name: 'Command and Scripting Interpreter',
        tactics: ['execution'],
        subtechniques: ['T1059.001', 'T1059.003', 'T1059.005', 'T1059.007'],
        description: 'Adversaries may abuse command and script interpreters to execute commands or scripts.'
    },
    'T1059.001': {
        id: 'T1059.001',
        name: 'PowerShell',
        tactics: ['execution'],
        description: 'Adversaries may abuse PowerShell commands and scripts for execution.'
    },
    'T1059.003': {
        id: 'T1059.003',
        name: 'Windows Command Shell',
        tactics: ['execution'],
        description: 'Adversaries may abuse cmd.exe to execute commands and payloads.'
    },
    'T1059.005': {
        id: 'T1059.005',
        name: 'Visual Basic',
        tactics: ['execution'],
        description: 'Adversaries may abuse Visual Basic (VB) for execution.'
    },
    'T1059.007': {
        id: 'T1059.007',
        name: 'JavaScript',
        tactics: ['execution'],
        description: 'Adversaries may abuse JavaScript for execution of malicious scripts.'
    },
    'T1078': {
        id: 'T1078',
        name: 'Valid Accounts',
        tactics: ['persistence', 'privilegeescalation', 'defenseevasion', 'initialaccess'],
        subtechniques: ['T1078.001', 'T1078.002', 'T1078.003', 'T1078.004'],
        description: 'Adversaries may obtain and abuse credentials of existing accounts.'
    },
    'T1078.001': {
        id: 'T1078.001',
        name: 'Default Accounts',
        tactics: ['persistence', 'privilegeescalation', 'defenseevasion', 'initialaccess'],
        description: 'Adversaries may obtain and abuse credentials of a default account.'
    },
    'T1078.002': {
        id: 'T1078.002',
        name: 'Domain Accounts',
        tactics: ['persistence', 'privilegeescalation', 'defenseevasion', 'initialaccess'],
        description: 'Adversaries may obtain and abuse credentials of domain accounts.'
    },
    'T1078.003': {
        id: 'T1078.003',
        name: 'Local Accounts',
        tactics: ['persistence', 'privilegeescalation', 'defenseevasion', 'initialaccess'],
        description: 'Adversaries may obtain and abuse credentials of local accounts.'
    },
    'T1078.004': {
        id: 'T1078.004',
        name: 'Cloud Accounts',
        tactics: ['persistence', 'privilegeescalation', 'defenseevasion', 'initialaccess'],
        description: 'Adversaries may obtain and abuse credentials of cloud accounts.'
    },
    'T1547': {
        id: 'T1547',
        name: 'Boot or Logon Autostart Execution',
        tactics: ['persistence', 'privilegeescalation'],
        subtechniques: ['T1547.001', 'T1547.004', 'T1547.009'],
        description: 'Adversaries may configure system settings to automatically execute at boot or logon.'
    },
    'T1547.001': {
        id: 'T1547.001',
        name: 'Registry Run Keys / Startup Folder',
        tactics: ['persistence', 'privilegeescalation'],
        description: 'Adversaries may achieve persistence by adding a program to a startup folder or registry run keys.'
    },
    'T1547.004': {
        id: 'T1547.004',
        name: 'Winlogon Helper DLL',
        tactics: ['persistence', 'privilegeescalation'],
        description: 'Adversaries may abuse Winlogon helper DLLs to establish persistence and elevate privileges.'
    },
    'T1053': {
        id: 'T1053',
        name: 'Scheduled Task/Job',
        tactics: ['execution', 'persistence', 'privilegeescalation'],
        subtechniques: ['T1053.002', 'T1053.005'],
        description: 'Adversaries may abuse task scheduling functionality to execute code.'
    },
    'T1053.002': {
        id: 'T1053.002',
        name: 'At',
        tactics: ['execution', 'persistence', 'privilegeescalation'],
        description: 'Adversaries may abuse the at utility to perform task scheduling for initial execution.'
    },
    'T1053.005': {
        id: 'T1053.005',
        name: 'Scheduled Task',
        tactics: ['execution', 'persistence', 'privilegeescalation'],
        description: 'Adversaries may abuse Windows Task Scheduler to perform task scheduling.'
    },
    'T1055': {
        id: 'T1055',
        name: 'Process Injection',
        tactics: ['defenseevasion', 'privilegeescalation'],
        subtechniques: ['T1055.001', 'T1055.002', 'T1055.012'],
        description: 'Adversaries may inject code into processes to evade defenses and elevate privileges.'
    },
    'T1055.001': {
        id: 'T1055.001',
        name: 'Dynamic-link Library Injection',
        tactics: ['defenseevasion', 'privilegeescalation'],
        description: 'Adversaries may inject DLLs into processes to execute malicious payloads.'
    },
    'T1055.002': {
        id: 'T1055.002',
        name: 'Portable Executable Injection',
        tactics: ['defenseevasion', 'privilegeescalation'],
        description: 'Adversaries may inject PE files into processes to execute malicious code.'
    },
    'T1055.012': {
        id: 'T1055.012',
        name: 'Process Hollowing',
        tactics: ['defenseevasion', 'privilegeescalation'],
        description: 'Adversaries may inject code into suspended and hollowed processes.'
    },
    'T1027': {
        id: 'T1027',
        name: 'Obfuscated Files or Information',
        tactics: ['defenseevasion'],
        subtechniques: ['T1027.002', 'T1027.010'],
        description: 'Adversaries may obfuscate files or information to evade detection.'
    },
    'T1027.002': {
        id: 'T1027.002',
        name: 'Software Packing',
        tactics: ['defenseevasion'],
        description: 'Adversaries may pack malicious code to evade static analysis.'
    },
    'T1027.010': {
        id: 'T1027.010',
        name: 'Command Obfuscation',
        tactics: ['defenseevasion'],
        description: 'Adversaries may obfuscate commands to make detection more difficult.'
    },
    'T1003': {
        id: 'T1003',
        name: 'OS Credential Dumping',
        tactics: ['credentialaccess'],
        subtechniques: ['T1003.001', 'T1003.002', 'T1003.003'],
        description: 'Adversaries may attempt to dump credentials to obtain account login information.'
    },
    'T1003.001': {
        id: 'T1003.001',
        name: 'LSASS Memory',
        tactics: ['credentialaccess'],
        description: 'Adversaries may attempt to access credential material stored in LSASS memory.'
    },
    'T1003.002': {
        id: 'T1003.002',
        name: 'Security Account Manager',
        tactics: ['credentialaccess'],
        description: 'Adversaries may attempt to extract credential material from the SAM database.'
    },
    'T1003.003': {
        id: 'T1003.003',
        name: 'NTDS',
        tactics: ['credentialaccess'],
        description: 'Adversaries may attempt to access NTDS.dit to retrieve password hashes.'
    },
    'T1082': {
        id: 'T1082',
        name: 'System Information Discovery',
        tactics: ['discovery'],
        description: 'An adversary may attempt to get detailed information about the operating system and hardware.'
    },
    'T1083': {
        id: 'T1083',
        name: 'File and Directory Discovery',
        tactics: ['discovery'],
        description: 'Adversaries may enumerate files and directories to find information.'
    },
    'T1057': {
        id: 'T1057',
        name: 'Process Discovery',
        tactics: ['discovery'],
        description: 'Adversaries may attempt to get information about running processes on a system.'
    },
    'T1087': {
        id: 'T1087',
        name: 'Account Discovery',
        tactics: ['discovery'],
        subtechniques: ['T1087.001', 'T1087.002'],
        description: 'Adversaries may attempt to get a listing of accounts on a system or domain.'
    },
    'T1087.001': {
        id: 'T1087.001',
        name: 'Local Account',
        tactics: ['discovery'],
        description: 'Adversaries may attempt to get a listing of local system accounts.'
    },
    'T1087.002': {
        id: 'T1087.002',
        name: 'Domain Account',
        tactics: ['discovery'],
        description: 'Adversaries may attempt to get a listing of domain accounts.'
    },
    'T1021': {
        id: 'T1021',
        name: 'Remote Services',
        tactics: ['lateralmovement'],
        subtechniques: ['T1021.001', 'T1021.002', 'T1021.006'],
        description: 'Adversaries may use valid accounts to log into remote services.'
    },
    'T1021.001': {
        id: 'T1021.001',
        name: 'Remote Desktop Protocol',
        tactics: ['lateralmovement'],
        description: 'Adversaries may use RDP to log into a system.'
    },
    'T1021.002': {
        id: 'T1021.002',
        name: 'SMB/Windows Admin Shares',
        tactics: ['lateralmovement'],
        description: 'Adversaries may use SMB shares to laterally move to a remote system.'
    },
    'T1021.006': {
        id: 'T1021.006',
        name: 'Windows Remote Management',
        tactics: ['lateralmovement'],
        description: 'Adversaries may use WinRM to execute commands on remote systems.'
    },
    'T1048': {
        id: 'T1048',
        name: 'Exfiltration Over Alternative Protocol',
        tactics: ['exfiltration'],
        subtechniques: ['T1048.003'],
        description: 'Adversaries may steal data by exfiltrating it over a different protocol than the command channel.'
    },
    'T1048.003': {
        id: 'T1048.003',
        name: 'Exfiltration Over Unencrypted Non-C2 Protocol',
        tactics: ['exfiltration'],
        description: 'Adversaries may steal data by exfiltrating it over an unencrypted protocol.'
    },
    'T1486': {
        id: 'T1486',
        name: 'Data Encrypted for Impact',
        tactics: ['impact'],
        description: 'Adversaries may encrypt data on target systems to interrupt availability.'
    },
    'T1489': {
        id: 'T1489',
        name: 'Service Stop',
        tactics: ['impact'],
        description: 'Adversaries may stop or disable services on a system to render components unavailable.'
    },
    'T1071': {
        id: 'T1071',
        name: 'Application Layer Protocol',
        tactics: ['commandandcontrol'],
        subtechniques: ['T1071.001', 'T1071.004'],
        description: 'Adversaries may communicate using OSI application layer protocols.'
    },
    'T1071.001': {
        id: 'T1071.001',
        name: 'Web Protocols',
        tactics: ['commandandcontrol'],
        description: 'Adversaries may communicate using HTTP/HTTPS protocols.'
    },
    'T1071.004': {
        id: 'T1071.004',
        name: 'DNS',
        tactics: ['commandandcontrol'],
        description: 'Adversaries may communicate using DNS application layer protocol.'
    },
    'T1105': {
        id: 'T1105',
        name: 'Ingress Tool Transfer',
        tactics: ['commandandcontrol'],
        description: 'Adversaries may transfer tools or files from an external system.'
    }
};

/**
 * Normalize a tactic name for consistent lookups.
 *
 * Examples:
 *   "Initial Access" -> "initialaccess"
 *   "initial-access" -> "initialaccess"
 *   "INITIAL_ACCESS" -> "initialaccess"
 *
 * @param tactic - Raw tactic string from IOC card
 * @returns Normalized tactic string for Map lookups
 */
export function normalizeTacticName(tactic: string): string {
    return tactic.toLowerCase().replace(/[\s\-_]+/g, '').trim();
}

/**
 * Check if a technique ID exists in the MITRE framework.
 *
 * @param techniqueId - Technique ID (e.g., "T1566", "T1566.001")
 * @returns True if technique is in the framework data
 */
export function isTechniqueValid(techniqueId: string): boolean {
    return techniqueId in MITRE_TECHNIQUES;
}

/**
 * Validate that a technique belongs to the specified tactic.
 *
 * Returns validation result with helpful error messages:
 *   - Unknown tactic
 *   - Unknown technique
 *   - Technique doesn't belong to tactic (with list of valid tactics)
 *
 * @param techniqueId - Technique ID (e.g., "T1566")
 * @param tacticName - Tactic name (any format: "Initial Access", "initial-access", etc.)
 * @returns Validation result with error message if invalid
 */
export function validateTechniqueTacticMapping(
    techniqueId: string,
    tacticName: string
): { valid: boolean; reason?: string } {
    const normalized = normalizeTacticName(tacticName);

    // Check if tactic exists in framework
    if (!(normalized in MITRE_TACTICS)) {
        return {
            valid: false,
            reason: `Unknown tactic: "${tacticName}"`
        };
    }

    // Check if technique exists in framework
    if (!(techniqueId in MITRE_TECHNIQUES)) {
        return {
            valid: false,
            reason: `Unknown technique: "${techniqueId}"`
        };
    }

    // Check if technique includes this tactic
    const technique = MITRE_TECHNIQUES[techniqueId];
    if (!technique.tactics.includes(normalized)) {
        const validTactics = technique.tactics
            .map(t => MITRE_TACTICS[t]?.displayName || t)
            .join(', ');
        return {
            valid: false,
            reason: `${techniqueId} (${technique.name}) does not belong to ${MITRE_TACTICS[normalized].displayName}. Valid tactics: ${validTactics}`
        };
    }

    return { valid: true };
}

/**
 * Get the display name for a tactic from its normalized form.
 *
 * @param tacticName - Tactic name (any format)
 * @returns Display name (e.g., "Initial Access") or original if not found
 */
export function getTacticDisplayName(tacticName: string): string {
    const normalized = normalizeTacticName(tacticName);
    return MITRE_TACTICS[normalized]?.displayName || tacticName;
}

/**
 * Get full technique information by ID.
 *
 * @param techniqueId - Technique ID (e.g., "T1566")
 * @returns Technique info or null if not found
 */
export function getTechniqueInfo(techniqueId: string): TechniqueInfo | null {
    return MITRE_TECHNIQUES[techniqueId] || null;
}
