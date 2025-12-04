# Sprint 04: CSS Pattern Standardization

**Status**: 🟡 Ready
**Estimated Time**: 2-4 hours
**Priority**: LOW
**Branch**: `sprint/epic-ahp-v1.3-sub4-04-css-pattern-standardization`

---

## Problem

The project has Tailwind CSS fully configured (`tailwind.config.js`, imported in `index.css`) but currently uses **only custom CSS classes**. This leads to:

1. **Inline styles for one-offs** (e.g., `style={{ display: 'flex', justifyContent: 'space-between' }}`)
2. **Linter warnings** about inline styles when Tailwind utilities would be cleaner
3. **No established pattern** for when to use custom classes vs. Tailwind utilities
4. **Tailwind configured but unused** - wasted potential

**Current Pattern**: All custom CSS → inline styles for one-offs

**Desired Pattern**: Hybrid approach → custom CSS for reusables, Tailwind for one-offs

---

## Tasks

### Documentation
- [ ] Document hybrid pattern in `.ai/central-agent-setup.md` under "Code Style and Patterns"
- [ ] Add examples of when to use custom CSS vs. Tailwind
- [ ] Add migration guidelines (opportunistic, not mass refactor)
- [ ] Update pattern for new code (all new components follow hybrid approach)

### Example Refactor (SettingsOverlay)
- [ ] Identify inline styles in SettingsOverlay
- [ ] Replace inline layout styles with Tailwind utilities
- [ ] Replace inline text styles with Tailwind utilities
- [ ] Keep custom classes for reusable component styles
- [ ] Verify no linter warnings
- [ ] Document as reference implementation

### Agent Guidance
- [ ] Add CSS pattern guidelines to agent instructions
- [ ] Add examples to central-agent-setup.md
- [ ] Clarify when to use each approach

---

## Implementation Details

### 1. Document Hybrid Pattern

**Add to `.ai/central-agent-setup.md`** under "Code Style and Patterns":

```markdown
### CSS Pattern: Custom Classes + Tailwind Utilities

**Pattern**: Hybrid approach for maintainability and velocity

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

**Example**:
```tsx
// ❌ Bad: Inline styles
<h3 className="settings-section-title"
    style={{ display: 'flex', justifyContent: 'space-between' }}>
  <span>Models</span>
</h3>

// ✅ Good: Custom class + Tailwind utilities
<h3 className="settings-section-title flex justify-between items-center">
  <span>Models</span>
</h3>
```

**Migration Strategy**:
- Document pattern (done)
- Refactor opportunistically - When touching a file, convert inline styles to Tailwind
- No mass refactor - Don't rewrite all existing code at once (low ROI)
- New code follows pattern - All new components use hybrid approach
```

---

### 2. Refactor SettingsOverlay (Reference Implementation)

**Before** (inline styles):

```tsx
// SettingsOverlay.tsx
<h3 className="settings-section-title"
    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <span>Models</span>
  <span className="docs-link"
        style={{ cursor: 'pointer', fontSize: '0.85em', fontWeight: 'normal', color: '#999' }}>
    Click For Model Reference Guide → 📖
  </span>
</h3>
```

**After** (custom + Tailwind):

```tsx
// SettingsOverlay.tsx
<h3 className="settings-section-title flex justify-between items-center">
  <span>Models</span>
  <span className="cursor-pointer text-sm font-normal text-gray-400 hover:text-gray-300">
    Click For Model Reference Guide → 📖
  </span>
</h3>
```

**Custom class remains** (in index.css):

```css
/* index.css */
.settings-section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
```

**Pattern**:
- Custom class (`.settings-section-title`) defines core component style (size, weight, margin)
- Tailwind utilities handle layout (`flex justify-between items-center`)
- Tailwind utilities handle one-off text styles (`text-sm font-normal text-gray-400`)
- Tailwind utilities handle interactive states (`hover:text-gray-300`)

---

### 3. Identify All Inline Styles in SettingsOverlay

**Search for** `style={{` in SettingsOverlay.tsx and replace with Tailwind utilities:

1. **Layout styles** → Tailwind layout utilities
   - `display: 'flex'` → `flex`
   - `justifyContent: 'space-between'` → `justify-between`
   - `alignItems: 'center'` → `items-center`
   - `flexDirection: 'column'` → `flex-col`
   - `gap: '0.5rem'` → `gap-2`

2. **Spacing styles** → Tailwind spacing utilities
   - `marginTop: '1rem'` → `mt-4`
   - `padding: '0.5rem'` → `p-2`
   - `marginBottom: '0.5rem'` → `mb-2`

