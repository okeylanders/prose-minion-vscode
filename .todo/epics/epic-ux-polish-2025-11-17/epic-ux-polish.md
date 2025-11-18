# Epic: UX Polish Enhancements

**Created**: 2025-11-17
**Status**: 📝 Planned
**Priority**: Medium (Post-v1.0 polish)
**Estimated Duration**: 2-3 hours total
**ADR**: [ADR-2025-11-17: UX Polish Enhancements](../../../docs/adr/2025-11-17-ux-polish-enhancements.md)

---

## Overview

Two quick-win UX improvements to enhance user experience and power user flexibility:

1. **N-Gram Filter Description** - Help users understand how `minCharacterLength` affects bigrams/trigrams
2. **Custom Model IDs** - Allow power users to try any OpenRouter model

**Combined Effort**: 15-30 min + 1-2 hours = ~2-3 hours total

---

## Goals

1. **Improve User Understanding**: Clear description of non-obvious settings behavior
2. **Empower Power Users**: Flexibility to experiment with new models
3. **Future-Proof Model Selection**: No extension updates when OpenRouter adds models
4. **Maintain Simplicity**: Normal users keep familiar curated experience

---

## Success Criteria

### Sprint 01: N-Gram Filter Description
- ✅ Clear explanation of all-or-nothing filter added to Settings Overlay
- ✅ Users understand how `minCharacterLength` affects bigrams/trigrams
- ✅ UI remains clean and readable

### Sprint 02: Custom Model IDs
- ✅ VSCode Settings pane accepts free-text model IDs
- ✅ Settings Overlay shows curated dropdown + custom model detection
- ✅ Custom models work in tools (or show clear error)
- ✅ Normal users unchanged (curated dropdown experience)

---

## Sprints

### Sprint 01: N-Gram Filter Description (15-30 min)
**Status**: 📝 Planned
**Document**: [sprints/01-ngram-filter-description.md](sprints/01-ngram-filter-description.md)

**Scope**: Add description to Settings Overlay explaining n-gram filter behavior

**Tasks**:
- Update `SettingsOverlay.tsx` with description
- Test in both light/dark themes
- Verify clarity and readability

---

### Sprint 02: Custom Model IDs (1-2 hours)
**Status**: 📝 Planned
**Document**: [sprints/02-custom-model-ids.md](sprints/02-custom-model-ids.md)

**Scope**: Remove enum restriction, allow free-text model input for power users

**Tasks**:
- Remove enum from package.json (3 settings)
- Update Settings Overlay to detect custom models
- Test with valid and invalid custom models
- Add error messages in OpenRouterClient

---

## Benefits

- ✅ **Better UX**: Users understand settings behavior
- ✅ **Power User Empowerment**: Flexibility to try new models
- ✅ **Future-Proof**: No extension updates for new models
- ✅ **Low Effort**: Total ~2-3 hours for both features
- ✅ **Clean Architecture**: No architectural changes, just polish

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Custom models fail silently | Add clear error messages in OpenRouterClient |
| UI clutter from long custom IDs | Truncate with ellipsis, full text in title attribute |
| Users confused about which to use | Clear description in package.json |

---

## References

**Superseded Documents**:
- `.todo/settings-module/minCharacterLength-bigrams-trigrams-description.md` → Sprint 01
- `.todo/models-advanced-features/custom-model-ids.md` → Sprint 02

**Related ADR**:
- [ADR-2025-11-17: UX Polish Enhancements](../../../docs/adr/2025-11-17-ux-polish-enhancements.md)

**Files to Modify**:
- `src/presentation/webview/components/SettingsOverlay.tsx` (both sprints)
- `package.json` (Sprint 02 only)
- `src/infrastructure/api/OpenRouterClient.ts` (Sprint 02, optional)

---

## Notes

- **Alpha Freedom**: Both features are additive, no breaking changes
- **Manual Testing**: Both require manual verification
- **Quick Wins**: Each sprint is independently valuable
- **Can be split**: If time constrained, Sprint 01 alone is valuable

---

**Last Updated**: 2025-11-17
**Epic Status**: 📝 Planned - Ready to begin Sprint 01
