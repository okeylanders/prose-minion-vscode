/**
 * Open File in Lightbox (launch entry points, 2026-10-20): which file a menu
 * or the Command Palette boards, and what is refused before anything is sent.
 * The host is a fake port, so no VS Code API is mocked; the payload goes to
 * `seedSource`, the same seam the selection command uses, under the source
 * request the command took before loading the document (PR #152 F-01). The
 * fake keeps the service's rule: only the newest ticket may board. The real
 * adapter, provider, handler and service are ordered against each other in
 * openFileInLightboxOwnership.integration.test.ts.
 */

import type { LightboxSetSourcePayload, LightboxSourceTicket } from '@prose-minion/core';
import {
  LIGHTBOX_FILE_LANGUAGE_IDS,
  LightboxFileDocument,
  OpenFileInLightboxHost,
  openFileInLightbox
} from '@app/application/commands/openFileInLightbox';

class FakeUri {
  constructor(readonly scheme: string, readonly path: string) {}

  toString(): string {
    return this.scheme === 'file' ? `file://${this.path}` : `${this.scheme}:${this.path}`;
  }
}

const fileUri = (relativePath: string) => new FakeUri('file', `/workspace/${relativePath}`);

const doc = (
  uri: FakeUri,
  languageId = 'markdown',
  isDirty = false
): LightboxFileDocument<FakeUri> => ({ uri, languageId, isDirty });

interface FakeHostOptions {
  active?: LightboxFileDocument<FakeUri>;
  /** What opening each URI (by its string) yields: a document, or a failure. */
  files?: Array<LightboxFileDocument<FakeUri> | [FakeUri, Error]>;
}

