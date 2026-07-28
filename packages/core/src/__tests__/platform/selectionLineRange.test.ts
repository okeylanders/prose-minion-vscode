/**
 * Selection line-range normalization (Sprint 12): every host adapter must
 * report the same 1-based inclusive range for the same selection, including
 * the "selection ends at column 0 of the next line" editor idiom.
 */

import { toInclusiveLineRange } from '@/platform/EditorContext';

describe('toInclusiveLineRange', () => {
  it('converts zero-based lines to a 1-based inclusive range', () => {
    expect(toInclusiveLineRange({ startLine: 142, endLine: 150, endCharacter: 12 }))
      .toEqual({ startLine: 143, endLine: 151 });
  });

  it('handles a single-line selection', () => {
    expect(toInclusiveLineRange({ startLine: 7, endLine: 7, endCharacter: 30 }))
      .toEqual({ startLine: 8, endLine: 8 });
  });

  it('stops on the previous line when the selection ends at column 0', () => {
    // Dragging through a full line typically lands the caret at col 0 of the
    // next line — that next line contributes no text and must not be claimed.
    expect(toInclusiveLineRange({ startLine: 142, endLine: 151, endCharacter: 0 }))
      .toEqual({ startLine: 143, endLine: 151 });
  });

  it('does not collapse a single-line selection starting at column 0', () => {
    expect(toInclusiveLineRange({ startLine: 5, endLine: 5, endCharacter: 0 }))
      .toEqual({ startLine: 6, endLine: 6 });
  });
});
