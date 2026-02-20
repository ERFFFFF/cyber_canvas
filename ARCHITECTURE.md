# Cyber Canvas UML Diagrams

Comprehensive UML documentation for the Cyber Canvas Obsidian plugin — a cybersecurity forensic analysis tool with IOC cards, MITRE ATT&CK integration, and timeline views. Four diagram types cover the full architecture.

---

## 1. Component Diagram (High-Level Subsystems)

```mermaid
graph TB
    subgraph Entry["Entry Point"]
        main["main.ts<br/>IOCCanvasPlugin"]
    end

    subgraph Canvas["canvas/ — UI Integration"]
        CT["CanvasToolbar"]
        CS["CanvasSelection"]
        RV["ReduceView"]
        ICC["IOCCardCreation"]
        RIC["RenderIOCCards"]
        RICM["RenderIOCCardsModal"]
        CE["CanvasEdges"]
        CCM["CanvasContextMenu"]
    end

    subgraph Parsing["parsing/ — IOC Extraction"]
        IP["IOCParser"]
        ITD["IOCTypeDetection"]
        IFE["IOCFieldExtractors"]
        IVL["IOCVisualLookup"]
    end

    subgraph Timeline["timeline/ — Temporal Views"]
        TTP["TimeTimelineProcessing"]
        TTT["TimeTimelineTab"]
        GTT["GraphTimelineTab"]
        GTH["GraphTimelineHelpers"]
        GTR["GraphTimelineRendering"]
        LTT["LinkTimelineTab"]
        LTCR["LinkTimelineCardRow"]
        LTP["LinkTimelineProcessing"]
        TCE["TimelineCopyExport"]
        RTM["RenderTimelinesModal"]
    end

    subgraph Mitre["mitre/ — ATT&CK Framework"]
        MT["MitreTypes"]
        MTU["MitreTextUtils"]
        MS["MitreSeverity"]
        MSR["MitreSearch"]
        MA["MitreAggregator"]
        MAT["MitreAggregatorTypes"]
        MACP["MitreAggregatorCardProc"]
        ME["MitreExport"]
        MR["MitreResizable"]
        ML["MitreLoader"]
        MSP["MitreStixParser"]
        MV["MitreValidation"]
        MCB["MitreCountBadge"]
        MSTR["MitreSubtechniqueRenderer"]
        MSB["MitreStatsBar"]
        MMH["MitreModalHelpers"]
        MMTR["MitreModalTacticRenderer"]
        MMV["MitreModalValidation"]
        MMS["MitreModalSearch"]
        RMM["RenderMitreModal"]
    end

    subgraph Types["types/ — Data Shapes"]
        ICT["IOCCardsTypes"]
        IND["IOCNodeData"]
    end

    subgraph Settings["settings/"]
        PS["PluginSettings"]
    end

    subgraph Shared["Shared"]
        DBG["debug.ts"]
    end

    main -->|"registers buttons"| Canvas
    main -->|"opens modals"| RTM & RMM
    main -->|"loads settings"| PS
    Canvas -->|"parses cards"| Parsing
    Canvas -->|"reads types"| Types
    Timeline -->|"parses IOC data"| Parsing
    Timeline -->|"reads edges"| CE
    Mitre -->|"parses IOC data via"| TTP
    Mitre -->|"reads types"| Types
    Parsing -->|"uses type defs"| Types

    style Entry fill:#4a90d9,color:#fff
    style Canvas fill:#5ba85b,color:#fff
    style Parsing fill:#d4a843,color:#fff
    style Timeline fill:#c76b4a,color:#fff
    style Mitre fill:#9b59b6,color:#fff
    style Types fill:#7f8c8d,color:#fff
    style Settings fill:#7f8c8d,color:#fff
    style Shared fill:#7f8c8d,color:#fff
```

---

## 2. Module Dependency Diagram

Arrows mean "imports from". Grouped by dependency layer (leaf -> entry point).

