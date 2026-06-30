# Configuration

> **Status**: Current as of v2.0.1. Settings live in `apps/vscode-extension/package.json` under `contributes.configuration`.

## Accessing Settings

- **In-app**: Click the **gear icon** in the Prose Minion panel header to open the Settings Overlay.
- **VS Code Settings**: `Cmd+,` (Mac) / `Ctrl+,` (Windows/Linux) and search "Prose Minion".

All settings sync bidirectionally between the Settings Overlay and the VS Code Settings panel via the Domain Hooks pattern ([ADR 2025-11-03](adr/2025-11-03-unified-settings-architecture.md)).

---

## OpenRouter API Key (Required for AI Tools)

The API key is **not** stored in `settings.json`. It lives in VS Code's **SecretStorage** — OS-level encrypted storage (macOS Keychain, Windows Credential Manager, Linux libsecret).

- **Setting**: `proseMinion.openRouterApiKey` (legacy, migrated once automatically)
- **Storage**: SecretStorage via the `SecretStore` platform port
- **How to set**: Settings Overlay → "OpenRouter API Key" field → Save

**Get a key**: [openrouter.ai](https://openrouter.ai/) → Sign up → API Keys → Create key.

> **Note**: Measurement tools (Prose Statistics, Style Flags, Word Frequency) and Word Search work **without** an API key.

---

## AI Model Selection

Scoped models per feature. Each scope can use a different model to balance cost and quality. The in-app **Model Browser** lets you search by provider, family, pricing, release date, and context window.

| Setting | Scope | Default | Used By |
|---------|-------|---------|---------|
| `proseMinion.assistantModel` | Assistant | `anthropic/claude-sonnet-5` | Prose & dialogue analysis |
| `proseMinion.dictionaryModel` | Dictionary | `anthropic/claude-haiku-4.5` | Dictionary/utility lookups |
| `proseMinion.contextModel` | Context | `openai/gpt-5.4` | Context assistant |
| `proseMinion.categoryModel` | Category Search | `anthropic/claude-sonnet-5` | Semantic word discovery |

Model IDs are curated and verified against the live OpenRouter API. See the Model Browser in the Settings Overlay for the full list.

---

## General AI Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `proseMinion.temperature` | number (0–2) | `0.7` | AI creativity: 0 = focused, 2 = very creative |
| `proseMinion.maxTokens` | number (100–100000) | `10000` | Max response length (applied uniformly across all tools). Responses hitting the cap show a truncation notice. |
| `proseMinion.includeCraftGuides` | boolean | `true` | Include craft guides in AI prompts (writing best practices, sensory details, scene examples) |
| `proseMinion.applyContextWindowTrimming` | boolean | `true` | Auto-trim large inputs to prevent context window errors |

---

## UI Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `proseMinion.ui.showTokenWidget` | boolean | `true` | Show session token usage widget in header |
| `proseMinion.ui.sidebarTheme` | string | `follow-vscode` | Sidebar palette: `follow-vscode` (default) or a warm-dark option |

---

## Word Search Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `proseMinion.wordSearch.contextWords` | number | `3` | Words shown around each match |
| `proseMinion.wordSearch.clusterWindow` | number | `50` | Max word distance to group matches into a cluster |
| `proseMinion.wordSearch.minClusterSize` | number | `2` | Min matches to form a cluster |
| `proseMinion.wordSearch.caseSensitive` | boolean | `false` | Case-sensitive matching |
| `proseMinion.wordSearch.enableAssistantExpansion` | boolean | `false` | AI-based expansion for target words (synonyms, inflections) |

---

## Word Frequency Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `proseMinion.wordFrequency.topN` | number | `100` | Top N words/lemmas to display |
| `proseMinion.wordFrequency.includeHapaxList` | boolean | `true` | Show hapax (frequency=1) word list |
| `proseMinion.wordFrequency.hapaxDisplayMax` | number | `300` | Max hapax words shown inline |
| `proseMinion.wordFrequency.includeStopwordsTable` | boolean | `true` | Show top stopwords table |
| `proseMinion.wordFrequency.contentWordsOnly` | boolean | `true` | Exclude stopwords from top words |
| `proseMinion.wordFrequency.posEnabled` | boolean | `true` | Enable POS sections via wink-pos-tagger |
| `proseMinion.wordFrequency.includeBigrams` | boolean | `true` | Show top bigrams |
| `proseMinion.wordFrequency.includeTrigrams` | boolean | `true` | Show top trigrams |
| `proseMinion.wordFrequency.enableLemmas` | boolean | `false` | Show lemmatized top words |
| `proseMinion.wordFrequency.lengthHistogramMaxChars` | number | `10` | Max word length in histogram |
| `proseMinion.wordFrequency.minCharacterLength` | number | `1` | Min word length filter (UI exposes 1+ through 6+ tabs) |

> POS tagging uses `wink-pos-tagger` bundled with the extension — no runtime downloads.

---

## Category Search Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `proseMinion.categorySearch.ngramMode` | string | `words` | Default mode: `words`, `bigrams`, or `trigrams` |
| `proseMinion.categorySearch.minPhraseOccurrences` | number | `2` | Min phrase occurrences for n-gram searches |

---

## Context Resource Paths

Comma-separated glob patterns for project reference files. Only `.md` and `.txt` files are indexed. Editable in the Settings Overlay under "Context Paths".

| Group | Setting | Default |
|-------|---------|---------|
| Characters | `proseMinion.contextPaths.characters` | `characters/**/*,Characters/**/*` |
| Locations | `proseMinion.contextPaths.locations` | `locations/**/*,Locations/**/*,Locations-Settings/**/*` |
| Themes | `proseMinion.contextPaths.themes` | `themes/**/*,Themes/**/*` |
| Things / Props | `proseMinion.contextPaths.things` | `things/**/*,Things/**/*` |
| Draft Chapters & Outlines | `proseMinion.contextPaths.chapters` | `drafts/**/*,Drafts/**/*,outlines/**/*,Outlines/**/*` |
| Manuscript Chapters | `proseMinion.contextPaths.manuscript` | `manuscript/**/*,Manuscript/**/*` |
| Project Brief | `proseMinion.contextPaths.projectBrief` | `brief/**/*,Brief/**/*` |
| General References | `proseMinion.contextPaths.general` | `research/**/*,Research/**/*,tone-and-style/**/*,Tone-And-Style/**/*,literary-devices/**/*,Literary-Devices/**/*,**/story-bible.md,**/synopsis.md,**/voice-and-tone.md,**/genre-conventions.md` |

Changes apply immediately — the next context request picks up the new patterns.

---

## Publishing Standards

Used for Metrics tab comparison and publishing format estimates.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `proseMinion.publishingStandards.preset` | string | `none` | `none`, `manuscript`, or `genre:<slug\|abbr\|name>` |
| `proseMinion.publishingStandards.pageSizeKey` | string | `""` | Trim size key (uses `format` when available, else `WxH`) |

> **Note**: Lexical density is the content-word ratio (non-stopwords/total) × 100. Type-Token Ratio (TTR) is a separate metric.

---

## Reports

Metrics reports are saved to:

```
prose-minion/reports/prose-statistics-YYYYMMDD-HHmm.md
```

On save/copy, a modal prompt asks whether to include the "## Chapter Details" breakdown. The on-screen summary table is always preserved.

---

## Session Persistence

The webview persists active tab, latest results, model selections, and UI state via VS Code webview storage. Long-running API requests continue in the background; cached responses are replayed when you return.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "API key not configured" | Settings Overlay → paste key → Save. Verify at [openrouter.ai](https://openrouter.ai/) |
| Responses truncated | Increase `proseMinion.maxTokens` |
| Responses too creative | Lower `proseMinion.temperature` (try 0.3–0.5) |
| High cost | Use cheaper models (e.g., Haiku for dictionary), disable craft guides, reduce max tokens, use free measurement tools first |

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design, ports/adapters, composition root
- [TOOLS.md](TOOLS.md) — Tool inventory and capabilities
- [TESTING.md](TESTING.md) — Test strategy and commands
- [Adding Settings Guide](guides/ADDING_SETTINGS.md) — How to add a new setting end-to-end
