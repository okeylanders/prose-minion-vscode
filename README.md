# Prose Minion VS Code Extension

AI-powered prose analysis and writing assistance for creative writers.

## Features

This extension brings the power of the Prose Minion MCP tools directly into VS Code with a multi-tab interface:

### Analysis Tab

- **Dialogue Analysis**: Get suggestions for dialogue tags and action beats
- **Prose Analysis**: General prose assistance and improvements

### Metrics Tab

- **Prose Statistics**: Word count, sentence analysis, pacing metrics
- **Style Flags**: Identify style patterns and potential issues
- **Word Frequency**: Analyze word usage patterns

### Suggestions Tab

- Coming soon: AI-powered writing suggestions

## Usage

1. Open the Prose Minion panel from the activity bar
2. Select text in your editor or paste text into the input field
3. Choose the appropriate tool from the tabs
4. Click the analysis button to get results

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

Currently using placeholder implementations. Future versions will integrate with:
- OpenRouter API for AI-powered analysis
- MCP protocol for tool communication

## License

MIT