```mermaid
graph BT
    %% ===== LEAF MODULES (no internal deps) =====
    debug["debug.ts"]
    ICT["types/IOCCardsTypes"]
    IND["types/IOCNodeData"]
    ITD["parsing/IOCTypeDetection"]
    MT["mitre/MitreTypes"]
    MTU["mitre/MitreTextUtils"]
    GTH["timeline/GraphTimelineHelpers"]

    %% ===== LAYER 1 =====
    CT["canvas/CanvasToolbar"] --> debug
    RV["canvas/ReduceView"] --> debug
    CE["canvas/CanvasEdges"] --> debug
    CCM["canvas/CanvasContextMenu"] --> debug
    RIC["canvas/RenderIOCCards"] --> ICT
    RICM["canvas/RenderIOCCardsModal"] --> ICT
    IFE["parsing/IOCFieldExtractors"] --> debug
    IVL["parsing/IOCVisualLookup"] --> ICT
    MS["mitre/MitreSeverity"] --> MT
    MR["mitre/MitreResizable"] --> debug
    MSB["mitre/MitreStatsBar"] --> MT
    TCE["timeline/TimelineCopyExport"] --> IND
    LTCR["timeline/LinkTimelineCardRow"] --> IND
    GTR["timeline/GraphTimelineRendering"] --> IND
    GTR --> GTH

    %% ===== LAYER 2 =====
    MSR["mitre/MitreSearch"] --> MT
    MSR --> debug
    IP["parsing/IOCParser"] --> debug
    IP --> IND
    IP --> ITD
    IP --> IFE
    IP --> IVL

    %% ===== LAYER 2-3 (circular cluster) =====
    ML["mitre/MitreLoader"] --> debug
    ML -.->|"re-exports"| MV["mitre/MitreValidation"]
    ML --> MSP["mitre/MitreStixParser"]
    MSP -.->|"interfaces"| ML
    MV -.->|"interfaces"| ML
    MV --> debug
    MSP --> debug

    %% ===== LAYER 3 =====
    CS["canvas/CanvasSelection"] --> IP
    CS --> debug
    ICC["canvas/IOCCardCreation"] --> ICT
    ICC --> RICM
    ICC --> RIC
    ICC --> debug
    TTP["timeline/TimeTimelineProcessing"] --> IP
    TTP --> debug
    LTP["timeline/LinkTimelineProcessing"] --> IND
    LTP --> CE
    MAT["mitre/MitreAggregatorTypes"] --> IP
    MAT --> MT
    MAT --> ML
    MAT --> debug
    MMH["mitre/MitreModalHelpers"] --> MT
    MMH --> MTU
    MMH --> MSR
    MMH --> IND
    ME["mitre/MitreExport"] --> MT
    ME --> MS
    ME --> ML
    ME --> debug

    %% ===== LAYER 4 =====
    MACP["mitre/MitreAggregatorCardProc"] --> IP
    MACP --> MT
    MACP --> MS
    MACP --> ML
    MACP --> MAT
    MACP --> debug
    MCB["mitre/MitreCountBadge"] --> MT
    MCB --> MMH
    MCB --> ICT
    MCB --> debug
    GTT["timeline/GraphTimelineTab"] --> IND
    GTT --> TCE
    GTT --> GTH
    GTT --> GTR
    TTT["timeline/TimeTimelineTab"] --> IP
    TTT --> TCE
    TTT --> debug
    LTT["timeline/LinkTimelineTab"] --> LTP
    LTT --> IND
    LTT --> LTCR

    %% ===== LAYER 5 =====
    MA["mitre/MitreAggregator"] --> IP
    MA --> MT
    MA --> ML
    MA --> debug
    MA -.->|"re-exports"| MAT
    MA --> MACP
    MSTR["mitre/MitreSubtechniqueRenderer"] --> MT
    MSTR --> MTU
    MSTR --> MS
    MSTR --> MSR
    MSTR --> MMH
    MSTR --> MCB

    %% ===== LAYER 6 =====
    MMTR["mitre/MitreModalTacticRenderer"] --> MT
    MMTR --> MTU
    MMTR --> MS
    MMTR --> MSR
    MMTR --> MMH
    MMTR --> MCB
    MMTR --> debug
    MMV["mitre/MitreModalValidation"] --> MT
    MMV --> MS
    MMV --> debug

    %% ===== LAYER 7 =====
    MMS["mitre/MitreModalSearch"] --> MT
    MMS --> MSR
    MMS --> MMH
    MMS --> MMTR
    MMS --> debug
    RTM["timeline/RenderTimelinesModal"] --> TTP
    RTM --> TTT
    RTM --> GTT
    RTM --> CE
    RTM --> LTP
    RTM --> LTT
    RTM --> debug

    %% ===== LAYER 8 (top orchestrators) =====
    RMM["mitre/RenderMitreModal"] --> TTP
    RMM --> ML
    RMM --> debug
    RMM --> IND
    RMM --> MT
    RMM --> MA
    RMM --> ME
    RMM --> MR
    RMM --> MSB
    RMM --> MMH
    RMM --> MMTR
    RMM --> MSTR
    RMM --> MMV
    RMM --> MMS

    %% ===== LAYER 9 (entry point) =====
    MAIN["main.ts"] --> RTM
    MAIN --> RMM
    MAIN --> PS["settings/PluginSettings"]
    MAIN --> CT
    MAIN --> CS
    MAIN --> RV
    MAIN --> ICC
    MAIN --> CCM
    PS -.->|"type ref"| MAIN

    %% Styling
    style MAIN fill:#4a90d9,color:#fff
    style debug fill:#95a5a6,color:#fff
    style ICT fill:#7f8c8d,color:#fff
    style IND fill:#7f8c8d,color:#fff
    style MT fill:#7f8c8d,color:#fff
```

