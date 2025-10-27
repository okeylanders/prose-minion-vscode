<p align="center">
  <img src="assets/prose-minion-book.svg" alt="Prose Minion" width="200"/>
</p>

<p align="center">
  <strong>AI-powered prose analysis and writing assistance for creative writers</strong>
</p>

<p align="center">
  Bring professional-grade prose metrics, AI writing assistance, and contextual analysis directly into your VS Code workflow.
</p>

---

# Prose Minion

## ✨ Features

### 📖 Writer's Dictionary

Fiction-focused definitions with creative context:

- **Craft-Aware Definitions** - Understand words in a writing context
- **Tonal Guidance** - Learn connotations and emotional weight
- **Usage Examples** - See words used in narrative prose
- **Related Terms** - Discover alternatives and related concepts

### 📝 AI Writing Assistance

Get intelligent suggestions for your creative writing with dedicated AI models:

- **Dialogue Analysis** - Enhance dialogue with natural tags and action beats
- **Prose Refinement** - Strengthen narrative passages with craft-focused suggestions
- **Contextual Insights** - Project-aware assistance that understands your characters, settings, and themes
- **Model Flexibility** - Choose from multiple AI models per workflow

### 📊 Professional Prose Metrics

Comprehensive analysis tools for understanding your writing:

- **Prose Statistics** - Word count, sentence analysis, pacing metrics, lexical density, readability scores
- **Publishing Standards** - Compare your metrics against genre-specific benchmarks
- **Style Flags** - Identify patterns like placeholders, intensifiers, hedges, filler words
- **Word Frequency** - Analyze vocabulary usage, n-grams, hapax legomena
- **Chapter Analysis** - Aggregate metrics across multiple files with per-chapter breakdowns

### 🔍 Advanced Search

Find patterns and track word usage across your manuscript:

- **Pattern Matching** - Search for specific words or phrases with context
- **Cluster Detection** - Identify repeated patterns and potential overuse
- **Configurable Context** - See surrounding words for each match
- **Case Sensitivity** - Toggle exact matching as needed

### ⚙️ In-App Settings

Configure everything without leaving your workspace:

- **Model Selection** - Choose AI models per tool (assistant, dictionary, context)
- **Publishing Presets** - Genre-specific standards and trim sizes
- **Context Paths** - Define your project structure with glob patterns
- **Token Management** - Track usage and reset session totals
- **Complete Control** - Access all settings via friendly UI with inline help

---

## 🚀 Getting Started

### Installation

1. Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/)
2. Open the Prose Minion panel from the activity bar (hexagon icon)
3. Configure your OpenRouter API key in Settings (gear icon)

### Quick Start

1. **Select text** in your editor or paste into the panel
2. **Choose a tab** - Analysis, Metrics, Search, or Dictionary
3. **Select a model** (optional) - Pick from the dropdown below tabs
4. **Click analyze** - Get instant AI-powered results
5. **Configure settings** - Click the gear icon for full control

### First Time Setup

