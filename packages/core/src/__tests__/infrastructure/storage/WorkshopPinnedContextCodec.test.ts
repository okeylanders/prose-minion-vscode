/**
 * WorkshopPinnedContextCodec (Workshop Pinned Context, Slice 1; ADR
 * 2026-11-04 D5, D6): format 1 round-trips its fixture byte for byte,
 * refuses every malformed shape whole by name, and compares paths
 * case-folded on Windows only. *Alice*, with made-up paths.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  decodeWorkshopPinnedContext,
  encodeWorkshopPinnedContext,
  prepareWorkshopPinnedContext
} from '@/infrastructure/storage/WorkshopPinnedContextCodec';
import {
  WORKSHOP_PINNED_CONTEXT_FILE_BYTES,
  WORKSHOP_PINNED_CONTEXT_FILES,
  WORKSHOP_PINNED_CONTEXT_REFUSALS,
  workshopPinnedContextPathKey,
  workshopPinnedContextPlatformOf,
  type WorkshopPinnedContextRefusal
} from '@shared/types/workshopPinnedContext';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const FIXTURE = path.resolve(__dirname, '../../fixtures/pinned-context-v1.json');
const fixture = () => fs.readFileSync(FIXTURE, 'utf8');
const json = (value: unknown) => JSON.stringify(value);
const files = (...paths: string[]) => paths.map((entryPath) => ({ path: entryPath }));
/** A valid file padded with trailing whitespace (which JSON allows) to exactly `bytes` bytes. */
const paddedTo = (bytes: number) => {
  const base = encodeWorkshopPinnedContext({ files: files('Characters/alice.md') });
  return base + ' '.repeat(bytes - new TextEncoder().encode(base).byteLength);
};
const refusal = (text: string | Uint8Array, platform: 'posix' | 'windows' = 'posix') => {
  const decoded = decodeWorkshopPinnedContext(text, platform);
  return decoded.ok ? 'read' : { reason: decoded.reason, ...(decoded.entry !== undefined ? { entry: decoded.entry } : {}) };
};

describe('format 1: the fixture', () => {
  it('reads the fixture, in pinned order', () => {
    const decoded = decodeWorkshopPinnedContext(fixture(), 'posix');
    expect(decoded).toEqual({
      ok: true,
      list: { files: files('Project/brief.md', 'Characters/alice.md', 'Characters/the-hatter.md', 'Places/Wonderland/the tea party.md') }
    });
  });

  it('writes the fixture back byte for byte: two-space indent, format first, a trailing newline', () => {
    const decoded = decodeWorkshopPinnedContext(fs.readFileSync(FIXTURE), 'windows');
    if (!decoded.ok) {
      throw new Error(decoded.reason);
    }
    const text = encodeWorkshopPinnedContext(decoded.list);
    expect(text).toBe(fixture());
    expect(text.startsWith('{\n  "format": 1,\n  "files": [')).toBe(true);
    expect(text.endsWith('}\n')).toBe(true);
  });

  it('writes an empty list stably, and nothing a caller added to an entry', () => {
    expect(encodeWorkshopPinnedContext({ files: [] })).toBe('{\n  "format": 1,\n  "files": []\n}\n');
    const smuggled = { files: [{ path: 'Characters/alice.md', group: 'characters' }] } as never;
    expect(encodeWorkshopPinnedContext(smuggled)).not.toContain('group');
  });

  it('reads past a leading byte-order mark, and never writes one', () => {
    const decoded = decodeWorkshopPinnedContext(`\uFEFF${fixture()}`, 'posix');
    expect(decoded.ok).toBe(true);
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(fixture())]);
    expect(decodeWorkshopPinnedContext(bytes, 'posix').ok).toBe(true);
    if (decoded.ok) {
      expect(encodeWorkshopPinnedContext(decoded.list).startsWith('{')).toBe(true);
    }
  });
});

