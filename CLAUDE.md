# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cyber Canvas is an Obsidian plugin for cybersecurity forensic analysis. It adds IOC (Indicators of Compromise) card types with SVG icons to Obsidian's Canvas view, plus MITRE ATT&CK framework integration for technique mapping and validation. Features include time-based timeline analysis, comprehensive MITRE matrix visualization, and export to MITRE ATT&CK Navigator format. Targeted at security analysts and threat hunters.

## Recent Changes

**Timeline Features (2026-02-16):**
- Implemented Graph Timeline with drag-to-zoom (Splunk-like interaction), manual time range inputs, viewport-based filtering, and two-line axis timestamps (`YYYY-MM-DD\nHH:MM:SS`)
- Implemented Link Timeline with hierarchical parent-child grouping, arrow-based relationship detection, expandable nested structures (parent→child→grandchild), and error detection for Child→Parent arrow violations
- Refactored copy button behavior: removed global copy, added tab-specific buttons (Time: copy all, Graph: copy filtered range, Link: no copy), implemented time range filtering in `generateCopyText()`
- Refined error detection logic: P→P arrows now allowed, only C→P arrows flagged as errors
- Created 4 new timeline modules: `GraphTimelineTab.ts`, `LinkTimelineTab.ts`, `LinkTimelineProcessing.ts`, `TimelineCopyExport.ts`

**Folder Reorganization (2026-02-15):**
Organized all 30 source files into 6 subdirectories (`types/`, `canvas/`, `parsing/`, `timeline/`, `mitre/`, `settings/`). Split 3 large files: `main.ts` (494→132 lines), `IOCParser.ts` (389→97 lines), `RenderMitreModal.ts` (936→246 lines). Created 11 new single-responsibility modules. All files now under 562 lines. Class methods converted to exported free functions with context interfaces (`ToolbarContext`, `MitreModalContext`).

**Previous Changes (2026-02-15):**
- Split `RenderMitreModal.ts` (2,112 lines) into 8 modules, then further into 12 modules
- Removed dead code: MitreData.ts (547 lines), parse-mitre-stix.js (144 lines), DiagnosticTests.ts (315 lines), IOCCardFactory.ts (79 lines)
- Added comprehensive inline documentation (15-20% comment ratio across all files)

## Build Commands

```bash
npm install          # Install dependencies
npm run dev          # Development mode (watch + auto-rebuild via esbuild)
npm run build        # Production build (minified, no sourcemaps)
```

The build outputs `main.js` directly in the project root (consumed by Obsidian). There are no tests or linting configured.

## Architecture

**Entry point:** `src/main.ts` — `IOCCanvasPlugin` extends Obsidian's `Plugin` class. Thin plugin shell that registers commands, ribbon icons, settings, and delegates to extracted modules in `canvas/`.

**Canvas Modules (`src/canvas/`):**
- `CanvasToolbar.ts` — SVG icon constants, `ToolbarContext` interface, `addCanvasButtons(ctx)` and `createToolbarButton()`. Injects 4 buttons (Timeline, Add Card, Reduce, MITRE) into Obsidian's native `.canvas-controls` bar.
- `CanvasSelection.ts` — `getSelectedTechniqueId(app)` extracts MITRE technique ID from selected canvas node. Tries 3 approaches to find selection.
- `ReduceView.ts` — `toggleReduceView(app, isReducedView)` returns new state. Adds/removes `.ioc-reduced` class and resizes nodes to 60px/original height.
- `IOCCardCreation.ts` — `openIOCCardSelector(app, callback)` and `createIOCCard(app, iocTypeId, osType?)`. Creates canvas text nodes via internal canvas API.
- `RenderIOCCards.ts` — Generates markdown content for new IOC cards (HTML header with inline SVG + markdown fields + MITRE fields). **All IOC cards include "Mitre Tactic:" and "Mitre Technique:" fields.**
- `RenderIOCCardsModal.ts` — IOC type selector grid with auto-scaling columns (sqrt-based). Hostname type triggers OS selector sub-view.

**Type System (`src/types/`):**
- `IOCCardsTypes.ts` — `IOC_TYPES` constant (16 types with name, icon, color, fields[], svg, optional os_icons).
- `IOCNodeData.ts` — `IOCNodeData` interface (id, type, value, time, splunkQuery, tactic, technique, icon, color).