---

## 3. Class / Interface Diagram

### 3a. Core Data Types & Interfaces

```mermaid
classDiagram
    class IOCNodeData {
        <<interface>>
        +id: string
        +cardId?: string
        +type: string
        +value: string
        +time: string
        +splunkQuery: string
        +tactic: string
        +technique: string
        +icon: string
        +color: string
        +isChild?: boolean
    }

    class IOCField {
        <<interface>>
        +name: string
        +icon: string
        +color: string
        +fields: string[]
        +svg: string
        +os_icons?: OSIcons
    }

    class IOCCardsTypes {
        <<interface>>
        +[key: string]: IOCField
    }

    class EdgeData {
        <<interface>>
        +fromNodeId: string
        +toNodeId: string
    }

    IOCCardsTypes o-- IOCField : values

    class IOCCanvasPluginSettings {
        <<interface>>
        +cardSize: string
        +showTimelineButton: boolean
    }
```

### 3b. Classes (Inheritance from Obsidian)

```mermaid
classDiagram
    class Plugin {
        <<Obsidian>>
        +app: App
        +onload(): void
        +onunload(): void
    }

    class Modal {
        <<Obsidian>>
        +app: App
        +modalEl: HTMLElement
        +open(): void
        +close(): void
        +onOpen(): void
        +onClose(): void
    }

    class PluginSettingTab {
        <<Obsidian>>
        +app: App
        +display(): void
    }

    class IOCCanvasPlugin {
        +settings: IOCCanvasPluginSettings
        +isReducedView: boolean
        -canvasWrapperEl: HTMLElement|null
        +onload(): void
        +onunload(): void
        +loadSettings(): Promise~void~
        +saveSettings(): Promise~void~
        -injectCanvasButtons(): void
    }

    class RenderMitreModal {
        -plugin: any
        -mitreDataset: MitreDataset|null
        -subtechniquesMap: Map
        -currentSearchState: SearchState|null
        -currentTactics: MitreTactic[]|null
        -validationErrors: ValidationError[]
        -activeTechniqueId: string|null
        -iocDataMap: Map
        -iocCount: number
        -searchUI: SearchUIElements
        -TECHNIQUE_TRUNCATE_LIMIT: 180
        -SUBTECHNIQUE_TRUNCATE_LIMIT: 100
        +onOpen(): void
        +onClose(): void
        -getContext(): MitreModalContext
        -loadDataset(): Promise~void~
        -renderMitreMapping(): Promise~void~
    }

    class RenderTimelinesModal {
        -plugin: any
        +onOpen(): void
        +onClose(): void
    }

    class RenderIOCCardsModal {
        -iocTypes: IOCCardsTypes
        -onSelect: OnSelectCallback
        -title: string
        +onOpen(): void
        -showOSSelector(iocTypeId): void
        +onClose(): void
    }

    class PluginSettings {
        +plugin: IOCCanvasPlugin
        +display(): void
    }

    Plugin <|-- IOCCanvasPlugin
    Modal <|-- RenderMitreModal
    Modal <|-- RenderTimelinesModal
    Modal <|-- RenderIOCCardsModal
    PluginSettingTab <|-- PluginSettings

    IOCCanvasPlugin ..> RenderMitreModal : creates
    IOCCanvasPlugin ..> RenderTimelinesModal : creates
    IOCCanvasPlugin ..> PluginSettings : creates
    IOCCanvasPlugin --> IOCCanvasPluginSettings : holds
    RenderMitreModal --> MitreModalContext : builds via getContext()
```

### 3c. MITRE Data Types

