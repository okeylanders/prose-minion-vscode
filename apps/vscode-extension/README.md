<p align="center">
  <img src="https://raw.githubusercontent.com/okeylanders/prose-minion-vscode/main/apps/vscode-extension/assets/prose-minion-banner.png" alt="Prose Minion — AI-powered writing tools for VS Code: dialogue, pacing, voice, metrics" width="100%"/>
</p>

<p align="center">
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

<p align="center">
  <img src="https://raw.githubusercontent.com/okeylanders/prose-minion-vscode/main/screenshots/readme/hero-four-tools.png" alt="The four Prose Minion tools side by side: Assistant, Search, Metrics, and Dictionary" width="100%"/>
</p>

---

## What's new in v2.0.2

- **Claude Fable 5 added** — the curated model catalog now includes `anthropic/claude-fable-5` for long-context critique and revision planning.
- **Fresh Marketplace tour** — updated screenshots and setup copy now match the current four-tool sidebar.
- **Cleaner package metadata** — the extension homepage now points to the Prose Minion website, and Marketplace-only banner art stays out of the runtime VSIX.
- **Sister extension: [FrameMinion](https://frameminion.video)** — AI video, image, and music-video workflow tools for VS Code, same house style. [Install it too](https://marketplace.visualstudio.com/items?itemName=OkeyLanders.frame-minion).

Full history → [CHANGELOG.md](https://github.com/okeylanders/prose-minion-vscode/blob/main/apps/vscode-extension/CHANGELOG.md)

---

## Get started in three steps

1. **Install** from this Marketplace page, then open the Prose Minion panel from the activity bar.
2. **Try Metrics or Word Search** right away — both run entirely offline, no API key needed.
3. **Add an OpenRouter key** to unlock the Assistant, Context Search, and Dictionary.

<p align="center">
  <img src="https://raw.githubusercontent.com/okeylanders/prose-minion-vscode/main/screenshots/readme/setup-three-steps.png" alt="Three setup steps: open settings, paste your OpenRouter key, pick models from the live catalog" width="100%"/>
</p>

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

## The Assistant

Pin an excerpt, attach a context brief built from your own characters and canon, and run a pass. The analysis respects what you've marked as intentional — and pushes on everything else.

<p align="center">
  <img src="https://raw.githubusercontent.com/okeylanders/prose-minion-vscode/main/screenshots/readme/assistant-workflow.png" alt="Left: an excerpt with a context brief and referenced story-bible files. Right: the resulting dialogue and microbeat analysis." width="100%"/>
</p>

Fourteen focused passes, from Dialogue & Beats to Continuity — each one a single, opinionated read of your excerpt:

<p align="center">
  <img src="https://raw.githubusercontent.com/okeylanders/prose-minion-vscode/main/screenshots/readme/writing-tools-grid.png" alt="The Writing Tools picker: fourteen analysis passes across Primary, Dialogue, Craft & Voice, and Technical groups" width="100%"/>
</p>

---

## Search: by pattern, or by meaning

Word Search finds every occurrence and flags clusters — free and offline. Context Search finds words by *meaning*: ask for "emotion verbs" and get `flinched`, `froze`, `hated` back with counts.

<p align="center">
  <img src="https://raw.githubusercontent.com/okeylanders/prose-minion-vscode/main/screenshots/readme/search-duo.png" alt="Word Search results with per-line context next to a Context Search for emotion verbs" width="100%"/>
</p>

---

## Metrics: know your manuscript

All offline, no key, no cost — from a single chapter to the whole draft, with publishing-standard comparisons by genre and trim size.

<p align="center">
  <img src="https://raw.githubusercontent.com/okeylanders/prose-minion-vscode/main/screenshots/readme/metrics-triptych.png" alt="Prose Statistics, Style Flags, and Word Frequency reports side by side" width="100%"/>
</p>

---

## A dictionary that writes fiction

Not a definition lookup — a craft reference: connotation, register, sense explorer, soundplay, and character-voice variations for any word or phrase in your draft.

<p align="center">
  <img src="https://raw.githubusercontent.com/okeylanders/prose-minion-vscode/main/screenshots/readme/dictionary-spread.png" alt="Dictionary lookup input with scene context next to the resulting writer-focused entry" width="100%"/>
</p>

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