function createHost(options: FakeHostOptions = {}) {
  const files = new Map<string, LightboxFileDocument<FakeUri> | Error>();
  for (const entry of options.files ?? []) {
    if (Array.isArray(entry)) {
      files.set(entry[0].toString(), entry[1]);
    } else {
      files.set(entry.uri.toString(), entry);
    }
  }
  const seeded: LightboxSetSourcePayload[] = [];
  const warnings: string[] = [];
  const information: string[] = [];
  const logs: string[] = [];
  /** 'ticket' and 'open' in the order the command asked for them. */
  const events: string[] = [];
  let sequence = 0;
  let current: LightboxSourceTicket | undefined;
  const seededTickets: LightboxSourceTicket[] = [];
  const beginSourceRequest = jest.fn(() => {
    events.push('ticket');
    current = { sequence: ++sequence };
    return current;
  });
  const openTextDocument = jest.fn(async (uri: FakeUri) => {
    events.push('open');
    const entry = files.get(uri.toString());
    if (entry === undefined) {
      throw new Error(`cannot open ${uri.toString()}`);
    }
    if (entry instanceof Error) {
      throw entry;
    }
    return entry;
  });
  const activeDocument = jest.fn(() => options.active);
  const host: OpenFileInLightboxHost<FakeUri> = {
    toUri: (value) => (value instanceof FakeUri ? value : undefined),
    activeDocument,
    openTextDocument,
    asRelativePath: (uri) => uri.path.replace(/^\/workspace\//, ''),
    beginSourceRequest,
    seedSource: (payload, ticket) => {
      if (ticket !== current) {
        return false;
      }
      seeded.push(payload);
      seededTickets.push(ticket);
      return true;
    },
    showWarning: (message) => {
      warnings.push(message);
    },
    showInformation: (message) => {
      information.push(message);
    },
    log: (line) => {
      logs.push(line);
    }
  };
  return {
    host,
    seeded,
    seededTickets,
    warnings,
    information,
    logs,
    events,
    openTextDocument,
    activeDocument,
    beginSourceRequest,
    /** A newer source chosen elsewhere (a selection, a picked file, a re-read). */
    chooseNewerSource: () => {
      current = { sequence: ++sequence };
    }
  };
}

describe('openFileInLightbox', () => {
  describe('which file is boarded', () => {
    it('boards the URI a menu passes, as the selection command\'s payload without text', async () => {
      const chapter = fileUri('Drafts/chapter-6.md');
      const fake = createHost({
        active: doc(fileUri('Notes/other.md')),
        files: [doc(chapter)]
      });

      const outcome = await openFileInLightbox(chapter, fake.host);

      expect(fake.openTextDocument).toHaveBeenCalledWith(chapter);
      expect(fake.activeDocument).not.toHaveBeenCalled();
      // Exactly the whole-file shape: no text and no line range, so the
      // Lightbox reads the file itself and keeps it re-readable.
      expect(fake.seeded).toEqual([{
        sourceUri: 'file:///workspace/Drafts/chapter-6.md',
        relativePath: 'Drafts/chapter-6.md'
      }]);
      expect(outcome).toEqual({ kind: 'seeded', payload: fake.seeded[0], savedCopyOnly: false });
      expect(fake.warnings).toEqual([]);
      expect(fake.information).toEqual([]);
      expect(fake.logs).toEqual(['[Lightbox] Open File in Lightbox: boarding Drafts/chapter-6.md']);
    });

    it('boards the active editor\'s file when no URI is passed (the Command Palette)', async () => {
      const fake = createHost({ active: doc(fileUri('Drafts/chapter-7.md')) });

      await openFileInLightbox(undefined, fake.host);

      expect(fake.openTextDocument).not.toHaveBeenCalled();
      expect(fake.seeded).toEqual([{
        sourceUri: 'file:///workspace/Drafts/chapter-7.md',
        relativePath: 'Drafts/chapter-7.md'
      }]);
    });

    it.each(LIGHTBOX_FILE_LANGUAGE_IDS.map((languageId) => [languageId]))(
      'boards a %s file',
      async (languageId) => {
        const notes = fileUri('Drafts/notes.txt');
        const fake = createHost({ files: [doc(notes, languageId)] });

        const outcome = await openFileInLightbox(notes, fake.host);

        expect(outcome.kind).toBe('seeded');
        expect(fake.seeded).toHaveLength(1);
      }
    );

    it('offers Markdown and plain text only', () => {
      expect(LIGHTBOX_FILE_LANGUAGE_IDS).toEqual(['markdown', 'plaintext']);
    });

    it('leaves the word ceiling to the Lightbox: a whole book is handed over, uncounted', async () => {
      // LightboxHandler refuses it in the tab with its count (see
      // LightboxHandler.test.ts); the adapter never reads or counts the text.
      const book = fileUri('Drafts/whole-book.md');
      const fake = createHost({ files: [doc(book)] });

      await openFileInLightbox(book, fake.host);

      expect(fake.seeded).toEqual([{ sourceUri: 'file:///workspace/Drafts/whole-book.md', relativePath: 'Drafts/whole-book.md' }]);
      expect(fake.warnings).toEqual([]);
    });
  });

  describe('a dirty document', () => {
    it('boards the saved copy, the one Re-read file and the handoff check read, and says so', async () => {
      const chapter = fileUri('Drafts/chapter-6.md');
      const fake = createHost({ files: [doc(chapter, 'markdown', true)] });

      const outcome = await openFileInLightbox(chapter, fake.host);

      // The payload carries no editor text: the host reads the file on disk.
      expect(fake.seeded).toEqual([{ sourceUri: 'file:///workspace/Drafts/chapter-6.md', relativePath: 'Drafts/chapter-6.md' }]);
      expect(outcome).toEqual(expect.objectContaining({ kind: 'seeded', savedCopyOnly: true }));
      expect(fake.information).toEqual([
        'The Lightbox boarded the saved copy of “Drafts/chapter-6.md”. ' +
          'Your unsaved changes are not on the board: save, then choose Re-read file.'
      ]);
      expect(fake.warnings).toEqual([]);
      expect(fake.logs).toEqual([
        '[Lightbox] Open File in Lightbox: boarding the saved copy of Drafts/chapter-6.md; the editor has unsaved changes'
      ]);
    });

    it('says the same for the active editor', async () => {
      const fake = createHost({ active: doc(fileUri('Drafts/chapter-7.md'), 'plaintext', true) });

      await openFileInLightbox(undefined, fake.host);

      expect(fake.seeded).toHaveLength(1);
      expect(fake.information).toHaveLength(1);
    });
  });

  describe('refused with a message, and never sent', () => {
    it('refuses an untitled active document and points to Open Selection in Lightbox', async () => {
      const fake = createHost({ active: doc(new FakeUri('untitled', 'Untitled-1'), 'plaintext', true) });

      const outcome = await openFileInLightbox(undefined, fake.host);

      const message = '“Untitled-1” isn’t saved yet, so there is no file to board. ' +
        'Save it first, or select its text and run Open Selection in Lightbox.';
      expect(outcome).toEqual({ kind: 'refused', reason: 'untitled', message });
      expect(fake.warnings).toEqual([message]);
      expect(fake.seeded).toEqual([]);
      expect(fake.information).toEqual([]);
      expect(fake.logs).toEqual(['[Lightbox] Open File in Lightbox refused (untitled): Untitled-1']);
    });

    it('refuses an untitled URI before opening it, which would create the document', async () => {
      const fake = createHost();

      const outcome = await openFileInLightbox(new FakeUri('untitled', 'Untitled-2'), fake.host);

      expect(outcome).toEqual(expect.objectContaining({ kind: 'refused', reason: 'untitled' }));
      expect(fake.openTextDocument).not.toHaveBeenCalled();
      expect(fake.seeded).toEqual([]);
    });

    it('refuses a URI that is not a file on disk', async () => {
      const fake = createHost();

      const outcome = await openFileInLightbox(new FakeUri('git', '/workspace/Drafts/chapter-6.md'), fake.host);

      expect(outcome).toEqual({
        kind: 'refused',
        reason: 'not-on-disk',
        message: 'The Lightbox boards files saved on disk, and “chapter-6.md” is not one.'
      });
      expect(fake.openTextDocument).not.toHaveBeenCalled();
      expect(fake.seeded).toEqual([]);
    });

    it('refuses a non-text file passed programmatically', async () => {
      const cover = fileUri('Art/cover.png');
      const fake = createHost({ files: [[cover, new Error('File seems to be binary and cannot be opened as text')]] });

      const outcome = await openFileInLightbox(cover, fake.host);

      expect(outcome).toEqual({
        kind: 'refused',
        reason: 'not-text',
        message: '“cover.png” can’t be read as text. The Lightbox opens Markdown and plain-text files.'
      });
      expect(fake.warnings).toEqual(['“cover.png” can’t be read as text. The Lightbox opens Markdown and plain-text files.']);
      expect(fake.seeded).toEqual([]);
      // The opener's own wording stays out of the log; the reason and name say enough.
      expect(fake.logs).toEqual(['[Lightbox] Open File in Lightbox refused (not-text): cover.png']);
    });

    it('refuses a text file that is neither Markdown nor plain text', async () => {
      const settings = fileUri('.vscode/settings.json');
      const fake = createHost({ files: [doc(settings, 'json')] });

      const outcome = await openFileInLightbox(settings, fake.host);

      expect(outcome).toEqual({
        kind: 'refused',
        reason: 'unsupported-language',
        message: 'The Lightbox opens Markdown and plain-text files, and “settings.json” is neither.'
      });
      expect(fake.seeded).toEqual([]);
    });

    it('refuses the active editor\'s file when it is neither Markdown nor plain text', async () => {
      const fake = createHost({ active: doc(fileUri('src/index.ts'), 'typescript') });

      const outcome = await openFileInLightbox(undefined, fake.host);

      expect(outcome).toEqual(expect.objectContaining({ kind: 'refused', reason: 'unsupported-language' }));
      expect(fake.seeded).toEqual([]);
    });

    it('refuses an argument that is not a URI', async () => {
      const fake = createHost({ active: doc(fileUri('Drafts/chapter-6.md')) });

      const outcome = await openFileInLightbox('/workspace/Drafts/chapter-6.md', fake.host);

      expect(outcome).toEqual({ kind: 'refused', reason: 'not-a-uri', message: 'Open File in Lightbox needs a file to open.' });
      expect(fake.activeDocument).not.toHaveBeenCalled();
      expect(fake.seeded).toEqual([]);
    });

    it('asks for a file when there is no URI and no active editor', async () => {
      const fake = createHost();

      const outcome = await openFileInLightbox(undefined, fake.host);

      expect(outcome).toEqual({
        kind: 'refused',
        reason: 'no-file',
        message: 'Open a Markdown or plain-text file to board it in the Lightbox.'
      });
      expect(fake.seeded).toEqual([]);
      expect(fake.logs).toEqual(['[Lightbox] Open File in Lightbox refused (no-file)']);
    });
  });

  describe('owning the source before the document loads (PR #152 F-01)', () => {
    it('takes the source request when the file is chosen, before VS Code loads it, and boards under it', async () => {
      const chapter = fileUri('Drafts/chapter-6.md');
      const fake = createHost({ files: [doc(chapter)] });

      await openFileInLightbox(chapter, fake.host);

      expect(fake.events).toEqual(['ticket', 'open']);
      expect(fake.seededTickets).toEqual([fake.beginSourceRequest.mock.results[0].value]);
    });

    it('takes it for the active editor\'s file too, which has nothing to load', async () => {
      const fake = createHost({ active: doc(fileUri('Drafts/chapter-7.md')) });

      await openFileInLightbox(undefined, fake.host);

      expect(fake.events).toEqual(['ticket']);
      expect(fake.seeded).toHaveLength(1);
    });

    it.each([
      ['an untitled URI', () => new FakeUri('untitled', 'Untitled-2'), undefined],
      ['a URI not on disk', () => new FakeUri('git', '/workspace/Drafts/chapter-6.md'), undefined],
      ['an argument that is not a URI', () => '/workspace/Drafts/chapter-6.md', undefined],
      ['no target and no active editor', () => undefined, undefined],
      ['an untitled active document', () => undefined, doc(new FakeUri('untitled', 'Untitled-1'), 'plaintext')],
      ['an active document in another language', () => undefined, doc(fileUri('src/index.ts'), 'typescript')]
    ])('takes no request for a refusal it makes without loading: %s', async (_name, target, active) => {
      const fake = createHost({ active });

      const outcome = await openFileInLightbox(target(), fake.host);

      expect(outcome.kind).toBe('refused');
      expect(fake.beginSourceRequest).not.toHaveBeenCalled();
      expect(fake.seeded).toEqual([]);
    });

    it.each([
      ['cannot be read as text', fileUri('Art/cover.png'), new Error('File seems to be binary and cannot be opened as text')],
      ['is in another language', fileUri('.vscode/settings.json'), undefined]
    ])('has taken its request, and sends nothing, when the loaded file %s', async (_name, uri, failure) => {
      const fake = createHost({ files: [failure ? [uri, failure] : doc(uri, 'json')] });

      const outcome = await openFileInLightbox(uri, fake.host);

      expect(outcome.kind).toBe('refused');
      expect(fake.events).toEqual(['ticket', 'open']);
      expect(fake.seeded).toEqual([]);
    });

    it('drops a launch whose document loads after a newer choice, and says nothing about its saved copy', async () => {
      const chapter = fileUri('Drafts/chapter-6.md');
      let release!: (document: LightboxFileDocument<FakeUri>) => void;
      const fake = createHost();
      fake.openTextDocument.mockImplementationOnce(() => new Promise((resolve) => {
        release = resolve;
      }));

      const launching = openFileInLightbox(chapter, fake.host);
      fake.chooseNewerSource();
      release(doc(chapter, 'markdown', true));
      const outcome = await launching;

      expect(outcome).toEqual({
        kind: 'superseded',
        payload: { sourceUri: 'file:///workspace/Drafts/chapter-6.md', relativePath: 'Drafts/chapter-6.md' }
      });
      expect(fake.seeded).toEqual([]);
      expect(fake.information).toEqual([]);
      expect(fake.warnings).toEqual([]);
      expect(fake.logs).toEqual([
        '[Lightbox] Open File in Lightbox: dropped Drafts/chapter-6.md; a newer source was chosen while it loaded'
      ]);
    });
  });
});