```mermaid
classDiagram
    class MitreDataset {
        <<interface>>
        +version: string
        +last_updated: string
        +tactics: Record~string, TacticData~
        +techniques: Record~string, TechniqueData~
    }

    class TacticData {
        <<interface>>
        +id: string
        +name: string
        +short_name: string
        +description: string
        +abbreviations: string[]
    }

    class TechniqueData {
        <<interface>>
        +id: string
        +name: string
        +description: string
        +tactics: string[]
        +parent?: string
        +url: string
    }

    class MitreTechnique {
        <<interface>>
        +id: string
        +name: string
        +tactic: string
        +tacticId: string
        +count: number
        +iocCards: string[]
        +severity: SeverityLevel
        +validationMessage?: string
        +description?: string
        +isFound: boolean
    }

    class MitreTactic {
        <<interface>>
        +name: string
        +displayName?: string
        +techniques: MitreTechnique[]
    }

    class AggregationResult {
        <<interface>>
        +tactics: MitreTactic[]
        +validationErrors: ValidationError[]
        +subtechniquesMap: Map~string, MitreTechnique[]~
        +iocDataMap: Map~string, IOCNodeData~
        +iocCount: number
        +missingFields: MissingFieldsResult
    }

    class ValidationError {
        <<interface>>
        +techniqueId: string
        +techniqueName: string
        +severity: ErrorSeverity
        +message: string
        +iocCards: Array~CardRef~
    }

    class SearchState {
        <<interface>>
        +query: string
        +keywords: string[]
        +phrases: string[]
        +isActive: boolean
    }

    class MissingFieldsResult {
        <<interface>>
        +missingTactic: MissingFieldInfo[]
        +missingTechnique: MissingFieldInfo[]
    }

    MitreDataset o-- TacticData
    MitreDataset o-- TechniqueData
    MitreTactic o-- MitreTechnique
    AggregationResult o-- MitreTactic
    AggregationResult o-- ValidationError
    AggregationResult o-- MissingFieldsResult
```

### 3d. Context Interfaces & Timeline Types

```mermaid
classDiagram
    class ToolbarContext {
        <<interface>>
        +app: App
        +onTimeline: () => void
        +onAddCard: () => void
        +onChildCard: () => void
        +onReduce: () => boolean
        +onMitre: () => void
        +isReducedView: boolean
    }

    class MitreModalContext {
        <<interface>>
        +activeTechniqueId: string|null
        +currentSearchState: SearchState|null
        +subtechniquesMap: Map~string, MitreTechnique[]~
        +iocDataMap: Map~string, IOCNodeData~
        +TECHNIQUE_TRUNCATE_LIMIT: number
        +SUBTECHNIQUE_TRUNCATE_LIMIT: number
        +renderSubtechniques: Function
    }

    class ParentChildGroup {
        <<interface>>
        +parent: IOCNodeData
        +children: (IOCNodeData|ParentChildGroup)[]
    }

    class LinkTimelineResult {
        <<interface>>
        +groups: ParentChildGroup[]
        +badDirectionalCards: IOCNodeData[]
    }

    class GraphTimelineDOM {
        <<interface>>
        +controlsEl: HTMLElement
        +startInput: HTMLInputElement
        +endInput: HTMLInputElement
        +resetBtn: HTMLElement
        +graphArea: HTMLElement
        +axisEl: HTMLElement
        +tooltip: HTMLElement
        +selectionOverlay: HTMLElement
        +dots: HTMLElement[]
        +listContainer: HTMLElement
        +copyBtn: HTMLElement
    }

    class PaddedViewport {
        <<interface>>
        +paddedMin: number
        +paddedMax: number
        +paddedSpan: number
    }

    class CardRowOptions {
        <<interface>>
        +container: HTMLElement
        +ioc: IOCNodeData
        +showConnector?: boolean
        +depth?: number
        +extraClasses?: string[]
    }

    class SearchUIElements {
        <<interface>>
        +searchBar: HTMLInputElement|null
        +searchClearButton: HTMLElement|null
        +searchMatchCount: HTMLElement|null
    }

    LinkTimelineResult o-- ParentChildGroup
    ParentChildGroup o-- IOCNodeData
    MitreModalContext --> SearchState
```

### 3e. Type Aliases

```
SeverityLevel      = 'valid' | 'unknown_technique' | 'unknown_tactic' | 'mismatch' | 'not_found'
ValidationSeverity = 'valid' | 'unknown_technique' | 'unknown_tactic' | 'mismatch'
ErrorSeverity      = 'unknown_technique' | 'unknown_tactic' | 'mismatch'
```