**Parsing Modules (`src/parsing/`):**
- `IOCParser.ts` — Orchestrator that imports from detection/extractors/visuals below. Exports `parseIOCNode()` and re-exports `IOCNodeData`.
- `IOCTypeDetection.ts` — `IOC_TYPE_PATTERNS` array and `detectIOCType(text)`. Pattern order matters: specific before generic (e.g., "File Hash" before "File").
- `IOCFieldExtractors.ts` — All `extract*` functions (value, time, splunk, MITRE, cardId). **CRITICAL**: MITRE field extraction uses `[ \t]*` (spaces/tabs only) instead of `\s*` to avoid matching newlines.
- `IOCVisualLookup.ts` — `lookupTypeVisuals(iocType)` searches `IOC_TYPES` for SVG icon and color.

**Timeline (`src/timeline/`, 6 modules):**
- `TimeTimelineProcessing.ts` — Extracts IOC data via `IOCParser`, returns flat array for chronological sorting by "Time of Event" field. Used by Time Timeline tab.
- `GraphTimelineTab.ts` — Horizontal dot timeline with drag-to-zoom. Renders interactive axis with colored dots, selection overlay, manual time inputs, and filtered card list. Edge padding (8%), two-line timestamps, viewport-based positioning.
- `LinkTimelineTab.ts` — Hierarchical parent-child timeline renderer. Displays expandable groups with role badges ([P]/[C]), nested structures (depth-based indentation), and error section for Child→Parent arrow violations.
- `LinkTimelineProcessing.ts` — Parent-child grouping algorithm from canvas edges. Builds `ParentChildGroup` hierarchy, detects root parents, recursively nests children, validates arrow directions (flags C→P, allows P→P). Returns `LinkTimelineResult` with groups + error cards.
- `TimelineCopyExport.ts` — Tab-separated text generator for clipboard export. Supports optional time range filtering (`startTime`/`endTime`) for Graph Timeline's filtered copy. Format: `Time\tTactic\tTechnique\tValue`.
- `RenderTimelinesModal.ts` — Full-screen modal orchestrator. Creates tab bar (Time/Graph/Link), renders tab-specific content, manages tab switching, handles IOC data extraction and edge loading.

**MITRE ATT&CK Integration (`src/mitre/`, 12 modules):**
- `MitreTypes.ts` — Shared interfaces (`MitreTechnique`, `MitreTactic`, `SearchState`, `ValidationError`, `SeverityLevel`). Foundation, no deps.
- `MitreTextUtils.ts` — `cleanDescription()` and `truncateDescription()`. Removes markdown links and citation brackets.
- `MitreSeverity.ts` — `isCriticalSeverity()`, `getSeverityIcon()`, `applySeverityClass()`, `shouldOverrideSeverity()`. Severity ranking: unknown_technique (5) > unknown_tactic (4) > empty_tactic (3) > mismatch (2) > valid (1).
- `MitreSearch.ts` — `parseSearchQuery()`, `matchesSearch()` (4-level hierarchy: ID > name > description > subtechniques), `highlightMatches()`.
- `MitreAggregator.ts` — 5-step IOC-to-MITRE matrix aggregation. Exports `aggregateTacticsTechniques()`, `extractTechniqueId()`, `extractTechniqueName()`.
- `MitreExport.ts` — `exportToNavigator()` takes pre-computed tactics (what-you-see-is-what-you-export).
- `MitreResizable.ts` — `makeResizable(modal)` with 8 drag handles (corners + edges).
- `MitreLoader.ts` — STIX 2.1 bundle parser from `MITRE/enterprise-attack.json`. Caching, `validateTechniqueTactic()`, abbreviation support.
- `MitreModalHelpers.ts` — `MitreModalContext` interface (replaces `this` for extracted functions), `isActiveTechnique()`, `toggleExpansion()`.
- `MitreModalTacticRenderer.ts` — `renderTacticSection()`, `renderSubtechniques()`, `createCountBadgeWithTooltip()`.
- `MitreModalValidation.ts` — `renderValidationErrors()` with grouped error categories (Missing Tactic, Unknown Tactic, Technique Errors, Mismatches).
- `MitreModalSearch.ts` — `SearchUIElements` interface, `renderSearchBar()`, `handleSearchInput()` with debounced re-render.
- `RenderMitreModal.ts` — Class shell with lifecycle (onOpen/onClose), `getContext()` builder, `renderMitreMapping()`. Orchestrates all modules above.

**Settings (`src/settings/`):**
- `PluginSettings.ts` — Single settings tab (card size, timeline button toggle).

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
- **MITRE aggregation STEPS 1-5** in MitreAggregator - Full matrix building with found/unfound techniques
- **STIX 2.1 bundle parsing** in MitreLoader - Two-pass algorithm explanation (tactics first, then techniques)
- **Canvas button injection** in CanvasToolbar.ts and **reduce view toggle** in ReduceView.ts - DOM manipulation and height restoration
- **Resize handle coordinate math** - Delta calculations for 8-handle resizable modal
- **Search hierarchy** - Precedence ordering (ID → name → description → subtechniques)

