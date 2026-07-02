<p align="center">
  <img src="https://raw.githubusercontent.com/okeylanders/prose-minion-vscode/main/apps/vscode-extension/assets/prose-minion-banner.png" alt="Prose Minion — AI-powered writing tools for VS Code: dialogue, pacing, voice, metrics" width="100%"/>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=OkeyLanders.prose-minion"><img src="https://img.shields.io/visual-studio-marketplace/v/OkeyLanders.prose-minion?style=flat-square&label=Marketplace&color=c8552c" alt="Marketplace version"/></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=OkeyLanders.prose-minion"><img src="https://img.shields.io/visual-studio-marketplace/i/OkeyLanders.prose-minion?style=flat-square&color=c8552c" alt="Installs"/></a>
  <a href="https://github.com/okeylanders/prose-minion-vscode/blob/main/apps/vscode-extension/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0--with--Commons--Clause-6b5b4a?style=flat-square" alt="License"/></a>
</p>

<h3 align="center">Workshop your prose where you already write it.</h3>

<p align="center">
  Select an excerpt, attach a context brief built from your own story bible, and run focused craft passes — dialogue, gesture, cliché, continuity, metrics — without leaving VS Code. Bring your own OpenRouter key; Metrics and Word Search need no key at all.
</p>

<p align="center">
  <a href="https://proseminion.app"><img src="https://img.shields.io/badge/Website-proseminion.app-c8552c?style=for-the-badge" alt="Website"/></a>
  <a href="https://proseminion.app/setup-guide"><img src="https://img.shields.io/badge/Setup%20Guide-no%20coding%20required-c8552c?style=for-the-badge" alt="Setup Guide"/></a>
  <a href="https://proseminion.app/examples"><img src="https://img.shields.io/badge/Examples-real%20output-c8552c?style=for-the-badge" alt="Examples"/></a>
</p>

---

## What's new in v2.0.1

- **Claude Sonnet 5 by default** — Assistant and Context Search now default to `anthropic/claude-sonnet-5`, verified against OpenRouter's live catalog.
- **API key warning cleanup** — saving a key now clears stale "no key" warnings instead of leaving them stuck.
- **Sister extension: [FrameMinion](https://frameminion.video)** — AI video, image, and music-video workflow tools for VS Code, same house style. [Install it too](https://marketplace.visualstudio.com/items?itemName=OkeyLanders.frame-minion).

Full history → [CHANGELOG.md](https://github.com/okeylanders/prose-minion-vscode/blob/main/apps/vscode-extension/CHANGELOG.md)

---

## Get started in three steps

1. **Install** from this Marketplace page, then open the Prose Minion panel from the activity bar.
2. **Try Metrics or Word Search** right away — both run entirely offline, no API key needed.
3. **Add an OpenRouter key** (gear icon → paste key, stored in your OS keychain) to unlock the Assistant, Context Search, and Dictionary.

Want a guided, no-code walkthrough — project folders, glob patterns, every setting explained? → **[Read the Setup Guide](https://proseminion.app/setup-guide)**

---

## Four tools, one sidebar

| Tool | What it does | OpenRouter API key? |
|---|---|---|
| 🤖 **Assistant** | Dialogue tags, action beats, and cliché/repetition/show-vs-tell passes on a selected excerpt or whole chapter, optionally grounded in a context brief pulled from your story bible | 🔑 required |
| 🔍 **Search** | Word Search (pattern matching + cluster detection) and Context Search (find words by *meaning* — `[anger]`, `[color red]`, `[movement verbs]`) | Word Search free · Context Search 🔑 |
| 📊 **Metrics** | Word count, pacing, dialogue %, lexical density, readability, hapax rate, publishing-standard comparisons by genre and trim size, per-chapter breakdowns | ✅ free, offline |
| 📖 **Dictionary** | Fiction-focused definitions — pronunciation, sense explorer, register, character-voice variants — for any selected word | 🔑 required |

Curious what real output looks like on an actual manuscript? → **[Browse the Examples gallery](https://proseminion.app/examples)**

---

## Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/okeylanders/prose-minion-vscode/main/screenshots/screenshot-assistant-dialogue-analysis.png" alt="Prose Excerpt Assistant with dialogue and microbeat analysis" width="720"/>
  <br/><em>The Excerpt Assistant, mid-analysis.</em>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/okeylanders/prose-minion-vscode/main/screenshots/screenshot-metrics-prose-statistics.png" alt="Prose statistics compared against genre publishing standards" width="720"/>
  <br/><em>Prose statistics, compared against genre publishing standards.</em>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/okeylanders/prose-minion-vscode/main/screenshots/screenshot-settings-pane.png" alt="Settings overlay with API key field and model browser" width="720"/>
  <br/><em>One settings overlay: API key, model browser, context paths, publishing presets.</em>
</p>

More — Word Frequency, Style Flags, Dictionary, Context Search — in the **[Examples gallery](https://proseminion.app/examples)**.

---

## Project structure & context

The Assistant's context features shine with a lightly organized project: one chapter per file, plus folders for characters, locations, and story-bible material that Prose Minion turns into clickable resource pills during analysis. The **[Setup Guide](https://proseminion.app/setup-guide)** walks through the whole layout — including glob patterns, demystified — in about five minutes, no coding required.

---

## Privacy

- API key stored in your OS keychain via VS Code `SecretStorage` — never written to settings files.
- Metrics and Word Search run entirely offline; nothing leaves your machine.
- Only Assistant, Context Search, Context, and Dictionary call OpenRouter, and only with the text you send them.
- There's no Prose Minion server — your writing has nowhere else to go.

---

## Requirements

- VS Code 1.75.0 or higher
- An [OpenRouter](https://openrouter.ai/) account for AI-powered tools (pay-as-you-go; Metrics and Search need nothing)

---

## License

**AGPL-3.0 with Commons Clause** — source-available, no resale, no closed-source derivatives. Free for personal and open-source use; see [LICENSE](https://github.com/okeylanders/prose-minion-vscode/blob/main/apps/vscode-extension/LICENSE) for full terms. Commercial licensing: open an issue.

---

## A note from the author

I built Prose Minion for my own novel-writing workflow, pairing it with [Cline](https://cline.bot) as a copy-paste-friendly analytical companion: metrics and word searches from Prose Minion, revision discussion in Cline's chat. I kept going because it turned out other writers wanted the same setup — so here it is, publicly available. Happy writing.

## Acknowledgments

Built with [OpenRouter](https://openrouter.ai/), the [VS Code Extension API](https://code.visualstudio.com/api), and React. Development assisted by [Cline](https://github.com/cline/cline), [Claude Code](https://www.anthropic.com/claude), and OpenAI Codex.

---

## Support development

If Prose Minion earns a place in your workflow, consider [buying me a coffee](https://buymeacoffee.com/okeylanders) — it funds the OpenRouter catalog audits and keeps this maintained.

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support%20development-orange?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/okeylanders)

---

<p align="center">
  <a href="https://proseminion.app">Website</a> •
  <a href="https://proseminion.app/setup-guide">Setup Guide</a> •
  <a href="https://proseminion.app/examples">Examples</a> •
  <a href="https://github.com/okeylanders/prose-minion-vscode/blob/main/apps/vscode-extension/CHANGELOG.md">Changelog</a> •
  <a href="https://github.com/okeylanders/prose-minion-vscode/issues">Report an Issue</a>
</p>
