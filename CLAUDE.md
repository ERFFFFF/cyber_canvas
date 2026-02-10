# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cyber Canvas is an Obsidian plugin for cybersecurity forensic analysis. It adds IOC (Indicators of Compromise) card types with SVG icons to Obsidian's Canvas view, plus automatic timeline analysis for attack chain visualization. Targeted at security analysts and threat hunters.

## Build Commands

```bash
npm install          # Install dependencies
npm run dev          # Development mode (watch + auto-rebuild via esbuild)
npm run build        # Production build (minified, no sourcemaps)
```

The build outputs `main.js` directly in the project root (consumed by Obsidian). There are no tests or linting configured.

## Architecture

**Entry point:** `src/main.ts` — `IOCCanvasPlugin` extends Obsidian's `Plugin` class. Registers commands, ribbon icons, canvas context menu items, and injects buttons into Obsidian's native `.canvas-controls` bar on `active-leaf-change`. Creates IOC cards as canvas text nodes via the internal canvas API (`canvas.createTextNode()`).

**IOC Type System:**
- `IOCCardsTypes.ts` — Defines the `IOC_TYPES` constant (16 types: IP Address, Domain, File Hash, URL, Email, Hostname, YARA Rule, Sigma Rule, Registry Key, Process Name, Network, Command Line, File, Note, DLL, C2). Each type has `name`, `icon`, `color`, `fields[]`, `svg`, and optional `os_icons` (Hostname has Windows/macOS/Linux variants).
- `IOCCardFactory.ts` — Static CRUD helper for runtime manipulation of `IOC_TYPES`.
- `RenderIOCCards.ts` — Generates markdown content for new IOC cards (HTML header with inline SVG + markdown fields with blank lines for user input + timestamp/Splunk/MITRE fields). Field values are entered by users in the blank space after field labels. **No separators are included in the template** - users type values directly after field labels, and the parser uses the next field or metadata section as the delimiter. Called by `main.ts` `createIOCCard()` method.

**Shared IOC Parsing:**
- `IOCParser.ts` — Shared module that extracts IOC data from canvas node markdown text. Used by both timeline processors. Exports `parseIOCNode()` and `IOCNodeData` interface. Handles IOC type detection (order-dependent regex), value extraction (looks for content between field label and next delimiter - either `-----` separator or next field label or "Time of Event"), time/Splunk/MITRE field parsing, and icon/color lookup from `IOC_TYPES`. **Includes extensive debug logging** for troubleshooting value extraction issues.

**Timeline Processing (two modes):**
- `TimeTimelineProcessing.ts` — Extracts IOC data from canvas nodes via shared `IOCParser`, returns flat array for chronological sorting. **Includes comprehensive debug logging** tracking node processing, IOC detection, value extraction success/failure, and summary statistics.
- `LinkTimelineProcessing.ts` — Builds hierarchical tree structure by analyzing canvas edges between IOC nodes. Handles both live canvas Map format (`edge.from.node.id`) and serialized JSON format (`edge.fromNode`). Uses BFS to assign nodes to layers by maximum depth from roots (no incoming edges). **Key feature:** Each node appears exactly once at its calculated depth layer. Prevents cycles and handles orphaned connected components. Returns layered DAG structure with edges for arrow rendering. **Includes step-by-step debug logging** showing node parsing, edge processing, DAG construction, and layer-by-layer breakdown.
- `IOCParser.ts` — Shared parsing logic used by both processors.

**UI/Modals:**
- `RenderTimelinesModal.ts` — Full-screen modal with tabs for Time Timeline and Link Timeline views. Time tab renders chronological sorted cards. Link tab renders vertical tree structure with indentation and tree connector lines showing parent-child relationships. Each node appears exactly once. Uses recursive `renderTreeNode()` for depth-first rendering. Tree connectors use CSS borders for L-shaped lines connecting parents to children.
- `RenderIOCCardsModal.ts` — IOC type selector grid with auto-scaling columns (sqrt-based). Hostname type triggers a secondary OS selector sub-view. Callback creates actual canvas text nodes.

**Settings:**
- `PluginSettings.ts` — Single settings tab (card size, timeline button toggle). Registered in `main.ts`.

**Canvas Integration:** The plugin accesses Obsidian's internal canvas API via `(activeView as any).canvas`. Key APIs used:
- `canvas.nodes` (Map) and `canvas.edges` (Map) — for reading node/edge data
- `canvas.createTextNode({pos, size, text})` — for creating new IOC cards
- `canvas.requestSave()` — to persist changes
- Edge format: `edge.from.node.id` / `edge.to.node.id` (live canvas), `edge.fromNode` / `edge.toNode` (serialized JSON)
- IOC cards are stored as standard canvas text nodes with markdown content that gets pattern-matched by IOCParser.

## Key Patterns

- IOC card content is **markdown with embedded HTML** for the header. IOCParser detects IOC types by regex-matching type names (e.g., `/IP Address/i`) against node text content — pattern order matters (e.g., "File Hash" must match before "File").
- **IOC card field format**: Cards are created with field labels followed by blank lines for user input. Users type values after the field labels. The parser extracts the **first field's value** as the primary "value" for timeline display (e.g., for Hostname cards, the "hostname" field is extracted; for File Hash cards, the "hash" field). No separators are included in the card template - the parser uses the next field label or "Time of Event:" as the delimiter.
- **Debug logging**: Extensive console.debug() output tracks the entire parsing and rendering pipeline from card creation through value extraction to timeline display. Check the browser console when investigating value display issues.
- Colors are defined per-IOC-type and applied via inline CSS variables and styles throughout the UI.
- The plugin uses Obsidian's `createEl`/`createDiv` DOM API for building UI, not frameworks.
- Plugin buttons (Timeline, Add Card, Reduce) are injected into Obsidian's native `.canvas-controls` bar as `.ioc-toolbar` > `.canvas-control-item` > `.clickable-icon` elements to match the native canvas button style.
- **Reduce toggle**: The "Reduce" button in the toolbar toggles `isReducedView` state. When ON, adds `.ioc-reduced` class to the canvas wrapper (CSS hides headers/metadata, shows only field values) and resizes nodes to 60px height. When OFF, removes the class and restores original node heights. Original heights are stored as `node._iocOriginalHeight`.
- All styles are in `styles.css` (uses Obsidian CSS variables like `--background-primary`, `--interactive-accent`).
- SVG icons are inline strings in `IOCCardsTypes.ts`, not loaded from the `icons/` directory (which contains standalone PNG/SVG files).
- **Link timeline visualization** uses vertical tree layout flowing top-to-bottom. Root nodes (no incoming edges) appear at the top, children are indented below their parents. Tree connector lines (L-shaped CSS borders) visually connect parents to children. Each node appears exactly once in the tree structure, preventing duplicates and showing a clear hierarchical attack chain.

## Build Config

`esbuild.config.mjs` bundles from `src/main.ts` to `main.js` (CJS format, ES2018 target). Externals include `obsidian`, `electron`, and `@codemirror/*` packages (provided by Obsidian at runtime). TypeScript is configured with `strict: true`, `noEmit: true` (esbuild handles transpilation), target ES2020.
