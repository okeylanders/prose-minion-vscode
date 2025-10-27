<p align="center">
  <img src="../assets/prose-minion-book.svg" alt="Prose Minion" width="120"/>
</p>

<p align="center">
  <strong>Prose Minion Developer Guide</strong><br/>
  Complete guide for developers working on the Prose Minion VS Code extension
</p>

---

# Developer Guide

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
- [Development Workflow](#development-workflow)
- [Project Architecture](#project-architecture)
- [Building and Packaging](#building-and-packaging)
- [Testing](#testing)
- [Debugging](#debugging)
- [Common Issues](#common-issues)
- [Publishing](#publishing)

## Prerequisites

- **Node.js 18+**
- **npm or yarn**
- **VS Code** (latest stable version recommended)

## Project Setup

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd prose-minion-vscode

# Install dependencies
npm install

# Start the development watcher
npm run watch
```

The `watch` command will continuously compile TypeScript changes for both the extension and webview.

## Development Workflow

### Running the Extension

1. **Start the watcher** (if not already running):
   ```bash
   npm run watch
   ```

2. **Launch Extension Development Host**:
   - Press **F5** in VS Code
   - A new window opens with `[Extension Development Host]` in the title
   - You should see: "Prose Minion extension activated!"

3. **Open the Extension Panel**:
   
   **Option A: Activity Bar Icon**
   - Click the hexagon icon in the left sidebar
   
   **Option B: Command Palette**
   - Press **Cmd+Shift+P** (Mac) or **Ctrl+Shift+P** (Windows/Linux)
   - Type: `Views: Show Prose Minion`
   - Press Enter
   
   **Option C: Right-click Menu**
   - Open any text file
   - Select some text
   - Right-click → "Analyze with Prose Minion"

### Making Changes

1. **Edit code** in `src/`
2. **Save files** - watcher automatically recompiles
3. **Reload Extension Development Host**:
   - Press **Cmd+R** (Mac) or **Ctrl+R** (Windows/Linux)
   - Or use Command Palette: `Developer: Reload Window`

### Hot Reload Tips

- **Extension code changes** (src/extension.ts, handlers, etc.) require reload
- **Webview changes** (React components) may require reload depending on the change
- **Configuration changes** (package.json) always require reload

## Project Architecture

The extension follows **Clean Architecture** principles with clear separation of concerns:

```
src/
├── application/           # Application layer
│   ├── handlers/         # Message handlers (domain-organized)
│   │   └── domain/       # Domain-specific handlers
│   ├── providers/        # VS Code view providers
│   └── services/         # Application services
├── domain/               # Domain layer
│   ├── models/          # Domain models
│   └── services/        # Domain service interfaces
├── infrastructure/       # Infrastructure layer
│   ├── api/            # External API clients (OpenRouter)
│   ├── context/        # Context resolution
│   ├── guides/         # Guide registry
│   ├── standards/      # Publishing standards
│   └── text/           # Text source resolution
├── presentation/         # Presentation layer
│   └── webview/        # React-based webview UI
│       ├── components/ # React components
│       ├── hooks/      # Custom React hooks
│       └── utils/      # UI utilities
├── shared/              # Shared code
│   └── types/          # Shared type definitions
│       └── messages/   # Message contracts (domain-organized)
├── tools/               # Prose Minion tool implementations
│   ├── assist/         # AI assistant tools
│   ├── measure/        # Measurement tools
│   ├── shared/         # Shared tool utilities
│   └── utility/        # Utility tools
└── extension.ts         # Extension entry point
```

### Key Architectural Concepts

**Message-Based Communication**:
- Webview ↔ Extension communication via typed message contracts
- Messages organized by domain (analysis, configuration, metrics, etc.)
- See `src/shared/types/messages/` for all contracts

**Domain Handlers**:
- Each domain has a dedicated handler module
- Handlers process specific message types
- Located in `src/application/handlers/domain/`

**Clean Separation**:
- UI knows nothing about VS Code APIs
- Extension code knows nothing about React
- Domain logic is independent of both

For complete architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Building and Packaging

### Development Build

```bash
npm run build
```

Outputs to `dist/` directory:
- `dist/extension.js` - Extension host code
- `dist/webview.js` - Webview UI bundle

### Production Package

```bash
# Create .vsix package
npm run package
```

This runs:
1. Clean build (`npm run build`)
2. `vsce package` to create the `.vsix` file

The `.vsix` file can be:
- Installed locally for testing
- Published to VS Code Marketplace
- Distributed directly

### Install Local Package

```bash
code --install-extension prose-minion-<version>.vsix
```

## Testing

### Manual Testing Checklist

**Analysis Tab**:
- [ ] Dialogue analysis with sample dialogue
- [ ] Prose analysis with sample prose
- [ ] Model selector changes work
- [ ] Results render correctly

**Metrics Tab**:
- [ ] Prose statistics generate
- [ ] Style flags detect patterns
- [ ] Word frequency analysis works
- [ ] Publishing standards comparison displays
- [ ] Chapter metrics for multi-file sources
- [ ] Copy/Save functionality works

**Search Tab**:
- [ ] Word search finds matches
- [ ] Context words display correctly
- [ ] Cluster detection works
- [ ] Case sensitivity toggle works

**Dictionary Tab**:
- [ ] Word lookups return results
- [ ] Inputs persist across tabs
- [ ] Source metadata displays

**Settings Overlay**:
- [ ] Gear icon opens overlay
- [ ] All settings load correctly
- [ ] Changes persist immediately
- [ ] Model dropdowns update
- [ ] Publishing Standards dropdowns work
- [ ] Reset Token Usage works
- [ ] Context Paths section displays
- [ ] Glob pattern primer renders correctly

**Integration**:
- [ ] Text selection populates input
- [ ] Right-click menu works
- [ ] Command palette command works
- [ ] Theme changes reflect immediately

### Test with Different Themes

1. Light themes (e.g., Light+)
2. Dark themes (e.g., Dark+)
3. High contrast themes

Verify all UI elements are readable and follow VS Code theming.

## Debugging

### View Extension Logs

**Console (Webview)**:
1. Open Extension Development Host
2. **Help** → **Toggle Developer Tools**
3. Go to **Console** tab
4. Look for "Prose Minion" messages

**Output Panel (Extension Host)**:
1. **View** → **Output** (Cmd+Shift+U)
2. Select **"Extension Host"** from dropdown
3. Look for activation/error messages

### Breakpoints

**Extension Code**:
1. Set breakpoints in `.ts` files in `src/`
2. Press F5 to start debugging
3. Breakpoints will hit when code executes

**Webview Code**:
1. Open Developer Tools in Extension Development Host
2. Find your webview source in Sources tab
3. Set breakpoints in browser DevTools

### Common Debug Scenarios

**Extension doesn't activate**:
- Check Output → Extension Host for errors
- Verify `dist/extension.js` exists
- Run `npm run build` manually

**Webview is blank**:
- Check browser console for JavaScript errors
- Verify `dist/webview.js` exists
- Check for CSP violations in console

**Changes not reflecting**:
- Ensure `npm run watch` is running
- Reload Extension Development Host (Cmd+R)
- Check for TypeScript compilation errors

**Message not reaching handler**:
- Check browser console for postMessage calls
- Verify message type matches contract
- Check handler registration in MessageHandler.ts

## Common Issues

### Port Already in Use

If you see "port already in use":
```bash
# Kill process on port (if using debug server)
lsof -ti:5000 | xargs kill -9
```

### TypeScript Errors

```bash
# Clear and rebuild
rm -rf dist/
npm run build
```

### Node Modules Issues

```bash
# Clean reinstall
rm -rf node_modules package-lock.json
npm install
```

### Webview Not Loading

1. Check `dist/webview.js` exists
2. Verify CSP in webview HTML
3. Check for JavaScript errors in browser console
4. Ensure webpack built successfully

### Extension Not Activating

1. Check `activationEvents` in package.json
2. Verify extension.ts exports `activate` function
3. Check Output → Extension Host for errors
4. Ensure all dependencies are installed

## Publishing

For complete publishing instructions, see **[PUBLISHING.md](PUBLISHING.md)**.

Quick reference:

```bash
# Update version
npm version patch  # or minor, or major

# Build and publish
npx @vscode/vsce publish
```

The Publishing Guide covers:
- Setting up publisher account and PAT
- Complete publishing workflow
- Version management
- Post-publishing verification
- Marketplace statistics
- Best practices

## AI Coding Assistants

This project supports multiple AI coding assistants through a unified configuration system. See **[AI_AGENTS_SETUP.md](AI_AGENTS_SETUP.md)** for complete details.

### Supported Tools

The project maintains symlinked configuration files for three AI agent tools:

| Agent Tool | Configuration File | Source |
|------------|-------------------|--------|
| **Codex** | `AGENTS.md` | `.ai/central-agent-setup.md` |
| **Claude Code** | `.claude/CLAUDE.md` | `.ai/central-agent-setup.md` |
| **Cline** | `.clinerules/prose-minion-agent.md` | `.ai/central-agent-setup.md` |

All symlinks point to **the same central file**, ensuring consistency.

### Setup

The symlinks should already exist, but if needed:

```bash
# Codex
ln -sf .ai/central-agent-setup.md AGENTS.md

# Claude Code
mkdir -p .claude
ln -sf ../.ai/central-agent-setup.md .claude/CLAUDE.md

# Cline
mkdir -p .clinerules
ln -sf ../.ai/central-agent-setup.md .clinerules/prose-minion-agent.md
```

### Documentation Resources

AI_AGENTS_SETUP.md covers:
- Multi-agent symlink configuration
- Project documentation structure (ADRs, Memory Bank, Epic/Sprint docs)
- Context loading strategies for AI sessions
- Best practices for AI collaboration
- When and how to create new documentation

**Key Directories**:
- `.ai/` - Central agent setup configuration (source file)
- `docs/adr/` - Architecture Decision Records
- `.memory-bank/` - Session notes for AI context
- `.todo/epics/` - Epic and sprint planning documents
- `docs/pr/` - PR description templates

## Additional Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Samples](https://github.com/microsoft/vscode-extension-samples)

## Getting Help

- Check [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- See [CONFIGURATION.md](CONFIGURATION.md) for settings reference
- Review [TOOLS.md](TOOLS.md) for tool documentation
- Read [AI_AGENTS_SETUP.md](AI_AGENTS_SETUP.md) for AI assistant workflows
- Open an issue on GitHub for bugs or questions
