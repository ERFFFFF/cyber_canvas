# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cyber Canvas is an Obsidian plugin for cybersecurity forensic analysis. It adds IOC (Indicators of Compromise) card types with SVG icons to Obsidian's Canvas view, plus MITRE ATT&CK framework integration for technique mapping and validation. Features include time-based timeline analysis, comprehensive MITRE matrix visualization, and export to MITRE ATT&CK Navigator format. Targeted at security analysts and threat hunters.

## Recent Simplifications (2026-02-15)

The codebase underwent significant simplification and documentation improvements:

**Code Reduction:**
- **MITRE data handling:** Removed embedded fallback dataset (MitreData.ts, 547 lines) and preprocessing script (parse-mitre-stix.js, 144 lines). MitreLoader now requires enterprise-attack.json and parses STIX bundles directly at runtime.
- **Debug logging:** Consolidated from 87+ scattered log statements to focused console.debug() calls with clear prefixes ([IOCParser], [MitreModal], [MitreLoader]).
- **Severity helpers:** Extracted reusable methods `isCriticalSeverity()`, `getSeverityIcon()`, `applySeverityClass()` to eliminate repeated conditionals (~25 lines net reduction).
- **Toggle expansion:** Unified `toggleTechniqueExpansion()` and `toggleSubtechniqueExpansion()` into single `toggleExpansion()` method (~58 lines net reduction).
- **Button creation:** Extracted `createToolbarButton()` helper for canvas control bar buttons (~20 lines net reduction).
- **Module-level constants:** Moved `TACTIC_ABBREVIATIONS` to module scope in MitreLoader to prevent recreation on each call.

**Documentation Improvements:**
- **Comprehensive inline comments:** Added detailed explanations to complex algorithms (MITRE aggregation STEPS 1-5, STIX parsing, coordinate math for resize handles).
- **JSDoc blocks:** Enhanced with @param, @returns, and algorithm overview sections.
- **Section dividers:** Added visual separators (-------) to break up long functions into logical blocks.
- **Comment ratio:** Maintained 16-20% across all files while adding detailed explanations.

**Total impact:** ~293 lines removed through consolidation, zero functional changes, improved readability and maintainability.

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
- `RenderIOCCards.ts` — Generates markdown content for new IOC cards (HTML header with inline SVG + markdown fields with blank lines for user input + timestamp/Splunk/MITRE fields). Field values are entered by users in the blank space after field labels. **No separators are included in the template** - users type values directly after field labels, and the parser uses the next field or metadata section as the delimiter. Called by `main.ts` `createIOCCard()` method. **All IOC cards now include two MITRE fields**: "Mitre Tactic: " and "Mitre Technique: " for analyst input.

**Shared IOC Parsing:**
- `IOCParser.ts` — Shared module that extracts IOC data from canvas node markdown text. Used by timeline processors and MITRE modal. Exports `parseIOCNode()` and `IOCNodeData` interface. Handles IOC type detection (order-dependent regex), value extraction (looks for content between field label and next delimiter - either `-----` separator or next field label or "Time of Event"), time/Splunk/MITRE field parsing, and icon/color lookup from `IOC_TYPES`. **Includes extensive debug logging** for troubleshooting value extraction issues. **Enhanced with MITRE support** - extracts "Mitre Tactic" and "Mitre Technique" fields from IOC cards. **CRITICAL**: MITRE field extraction uses `[ \t]*` (spaces/tabs only) instead of `\s*` to avoid matching newlines - prevents regex from skipping empty fields and capturing the next field's content.

**Timeline Processing:**
- `TimeTimelineProcessing.ts` — Extracts IOC data from canvas nodes via shared `IOCParser`, returns flat array for chronological sorting by "Time of Event" field. **Includes comprehensive debug logging** tracking node processing, IOC detection, value extraction success/failure, and summary statistics.

