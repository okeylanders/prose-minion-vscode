# Prose Minion VS Code Extension

AI-powered prose analysis and writing assistance for creative writers.

## Features

This extension brings the power of the Prose Minion MCP tools directly into VS Code with a multi-tab interface:

### Analysis Tab

- **Dialogue Analysis**: Get suggestions for dialogue tags and action beats
- **Prose Analysis**: General prose assistance and improvements
- **Inline Model Picker**: Choose the OpenRouter model per assistant workflow without leaving the panel

### Metrics Tab

- **Prose Statistics**: Word count, sentence analysis, pacing metrics
- **Style Flags**: Identify style patterns and potential issues
- **Word Frequency**: Analyze word usage patterns
- **Inline Model Picker**: Select a dedicated model for dictionary utilities

### Suggestions Tab

- Coming soon: AI-powered writing suggestions

## Usage

1. Open the Prose Minion panel from the activity bar
2. Select text in your editor or paste text into the input field
3. (Optional) Pick the model you want to use from the dropdown below the tab bar
4. Choose the appropriate tool from the tabs
5. Click the analysis button to get results

## Architecture

This extension follows Clean Architecture principles:

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
npm run build
```

## Integration with Prose Minion

This extension is designed to integrate with the [Prose Minion MCP tool](../example-repos/prose-minion/).

### Model & Session Management

The extension manages three dedicated OpenRouter client stacks—assistant, dictionary, and (future) context bot—so each feature can run against a different model without reloading. Responses are cached while the panel is hidden, and UI state is restored when you return to the view, so long-running conversations continue seamlessly.

### Upcoming Integrations

- Deeper MCP protocol support for guide retrieval
- Additional analysis personas (character voice, setting analysis)
- Project-aware prompts and reusable presets

## License

MIT
