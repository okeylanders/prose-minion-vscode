# Prose Minion VS Code Extension

AI-powered prose analysis and writing assistance for creative writers.

## Features

This extension brings the power of the Prose Minion MCP tools directly into VS Code with a multi-tab interface:

### Analysis Tab

- **Dialogue Analysis**: Get suggestions for dialogue tags and action beats
- **Prose Analysis**: General prose assistance and improvements
- **Inline Model Picker**: Choose the OpenRouter model per assistant workflow without leaving the panel

### Metrics Tab

- **Prose Statistics**: Word count, sentence analysis, pacing metrics, lexical density, stopword ratio, hapax %, FKGL
- **Style Flags**: Identify style patterns and potential issues
- **Word Frequency**: Analyze word usage patterns
- **Publishing Standards**: Compare key metrics to genre/manuscript ranges, see publishing format (trim size, words/page, estimated page count)
- **Chapter Metrics**: Chapter count, average chapter length (multi-file sources)
- **Chapter-by-Chapter**: Summary table per file; export can include detailed per-chapter tables on request
- **Inline Model Picker**: Select a dedicated model for dictionary utilities

See [docs/PROSE_STATS.md](docs/PROSE_STATS.md) for algorithms and the full legend of metrics.

### Dictionary Tab

- Fiction‑focused dictionary entries with definitions, connotations, tonal notes, usage examples, and related words
- Respects the dedicated Dictionary model selection for speed/cost tuning
- Inputs persist across tab switches and sessions; source of pasted data is shown when available
- Tool details: [docs/TOOLS.md](docs/TOOLS.md)

### Search Tab

- Word Search with configurable targets, context window, cluster detection, and case sensitivity
- Optional assistant expansion setting to propose synonyms/inflections (config only; UI toggle wired for future backend)
- Settings surfaced in overlay: `Word Search` section; keys documented in [docs/CONFIGURATION.md](docs/CONFIGURATION.md)

### Settings Overlay

- Full-screen in-app settings (gear icon in the panel header)
- Centered header with stacked icon over the title
- Context Resource Paths section to configure project globs used by the Context Assistant
- Reset Token Usage button and optional token widget in the header

## Usage

1. Open the Prose Minion panel from the activity bar
2. Select text in your editor or paste text into the input field
3. (Optional) Pick the model you want to use from the dropdown below the tab bar
4. Choose the appropriate tool from the tabs
5. Click the analysis button to get results
6. In Metrics, select a standards preset (optional) and trim size to see comparison and a publishing format summary
7. Use Copy/Save in Metrics; you’ll be prompted to include detailed per-chapter tables when available
8. Open the Settings overlay (gear icon) to configure models, tokens, and Context Resource Paths

## Recent Updates

- Scoped model selection per tool role (assistant/dictionary/context) with live dropdowns
- Unified `maxTokens` across tools (default 10000) with truncation notices on long responses
- In-app Settings overlay refinements: centered header (stacked icon over title) and a new “Context Resource Paths” section that mirrors VS Code settings
- Verbalized sampling in the Analysis assistants for more creative, character‑specific alternatives while maintaining craft quality (diverse suggestions sampled from tails of the distribution)
- Publishing standards: genre presets + trim size, comparison table, publishing format with page estimate
- Prose stats extended: lexical density (content-word ratio), stopword ratio, hapax %, hapax count, TTR, FKGL
- Chapter aggregation for multi-file metrics with per-chapter summary and optional detailed export
- Copy/Save prompt to include chapter details; metrics saved to `prose-minion/reports/prose-statistics-YYYYMMDD-HHmm.md`
- Context assistant includes the full source document on first turn (when available)
- Paste-selection carries source metadata; clipboard fallback when no selection exists
- Dictionary UX: persistent inputs, source display, and safer auto-fill behavior

## Architecture

This extension follows Clean Architecture principles (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):

```
src/
├── application/        # Application layer (providers, handlers)
├── domain/            # Domain layer (business logic, interfaces)
├── infrastructure/    # Infrastructure layer (external APIs)
├── presentation/      # Presentation layer (React UI)
└── shared/           # Shared types and contracts
```

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
npm install
npm run watch
```

Then press F5 to launch the extension in debug mode.

### Building

```bash
# Dev bundle
npm run build

# Production package (.vsix)
npm run package
```

## Configuration

Settings (search for "Prose Minion"):

- `proseMinion.assistantModel`, `proseMinion.dictionaryModel`, `proseMinion.contextModel`
- `proseMinion.model` (legacy fallback)
- `proseMinion.maxTokens` (default 10000)
- `proseMinion.publishingStandards.preset` (none | manuscript | genre:<key>)
- `proseMinion.publishingStandards.pageSizeKey` (format or WIDTHxHEIGHT for selected genre)

Additional commonly used settings:

- `proseMinion.openRouterApiKey`
- `proseMinion.includeCraftGuides` (boolean)
- `proseMinion.temperature` (0–2)
- `proseMinion.ui.showTokenWidget` (boolean)
- Context Resource Paths: `proseMinion.contextPaths.{characters,locations,themes,things,chapters,manuscript,projectBrief,general}` — can also be edited in the in-app Settings overlay; see docs/CONFIGURATION.md for examples

Notes:
- When the model stops due to token limits, a truncation notice is appended; raise `maxTokens` if needed.

### Model & Session Management

The extension manages three dedicated OpenRouter client stacks—assistant, dictionary, and context bot—so each feature can run against a different model without reloading. Responses are cached while the panel is hidden, and UI state is restored when you return to the view, so long-running conversations continue seamlessly.

### Upcoming Integrations

- Deeper MCP protocol support for guide retrieval
- Additional analysis personas (character voice, setting analysis)
- Project-aware prompts and reusable presets

## License

AGPL-3.0 with Commons Clause (no resale, no closed‑source derivatives). See the [LICENSE](LICENSE) file for details.

Notes:
- The Commons Clause makes this license "source‑available" rather than OSI‑approved open source.
- If you need a commercial or alternative license, open an issue to discuss options.