---

## 4. Sequence Diagrams

### 4a. IOC Card Creation Flow

```mermaid
sequenceDiagram
    actor User
    participant Main as IOCCanvasPlugin
    participant CT as CanvasToolbar
    participant ICC as IOCCardCreation
    participant Modal as RenderIOCCardsModal
    participant RIC as RenderIOCCards
    participant Canvas as Canvas API

    Note over Main: Plugin loads -> injectCanvasButtons()
    Main->>CT: addCanvasButtons(ctx: ToolbarContext)
    CT->>CT: querySelector('.canvas-controls')
    CT->>CT: createToolbarButton('Parent Card', SVG, ctx.onAddCard)

    User->>CT: Clicks "Parent Card" button
    CT->>ICC: openIOCCardSelector(app, callback, 'Select Parent IOC Type')
    ICC->>Modal: new RenderIOCCardsModal(app, IOC_TYPES, onSelect)
    ICC->>Modal: .open()
    Modal->>Modal: onOpen() -- render grid of 16 IOC types

    alt Hostname type selected
        User->>Modal: Clicks "Hostname"
        Modal->>Modal: showOSSelector() -- 4 OS buttons
        User->>Modal: Clicks OS (e.g., "Windows Workstation")
        Modal->>ICC: onSelect('hostname', 'windows_workstation')
    else Other type selected
        User->>Modal: Clicks type (e.g., "IP Address")
        Modal->>ICC: onSelect('ip_address')
    end

    Modal->>Modal: close()
    ICC->>ICC: createIOCCard(app, iocTypeId, osType, isChild)
    ICC->>ICC: Generate cardId = "#YYYYMMDD-HHMM"
    ICC->>RIC: createCardContent(iocType, iocTypeId, osType, cardId, isChild)
    RIC-->>ICC: markdown string (HTML header + fields + MITRE fields)
    ICC->>Canvas: canvas.createTextNode({pos, size, text})
    ICC->>Canvas: canvas.requestSave()
    ICC->>User: Notice("Created {name} card")
```

### 4b. MITRE Modal Flow

```mermaid
sequenceDiagram
    actor User
    participant Main as IOCCanvasPlugin
    participant CS as CanvasSelection
    participant RMM as RenderMitreModal
    participant ML as MitreLoader
    participant SP as StixParser
    participant TTP as extractFixedIOCData
    participant IP as IOCParser
    participant MA as MitreAggregator
    participant MACP as AggregatorCardProc
    participant MV as MitreValidation
    participant Render as Rendering Functions

    User->>Main: Clicks MITRE crosshair button
    Main->>CS: getSelectedTechniqueId(app)
    CS-->>Main: activeTechniqueId (string | null)

    Main->>RMM: new RenderMitreModal(app, plugin, activeTechniqueId)
    RMM->>ML: loadMitreDataset(app)
    ML->>ML: Check cachedDataset
    alt First load
        ML->>ML: Read MITRE/enterprise-attack.json
        ML->>SP: parseStixBundle(stixBundle)
        Note over SP: Pass 0: version info<br/>Pass 1: tactics + abbreviations<br/>Pass 2: techniques + parents
        SP-->>ML: MitreDataset
        ML->>ML: Cache dataset
    end
    ML-->>RMM: MitreDataset

    Main->>RMM: .open()
    RMM->>RMM: onOpen() -- makeResizable, create header
    RMM->>Render: renderSearchBar(header, callback)
    RMM->>RMM: renderMitreMapping(content, stats) [async]

    RMM->>TTP: extractFixedIOCData(app)
    TTP->>IP: canvas.nodes.forEach -> parseIOCNode(node)
    Note over IP: See Sequence 4d
    IP-->>TTP: IOCNodeData per node
    TTP-->>RMM: iocData: IOCNodeData[]

    RMM->>MA: aggregateTacticsTechniques(iocData, dataset)
    MA->>MACP: STEP 1: buildFoundTechniquesFromIOC(iocData, dataset)
    loop Each IOC card with technique
        MACP->>MV: validateTechniqueTactic(techId, tactic, dataset)
        MV-->>MACP: {severity, message?, tacticId?}
    end
    MACP-->>MA: BuildFoundResult (foundTechniques, cardValidations, missing*)

    Note over MA: STEP 2: Build tacticMap from dataset (14 tactics)<br/>STEP 3: Populate techniques (found=highlighted, unfound=gray)<br/>STEP 4: Sort by TACTIC_ORDER, found-first<br/>STEP 5: Build validationErrors from cardValidations
    MA-->>RMM: AggregationResult

    RMM->>Render: renderStatsBar(stats, tactics, iocCount, missingFields)
    RMM->>RMM: getContext() -> MitreModalContext
    RMM->>Render: renderValidationErrors(container, errors)
    loop Each of 14 tactics
        RMM->>Render: renderTacticSection(container, tactic, ctx, searchState)
    end
```

