/**
 * A stand-in for an open document and its host, for Draft Edit's write side:
 * it applies changes, moves its version and feeds every watch as VS Code
 * does, and answers `applyEdits` as the test says the host would. What VS
 * Code's own `applyEdit` does in each case is in the ADR's Slice 2
 * amendment; these behaviors mirror it.
 */
import type {
  DocumentApplyOutcome,
  DocumentEditor,
  DocumentEditReview,
  DocumentTextChange,
  DocumentTextEdit,
  DocumentWatch,
  DocumentWatchResult
} from '@/platform/DocumentEditor';

export type HostBehavior = (
  edits: readonly DocumentTextEdit[],
  review: DocumentEditReview,
  document: FakeDocuments
) => Promise<DocumentApplyOutcome> | DocumentApplyOutcome;

export class FakeDocuments implements DocumentEditor {
  version: number;
  open = true;
  readonly applyCalls: Array<{ edits: readonly DocumentTextEdit[]; expectedVersion: number; review: DocumentEditReview }> = [];
  private readonly watches = new Set<{ edits: DocumentTextChange[][]; closed: boolean }>();

  constructor(
    public text: string,
    readonly uri = 'file:///workspace/chapter-01.md',
    readonly languageId = 'markdown',
    version = 1,
    public host: HostBehavior = applyAll
  ) {
    this.version = version;
  }

  /** One change event, as the writer or the host makes it: offsets in the text before it. */
  edit(changes: readonly DocumentTextChange[]): void {
    for (const change of [...changes].sort((a, b) => b.offset - a.offset)) {
      this.text = this.text.slice(0, change.offset) + change.text + this.text.slice(change.offset + change.length);
    }
    this.version += 1;
    this.watches.forEach((watch) => watch.edits.push([...changes]));
  }

  close(): void {
    this.open = false;
    this.watches.forEach((watch) => {
      watch.closed = true;
    });
  }

  snapshot() {
    return { uri: this.uri, version: this.version, text: this.text, languageId: this.languageId };
  }

  watch(uri: string, version: number): DocumentWatch | undefined {
    if (uri !== this.uri || !this.open || version !== this.version) {
      return undefined;
    }
    const state = { edits: [] as DocumentTextChange[][], closed: false };
    this.watches.add(state);
    return {
      settle: (): DocumentWatchResult => {
        this.watches.delete(state);
        return state.closed || !this.open
          ? { kind: 'closed' }
          : { kind: 'open', snapshot: this.snapshot(), edits: state.edits };
      },
      dispose: () => {
        this.watches.delete(state);
      }
    };
  }

  async applyEdits(
    uri: string,
    edits: readonly DocumentTextEdit[],
    options: { readonly expectedVersion: number; readonly review: DocumentEditReview }
  ): Promise<DocumentApplyOutcome> {
    this.applyCalls.push({ edits, expectedVersion: options.expectedVersion, review: options.review });
    if (uri !== this.uri || !this.open) {
      return { kind: 'closed' };
    }
    if (this.version !== options.expectedVersion) {
      return { kind: 'stale' };
    }
    return this.host(edits, options.review, this);
  }
}

const asChange = (edit: DocumentTextEdit): DocumentTextChange => ({ offset: edit.start, length: edit.end - edit.start, text: edit.newText });

/** Every edit, as written, in one change event. */
export const applyAll: HostBehavior = (edits, _review, document) => {
  document.edit(edits.map(asChange));
  return { kind: 'submitted' };
};

/** Every edit, cut down to what differs (VS Code's "more minimal" edits on the active editor's document). */
export const applyMinimal: HostBehavior = (edits, _review, document) => {
  document.edit(edits.map((edit) => {
    const original = document.text.slice(edit.start, edit.end);
    let prefix = 0;
    while (prefix < original.length && prefix < edit.newText.length && original[prefix] === edit.newText[prefix]) {
      prefix += 1;
    }
    let suffix = 0;
    while (
      suffix < original.length - prefix && suffix < edit.newText.length - prefix
      && original[original.length - 1 - suffix] === edit.newText[edit.newText.length - 1 - suffix]
    ) {
      suffix += 1;
    }
    return { offset: edit.start + prefix, length: original.length - prefix - suffix, text: edit.newText.slice(prefix, edit.newText.length - suffix) };
  }));
  return { kind: 'submitted' };
};

/** The writer ticks only the edits `ticked` keeps, then Apply. */
export function applyTicked(ticked: (edit: DocumentTextEdit) => boolean): HostBehavior {
  return (edits, _review, document) => {
    const kept = edits.filter(ticked);
    if (kept.length === 0) {
      return { kind: 'declined' };
    }
    document.edit(kept.map(asChange));
    return { kind: 'submitted' };
  };
}

/** The writer discards the preview. */
export const decline: HostBehavior = () => ({ kind: 'declined' });

/** The writer types while the edit is out (in review, or on its way), and the host refuses it. */
export function writerTypes(changes: readonly DocumentTextChange[]): HostBehavior {
  return (_edits, _review, document) => {
    document.edit(changes);
    return { kind: 'stale' };
  };
}