3. **Text styles** → Tailwind typography utilities
   - `fontSize: '0.85em'` → `text-sm`
   - `fontWeight: 'normal'` → `font-normal`
   - `color: '#999'` → `text-gray-400` (or custom VSCode color variable)

4. **Interactive styles** → Tailwind state utilities
   - `cursor: 'pointer'` → `cursor-pointer`
   - `:hover` styles → `hover:bg-gray-100`, `hover:text-gray-300`

---

### 4. Migration Guidelines

**Opportunistic Refactoring**:
- When touching a component file for a feature or bug fix, convert inline styles to Tailwind
- Don't refactor files you're not already working on
- Focus on eliminating linter warnings as you encounter them

**Priority**:
1. **High**: Components with linter warnings (SettingsOverlay)
2. **Medium**: Components frequently modified (AnalysisTab, SearchTab)
3. **Low**: Stable components rarely touched

**Don't**:
- ❌ Mass refactor all components at once (low ROI, high risk)
- ❌ Refactor components just for consistency (unless already touching them)
- ❌ Remove custom classes that are genuinely reusable

---

### 5. Tailwind Configuration Review

**Verify Tailwind setup**:

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/presentation/webview/**/*.{ts,tsx,html}', // ✅ Correct paths
  ],
  theme: {
    extend: {
      colors: {
        // VSCode color variables
        'vscode-foreground': 'var(--vscode-foreground)',
        'vscode-background': 'var(--vscode-editor-background)',
        // ... more VSCode colors
      }
    }
  }
};
```

**Verify index.css**:

```css
/* index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom component classes below */
.settings-section { /* ... */ }
.settings-label { /* ... */ }
```

---

## Acceptance Criteria

- ✅ Hybrid pattern documented in `.ai/central-agent-setup.md`
- ✅ SettingsOverlay refactored (no inline styles)
- ✅ Pattern clear: custom CSS for reusables, Tailwind for one-offs
- ✅ No linter warnings for inline styles in refactored files
- ✅ Migration guidelines documented (opportunistic, not mass refactor)
- ✅ Agent guidance updated with CSS pattern
- ✅ Tailwind configuration verified (paths, colors)
- ✅ Manual testing: SettingsOverlay renders correctly, all styles work

---

## Testing Strategy

### Manual Testing Checklist

1. **SettingsOverlay Appearance**:
   - Open Settings overlay
   - Verify all sections render correctly
   - Verify layout looks identical to before refactor
   - Verify hover states work (docs link, buttons)
   - Verify spacing/alignment unchanged

2. **Responsive Behavior**:
   - Resize webview → verify layout adapts
   - Verify no layout breaks

3. **Linter Check**:
   - Run linter on SettingsOverlay.tsx
   - Verify no warnings about inline styles

4. **Build Check**:
   - Run `npm run build`
   - Verify Tailwind utilities are included in bundle
   - Verify unused utilities are purged

---

## Files to Update

### Documentation
- `.ai/central-agent-setup.md` (add CSS pattern guidelines)

### Example Refactor
- `src/presentation/webview/components/SettingsOverlay.tsx` (replace inline styles with Tailwind)

### Verification
- `tailwind.config.js` (verify configuration)
- `src/presentation/webview/index.css` (verify Tailwind imports)

---

## Effort Breakdown

- Document pattern in `.ai/central-agent-setup.md`: 30 minutes
- Refactor SettingsOverlay: 1-1.5 hours
- Add to agent guidance: 15 minutes
- Review and validate: 30 minutes
- Manual testing: 30 minutes

**Total**: 2.5-3.5 hours

---

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

### Mitigations

- ✅ Document pattern clearly with examples
- ✅ Provide reference implementation (SettingsOverlay)
- ✅ Opportunistic migration (no pressure to refactor everything)

---

## When to Defer

**This is LOW priority** - Can be deferred to v1.4 if Sub-Epic 4 timeline is tight.

**Reasons**:
- Not blocking any features
- Existing code works fine (just has linter warnings)
- Quality-of-life improvement, not critical bug fix

**When to prioritize**:
- If touching components with inline styles anyway (opportunistic)
- If linter warnings become annoying during development
- If adding new components that need styling

---

## References

**Architecture Debt**:
- [Tailwind Custom CSS Pattern](./../../../architecture-debt/2025-11-20-tailwind-custom-css-pattern.md)

**Configuration**:
- [tailwind.config.js](../../../tailwind.config.js)
- [index.css](../../../src/presentation/webview/index.css)

**Example Component**:
- [SettingsOverlay.tsx](../../../src/presentation/webview/components/SettingsOverlay.tsx)

**Tailwind Documentation**:
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Utility-First Fundamentals](https://tailwindcss.com/docs/utility-first)

---

**Created**: 2025-12-03
