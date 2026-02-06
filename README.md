# Cyber Canvas Plugin for Obsidian

A comprehensive cybersecurity plugin that adds specialized **Indicators of Compromise (IOC)** card types with **SVG icons** to Obsidian Canvas with automatic timelines designed for security analysts, threat hunters, and cybersecurity professionals.

## Features

**12 IOC Card Types:** IP Address, Domain Name, File Hash, URL, Email, Hostname (with OS icons), YARA Rule, Sigma Rule, Registry Key, Process Name, Network Traffic, Command Line

**Timeline Analysis:** Time-based and Link-based timeline views for attack chain visualization

## Installation

1. Copy `main.js`, `styles.css`, and `manifest.json` to `.obsidian/plugins/cyber-canvas/`
2. Restart Obsidian
3. Enable in Settings → Community Plugins

## Usage

- **Create IOC Card:** Click shield icon in Canvas toolbar
- **View Timeline:** Click timeline icon, switch between Time/Link tabs
- **Build Attack Chains:** Connect IOC cards with arrows

## Development Build

### Install dependencies

`npm install`

### Development mode (watch + auto-rebuild)

`npm run dev`

## Production build

`npm run build`

After building, copy generated `main.js` and `styles.css` to your vault's plugin folder:
`.obsidian/plugins/cyber-canvas/`

### Project Structure

After building, copy generated `main.js` and `styles.css` to your vault's plugin folder:
`.obsidian/plugins/cyber-canvas/`

### Color Palette

- **IP Address**: `#FF6B6B` - Red (Network threats)
- **Domain**: `#4ECDC4` - Teal (DNS indicators)
- **File Hash**: `#45B7D1` - Blue (File analysis)
- **URL**: `#96CEB4` - Green (Web threats)
- **Email**: `#FECA57` - Yellow (Communications)
- **Hostname**: `#9C27B0` - Purple (System identification)
- **YARA Rule**: `#FF9FF3` - Pink (Detection rules)
- **Sigma Rule**: `#A8E6CF` - Light Green (Log analysis)

## License

MIT
