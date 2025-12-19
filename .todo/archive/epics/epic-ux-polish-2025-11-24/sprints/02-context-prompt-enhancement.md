# Sprint 02: Context Prompt Enhancement

**Epic**: [UX Polish](../epic-ux-polish.md)
**Status**: Ready
**Duration**: 1.25 hrs
**Priority**: MEDIUM

---

## Problem

The context assistant prompt currently instructs the model to:
- Request the excerpt's source file
- Request the immediately preceding scene/chapter

But it **doesn't encourage** reading:
- Story bibles / project overviews
- README files at various folder levels
- Writing style guides or prose theory documents
- Character sheets for characters appearing in the excerpt

**Result**: Models often only read the current chapter and outline, missing valuable project context that would improve analysis quality.

### Real-World Example

A 524-entry catalog from a real writing project shows:
- `[projectBrief]` - **The overview content!** Contains:
  - `story-overview.md` — Story Overview
  - `storytelling-framework-guide.md` — Storytelling Framework Guide
  - `author-profile.md` — Author Profile
  - `readme.md` — Readme
- `[chapters]` - 54 chapter drafts + outlines
- `[characters]` - 18 character files (`Characters/Nate/character-nate.md`, etc.)
- `[general]` - 373 entries including:
  - `Writing-Theory-and-Technique/prose-styles-guide.md`
  - `Writing-Theory-and-Technique/general-writing-fundamentals.md`
  - `Research/` with thematic references
  - README.md files at folder levels (`Drafts/README.md`, `Characters/README.md`)

**Key insight**: The `[projectBrief]` category tag IS the story bible/overview - models should prioritize this entire category.

---

## Solution

Enhance the system prompt with:

1. **Specific file patterns** to prioritize:
   - `story-bible.md`, `overview.md`, `series-bible.md`
   - README.md files at folder levels (especially `Characters/README.md`, `Drafts/README.md`)
   - Style guides: `prose-styles-guide.md`, `*-fundamentals.md`, `*-guide.md`
   - Character sheets: `character-*.md` for characters appearing in excerpt

2. **General guidance** for finding overview documents:
   - Look for files with "overview", "bible", "world", "setting", "guide", "fundamentals" in names
   - Check README.md files at multiple folder levels
   - Prioritize `[general]` category for style and theory

3. **Hierarchy** for resource requests:
   - First turn: Source file + overview/README/style documents
   - Second turn (if needed): Character sheets + detailed references

4. **Allow one additional turn** for resource selection when catalog is rich

---

## Tasks

### 1. Update AIResourceOrchestrator (Backend)

- [ ] Modify `executeWithContextResources()` to support 3 turns
- [ ] After turn 2, check for another `<context-request>` tag
- [ ] If found, load resources and make 3rd API call
- [ ] Use existing `MAX_TURNS = 3` as safety limit
- [ ] Aggregate token usage across all turns

### 2. Update Context Briefing Prompt

- [ ] Add section for "Priority Resources" listing patterns
- [ ] Add hierarchy guidance (overview first, then character-specific)
- [ ] Update workflow to describe 2 resource request turns
- [ ] Add real-world examples of file patterns
- [ ] Emphasize `[projectBrief]` category and README.md files

### 3. Test with Sample Catalogs

- [ ] Verify model requests `[projectBrief]` items when available
- [ ] Verify model requests character sheets on second turn
- [ ] Verify model still works with minimal catalogs (single turn)
- [ ] Verify 3-turn limit is respected

---

## Implementation

### Updated Prompt Structure

```markdown
## Priority Resources

When reviewing the catalog, look for these resources in order of priority:

### Tier 1: Project Overview (request on first turn)
**IMPORTANT**: The `[projectBrief]` category contains the project's overview documents. Prioritize the most relevant items from this category (e.g., `story-overview.md`, `readme.md`, `storytelling-framework-guide.md`).

Also scan for these patterns:
- **Story bibles**: `story-bible.md`, `series-bible.md`, `story-overview.md`, `world-overview.md`, `overview.md`
- **Framework guides**: `storytelling-framework-guide.md`, `author-profile.md`
- **README files**: `README.md` or `readme.md` at folder roots (e.g., `Characters/README.md`, `Drafts/README.md`)
- **Style guides**: Files containing "guide", "fundamentals", "style" (e.g., `prose-styles-guide.md`, `general-writing-fundamentals.md`)
- **Writing theory**: Documents in `[general]` category that describe tone, voice, or conventions

### Tier 2: Source Context (request on first turn)
- The excerpt's source file (always request this)
- The immediately preceding scene/chapter (for narrative flow)
- The chapter summary/outline if available (e.g., `outlines/chapter-X-summary.md`)

### Tier 3: Character & Setting Details (request on second turn if needed)
- Character sheets for characters appearing in the excerpt (`character-*.md`)
- Location or setting documents relevant to the scene
- Timeline or plot documents

## Workflow

1. Review the excerpt, user context, and catalog of available resources.
2. **First resource turn**: Request:
   - Key items from `[projectBrief]` category (story-overview, readme, framework guides)
   - The source file (always)
   - Any other Tier 1 overview documents visible in catalog
   - The preceding chapter if available
3. After first resources are supplied, review what you've learned.
4. **Second resource turn (if needed)**: If characters or settings need clarification, request:
   - Character sheets (`character-*.md`) for characters appearing in the excerpt
   - Location or setting documents relevant to the scene
5. After all resources are supplied, build your context briefing.

**Note**: If no `[projectBrief]` category or overview documents exist, proceed gracefully. The excerpt and user context alone can suffice. Not all projects have formal story bibles.
```

---

## Files to Update

```
src/application/services/AIResourceOrchestrator.ts  # Add 3-turn support
resources/system-prompts/context-assistant/00-context-briefing.md  # Priority resources + workflow
```

---

## Acceptance Criteria

- [ ] AIResourceOrchestrator supports up to 3 turns (2 resource requests)
- [ ] Prompt explicitly lists priority file patterns (3 tiers)
- [ ] `[projectBrief]` category emphasized as primary overview source
- [ ] README.md files and style guides mentioned
- [ ] Character sheets (`character-*.md`) pattern documented for second turn
- [ ] Graceful fallback when overview docs unavailable
- [ ] Token usage aggregated across all turns
- [ ] All tests pass
- [ ] Build passes

---

## Testing

Manual testing with sample projects:
1. Project with `story-bible.md` → model should request it
2. Project with README.md files at folder levels → model should request them
3. Project with `prose-styles-guide.md` → model should request from `[general]`
4. Project with characters in excerpt → model should request `character-*.md` on second turn
5. Project with only chapters → model should request source + preceding chapter

---

**Created**: 2025-11-24
