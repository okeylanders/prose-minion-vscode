# Configuration Guide

## Overview

Prose Minion offers extensive configuration options to customize AI behavior and optimize costs. Recent updates introduce scoped model selection per feature and a unified token limit.

## Accessing Settings

1. Open VS Code Settings: `Cmd+,` (Mac) or `Ctrl+,` (Windows/Linux)
2. Search for "Prose Minion"
3. Configure the options below

## Configuration Options

### 1. OpenRouter API Key (Required for AI Tools)

**Setting**: `proseMinion.openRouterApiKey`
**Type**: String
**Default**: `""` (empty)

**How to get an API key**:
1. Go to https://openrouter.ai/
2. Sign up for an account
3. Navigate to "API Keys"
4. Create a new key
5. Copy and paste into this setting

**Security Note**: Your API key is stored locally in VS Code settings. Never share it or commit it to version control.

---

### 2. AI Model Selection

The extension now separates models by feature so you can tune cost, latency, and quality for each workflow.

| Feature | Settings Key | UI Override | Default |
|---------|--------------|-------------|---------|
| Dialogue & Prose Assistants | `proseMinion.assistantModel` | Analysis tab dropdown | `z-ai/glm-4.6` |
| Dictionary Utility | `proseMinion.dictionaryModel` | Utilities tab dropdown | `z-ai/glm-4.6` |
| Context Assistant | `proseMinion.contextModel` | Settings only (auto-applied) | `z-ai/glm-4.6` |
| Legacy fallback | `proseMinion.model` | Used only if a scoped model is unset | `z-ai/glm-4.6` |

**How it works**

1. Pick a model in Settings or via the dropdown under the tab bar.
2. The selection updates immediately in Settings (no reload required).
3. The next request for that scope uses the new model.

> Tip: Use a premium model (e.g., Claude Opus) for prose critique while keeping the dictionary on a faster, cheaper model.

**Recommended Combos**

- **Balanced**: Assistant → `anthropic/claude-sonnet-4.5`, Dictionary → `z-ai/glm-4.5`
- **Speed first**: Assistant → `google/gemini-2.5-flash`, Dictionary → `x-ai/grok-4-fast`
- **Premium**: Assistant → `anthropic/claude-opus-4.1`, Dictionary → `openai/gpt-5-chat`

You can still edit only `proseMinion.model` for backward compatibility; the extension cascades that value to any scope that is left blank. The context assistant always re-reads `proseMinion.contextModel` just before it runs, so you can switch models mid-session without reloading the extension.

---

### 3. Include Craft Guides

**Setting**: `proseMinion.includeCraftGuides`
**Type**: Checkbox
**Default**: `true` (enabled)

**What it does**:
- When enabled: AI receives 68 craft guides with writing best practices
- When disabled: AI uses only tool-specific prompts