describe('format 1: every refusal, whole', () => {
  // Every row names its entry (null for none): jest.each passes `done` into a missing last slot.
  const cases: Array<[string, string | Uint8Array, WorkshopPinnedContextRefusal, number | null]> = [
    ['text that is not JSON', '{"format": 1,', 'json', null],
    ['bytes that are not UTF-8', new Uint8Array([0x7b, 0xff, 0x7d]), 'json', null],
    ['a root that is an array', json([]), 'format', null],
    ['a root that is null', 'null', 'format', null],
    ['a missing format', json({ files: [] }), 'format', null],
    ['format 2', json({ format: 2, files: [] }), 'format', null],
    ['format "1"', json({ format: '1', files: [] }), 'format', null],
    ['missing files', json({ format: 1 }), 'format', null],
    ['files that are an object', json({ format: 1, files: {} }), 'format', null],
    ['an entry that is a string', json({ format: 1, files: ['Characters/alice.md'] }), 'format', 0],
    ['an unknown root key', json({ format: 1, files: [], group: 'characters' }), 'unknown-key', null],
    ['a __proto__ root key', '{"format":1,"files":[],"__proto__":{}}', 'unknown-key', null],
    ['an unknown entry key', json({ format: 1, files: [{ path: 'Characters/alice.md', note: 'Alice' }] }), 'unknown-key', 0],
    ['a missing path', json({ format: 1, files: [{}] }), 'path', 0],
    ['a path that is a number', json({ format: 1, files: [{ path: 7 }] }), 'path', 0],
    ['an empty path', json({ format: 1, files: files('') }), 'path', 0],
    ['an absolute path', json({ format: 1, files: files('/Characters/alice.md') }), 'path', 0],
    ['a drive letter', json({ format: 1, files: files('C:/Characters/alice.md') }), 'path', 0],
    ['a drive-relative path', json({ format: 1, files: files('c:alice.md') }), 'path', 0],
    ['a backslash', json({ format: 1, files: files('Characters\\alice.md') }), 'path', 0],
    ['a parent segment', json({ format: 1, files: files('Characters/../alice.md') }), 'path', 0],
    ['a leading parent segment', json({ format: 1, files: files('../alice.md') }), 'path', 0],
    ['a dot segment', json({ format: 1, files: files('./Characters/alice.md') }), 'path', 0],
    ['an empty segment', json({ format: 1, files: files('Characters//alice.md') }), 'path', 0],
    ['a trailing slash', json({ format: 1, files: files('Characters/') }), 'path', 0],
    ['a control character', json({ format: 1, files: files('Characters/alice\u0007.md') }), 'path', 0],
    ['a newline', json({ format: 1, files: files('Characters/alice\n.md') }), 'path', 0],
    ['a bad second entry', json({ format: 1, files: files('Characters/alice.md', '../the-hatter.md') }), 'path', 1],
    ['a duplicate', json({ format: 1, files: files('Characters/alice.md', 'Project/brief.md', 'Characters/alice.md') }), 'duplicate', 2],
    ['a duplicate in another Unicode form', json({ format: 1, files: files('Places/caf\u00e9.md', 'Places/cafe\u0301.md') }), 'duplicate', 1],
    ['a file one byte over the bound', paddedTo(WORKSHOP_PINNED_CONTEXT_FILE_BYTES + 1), 'too-large', null],
    ['one entry too many', json({ format: 1, files: Array.from({ length: WORKSHOP_PINNED_CONTEXT_FILES + 1 }, (_, index) => ({ path: `Notes/${index}.md` })) }), 'too-many', null]
  ];

  it.each(cases)('refuses %s', (_name, text, reason, entry) => {
    expect(refusal(text)).toEqual(entry === null ? { reason } : { reason, entry });
  });

  it('names every refusal the tab can say, and no other', () => {
    expect(new Set(cases.map(([, , reason]) => reason))).toEqual(new Set(WORKSHOP_PINNED_CONTEXT_REFUSALS));
  });

  it('reads exactly the bound, which is PROMPT_BUDGETS.workshopPinnedContext.files (20)', () => {
    expect(WORKSHOP_PINNED_CONTEXT_FILES).toBe(PROMPT_BUDGETS.workshopPinnedContext.files);
    expect(WORKSHOP_PINNED_CONTEXT_FILES).toBe(20);
    const full = Array.from({ length: WORKSHOP_PINNED_CONTEXT_FILES }, (_, index) => ({ path: `Notes/${index}.md` }));
    expect(refusal(json({ format: 1, files: full }))).toBe('read');
  });

  it('keeps names that only look odd: dots inside a name, spaces, colons past the first segment', () => {
    expect(refusal(json({ format: 1, files: files('.hidden/alice.md', 'Characters/alice..draft.md', 'Notes/10:30 tea.md') }))).toBe('read');
  });
});

