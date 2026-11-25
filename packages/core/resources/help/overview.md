# Prose Minion

## About this reference

Reference version: 2.16.0

Open Prose Minion in the VS Code activity bar for the Assistant, Search, Metrics and Dictionary. Open Workshop for an ongoing conversation about a draft. Use **New Workshop Tab** to keep a second room open beside it. Open Lightbox for a board of measurements and readings about one chapter. For proofreading and line notes, right-click a Markdown or plain-text editor and open the Prose Minion submenu.

Any Workshop host or guest can look up a product question with help.search and read the matching section with help.read. Ask for the section behind an answer. See the [Prose Minion README](https://github.com/okeylanders/prose-minion-vscode/blob/main/apps/vscode-extension/README.md) for the latest release highlights and the [extension changelog](https://github.com/okeylanders/prose-minion-vscode/blob/main/apps/vscode-extension/CHANGELOG.md) for every release.

## What's new in 2.16.0

In **Search → Passage Search**, ask where a gesture, image or kind of scene recurs. Choose the files, estimate the model calls and cost, then run the search. Each match has a quote checked against its source. A Workshop persona can propose the same search for your approval. A complete search can go straight back to the persona. If it stops early, you decide whether to send the partial results.

A Workshop host or guest can mark to-dos **Done** or **Dismissed** across saved sessions and compare a draft with a committed Git revision. If the chapter you want is missing from the project picker, ask the persona to help configure your context paths, or choose **Suggest from my folders** in Settings. Review the matching files before you apply the patterns.

The Workshop startup tour introduces these features. Use the arrows or dots to move between notices. Choose **Don’t show again** and then **Dismiss** to hide this edition on this machine. The next revised tour can appear after an update.

## Settings and models

Open Settings from the Prose Minion sidebar header, or run Prose Minion: Settings from the Command Palette. Add an OpenRouter API key for model-powered tools. VS Code keeps the key in secret storage. Metrics, ordinary Word Search and Lightbox measurements run locally.

Choose the assistant model for the Assistant and Workshop personas. Dictionary, Context, Category Search, conversation widgets and Proofread have separate model choices. Lightbox readings and Craft Flags follow the assistant model while their own model settings are empty. Passage Search follows Category Search until you choose a separate Passage Search model. Memory drafts and context-path suggestions use the helper model, which follows Proofread until you choose one. The model picker and Model Explorer let you inspect choices. Each reply's header identifies the model used.

Temperature controls variation in generation. Max tokens limits response length. Context window trimming sizes the input for supported analysis tools. Include craft guides adds writing guidance at the cost of input tokens. Retained Claude conversations can reuse cached input. Choose a five-minute or one-hour cache in General settings. The Workshop clock estimates the window, and the cached count on a reply shows the reuse actually reported.

## Sidebar appearance and diagnostics

Use the sidebar header to switch its palette, or set Sidebar Theme to follow VS Code. Show Token Widget controls the header’s usage display. Its cumulative token count and last-request cost cover all Prose Minion activity in the current VS Code window. Show Debug Output in the sidebar title bar opens the extension's Output channel. The Debug Logging setting may include rejected model replies containing manuscript text in that channel.

## Project files and context paths

Put character sheets, locations, themes, objects, chapter drafts, manuscript files, the project brief and general reference material in the project's folders. In Settings, the context path for each group takes comma-separated glob patterns. The catalog uses matching Markdown and plain-text files. Change the appropriate patterns if a project file is missing in a picker, or let Prose Minion suggest them from your folder names (see Suggest context paths). One chapter per file also makes chapter-level comparisons easier.

The Workshop can keep files as standing context, attach them to one message, or read configured files on demand. Pins supply the starting files for new conversations. Project Memory stores decisions and other durable notes separately. The extension keeps sessions, pinned-context lists, memories, Lightbox boards and Dictionary history under the project's prose-minion folder.

## Suggest context paths

In Settings, the Context Resource Paths section has a **Suggest from my folders** button. When none of the groups finds a file in the open project, a line above it points to it. Pressing it reads the project's folder and file names, never their contents. It skips hidden folders, `node_modules`, build output and the prose-minion folder. The helper model then proposes patterns for each group. This is one paid model call, made only when you press the button.

Before you see anything, Prose Minion checks each proposed pattern against your files with the same rules the pickers use. A pattern that starts at the top of the disk, names a drive, climbs out of the project with `..`, or holds a comma or a backslash is refused. A pattern that matches no file is dropped. When a search can't be completed, the group is left as it is rather than counted as empty.

The review lists each proposed group with its current patterns, the patterns kept, how many files each finds, a few example files, and any files another group would also find. Each group has a checkbox, ticked where something was kept. Groups the suggestion left out keep their patterns. Nothing changes until you press **Apply**, which writes only the ticked groups.

Apply writes to your user settings, so the new patterns apply to all your projects. A group your workspace's own settings file sets is shown but can't be ticked, because a user-level change wouldn't change it in this project; edit the workspace's settings file instead. If a group's patterns changed after the suggestion, or its files no longer match, Apply leaves it as it is and says why. Suggest again to see the current picture.

You can also ask a Workshop persona to work the paths out with you. She can read the current paths, look through the folder names and check patterns, but she can't change a setting. When you agree, she proposes the patterns, and they appear as a card under her reply: the same review, checkboxes and **Apply**, with **Decline** beside it. Applying the card changes your user settings, as the button's review does.
