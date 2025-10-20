# Configuration Guide

## Overview

Prose Minion offers extensive configuration options to customize AI behavior and optimize costs.

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

**Setting**: `proseMinion.model`
**Type**: Dropdown
**Default**: `anthropic/claude-3.5-sonnet`

**Available Models**:

| Model | Best For | Speed | Cost | Quality |
|-------|----------|-------|------|---------|
| **Claude 3.5 Sonnet** ⭐ | Balanced use | Fast | Medium | Excellent |
| Claude 3 Opus | Detailed analysis | Slower | High | Best |
| Claude 3 Haiku | Quick checks | Fastest | Low | Good |
| GPT-4 Turbo | Alternative choice | Fast | Medium | Excellent |
| GPT-4o | Multimodal tasks | Very Fast | Medium | Excellent |
| Gemini 1.5 Pro | Long passages | Fast | Medium | Very Good |

**Recommendations**:
- **Default use**: Claude 3.5 Sonnet (best balance)
- **Budget-conscious**: Claude 3 Haiku
- **Highest quality**: Claude 3 Opus
- **Very long passages**: Gemini 1.5 Pro (large context window)

**How to change**:
1. Open Settings
2. Find "Prose Minion: Model"
3. Select from dropdown

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
**Default**: `2000`

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

**Note**: The AI may use fewer tokens than the limit if it completes the response early.

---

## Configuration Presets

### Budget-Conscious

```json
{
  "proseMinion.model": "anthropic/claude-3-haiku",
  "proseMinion.includeCraftGuides": false,
  "proseMinion.temperature": 0.5,
  "proseMinion.maxTokens": 1000
}
```

### Balanced (Default)

```json
{
  "proseMinion.model": "anthropic/claude-3.5-sonnet",
  "proseMinion.includeCraftGuides": true,
  "proseMinion.temperature": 0.7,
  "proseMinion.maxTokens": 2000
}
```

### High Quality

```json
{
  "proseMinion.model": "anthropic/claude-3-opus",
  "proseMinion.includeCraftGuides": true,
  "proseMinion.temperature": 0.6,
  "proseMinion.maxTokens": 3000
}
```

### Creative Exploration

```json
{
  "proseMinion.model": "anthropic/claude-3.5-sonnet",
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