**Craft Guides Include**:
- Descriptors catalogs (sensory details, emotions, movements)
- Transformation guides (filler words, weak verbs, placeholders)
- Scene examples (campfire, basketball game, etc.)
- Writing techniques (show don't tell, pacing, etc.)

**Trade-offs**:

| Enabled | Disabled |
|---------|----------|
| ✅ More informed suggestions | ✅ Lower token cost |
| ✅ Better adherence to craft | ✅ Faster responses |
| ✅ Rich, detailed feedback | ✅ More concise output |
| ❌ Higher token usage | ❌ Less context |
| ❌ Slightly slower | ❌ May miss nuances |

**Recommended**:
- **Enable** for detailed analysis and learning
- **Disable** for quick checks or budget constraints

---

### 4. Temperature (AI Creativity)

**Setting**: `proseMinion.temperature`
**Type**: Number (0.0 - 2.0)
**Default**: `0.7`

**What it controls**:
- How creative vs. focused the AI responses are
- Lower = more deterministic, higher = more creative

**Recommended Values**:

| Temperature | Use Case | Behavior |
|-------------|----------|----------|
| 0.0 - 0.3 | Technical analysis | Highly focused, consistent |
| 0.4 - 0.7 | ⭐ General use | Balanced creativity |
| 0.8 - 1.2 | Creative suggestions | More varied responses |
| 1.3 - 2.0 | Experimental | Very creative, less predictable |

**Examples**:
- `0.3`: Strict adherence to guidelines, predictable suggestions
- `0.7`: Good balance of creativity and consistency (recommended)
- `1.0`: More creative alternatives, varied wording
- `1.5`: Very creative, may be less focused

---

### 5. Max Tokens (Response Length)

**Setting**: `proseMinion.maxTokens`
**Type**: Number (100 - 8000)
**Default**: `10000` (applied uniformly across all tools)

**What it controls**:
- Maximum length of AI responses
- Affects both cost and depth of analysis

**Recommended Values**:

| Tokens | Use Case | Response Size |
|--------|----------|---------------|
| 500 - 1000 | Quick checks | Brief feedback |
| 1500 - 2500 | ⭐ Standard analysis | Detailed feedback |
| 3000 - 5000 | Deep dives | Very detailed |
| 6000+ | Comprehensive | Exhaustive analysis |

**Cost Considerations**:
- Higher token limits = higher costs
- Most analyses work well with 2000 tokens
- Only increase for very long passages or detailed analysis

**Note**: The AI may use fewer tokens than the limit if it completes the response early. If a response is cut off, a “Response truncated” notice appears — increase Max Tokens to allow longer outputs.

### 7. Context Assistance

- When an excerpt comes from a real editor selection, the extension reads the full source document and includes it in the first turn of the context assistant. If the excerpt is pasted from the clipboard, no source is included.

---

### 6. Publishing Standards Preset

Control the standards used for comparison and publishing format in the Metrics tab.

**Settings**:
- `proseMinion.publishingStandards.preset`: `none` | `manuscript` | `genre:<slug|abbreviation|name>`
- `proseMinion.publishingStandards.pageSizeKey`: Trim size key (uses `format` when available, else `WIDTHxHEIGHT`)

**Behavior**:
- When set to a `genre:<key>`, the Metrics tab will display a comparison table against that genre’s ranges and a Publishing Format summary (trim size, words/page, estimated page count).
- When a genre has multiple `page_sizes`, the Trim Size dropdown appears; the selection is saved to `pageSizeKey`.

**Notes**:
- Lexical density is computed as content-word ratio (non-stopwords/total) × 100.
- Type-Token Ratio is provided as a separate metric.

---

### 7. Reports

Metrics reports saved via the Metrics tab are written to:

`prose-minion/reports/prose-statistics-YYYYMMDD-HHmm.md`

On Save/Copy, the extension prompts whether to include chapter-by-chapter breakdown tables (if available). Choosing “No” excludes the "## Chapter Details" section while preserving the summary chapter table.

---

### 9. Word Frequency Settings

Control the Word Frequency report in the Metrics tab.

Settings:
- `proseMinion.wordFrequency.topN` (number, default 100): size of Top Words and Top Lemmas.
- `proseMinion.wordFrequency.includeHapaxList` (boolean, default true): show the Hapax list section.
- `proseMinion.wordFrequency.hapaxDisplayMax` (number, default 300): maximum hapax entries shown inline.
- `proseMinion.wordFrequency.includeStopwordsTable` (boolean, default true): show Top Stopwords table and total stopword tokens.
- `proseMinion.wordFrequency.contentWordsOnly` (boolean, default true): exclude stopwords from Top Words/Lemmas.
- `proseMinion.wordFrequency.posEnabled` (boolean, default true): enable POS sections via wink-pos-tagger; if the tagger cannot initialize, sections show a short note.
- `proseMinion.wordFrequency.includeBigrams` (boolean, default true): include Top Bigrams.
- `proseMinion.wordFrequency.includeTrigrams` (boolean, default true): include Top Trigrams.
- `proseMinion.wordFrequency.enableLemmas` (boolean, default false): show a “Top Lemmas” section.
- `proseMinion.wordFrequency.lengthHistogramMaxChars` (number, default 10): max character length shown in the histogram.

Notes:
- POS tagging uses `wink-pos-tagger` bundled with the extension; no runtime downloads. If unavailable, POS sections are marked as unavailable.

### 8. Context Resource Paths

**Settings (comma-separated globs)**

| Group | Key | Default |
|-------|-----|---------|
| Characters | `proseMinion.contextPaths.characters` | `characters/**/*,Characters/**/*` |
| Locations & Settings | `proseMinion.contextPaths.locations` | `locations/**/*,Locations/**/*,Locations-Settings/**/*` |
| Themes | `proseMinion.contextPaths.themes` | `themes/**/*,Themes/**/*` |
| Things / Props | `proseMinion.contextPaths.things` | `things/**/*,Things/**/*` |
| Draft Chapters & Outlines | `proseMinion.contextPaths.chapters` | `drafts/**/*,Drafts/**/*,outlines/**/*,Outlines/**/*` |
| Manuscript Chapters | `proseMinion.contextPaths.manuscript` | `manuscript/**/*,Manuscript/**/*` |
| Project Brief Materials | `proseMinion.contextPaths.projectBrief` | `brief/**/*,Brief/**/*` |
| General References | `proseMinion.contextPaths.general` | `research/**/*,Research/**/*,tone-and-style/**/*,Tone-And-Style/**/*,literary-devices/**/*,Literary-Devices/**/*,**/story-bible.md,**/synopsis.md,**/voice-and-tone.md,**/genre-conventions.md` |

**How it works**

- Patterns are evaluated against your workspace folders using VS Code glob syntax. Use `**` to search all subdirectories.
- Only `.md` and `.txt` files are indexed; other file types are ignored automatically.
- Separate multiple patterns with commas. For example: `characters/**/*,Characters/**/*,**/cast/*.md`.
- The context assistant receives the catalog of matched files and can request specific ones during its two-turn workflow.
- Update these settings at any time — the next context request will pick up the new patterns immediately.

> Tip: Point the `projectBrief` or `general` groups at synopsis files, tone guides, or world bibles so the context assistant can summarise them automatically.

---

## Configuration Presets

### Budget-Conscious

```json
{
  "proseMinion.assistantModel": "anthropic/claude-sonnet-4.5",
  "proseMinion.dictionaryModel": "z-ai/glm-4.5",
  "proseMinion.includeCraftGuides": false,
  "proseMinion.temperature": 0.5,
  "proseMinion.maxTokens": 1000
}
```

### Balanced (Default)

```json
{
  "proseMinion.assistantModel": "anthropic/claude-sonnet-4.5",
  "proseMinion.dictionaryModel": "z-ai/glm-4.6",
  "proseMinion.includeCraftGuides": true,
  "proseMinion.temperature": 0.7,
  "proseMinion.maxTokens": 2000
}
```

### High Quality

```json
{
  "proseMinion.assistantModel": "anthropic/claude-opus-4.1",
  "proseMinion.dictionaryModel": "openai/gpt-5-chat",
  "proseMinion.includeCraftGuides": true,
  "proseMinion.temperature": 0.6,
  "proseMinion.maxTokens": 3000
}
```

### Creative Exploration

```json
{
  "proseMinion.assistantModel": "openai/gpt-5",
  "proseMinion.dictionaryModel": "google/gemini-2.5-flash",
  "proseMinion.includeCraftGuides": true,
  "proseMinion.temperature": 1.0,
  "proseMinion.maxTokens": 2500
}
```

## How to Apply Presets

1. Open Settings: `Cmd+,` or `Ctrl+,`
2. Click the file icon (top right) to edit `settings.json`
3. Add the preset configuration
4. Save the file

## Session Persistence

The UI keeps the last analysis, status messages, and model selections even if you switch to another sidebar view or temporarily close VS Code. Long-running OpenRouter requests continue in the background; when you come back, the cached response is replayed automatically.

Example:
```json
{
  "proseMinion.model": "anthropic/claude-3.5-sonnet",
  "proseMinion.includeCraftGuides": true,
  "proseMinion.temperature": 0.7,
  "proseMinion.maxTokens": 2000
}
```

## Cost Optimization Tips

### 1. Disable Guides for Quick Checks
- Turn off `includeCraftGuides` for simple questions
- Re-enable for detailed analysis

### 2. Use Appropriate Models
- Haiku for spell checks and quick feedback
- Sonnet for regular use
- Opus only when you need the best

### 3. Adjust Token Limits
- Use 1000-1500 tokens for short passages
- Reserve 3000+ for complex analysis

### 4. Batch Your Work
- Analyze multiple passages in one session
- Reduces per-request overhead

## Measurement Tools (Free)

Remember: These tools work **without an API key**:
- Prose Statistics
- Style Flags
- Word Frequency

Use these for free analysis before invoking AI tools!

## Troubleshooting

### "API key not configured"
- Check Settings → Prose Minion → OpenRouter API Key
- Ensure no extra spaces in the key
- Verify key is valid at https://openrouter.ai/

### Responses are too short
- Increase `maxTokens` setting
- Check if passage is too long for model's context

### Responses are too creative/unfocused
- Decrease `temperature` (try 0.5 or 0.3)
- Ensure craft guides are enabled

### High costs
- Switch to Claude 3 Haiku
- Disable craft guides
- Reduce max tokens
- Use measurement tools first

## Advanced Configuration

### Editing settings.json Directly

For power users, you can edit `settings.json` directly:

```json
{
  "proseMinion": {
    "openRouterApiKey": "sk-or-...",
    "model": "anthropic/claude-3.5-sonnet",
    "includeCraftGuides": true,
    "temperature": 0.7,
    "maxTokens": 2000
  }
}
```

### Workspace vs User Settings

- **User Settings**: Apply to all projects
- **Workspace Settings**: Apply only to current project

To use different settings per project:
1. Open workspace settings (folder icon in settings)
2. Configure Prose Minion settings
3. These override user settings

## Future Configuration Options

Coming soon:
- Custom craft guides
- Model-specific presets
- Analysis templates
- Batch processing settings

## Getting Help

For configuration issues:
1. Check this guide
2. Review [QUICKSTART.md](QUICKSTART.md)
3. See [TOOLS.md](TOOLS.md) for tool-specific info
4. Report bugs at https://github.com/anthropics/claude-code/issues