describe('format 1: the byte bound', () => {
  it('is PROMPT_BUDGETS.workshopPinnedContext.fileBytes, 128 KiB', () => {
    expect(WORKSHOP_PINNED_CONTEXT_FILE_BYTES).toBe(PROMPT_BUDGETS.workshopPinnedContext.fileBytes);
    expect(WORKSHOP_PINNED_CONTEXT_FILE_BYTES).toBe(128 * 1024);
  });

  it('reads a file exactly at the bound, and refuses one byte over, as text or as bytes', () => {
    expect(refusal(paddedTo(WORKSHOP_PINNED_CONTEXT_FILE_BYTES))).toBe('read');
    expect(refusal(paddedTo(WORKSHOP_PINNED_CONTEXT_FILE_BYTES + 1))).toEqual({ reason: 'too-large' });
    expect(refusal(new TextEncoder().encode(paddedTo(WORKSHOP_PINNED_CONTEXT_FILE_BYTES + 1)))).toEqual({ reason: 'too-large' });
  });

  it('refuses over-bound bytes before decoding them: even ones that are not JSON say too-large', () => {
    expect(refusal(new Uint8Array(WORKSHOP_PINNED_CONTEXT_FILE_BYTES + 1).fill(0xff))).toEqual({ reason: 'too-large' });
  });

  it('never refuses a full list of long paths: twenty 4,096-character paths fit under the bound', () => {
    const long = (index: number) => `Notes/${String(index).padStart(2, '0')}-${'a'.repeat(4_096 - 9)}`;
    const full = { files: Array.from({ length: WORKSHOP_PINNED_CONTEXT_FILES }, (_, index) => ({ path: long(index) })) };
    expect(full.files.every((entry) => entry.path.length === 4_096)).toBe(true);
    expect(prepareWorkshopPinnedContext(full, 'posix').ok).toBe(true);
  });
});

describe('format 1: duplicates by platform', () => {
  const caseOnly = json({ format: 1, files: files('Characters/Alice.md', 'characters/alice.md') });

  it('folds case on Windows, so two spellings of one file are a duplicate', () => {
    expect(refusal(caseOnly, 'windows')).toEqual({ reason: 'duplicate', entry: 1 });
  });

  it('compares as written elsewhere, so they are two files', () => {
    expect(refusal(caseOnly, 'posix')).toBe('read');
  });

  it('names the host platform, and keys paths by it', () => {
    expect(workshopPinnedContextPlatformOf('win32')).toBe('windows');
    expect(workshopPinnedContextPlatformOf('darwin')).toBe('posix');
    expect(workshopPinnedContextPathKey('Characters/Alice.md', 'windows')).toBe('characters/alice.md');
    expect(workshopPinnedContextPathKey('Characters/Alice.md', 'posix')).toBe('Characters/Alice.md');
  });
});

describe('prepareWorkshopPinnedContext', () => {
  it('gives the bytes a list writes, when they read back', () => {
    const prepared = prepareWorkshopPinnedContext({ files: files('Characters/alice.md') }, 'posix');
    expect(prepared.ok && new TextDecoder().decode(prepared.bytes)).toBe(encodeWorkshopPinnedContext({ files: files('Characters/alice.md') }));
  });

  it('refuses a list whose bytes would pass the bound', () => {
    const huge = { files: Array.from({ length: WORKSHOP_PINNED_CONTEXT_FILES }, (_, index) => ({ path: `Notes/${index}-${'a'.repeat(7_000)}` })) };
    expect(prepareWorkshopPinnedContext(huge, 'posix')).toEqual({ ok: false, reason: 'too-large' });
  });

  it('refuses a list that would not read back, with the reason', () => {
    expect(prepareWorkshopPinnedContext({ files: files('Characters/alice.md', 'Characters/ALICE.md') }, 'windows'))
      .toEqual({ ok: false, reason: 'duplicate', entry: 1 });
  });
});
