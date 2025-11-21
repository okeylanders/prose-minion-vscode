# Tailwind + Custom CSS Pattern Standardization

**Date Identified**: 2025-11-20
**Identified During**: v1.1.0 - Adding docs link icon to Settings Overlay
**Priority**: Low
**Estimated Effort**: 2-4 hours (one sprint)

## Problem

The project has Tailwind CSS fully configured (`tailwind.config.js`, imported in `index.css`) but currently uses **only custom CSS classes**. This means:

1. **One-off styles require inline styles** (e.g., `style={{ display: 'flex', justifyContent: 'space-between' }}`)
2. **Linter warnings** about inline styles when they could use Tailwind utilities
3. **No established pattern** for when to use custom classes vs. Tailwind utilities
4. **Tailwind is configured but unused** - wasted potential

## Current Implementation

**Example from SettingsOverlay:**
```tsx
// Inline styles for one-off layout
<h3 className="settings-section-title"
    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <span>Models</span>
  <span className="docs-link" style={{ cursor: 'pointer', fontSize: '0.85em', ... }}>
    Click For Model Reference Guide → 📖
  </span>
</h3>
```

**Custom classes in index.css:**
```css
.settings-section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
```

## Recommendation

Adopt a **hybrid pattern**: Custom CSS for reusable components, Tailwind for one-offs.

### Pattern Guidelines

1. **Custom CSS classes** - For reusable component styles:
   - `.settings-section`, `.settings-label`, `.settings-button`, etc.
   - Anything used 3+ times across components
   - Complex component patterns (e.g., `.app-header` with multiple properties)

2. **Tailwind utility classes** - For unique, one-off styles:
   - Layout adjustments (`flex justify-between items-center`)
   - Spacing tweaks (`mt-2 px-4`)
   - Text sizing (`text-sm text-gray-500`)
   - Hover states (`hover:bg-gray-100`)

3. **Never inline styles** - Avoid `style={{}}` in JSX
   - Use Tailwind utilities instead
   - Only exception: dynamic values from props/state

### Example Refactor

**Before (inline styles):**
```tsx
<h3 className="settings-section-title"
    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <span>Models</span>
  <span style={{ cursor: 'pointer', fontSize: '0.85em', fontWeight: 'normal', color: '#999' }}>
    Click For Model Reference Guide → 📖
  </span>
</h3>
```

**After (custom + Tailwind):**
```tsx
<h3 className="settings-section-title flex justify-between items-center">
  <span>Models</span>
  <span className="cursor-pointer text-sm font-normal text-gray-400 hover:text-gray-300">
    Click For Model Reference Guide → 📖
  </span>
</h3>
```

### Migration Strategy

1. **Document pattern** in `.ai/central-agent-setup.md` under "Code Style and Patterns"
2. **Refactor opportunistically** - When touching a file, convert inline styles to Tailwind
3. **No mass refactor** - Don't rewrite all existing code at once (low ROI)
4. **New code follows pattern** - All new components use hybrid approach

## Impact

### Benefits

- ✅ **No linter warnings** - Tailwind utilities instead of inline styles
- ✅ **Faster development** - Tailwind utilities for quick styling
- ✅ **Consistent reusables** - Custom classes for common patterns
- ✅ **Better maintainability** - Clear pattern for when to use each approach
- ✅ **Smaller bundle** - Tailwind purges unused utilities

### Risks

- ⚠️ **Learning curve** - Developers need to know Tailwind utility names
- ⚠️ **Pattern confusion** - "Should this be custom or Tailwind?" decisions
- ⚠️ **Inconsistency during migration** - Mixed approaches until fully adopted

### Effort Breakdown

- Document pattern: 30 minutes
- Refactor SettingsOverlay (example): 1 hour
- Add to agent guidance: 15 minutes
- Review and validate: 30 minutes

**Total**: ~2.5 hours for initial implementation + documentation

## References

- **Tailwind Config**: [tailwind.config.js](../../tailwind.config.js)
- **Custom CSS**: [src/presentation/webview/index.css](../../src/presentation/webview/index.css)
- **Example Component**: [src/presentation/webview/components/SettingsOverlay.tsx](../../src/presentation/webview/components/SettingsOverlay.tsx:161-178)
- **Tailwind Docs**: https://tailwindcss.com/docs

## Notes

- Tailwind is **already configured** with VSCode color variables in `tailwind.config.js`
- Tailwind is **already imported** in `index.css` (`@tailwind base; @tailwind components; @tailwind utilities;`)
- Current linter warning triggered this debt document (inline styles in SettingsOverlay)
- This is a **quality-of-life improvement**, not a critical bug fix
