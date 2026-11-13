# Walkthrough GIFs

Animated versions of the two walkthroughs on proseminion.app, for possible use
in the Marketplace README. None is referenced by the README yet.

| File | Steps | Length | Size |
|------|-------|--------|------|
| `prose-minion-setup-walkthrough.gif` | 20 | 50 s | 0.8 MB |
| `prose-minion-workshop-session.gif` | 35 | 90 s | 2.5 MB |
| `prose-minion-workshop-1-bring-the-passage.gif` | 13 | 28 s | 0.8 MB |
| `prose-minion-workshop-2-ask.gif` | 4 | 14 s | 0.3 MB |
| `prose-minion-workshop-3-keep-what-matters.gif` | 9 | 24 s | 0.7 MB |
| `prose-minion-workshop-4-shape-the-prose.gif` | 9 | 29 s | 0.7 MB |

The four numbered files are the full session split into its chapters.

## What they show

- The VS Code window (menus, Explorer, folder dialog) is an illustration.
- Prose Minion inside it is the real v2.13.0 webview, on a sample project built
  around *Alice's Adventures in Wonderland*.
- No model was called. The replies, the memory note and the widget results are
  scripted demo content.

The GIFs do not carry that note themselves, so put it in the alt text or a
caption wherever one is used.

## How they were made

Each is 960 px wide and loops. One still per step, held for about three
quarters of the step's time on the site, with the cursor already in place; the
cursor does not glide and folder names do not type in. They were rendered on
2026-11-13 from `setup-guide.html` and `workshop.html` in
`okeylanders/prose-minion-website`, whose `docs/plans/walkthroughs/` holds the
capture harness. To refresh them, rebuild the site walkthroughs there and
re-render.