**MITRE ATT&CK Integration (NEW):**
- `MitreLoader.ts` — Asynchronous dataset loader that parses STIX 2.1 bundle format directly from `MITRE/enterprise-attack.json`. Extracts tactics (`x-mitre-tactic` objects) and techniques (`attack-pattern` objects) with full validation. **Requires enterprise-attack.json** - throws error if unavailable. Implements caching. Exports `validateTechniqueTactic()` which performs severity-level validation (valid/unknown_technique/unknown_tactic/mismatch/empty_tactic). **Comprehensive abbreviation support** includes short forms like "EX" (Execution), "CA" (Credential Access), "DE" (Defense Evasion), etc. Includes step-by-step debug logging.
- `RenderMitreModal.ts` — Full-screen modal displaying complete MITRE ATT&CK matrix (all 14 tactics as columns, all techniques from dataset). Aggregates IOC card MITRE tactic/technique fields and validates technique-tactic pairings with severity indicators (green=valid, orange=warning, red=error, gray=unfound). Features: expandable techniques with subtechniques, description truncation with expand/collapse, count badges for found techniques, **validation error categories** (Missing Tactic, Unknown Tactic, Technique Errors, Validation Mismatches), export to MITRE ATT&CK Navigator JSON format (importable at https://mitre-attack.github.io/attack-navigator/). Includes 8-handle resizable modal UI with comprehensive debug logging.

**UI/Modals:**
- `RenderTimelinesModal.ts` — Full-screen modal with **time-based timeline only** (link timeline removed). Renders chronological sorted cards by "Time of Event" field. Uses recursive rendering for tree structure.
- `RenderIOCCardsModal.ts` — IOC type selector grid with auto-scaling columns (sqrt-based). Hostname type triggers a secondary OS selector sub-view. Callback creates actual canvas text nodes.
- `RenderMitreModal.ts` — (Documented above in MITRE section)

**Settings:**
- `PluginSettings.ts` — Single settings tab (card size, timeline button toggle). Registered in `main.ts`.

**Canvas Integration:** The plugin accesses Obsidian's internal canvas API via `(activeView as any).canvas`. Key APIs used:
- `canvas.nodes` (Map) and `canvas.edges` (Map) — for reading node/edge data
- `canvas.createTextNode({pos, size, text})` — for creating new IOC cards
- `canvas.requestSave()` — to persist changes
- IOC cards are stored as standard canvas text nodes with markdown content that gets pattern-matched by IOCParser.

**MITRE Dataset:**
- `MITRE/enterprise-attack.json` — Official MITRE ATT&CK STIX 2.1 bundle format (50MB+, ~800+ techniques). Downloaded directly from attack.mitre.org. MitreLoader parses this format natively — no preprocessing needed.

## Documentation Standards

All source files follow comprehensive inline documentation practices:

**Comment Structure:**
- **JSDoc blocks** for all public methods/classes with @param and @returns tags
- **Inline comments** explain complex logic, regex patterns, algorithms, and non-obvious design decisions
- **Section dividers** (`// ---------------------------------------------------------------`) separate logical code blocks
- **Algorithm overviews** at the start of complex functions (e.g., "Two-pass algorithm:", "Validation Steps:")
- **Debug logging** uses `console.debug()` with clear prefixes for non-production diagnostics

**Comment Ratio Target:** 15-20% of total lines

**Documentation Priority:**
- **High detail** (20%+ comments): Complex algorithms (MITRE aggregation, STIX parsing, validation), coordinate math (resize handles), search functionality
- **Moderate detail** (15% comments): Parsing logic, modal rendering, timeline processing
- **Light detail** (10% comments): Simple data structures, settings, CRUD helpers

**Complex Areas with Detailed Commentary:**
- **IOCParser field extraction** - Delimiter precedence logic (separator → next field → Time of Event)
- **MITRE aggregation STEPS 1-5** in RenderMitreModal - Full matrix building with found/unfound techniques
- **STIX 2.1 bundle parsing** in MitreLoader - Two-pass algorithm explanation (tactics first, then techniques)
- **Canvas button injection** and reduce view toggle in main.ts - DOM manipulation and height restoration
- **Resize handle coordinate math** - Delta calculations for 8-handle resizable modal
- **Search hierarchy** - Precedence ordering (ID → name → description → subtechniques)

**Why Comments Matter:**
- **Newcomer onboarding:** Analysts learning the codebase can understand complex MITRE validation logic without reverse-engineering
- **Algorithm transparency:** Multi-step processes (aggregation, parsing) are documented inline with their implementation
- **Maintenance:** Future changes to validation or parsing logic can reference documented assumptions
- **Edge cases:** Regex patterns, delimiter logic, and error handling are explained where non-obvious

## Key Patterns

- **Severity-based validation:** Use `isCriticalSeverity()` helper instead of repeated `severity === 'unknown_technique' || ...` checks. Severity ranking: unknown_technique (5) > unknown_tactic (4) > empty_tactic (3) > mismatch (2) > valid (1).
- **Modal expansion:** Use `toggleExpansion(element, subtechniques?)` for both parent techniques and subtechniques instead of separate toggle methods.
- **Toolbar buttons:** Use `createToolbarButton(label, svgIcon, onClick)` helper instead of manual DOM construction for canvas control bar buttons.
- IOC card content is **markdown with embedded HTML** for the header. IOCParser detects IOC types by regex-matching type names (e.g., `/IP Address/i`) against node text content — pattern order matters (e.g., "File Hash" must match before "File").
- **IOC card field format**: Cards are created with field labels followed by blank lines for user input. Users type values after the field labels. The parser extracts the **first field's value** as the primary "value" for timeline display (e.g., for Hostname cards, the "hostname" field is extracted; for File Hash cards, the "hash" field). No separators are included in the card template - the parser uses the next field label or "Time of Event:" as the delimiter.
- **MITRE field parsing**: IOC cards include "Mitre Tactic: " and "Mitre Technique: " fields. IOCParser extracts these using flexible pattern matching with `[ \t]*` (spaces/tabs only, NOT `\s*`) to prevent regex from matching across newlines. Technique field supports multiple formats: "T1566", "T1566.001", "T1566 - Phishing", "Phishing (T1566)", or plain name "Phishing". Tactic field supports display names, short names, or abbreviations (e.g., "EX" for Execution, "CA" for Credential Access).
- **MITRE validation architecture**: Uses severity levels instead of boolean - `valid` (green), `unknown_technique` (red), `unknown_tactic` (red), `mismatch` (orange, wrong tactic - shows correct tactics in error message), `empty_tactic` (red, technique filled but tactic empty), `not_found` (gray, not in IOC cards). Validation messages include specific guidance for analysts. Cards with empty technique are filtered out (can't validate without technique), but cards with empty tactic and filled technique show explicit "Tactic field is empty" error.
- **Full MITRE matrix aggregation**: MITRE modal builds complete 14-tactic matrix showing ALL techniques from dataset (not just IOC-found). Found techniques are highlighted with validation colors and count badges. Unfound techniques appear gray for context. This provides complete attack surface coverage view.
- **Description truncation**: MITRE technique descriptions are cleaned (removing markdown links and citation brackets) and truncated to ~180 characters in collapsed state. Clicking expands to show full description and subtechniques. Subtechniques always show full descriptions.
- **MITRE Navigator export**: Generates JSON layer file compatible with official MITRE ATT&CK Navigator (https://mitre-attack.github.io/attack-navigator/). Includes severity-based coloring (green/orange/red), IOC card counts as technique scores, validation messages in comments, and proper tactic mapping.
- **Debug logging**: Extensive console.debug() output tracks the entire parsing and rendering pipeline from card creation through value extraction to timeline/MITRE display. Check the browser console when investigating value display or validation issues.
- Colors are defined per-IOC-type and applied via inline CSS variables and styles throughout the UI.
- The plugin uses Obsidian's `createEl`/`createDiv` DOM API for building UI, not frameworks.
- Plugin buttons (Timeline, Add Card, Reduce, MITRE) are injected into Obsidian's native `.canvas-controls` bar as `.ioc-toolbar` > `.canvas-control-item` > `.clickable-icon` elements to match the native canvas button style.
- **Reduce toggle**: The "Reduce" button in the toolbar toggles `isReducedView` state. When ON, adds `.ioc-reduced` class to the canvas wrapper (CSS hides headers/metadata, shows only field values) and resizes nodes to 60px height. When OFF, removes the class and restores original node heights. Original heights are stored as `node._iocOriginalHeight`.
- All styles are in `styles.css` (uses Obsidian CSS variables like `--background-primary`, `--interactive-accent`). **MITRE modal styles** (~500 lines, lines 285-764) include full-screen modal wrapper, tactic columns, technique items with validation states, expandable subtechniques, resize handles, and responsive breakpoints.
- SVG icons are inline strings in `IOCCardsTypes.ts`, not loaded from the `icons/` directory (which contains standalone PNG/SVG files).

## MITRE ATT&CK Features

The plugin includes comprehensive MITRE ATT&CK framework integration for threat intelligence mapping:

**IOC Card Integration:**
- All IOC cards include "Mitre Tactic: " and "Mitre Technique: " fields at the bottom
- Analysts fill in these fields using any supported format (e.g., "T1566", "T1566.001 - Spearphishing Attachment", "Initial Access")
- IOCParser automatically extracts and normalizes these values

**MITRE Modal (accessed via crosshair button in canvas toolbar):**
- Displays complete MITRE ATT&CK matrix: all 14 tactics (Reconnaissance → Impact) as vertical columns
- Shows ALL techniques from dataset (~800+), highlighting only those found in IOC cards
- **Color-coded validation**:
  - Green: Valid technique-tactic pairing
  - Orange: Technique exists but wrong tactic specified (mismatch error shows correct tactics)
  - Red: Unknown technique, unknown tactic name, or empty tactic field
  - Gray: Valid technique but not found in any IOC cards
- **Validation error categories** (collapsible section at top):
  - 🔴 **Missing Tactic**: Technique filled but tactic empty - shows "Tactic field is empty"
  - 🔴 **Unknown Tactic**: Tactic abbreviation/name not recognized in dataset
  - 🔴 **Technique Errors**: Technique ID not found in MITRE dataset
  - ⚠️ **Validation Mismatches**: Both valid but don't belong together - shows correct tactics
- **Interactive features**:
  - Click techniques with subtechniques (▶ icon) to expand/collapse
  - Descriptions truncated to ~180 chars in collapsed state, full text when expanded
  - Count badges show how many IOC cards reference each technique
  - Hover to see validation warnings with specific guidance
- **Statistics bar** shows coverage percentage, active tactics, and total IOC count
- **Resizable modal** with 8 drag handles (corners + edges)

**Export to MITRE Navigator:**
- "Export to Navigator" button generates JSON layer file
- Import at https://mitre-attack.github.io/attack-navigator/ for visual heatmap
- Includes:
  - Technique coloring by validation severity
  - IOC card counts as visual scores (darker = more cards)
  - Validation messages in technique comments
  - Proper tactic mapping for Navigator display

**Dataset Management:**
- Full MITRE ATT&CK dataset stored in `MITRE/enterprise-attack.json` (official STIX 2.1 bundle format from attack.mitre.org)
- **Required file** - plugin will fail with clear error message if missing
- Update dataset: Download latest bundle from https://github.com/mitre-attack/attack-stix-data → save as `MITRE/enterprise-attack.json` → reload plugin (no conversion needed)

**Validation Logic:**
- Checks technique ID exists in dataset
- Verifies technique belongs to specified tactic
- Provides detailed error messages for mismatches (includes correct tactics)
- Handles subtechniques (T1566.001 format) with parent technique validation
- **Comprehensive abbreviation support**:
  - Reconnaissance: RECON, RECCE, R
  - Resource Development: RESOURCE, RES, RD
  - Initial Access: IA, INIT
  - Execution: EXEC, EXE, EX, E
  - Persistence: PERSIST, PERS, P
  - Privilege Escalation: PRIV, PE, PRIVESC, PRIV ESC
  - Defense Evasion: DEFENSE, DEF, DE
  - Credential Access: CRED, CA, CRED ACCESS
  - Discovery: DISC, DIS, D
  - Lateral Movement: LATERAL, LM, LAT MOVE
  - Collection: COLLECT, COL, C
  - Command and Control: C2, CNC, CC
  - Exfiltration: EXFIL, EXFILTRATE, E
  - Impact: IMP, I

## Build Config

`esbuild.config.mjs` bundles from `src/main.ts` to `main.js` (CJS format, ES2018 target). Externals include `obsidian`, `electron`, and `@codemirror/*` packages (provided by Obsidian at runtime). TypeScript is configured with `strict: true`, `noEmit: true` (esbuild handles transpilation), target ES2020.

## File Structure

```
src/
├── main.ts                      # Entry point (434 lines, 96 comments, 22%) - plugin initialization, canvas button injection, reduce view
├── IOCParser.ts                 # Shared parsing (398 lines, 97 comments, 24%) - IOC detection, value/time/MITRE extraction
├── TimeTimelineProcessing.ts    # Time-based timeline (79 lines, 17 comments, 22%) - chronological IOC sorting
├── RenderTimelinesModal.ts      # Timeline modal (131 lines, 28 comments, 21%) - time-based timeline UI only
├── RenderMitreModal.ts          # MITRE modal (1,798 lines, 348 comments, 19%) - full matrix visualization + Navigator export
├── MitreLoader.ts               # Dataset loader (388 lines, 108 comments, 28%) - STIX 2.1 bundle parser
├── RenderIOCCards.ts            # Card generation (73 lines, 27 comments, 37%) - markdown template with MITRE fields
├── RenderIOCCardsModal.ts       # IOC selector (138 lines, 23 comments, 17%) - type picker grid
├── IOCCardsTypes.ts             # Type definitions (288 lines, 36 comments, 13%) - 16 IOC types with icons/colors
├── IOCCardFactory.ts            # CRUD helpers (79 lines, 24 comments, 30%) - IOC_TYPES manipulation
└── PluginSettings.ts            # Settings tab (69 lines, 18 comments, 26%) - card size, timeline toggle

MITRE/
└── enterprise-attack.json       # Official STIX 2.1 bundle (50MB+, ~800+ techniques, download from attack.mitre.org)

styles.css                       # All styling (859 lines) - IOC cards, timelines, MITRE modal
manifest.json                    # Obsidian plugin manifest
esbuild.config.mjs              # Build configuration
```

**Total:** 3,875 lines TypeScript (782 comment lines, 20.2% average ratio across all files)
