export interface IOCField {
    name: string;
    icon: string;
    color: string;
    fields: string[];
    svg: string;
    os_icons?: {
      windows_workstation: string;
      windows_server: string;
      macos: string;
      linux: string;
    };
  }
  
  export interface IOCCardsTypes {
    [key: string]: IOCField;
  }
  
  export const IOC_TYPES: IOCCardsTypes = {
    ip_address: {
      name: 'IP Address',
      icon: 'network',
      color: '#FF6B6B',
      fields: ['IP', 'country', 'asn'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="15" r="7"/>
  <path d="M12 8c-3.9 0-7 3.1-7 7"/>
  <path d="M12 8c3.9 0 7 3.1 7 7"/>
  <line x1="5" y1="15" x2="19" y2="15"/>
  <line x1="12" y1="8" x2="12" y2="22"/>
  <path d="M12 8c-1.7-3-1.7-6 0-6s1.7 3 0 6z"/>
  <circle cx="12" cy="4" r="2" fill="currentColor"/>
</svg>`
    },
    
    domain: {
      name: 'Domain Name',
      icon: 'globe',
      color: '#4ECDC4',
      fields: ['name', 'IP'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>`
    },
    
    file_hash: {
      name: 'File Hash',
      icon: 'hash',
      color: '#45B7D1',
      fields: ['hash', 'hash_type', 'filename', 'file_size'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="4" y1="9" x2="20" y2="9"/>
    <line x1="4" y1="15" x2="20" y2="15"/>
    <line x1="10" y1="3" x2="8" y2="21"/>
    <line x1="16" y1="3" x2="14" y2="21"/>
  </svg>`
    },
    
    url: {
      name: 'URL',
      icon: 'link',
      color: '#96CEB4',
      fields: ['url', 'domain', 'category'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>`
    },
    
    email: {
      name: 'Email Address',
      icon: 'mail',
      color: '#FECA57',
      fields: ['email', 'domain'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>`
    },
    
    hostname: {
      name: 'Hostname',
      icon: 'monitor',
      color: '#9C27B0',
      fields: ['hostname', 'os_type', 'domain'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>`,
      os_icons: {
        windows_workstation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
    <path d="M0 3.5L10 2v9.5H0V3.5zM11 1.9l13-1.9v11H11V1.9zM0 12.5h10V22l-10-1.5v-8zM11 12h13v10l-13 2v-12z"/>
  </svg>`,
        windows_server: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
    <path d="M0 3.5L10 2v9.5H0V3.5zM11 1.9l13-1.9v11H11V1.9zM0 12.5h10V22l-10-1.5v-8zM11 12h13v10l-13 2v-12z"/>
  </svg>`,
        macos: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>`,
        linux: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.84-.41 1.684-.287 2.489.845 5.548 5.676 6.016 6.855 6.016.178 0 .287-.016.287-.016s8.029-.192 8.03-8.047c0-4.662-3.916-9.69-7.47-14.302z"/>
  </svg>`
      }
    },
    
    yara_rule: {
      name: 'YARA Rule',
      icon: 'shield',
      color: '#FF9FF3',
      fields: ['rule_name', 'rule_content'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <text x="12" y="15" font-size="10" text-anchor="middle" fill="currentColor" font-weight="bold">Y</text>
  </svg>`
    },
    
    sigma_rule: {
      name: 'Sigma Rule',
      icon: 'search',
      color: '#A8E6CF',
      fields: ['rule_name', 'rule_content'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <text x="12" y="17" font-size="14" text-anchor="middle" fill="currentColor" font-weight="bold">Σ</text>
  </svg>`
    },
    
    registry_key: {
      name: 'Registry Key',
      icon: 'settings',
      color: '#FFB74D',
      fields: ['key_path', 'key_name', 'key_data'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
  </svg>`
    },
    
    process_name: {
      name: 'Process Name',
      icon: 'cpu',
      color: '#81C784',
      fields: ['process_name', 'command_line', 'pid', 'parent_process'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="5" width="18" height="14" rx="2" ry="2"/>
  <line x1="3" y1="9" x2="21" y2="9"/>
  <circle cx="6" cy="7" r="0.8" fill="currentColor"/>
  <circle cx="9" cy="7" r="0.8" fill="currentColor"/>
  <line x1="7" y1="13" x2="17" y2="13"/>
  <line x1="7" y1="16" x2="14" y2="16"/>
</svg>`
    },
    
    network: {
      name: 'Network',
      icon: 'activity',
      color: '#9575CD',
      fields: ['protocol', 'port', 'direction'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>`
    },
    
    command_line: {
      name: 'Command Line',
      icon: 'terminal',
      color: '#2E8B57',
      fields: ['command', 'pid', 'parent_process'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  </svg>`
    },

    file: {
      name: 'File',
      icon: 'file',
      color: '#E91E63',
      fields: ['name', 'type', 'path', 'size', 'hash', 'pid'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 4h12l4 4v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
  <line x1="8" y1="11" x2="16" y2="11"/>
  <line x1="8" y1="15" x2="16" y2="15"/>
</svg>`
    },

    note: {
      name: 'Note',
      icon: 'note',
      color: '#F39C12',
      fields: ['NB'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
  <line x1="8" y1="8" x2="16" y2="8"/>
  <line x1="8" y1="12" x2="16" y2="12"/>
  <line x1="8" y1="16" x2="14" y2="16"/>
</svg>`
    },

    dll: {
      name: 'DLL',
      icon: 'dll',
      color: '#3498DB',
      fields: ['name', 'type', 'path', 'size', 'hash'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
  <polyline points="14 2 14 8 20 8"/>
  <circle cx="12" cy="13" r="2"/>
  <path d="M12 10.5v-1"/>
  <path d="M12 15.5v1"/>
  <path d="M14.5 11.5l0.7-0.7"/>
  <path d="M9.8 16.2l-0.7 0.7"/>
  <path d="M15.5 13h1"/>
  <path d="M8.5 13h-1"/>
  <path d="M14.5 14.5l0.7 0.7"/>
  <path d="M9.8 9.8l-0.7-0.7"/>
</svg>`
    },

    c2: {
      name: 'C2',
      icon: 'c2',
      color: '#E74C3C',
      fields: ['domain', 'IP'],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9"/>
  <path d="M12 3v1.5"/>
  <path d="M12 19.5V21"/>
  <path d="M3 12h1.5"/>
  <path d="M19.5 12H21"/>
  <path d="M5.6 5.6l1.1 1.1"/>
  <path d="M17.3 17.3l1.1 1.1"/>
  <path d="M5.6 18.4l1.1-1.1"/>
  <path d="M17.3 6.7l1.1-1.1"/>
  <polyline points="8 10 11 13 8 16"/>
  <line x1="13" y1="16" x2="16" y2="16"/>
</svg>`
    }
  };
  