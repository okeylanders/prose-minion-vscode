# Prose Minion

## About this reference

Reference version: 2.15.0

Open Prose Minion in the VS Code activity bar for the Assistant, Search, Metrics and Dictionary. Open Workshop for an ongoing conversation about a draft, or Lightbox for a board of measurements and readings about one chapter. For proofreading and line notes, right-click a Markdown or plain-text editor and open the Prose Minion submenu.

Any Workshop host or guest can look up a product question with help.search and read the matching section with help.read. Ask for the section behind an answer. See the [Prose Minion README](https://github.com/okeylanders/prose-minion-vscode/blob/main/apps/vscode-extension/README.md) for the latest release highlights and the [extension changelog](https://github.com/okeylanders/prose-minion-vscode/blob/main/apps/vscode-extension/CHANGELOG.md) for every release.

## Settings and models

Open Settings from the Prose Minion sidebar header, or run Prose Minion: Settings from the Command Palette. Add an OpenRouter API key for model-powered tools. VS Code keeps the key in secret storage. Metrics, ordinary Word Search and Lightbox measurements run locally.

Choose the assistant model for the Assistant and Workshop personas. Dictionary, Context, Category Search, conversation widgets and Proofread have separate model choices. Lightbox readings and Craft Flags follow the assistant model while their own model settings are empty. Memory-sheet helper drafts follow Proofread unless you choose a helper model. The model picker and Model Explorer let you inspect choices. Each reply's header identifies the model used.

Temperature controls variation in generation. Max tokens limits response length. Context window trimming sizes the input for supported analysis tools. Include craft guides adds writing guidance at the cost of input tokens. Retained Claude conversations can reuse cached input. Choose a five-minute or one-hour cache in General settings. The Workshop clock estimates the window, and the cached count on a reply shows the reuse actually reported.

## Sidebar appearance and diagnostics

Use the sidebar header to switch its palette, or set Sidebar Theme to follow VS Code. Show Token Widget controls the header's session usage and optional cost display. Show Debug Output in the sidebar title bar opens the extension's Output channel. The Debug Logging setting may include rejected model replies containing manuscript text in that channel.

## Project files and context paths

Put character sheets, locations, themes, objects, chapter drafts, manuscript files, the project brief and general reference material in the project's folders. In Settings, the context path for each group takes comma-separated glob patterns. The catalog uses matching Markdown and plain-text files. Change the appropriate patterns if a project file is missing in a picker. One chapter per file also makes chapter-level comparisons easier.

The Workshop can keep files as standing context, attach them to one message, or read configured files on demand. Pins supply the starting files for new conversations. Project Memory stores decisions and other durable notes separately. The extension keeps sessions, pinned-context lists, memories, Lightbox boards and Dictionary history under the project's prose-minion folder.