**Why Comments Matter:**
- **Newcomer onboarding:** Analysts learning the codebase can understand complex MITRE validation logic without reverse-engineering
- **Algorithm transparency:** Multi-step processes (aggregation, parsing) are documented inline with their implementation
- **Maintenance:** Future changes to validation or parsing logic can reference documented assumptions
- **Edge cases:** Regex patterns, delimiter logic, and error handling are explained where non-obvious

## Key Patterns

- **Severity-based validation:** Use `isCriticalSeverity()` from `MitreSeverity.ts` instead of repeated `severity === 'unknown_technique' || ...` checks. Severity ranking: unknown_technique (5) > unknown_tactic (4) > empty_tactic (3) > mismatch (2) > valid (1).
- **Modal expansion:** Use `toggleExpansion(element, subtechniques?)` for both parent techniques and subtechniques instead of separate toggle methods.
- **Toolbar buttons:** Use `createToolbarButton(label, svgIcon, onClick)` from `canvas/CanvasToolbar.ts` instead of manual DOM construction.
- **Context interfaces:** Extracted functions receive context objects instead of `this`. `ToolbarContext` (in `CanvasToolbar.ts`) provides app + callbacks for toolbar buttons. `MitreModalContext` (in `MitreModalHelpers.ts`) provides state + callbacks for modal rendering functions.
- **MITRE module boundaries:** Each MITRE module is a set of exported free functions (not class methods). `MitreAggregator.aggregateTacticsTechniques()` takes `(iocData, dataset)` and returns an `AggregationResult` struct. `MitreExport.exportToNavigator()` takes pre-computed `(tactics, iocCount, dataset)` for what-you-see-is-what-you-export. `MitreSearch.matchesSearch()` takes `subtechniquesMap` as a parameter instead of reading from `this`.
- **Link Timeline error detection:** Use `incomingFrom` Map to track arrow sources, check if ANY incoming source is a [C] card. P→P arrows allowed (attack chain progression), C→P arrows flagged (violates convention). Pattern: `for (const sourceId of incomingSources) { if (nodeMap.get(sourceId)?.isChild) { ... } }`.
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
- Plugin buttons (Timeline, Add Card, Reduce, MITRE) are injected via `canvas/CanvasToolbar.ts` into Obsidian's native `.canvas-controls` bar as `.ioc-toolbar` > `.canvas-control-item` > `.clickable-icon` elements.
- **Reduce toggle**: `canvas/ReduceView.ts` exports `toggleReduceView(app, isReducedView)` which returns the new state. When ON, adds `.ioc-reduced` class and resizes nodes to 60px. When OFF, restores original heights from `node._iocOriginalHeight`.
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
  - Execution: EXEC, EXE, EX
  - Persistence: PERSIST, PERS, PS
  - Privilege Escalation: PRIV, PE, PRIVESC, PRIV ESC
  - Defense Evasion: DEFENSE, DEF, DE
  - Credential Access: CRED, CA, CRED ACCESS
  - Discovery: DISC, DIS, DI
  - Lateral Movement: LATERAL, LM, LAT MOVE
  - Collection: COLLECT, COL, CO
  - Command and Control: C2, CNC, CC
  - Exfiltration: EXFIL, EXFILTRATE
  - Impact: IMP, IM

## Build Config

`esbuild.config.mjs` bundles from `src/main.ts` to `main.js` (CJS format, ES2018 target). Externals include `obsidian`, `electron`, and `@codemirror/*` packages (provided by Obsidian at runtime). TypeScript is configured with `strict: true`, `noEmit: true` (esbuild handles transpilation), target ES2020.

## File Structure