1. **Get an OpenRouter API Key**:
   - Visit [openrouter.ai](https://openrouter.ai/)
   - Create a pay-as-you-go account
   - Generate an API key

2. **Add Your Key**:
   - Open Settings (gear icon in panel header)
   - Paste your key in the "OpenRouter API Key" field
   - Changes save automatically

3. **Choose Your Models**:
   - Select models for Assistant, Dictionary, and Context workflows
   - Each can use a different model for cost/quality balance

---

## 📚 Key Capabilities

### Publishing Standards Comparison

Compare your work against industry benchmarks:

- **Genre Presets** - Choose from multiple fiction categories
- **Trim Size Selection** - Calculate page counts for standard book formats
- **Metric Comparison** - See how your stats compare to genre ranges
- **Publishing Format** - Get estimated page counts and words-per-page

### Context-Aware Assistance

The extension understands your project structure:

- **Project Resources** - Configure paths to characters, locations, themes
- **Automatic Discovery** - Uses glob patterns to find your reference files
- **Contextual Suggestions** - AI assistance informed by your world-building
- **Flexible Organization** - Works with your existing project structure

### Advanced Metrics

Go beyond basic word count:

- **Lexical Density** - Content word ratio
- **Stopword Analysis** - Function word balance
- **Hapax Legomena** - Unique vocabulary tracking
- **Type-Token Ratio** - Vocabulary diversity
- **Flesch-Kincaid Grade Level** - Readability scoring
- **N-gram Analysis** - Bigrams and trigrams for pattern detection

---

## 🎯 Use Cases

### For Novelists

- Track chapter-by-chapter metrics across your manuscript
- Compare prose statistics against genre standards
- Identify overused words and phrases
- Generate contextual writing suggestions

### For Short Story Writers

- Analyze pacing and structure
- Refine dialogue with AI assistance
- Check vocabulary variety
- Ensure consistent tone

### For Content Creators

- Maintain consistent voice across pieces
- Track readability for target audience
- Identify style patterns
- Generate alternative phrasings

---

## 🛠️ Technical Details

### Architecture

Built with **Clean Architecture** principles:
- Separation of concerns across layers
- Domain-driven design
- Message-based communication
- Extensible tool system

### Privacy & Security

- API calls route through OpenRouter
- Configurable privacy options (no logging, no training)
- Local-first processing where possible
- Your writing stays in your workspace

### Requirements

- VS Code 1.85.0 or higher
- Node.js 18+ (for development only)
- OpenRouter API account (pay-as-you-go)

---

## 📖 Documentation

- **[Developer Guide](docs/DEVELOPER_GUIDE.md)** - Setup, architecture, and development workflow
- **[Architecture](docs/ARCHITECTURE.md)** - System design and principles
- **[Configuration](docs/CONFIGURATION.md)** - Complete settings reference
- **[Tools Reference](docs/TOOLS.md)** - Detailed tool documentation
- **[Prose Stats](docs/PROSE_STATS.md)** - Metrics algorithms and legend

---

## 🔄 Recent Updates

### Latest Features

- **Context Resource Paths** - Configure project structure via Settings overlay
- **Glob Pattern Education** - Learn recursive patterns with visual examples
- **Centered Settings Header** - Improved layout with stacked icon design
- **Token Usage Widget** - Optional token tracking in panel header
- **Publishing Standards** - Genre presets with trim size selection
- **Extended Metrics** - Lexical density, hapax analysis, readability scores

### Recent Improvements

- Scoped model selection per tool role (assistant/dictionary/context)
- Verbalized sampling for creative, diverse AI suggestions
- Chapter aggregation for multi-file manuscripts
- Enhanced copy/save with optional chapter details
- Persistent dictionary inputs with source metadata
- Settings overlay with comprehensive inline help

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

---

## 🤝 Contributing

We welcome contributions! See the **[Developer Guide](docs/DEVELOPER_GUIDE.md)** for:
- Development setup
- Project architecture
- Testing procedures
- Publishing workflow

---

## 📄 License

**AGPL-3.0 with Commons Clause** - Source-available, no resale, no closed-source derivatives.

This means:
- ✅ Free to use for personal and open-source projects
- ✅ Full source code available
- ✅ Modify and share under the same terms
- ❌ Cannot resell or create proprietary derivatives

See [LICENSE](LICENSE) for complete terms. For commercial licensing inquiries, please open an issue.

---

## 🙏 Acknowledgments

Built with:
- [OpenRouter](https://openrouter.ai/) - AI model routing
- [VS Code Extension API](https://code.visualstudio.com/api) - Platform
- [React](https://react.dev/) - UI framework
- Open source prose analysis algorithms

Development assisted by:
- [Cline](https://github.com/cline/cline) - AI coding assistant for VS Code
- [Claude Code](https://www.anthropic.com/claude) - AI pair programming
- [OpenAI Codex](https://openai.com/index/openai-codex/) - Code generation and analysis

---

<p align="center">
  <strong>Happy Writing! 📚✨</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/">Install from Marketplace</a> •
  <a href="docs/DEVELOPER_GUIDE.md">Developer Guide</a> •
  <a href="https://github.com/yourusername/prose-minion-vscode/issues">Report Issue</a>
</p>
