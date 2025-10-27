# Settings Header Layout Options

This page shows three simple layout options for the Settings overlay header and how to switch between them. The default implemented in the codebase is Option 1 (stacked icon over title).

Paths referenced:
- Component: `src/presentation/webview/components/SettingsOverlay.tsx`
- Styles: `src/presentation/webview/index.css`

## Option 1 — Stacked (Default)
- Icon above the “Settings” title, both centered. Close button stays at right.

Implementation (already in code):
- Header wrapper: `div.settings-header` includes `data-header-layout="stack"`.
- Grid centers the header content in column 2; Close button is column 3.
- CSS stacks icon/title vertically under the data attribute.

Key bits:
- `SettingsOverlay.tsx: <div className="settings-header" data-header-layout="stack">`
- `index.css: .settings-header[data-header-layout="stack"] .settings-header-content { flex-direction: column; gap: var(--spacing-xs); }`

Why: Strong visual focus for a modal overlay, works well at narrow widths, consistent with dialog patterns.

## Option 2 — Title Left, Icon Centered
- Title anchored to the left edge, icon centered in the header, Close button right.
- Requires splitting the title and icon into separate siblings so they can occupy distinct grid areas.

Markup change in `SettingsOverlay.tsx` header block (replace the header content group):

```
<div className="settings-header layout-icon-center">
  <div className="settings-title"><h2>Settings</h2></div>
  <div className="settings-icon">{/* SVG icon here */}</div>
  <button className="settings-button" onClick={onClose}>Close</button>
</div>
```

Add CSS in `index.css`:

```
.settings-header.layout-icon-center {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  grid-template-areas: 'title icon close';
  align-items: center;
}
.settings-title { grid-area: title; justify-self: start; }
.settings-icon  { grid-area: icon;  justify-self: center; }
.settings-header.layout-icon-center .settings-button { grid-area: close; justify-self: end; }
```

## Option 3 — Icon Left, Title Centered
- Icon anchored left, title centered, Close button right.

Markup (same split as Option 2):

```
<div className="settings-header layout-title-center">
  <div className="settings-icon">{/* SVG icon here */}</div>
  <div className="settings-title"><h2>Settings</h2></div>
  <button className="settings-button" onClick={onClose}>Close</button>
</div>
```

CSS in `index.css`:

```
.settings-header.layout-title-center {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas: 'icon title close';
  align-items: center;
}
.settings-icon  { grid-area: icon;  justify-self: start; }
.settings-title { grid-area: title; justify-self: center; }
.settings-header.layout-title-center .settings-button { grid-area: close; justify-self: end; }
```

## Notes
- The icon uses the `.app-header-icon` class; adjust size if desired for stacked layout (e.g., 56–64px) without affecting other views.
- Keep the `Close` button aligned to the right for all variants for consistency.
- The current default is Option 1. To try Options 2/3, update the header markup in `SettingsOverlay.tsx` and apply the corresponding CSS.