### 4c. Timeline Modal Flow

```mermaid
sequenceDiagram
    actor User
    participant Main as IOCCanvasPlugin
    participant RTM as RenderTimelinesModal
    participant TTP as extractFixedIOCData
    participant IP as IOCParser
    participant CE as CanvasEdges
    participant LTP as LinkTimelineProcessing
    participant TTT as TimeTimelineTab
    participant GTT as GraphTimelineTab
    participant LTT as LinkTimelineTab

    User->>Main: Clicks Timeline clock button
    Main->>RTM: new RenderTimelinesModal(app, plugin).open()

    RTM->>RTM: onOpen() -- create tab bar (Time | Graph | Link)

    RTM->>TTP: extractFixedIOCData(app)
    TTP->>IP: canvas.nodes.forEach -> parseIOCNode(node)
    IP-->>TTP: IOCNodeData[]
    TTP-->>RTM: iocData (flat array)
    RTM->>RTM: sortedData = sort by time ascending

    Note over RTM: Render all 3 tabs (only Time visible initially)

    RTM->>TTT: renderTimeTimeline(timeTab, sortedData)
    Note over TTT: Chronological cards + gradient connectors + copy btn

    RTM->>GTT: renderGraphTimeline(graphTab, sortedData)
    Note over GTT: Dot axis + drag-to-zoom + filtered list + copy btn

    RTM->>CE: getCanvasEdges(app)
    CE-->>RTM: edges: EdgeData[]
    RTM->>LTP: buildParentChildGroups(iocData, edges)
    Note over LTP: Build hierarchy from [P]->[C] edges<br/>Detect C->P violations
    LTP-->>RTM: LinkTimelineResult {groups, badDirectionalCards}
    RTM->>LTT: renderLinkTimeline(linkTab, result)
    Note over LTT: Expandable [P]/[C] hierarchy + error section

    User->>RTM: Clicks tab button (Graph / Link)
    RTM->>RTM: Hide other tabs, show selected tab
```

### 4d. IOC Parsing Flow (parseIOCNode)

```mermaid
sequenceDiagram
    participant Caller as Caller (extractFixedIOCData)
    participant IP as IOCParser
    participant ITD as IOCTypeDetection
    participant IFE as IOCFieldExtractors
    participant IVL as IOCVisualLookup

    Caller->>IP: parseIOCNode(node)
    IP->>IP: Check node.text exists

    IP->>ITD: detectIOCType(node.text)
    Note over ITD: Test 16 regex patterns in order<br/>(File Hash before File, etc.)
    ITD-->>IP: iocType: string (e.g., "IP Address")

    alt No type matched
        IP-->>Caller: return null
    end

    IP->>IFE: extractValue(text)
    Note over IFE: Find first field after HTML header<br/>Extract up to separator/next field
    IFE-->>IP: value: string

    IP->>IFE: extractTime(text)
    Note over IFE: 6 regex patterns in precedence order
    IFE-->>IP: time: string (ISO format)

    IP->>IFE: extractSplunkQuery(text)
    IFE-->>IP: splunkQuery: string

    IP->>IFE: extractTactic(text)
    Note over IFE: /Mitre Tactic:[ \t]*/i<br/>Uses [ \t]* not \s* to avoid newline match
    IFE-->>IP: tactic: string (UPPERCASE)

    IP->>IFE: extractTechnique(text)
    IFE-->>IP: technique: string

    IP->>IFE: extractCardId(text)
    Note over IFE: HTML comment or "Card ID:" field
    IFE-->>IP: cardId: string

    IP->>IFE: extractCardRole(text)
    Note over IFE: [P] -> 'parent', [C] -> 'child'
    IFE-->>IP: role: 'parent' | 'child' | ''

    IP->>IVL: lookupTypeVisuals(iocType, fallbackColor)
    Note over IVL: Search IOC_TYPES for matching SVG + color
    IVL-->>IP: {icon: string, color: string}

    IP->>IP: Assemble IOCNodeData object
    IP-->>Caller: IOCNodeData (or null)
```
