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

**Entry point:** `src/main.ts` — `IOCCanvasPlugin` extends Obsidian's `Plugin` class. Registers commands, ribbon icons, canvas context menu items, and injects floating buttons into canvas views on `active-leaf-change`.

**IOC Type System:**
- `IOCCardsTypes.ts` — Defines the `IOC_TYPES` constant (16 types: IP Address, Domain, File Hash, URL, Email, Hostname, YARA Rule, Sigma Rule, Registry Key, Process Name, Network, Command Line, File, Note, DLL, C2). Each type has `name`, `icon`, `color`, `fields[]`, `svg`, and optional `os_icons` (Hostname has Windows/macOS/Linux variants).
- `IOCCardFactory.ts` — Static CRUD helper for runtime manipulation of `IOC_TYPES`.
- `RenderIOCCards.ts` — Generates markdown content for new IOC cards (HTML header with inline SVG + markdown fields with code blocks + timestamp/Splunk/MITRE fields).

**Timeline Processing (two modes):**
- `TimeTimelineProcessing.ts` — Extracts IOC data from canvas nodes by parsing their markdown text, sorts by `Time of Event` field. Used for chronological timeline view.
- `LinkTimelineProcessing.ts` — Builds directed attack chains by analyzing canvas edges between IOC nodes. Identifies source nodes (no incoming edges), builds chains via DFS, and finds isolated nodes. Supports edge labels.
- Both processors parse IOC node text using regex patterns to extract: IOC type, value (from code blocks), time, Splunk query, MITRE tactic/technique.

**UI/Modals:**
- `RenderTimelinesModal.ts` — Full-screen modal with tabs for Time Timeline and Link Timeline views. Renders colored timeline items and collapsible attack chain trees.
- `RenderIOCCardsModal.ts` — IOC type selector grid. Hostname type triggers a secondary OS selector sub-view.
- `MinimalistRenderer.ts` — Alternative canvas view that replaces the normal canvas with a simplified DAG layout (topological sort by incoming edges, SVG connections with arrowheads).

**Canvas Integration:** The plugin accesses Obsidian's internal canvas API via `(activeView as any).canvas` to read `canvas.nodes` (Map) and `canvas.edges` for data extraction. IOC cards are stored as standard canvas text nodes with markdown content that gets pattern-matched by the timeline processors.

## Key Patterns

- IOC card content is **markdown with embedded HTML** for the header. The processors detect IOC types by regex-matching type names (e.g., `/IP Address/i`) against node text content — pattern order matters (e.g., "File Hash" must match before "File").
- Colors are defined per-IOC-type and applied via inline CSS variables and styles throughout the UI.
- The plugin uses Obsidian's `createEl`/`createDiv` DOM API for building UI, not frameworks.
- All styles are in `styles.css` (uses Obsidian CSS variables like `--background-primary`, `--interactive-accent`).
- SVG icons are inline strings in `IOCCardsTypes.ts`, not loaded from the `icons/` directory (which contains standalone PNG/SVG files).
- The `PluginSettings.ts` settings tab is defined but the main plugin class in `main.ts` has its own `IOCCanvasSettingTab` — there's a duplicate settings implementation.

## Build Config

`esbuild.config.mjs` bundles from `src/main.ts` to `main.js` (CJS format, ES2018 target). Externals include `obsidian`, `electron`, and `@codemirror/*` packages (provided by Obsidian at runtime). TypeScript is configured with `strict: true`, `noEmit: true` (esbuild handles transpilation), target ES2020.