```
src/
├── main.ts                              # Plugin shell (132 lines) - lifecycle, settings, canvas button injection
├── debug.ts                             # Debug flag (2 lines) - controls console.debug() output
│
├── types/
│   ├── IOCCardsTypes.ts                 # IOC type definitions (286 lines) - 16 types with icons/colors/fields
│   └── IOCNodeData.ts                   # IOCNodeData interface (35 lines) - parsed IOC card data shape
│
├── canvas/
│   ├── CanvasToolbar.ts                 # Toolbar injection (141 lines) - addCanvasButtons, SVG icons, ToolbarContext
│   ├── CanvasSelection.ts              # Selection helper (88 lines) - getSelectedTechniqueId from canvas
│   ├── ReduceView.ts                    # Reduce toggle (85 lines) - toggleReduceView, node height management
│   ├── IOCCardCreation.ts              # Card creation (90 lines) - openIOCCardSelector, createIOCCard
│   ├── RenderIOCCards.ts               # Card templates (72 lines) - markdown generation with MITRE fields
│   └── RenderIOCCardsModal.ts          # IOC selector modal (122 lines) - type picker grid, OS sub-view
│
├── parsing/
│   ├── IOCParser.ts                     # Parser orchestrator (97 lines) - parseIOCNode, re-exports IOCNodeData
│   ├── IOCTypeDetection.ts             # Type detection (69 lines) - IOC_TYPE_PATTERNS, detectIOCType
│   ├── IOCFieldExtractors.ts           # Field extraction (240 lines) - extractValue/Time/Splunk/Mitre/CardId
│   └── IOCVisualLookup.ts              # Visual lookup (37 lines) - lookupTypeVisuals from IOC_TYPES
│
├── timeline/
│   ├── TimeTimelineProcessing.ts       # Timeline processor (79 lines) - chronological IOC sorting
│   ├── GraphTimelineTab.ts             # Graph timeline (434 lines) - drag-to-zoom, axis rendering, filtering
│   ├── LinkTimelineTab.ts              # Link timeline (305 lines) - hierarchical parent-child rendering
│   ├── LinkTimelineProcessing.ts       # Link grouping (195 lines) - arrow-based hierarchy, error detection
│   ├── TimelineCopyExport.ts           # Copy export (42 lines) - tab-separated text generation
│   └── RenderTimelinesModal.ts         # Timeline modal (197 lines) - tab orchestration, 3-mode UI
│
├── mitre/
│   ├── MitreTypes.ts                    # Shared interfaces (88 lines) - foundation, no deps
│   ├── MitreTextUtils.ts               # Description utils (58 lines) - cleanDescription, truncateDescription
│   ├── MitreSeverity.ts                # Severity helpers (74 lines) - isCriticalSeverity, applySeverityClass
│   ├── MitreSearch.ts                   # Search engine (204 lines) - parseSearchQuery, matchesSearch, highlight
│   ├── MitreAggregator.ts              # Matrix aggregation (562 lines) - 5-step IOC-to-MITRE algorithm
│   ├── MitreExport.ts                   # Navigator export (129 lines) - JSON layer file generation
│   ├── MitreResizable.ts               # Modal resize (129 lines) - 8-handle drag-to-resize
│   ├── MitreLoader.ts                   # Dataset loader (431 lines) - STIX 2.1 bundle parser
│   ├── MitreModalHelpers.ts            # Context & utils (131 lines) - MitreModalContext, toggleExpansion
│   ├── MitreModalTacticRenderer.ts     # Tactic renderer (386 lines) - renderTacticSection, subtechniques
│   ├── MitreModalValidation.ts         # Validation UI (162 lines) - renderValidationErrors, error categories
│   ├── MitreModalSearch.ts             # Search UI (169 lines) - renderSearchBar, handleSearchInput
│   └── RenderMitreModal.ts             # Modal orchestrator (246 lines) - class shell, lifecycle, getContext
│
└── settings/
    └── PluginSettings.ts                # Settings tab (68 lines) - card size, timeline toggle

MITRE/
└── enterprise-attack.json               # Official STIX 2.1 bundle (50MB+, ~800+ techniques)

styles.css                               # All styling (1,285 lines) - IOC cards, timelines, MITRE modal
manifest.json                            # Obsidian plugin manifest
esbuild.config.mjs                      # Build configuration
```

**Module dependency graph (arrows point upward to dependents):**
```
debug.ts, types/IOCNodeData.ts, types/IOCCardsTypes.ts     <- leaf modules (no deps)
    ↑
parsing/IOCTypeDetection.ts, IOCFieldExtractors.ts, IOCVisualLookup.ts
    ↑
parsing/IOCParser.ts                                        <- orchestrator
    ↑
timeline/TimeTimelineProcessing.ts, timeline/RenderTimelinesModal.ts
    ↑
mitre/MitreTypes.ts, MitreTextUtils.ts, MitreResizable.ts  <- leaf MITRE modules
    ↑
mitre/MitreSeverity.ts, MitreSearch.ts, MitreLoader.ts
    ↑
mitre/MitreAggregator.ts, MitreExport.ts
    ↑
mitre/MitreModalHelpers.ts, MitreModalTacticRenderer.ts, MitreModalValidation.ts, MitreModalSearch.ts
    ↑
mitre/RenderMitreModal.ts                                   <- top of MITRE tree
    ↑
canvas/CanvasToolbar.ts, CanvasSelection.ts, ReduceView.ts, IOCCardCreation.ts
    ↑
main.ts                                                      <- entry point
```

**Total:** ~5,792 lines TypeScript across 34 files (largest: MitreAggregator.ts at 562 lines)
