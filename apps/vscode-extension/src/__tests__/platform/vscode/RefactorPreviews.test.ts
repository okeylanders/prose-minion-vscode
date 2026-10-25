/**
 * `RefactorPreviews` (PR #172 F-06): a review holds VS Code's preview pane
 * only when a preview that opened after it asked covers its document and
 * nothing else. The URI shapes are VS Code's own (`bulkEditPreview.ts`
 * `asPreviewUri`, at 1.82.0 and at main).
 */
import { RefactorPreviews, type PreviewDocumentUri } from '@app/platform/vscode/RefactorPreviews';

const CHAPTER = 'file:///workspace/chapter-01.md';
const NOTES = 'file:///workspace/notes.md';
const preview = (instance: string, file: string, scheme = 'vscode-bulkeditpreview'): PreviewDocumentUri => ({ scheme, authority: instance, file });

describe('RefactorPreviews', () => {
  it.each(['vscode-bulkeditpreview', 'vscode-bulkeditpreview-editor'])('holds for a preview of the one document that opened after the review asked (%s)', (scheme) => {
    const previews = new RefactorPreviews();
    const before = previews.current();

    expect(previews.opened(preview('p1', CHAPTER, scheme))).toBe(true);
    expect(previews.holds(CHAPTER, before)).toBe(true);
  });

  it('does not hold for a preview that was open before the review asked, even of the same document', () => {
    const previews = new RefactorPreviews();
    previews.opened(preview('other', CHAPTER));

    expect(previews.holds(CHAPTER, previews.current())).toBe(false);
  });

  it('does not hold for a preview of another document, or of several', () => {
    const previews = new RefactorPreviews();
    const before = previews.current();
    previews.opened(preview('p1', NOTES));
    previews.opened(preview('p2', CHAPTER));
    previews.opened(preview('p2', NOTES));

    expect(previews.holds(CHAPTER, before)).toBe(false);
  });

  it('stops holding once the preview closes', () => {
    const previews = new RefactorPreviews();
    const before = previews.current();
    previews.opened(preview('p1', CHAPTER));
    previews.closed(preview('p1', CHAPTER));

    expect(previews.holds(CHAPTER, before)).toBe(false);
    expect(previews.current().size).toBe(0);
  });

  it('ignores documents that are not a preview\'s, or name no file', () => {
    const previews = new RefactorPreviews();
    const before = previews.current();

    expect(previews.opened({ scheme: 'file', authority: '', file: CHAPTER })).toBe(false);
    expect(previews.opened({ scheme: 'vscode-bulkeditpreview', authority: '', file: CHAPTER })).toBe(false);
    expect(previews.opened({ scheme: 'vscode-bulkeditpreview', authority: 'p1', file: undefined })).toBe(false);
    expect(previews.opened(preview('p1', CHAPTER, 'vscode-bulkeditpreview-renamed'))).toBe(false);
    expect(previews.holds(CHAPTER, before)).toBe(false);
  });
});
