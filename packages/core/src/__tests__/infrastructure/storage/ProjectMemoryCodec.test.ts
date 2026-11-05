/**
 * ProjectMemoryCodec, format 1 (Workshop Project Memory, Slice 1): a round
 * trip, the fixtures as written, every refusal by name, and the hand edits a
 * writer makes in VS Code (extra space, CRLF line endings, a missing
 * optional key). Fixtures are *Alice* (1865, public domain) with made-up
 * ids; never a writer's text.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { projectMemoryBody, supersededProjectMemoryIds, type ProjectMemory } from '@shared/types/projectMemory';
import {
  PROJECT_MEMORY_INVALID_REASONS,
  PROJECT_MEMORY_KEYS,
  decodeProjectMemory,
  encodeProjectMemory,
  prepareProjectMemoryFile,
  type ProjectMemoryInvalidReason
} from '@/infrastructure/storage/ProjectMemoryCodec';

const FIXTURES = path.resolve(__dirname, '../../fixtures/project-memory-v1');
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const RABBIT: ProjectMemory = {
  id: 'mem-7f3c2a',
  title: 'The Rabbit\'s watch runs backward',
  kind: 'canon',
  summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward; nobody in Wonderland remarks on it.',
  status: 'active',
  pinned: false,
  created: '2026-11-03T14:22:05Z',
  updated: '2026-11-03T14:22:05Z',
  origin: 'proposed',
  proposedBy: 'cliff',
  sourceSession: '6b0f3c9e-2c1d-4e8a-9a51-0d6f2b7c9e11',
  sourceTurns: ['turn-12-assistant-1730643725000', 'turn-15-assistant-1730643925000'],
  supersedes: [],
  body: [
    '',
    'We settled this while working the tea-party scene. The watch running',
    'backward is the first sign that time in Wonderland is wrong, and it pays',
    'off when the Hatter says it has always been six o\'clock.',
    '',
    '- It is never explained.',
    '- Alice notices once, in chapter 7.',
    ''
  ].join('\n')
};

function decoded(text: string): ProjectMemory {
  const result = decodeProjectMemory(text);
  if (result.kind !== 'memory') {
    throw new Error(`expected a memory, got ${result.reason}${result.key ? ` at ${result.key}` : ''}`);
  }
  return result.memory;
}

/** The fixture's text with the `key:` line replaced by `line` (or removed when `line` is undefined); added before the closing fence when absent. */
function withLine(text: string, key: string, line: string | undefined): string {
  const lines = text.split('\n');
  const index = lines.findIndex((candidate) => candidate.startsWith(`${key}:`));
  if (index < 0) {
    const close = lines.indexOf('---', 1);
    return [...lines.slice(0, close), ...(line === undefined ? [] : [line]), ...lines.slice(close)].join('\n');
  }
  return [...lines.slice(0, index), ...(line === undefined ? [] : [line]), ...lines.slice(index + 1)].join('\n');
}

describe('format 1: a round trip, and the fixtures as written', () => {
  it('reads the proposed fixture as the memory it holds, and writes it back byte for byte', () => {
    const text = fixture('the-rabbits-watch-runs-backward-7f3c2a.md');
    expect(decoded(text)).toEqual(RABBIT);
    expect(encodeProjectMemory(RABBIT)).toBe(text);
  });

  it('writes every fixture canonically: the keys present, in order, and no empty optional', () => {
    for (const name of fs.readdirSync(FIXTURES)) {
      const text = fixture(name);
      expect(encodeProjectMemory(decoded(text))).toBe(text);
      const frontmatter = text.split('\n---\n')[0].split('\n').slice(1);
      const keys = frontmatter.map((line) => line.split(':')[0]);
      expect(keys).toEqual(PROJECT_MEMORY_KEYS.filter((key) => keys.includes(key)));
      expect(frontmatter.filter((line) => /:$/.test(line))).toEqual([]);
    }
  });

  it('reads a writer\'s pinned memory with milliseconds, and an empty body', () => {
    expect(decoded(fixture('structure-before-line-edits-1a9e04.md'))).toMatchObject({
      origin: 'writer', pinned: true, updated: '2026-10-30T16:45:12.250Z', sourceTurns: [], supersedes: []
    });
    const duchess = decoded(fixture('the-duchess-baby-c0ffee.md'));
    expect(duchess).toMatchObject({ status: 'archived', kind: 'open-thread', body: '', supersedes: ['mem-0badd0', 'mem-abcdef'] });
    expect(duchess).not.toHaveProperty('proposedBy');
    expect(decoded(fixture('the-hatter-keeps-six-oclock-5a5a5a.md'))).toMatchObject({ origin: 'auto', proposedBy: 'agnes', supersedes: ['mem-7f3c2a'] });
  });

  it('derives superseded from the memories that name it, and never stores it', () => {
    const memories = fs.readdirSync(FIXTURES).map((name) => decoded(fixture(name)));
    expect(supersededProjectMemoryIds(memories)).toEqual(new Set(['mem-7f3c2a', 'mem-0badd0', 'mem-abcdef']));
    // The superseded Rabbit note is still stored as active, untouched.
    expect(memories.find((memory) => memory.id === 'mem-7f3c2a')?.status).toBe('active');
  });

  it('gives a new memory\'s Markdown its separating blank line', () => {
    expect(projectMemoryBody('Settled at the tea party.  \n\n')).toBe('\nSettled at the tea party.\n');
    expect(projectMemoryBody('  \n')).toBe('');
  });

  it('round-trips every kind, status and origin', () => {
    for (const kind of ['decision', 'canon', 'preference', 'open-thread'] as const) {
      for (const status of ['active', 'archived'] as const) {
        const memory: ProjectMemory = { ...RABBIT, kind, status, pinned: status === 'active' };
        expect(decoded(encodeProjectMemory(memory))).toEqual(memory);
      }
    }
    for (const origin of ['writer', 'proposed', 'auto'] as const) {
      expect(decoded(encodeProjectMemory({ ...RABBIT, origin }))).toEqual({ ...RABBIT, origin });
    }
    // A writer's memory may leave its provenance out.
    const { proposedBy: _proposer, sourceSession: _session, ...writer } = RABBIT;
    const written: ProjectMemory = { ...writer, origin: 'writer', sourceTurns: [] };
    expect(decoded(encodeProjectMemory(written))).toEqual(written);
    expect(encodeProjectMemory(written)).not.toMatch(/^(?:proposed-by|source-session|source-turns|supersedes):/m);
  });

  it('keeps the body byte for byte, with its own --- lines, indentation, blank lines and line endings', () => {
    const memory: ProjectMemory = { ...RABBIT, body: '\n\n\nAbove.\r\n\n---\n\n    indented code\n\n## A heading  \n\n' };
    expect(decoded(encodeProjectMemory(memory))).toEqual(memory);
  });
});

describe('hand edits in VS Code', () => {
  const text = fixture('the-rabbits-watch-runs-backward-7f3c2a.md');

  it('reads CRLF and lone CR line endings and a byte-order mark; writes LF, and keeps the body\'s own endings', () => {
    const crlf = decoded(text.replace(/\n/g, '\r\n'));
    expect(crlf).toEqual({ ...RABBIT, body: RABBIT.body.replace(/\n/g, '\r\n') });
    expect(encodeProjectMemory(crlf).split('\n---\n')[0]).not.toMatch(/\r/);
    expect(decoded(text.replace(/\n/g, '\r'))).toEqual({ ...RABBIT, body: RABBIT.body.replace(/\n/g, '\r') });
    expect(decoded(`\uFEFF${text}`)).toEqual(RABBIT);
  });

  it('reads extra space around keys, colons and values, around list entries, and after the fences', () => {
    let edited = withLine(text, 'title', 'title   :   The Rabbit\'s watch runs backward \t');
    edited = withLine(edited, 'source-turns', 'source-turns:turn-12-assistant-1730643725000 ,   turn-15-assistant-1730643925000');
    edited = edited.replace(/^---$/gm, '---  ');
    expect(decoded(edited)).toEqual(RABBIT);
  });

  it('skips blank lines inside the frontmatter', () => {
    expect(decoded(withLine(text, 'kind', '\nkind: canon\n'))).toEqual(RABBIT);
  });

  it('reads a missing or empty optional key as none, and writes neither back', () => {
    const edited = withLine(fixture('structure-before-line-edits-1a9e04.md'), 'pinned', 'supersedes:\nsource-session:   \nproposed-by:');
    const memory = decoded(edited);
    expect(memory).toMatchObject({ pinned: false, sourceTurns: [], supersedes: [] });
    expect(memory).not.toHaveProperty('sourceSession');
    expect(memory).not.toHaveProperty('proposedBy');
    expect(encodeProjectMemory(memory)).toBe(fixture('structure-before-line-edits-1a9e04.md').replace('pinned: true', 'pinned: false'));
  });

  it('takes a value literally: quotation marks and colons stay', () => {
    const edited = withLine(text, 'title', 'title: "Time: it runs backward"');
    expect(decoded(edited).title).toBe('"Time: it runs backward"');
  });
});

describe('fails closed, by name', () => {
  const text = fixture('the-rabbits-watch-runs-backward-7f3c2a.md');
  const cases: Array<[ProjectMemoryInvalidReason, string, string | undefined]> = [
    ['no-frontmatter', 'title: The Rabbit\n', undefined],
    ['no-frontmatter', `\n${text}`, undefined],
    ['unclosed-frontmatter', text.replace(/\n---\n\nWe settled[\s\S]*$/, '\n'), undefined],
    ['malformed-line', withLine(text, 'kind', '  kind: canon'), undefined],
    ['malformed-line', withLine(text, 'kind', '- canon'), undefined],
    ['malformed-line', withLine(text, 'kind', '# kind: canon'), undefined],
    ['malformed-line', withLine(text, 'kind', 'Kind: canon'), undefined],
    ['unknown-key', withLine(text, 'kind', 'kind: canon\nmood: wistful'), undefined],
    ['duplicate-key', withLine(text, 'kind', 'kind: canon\nkind: canon'), 'kind'],
    ['missing-key', withLine(text, 'summary', undefined), 'summary'],
    ['missing-key', withLine(text, 'title', 'title:   '), 'title'],
    ['missing-key', withLine(text, 'format', undefined), 'format'],
    ['unsupported-format', withLine(text, 'format', 'format: 2'), 'format'],
    ['invalid-value', withLine(text, 'format', 'format: one'), 'format'],
    ['invalid-value', withLine(text, 'id', 'id: mem-7F3C2A'), 'id'],
    ['invalid-value', withLine(text, 'id', 'id: ../../etc'), 'id'],
    ['invalid-value', withLine(text, 'kind', 'kind: rumor'), 'kind'],
    ['invalid-value', withLine(text, 'status', 'status: deleted'), 'status'],
    // Superseded is derived, never stored.
    ['invalid-value', withLine(text, 'status', 'status: superseded'), 'status'],
    ['invalid-value', withLine(text, 'origin', 'origin: model'), 'origin'],
    ['invalid-value', withLine(text, 'pinned', 'pinned: yes'), 'pinned'],
    ['invalid-value', withLine(text, 'created', 'created: 2026-02-30T00:00:00Z'), 'created'],
    ['invalid-value', withLine(text, 'created', 'created: 2026-11-03T14:22:05+01:00'), 'created'],
    ['invalid-value', withLine(text, 'updated', 'updated: yesterday'), 'updated'],
    ['invalid-value', withLine(text, 'proposed-by', 'proposed-by: Cliff Hanger'), 'proposed-by'],
    ['invalid-value', withLine(text, 'source-session', 'source-session: a/b'), 'source-session'],
    ['invalid-value', withLine(text, 'source-turns', 'source-turns: turn-1,,turn-2'), 'source-turns'],
    ['invalid-value', withLine(text, 'source-turns', 'source-turns: turn-1-user-1, turn-1-user-1'), 'source-turns'],
    ['invalid-value', withLine(text, 'source-turns', 'source-turns: t-0412'), 'source-turns'],
    ['invalid-value', withLine(text, 'source-turns', 'source-turns: turn-4-persona-1730643725000'), 'source-turns'],
    ['invalid-value', withLine(text, 'supersedes', 'supersedes: mem-1a9e04,'), 'supersedes'],
    ['invalid-value', withLine(text, 'title', 'title: The Rabbit\u2028watch'), 'title'],
    ['invalid-value', withLine(text, 'summary', 'summary: A\u0007bell'), 'summary'],
    ['too-long', withLine(text, 'title', `title: ${'a'.repeat(121)}`), 'title'],
    ['too-long', withLine(text, 'summary', `summary: ${'a'.repeat(281)}`), 'summary'],
    ['too-long', withLine(text, 'source-turns', `source-turns: ${Array.from({ length: 33 }, (_, index) => `turn-${index}-user-1`).join(', ')}`), 'source-turns'],
    ['too-long', withLine(text, 'supersedes', `supersedes: ${Array.from({ length: 9 }, (_, index) => `mem-00000${index}`).join(', ')}`), 'supersedes'],
    ['too-long', `${text}${'a'.repeat(8_001)}\n`, undefined],
    ['proposal-without-provenance', withLine(text, 'proposed-by', undefined), 'proposed-by'],
    ['proposal-without-provenance', withLine(text, 'source-session', 'source-session:'), 'source-session'],
    ['proposal-without-provenance', withLine(text, 'source-turns', undefined), 'source-turns'],
    ['proposal-without-provenance', withLine(withLine(text, 'origin', 'origin: auto'), 'proposed-by', undefined), 'proposed-by'],
    ['turns-without-session', withLine(withLine(text, 'origin', 'origin: writer'), 'source-session', undefined), 'source-turns'],
    ['updated-before-created', withLine(text, 'updated', 'updated: 2026-11-03T14:22:04Z'), 'updated'],
    ['supersedes-itself', withLine(text, 'supersedes', 'supersedes: mem-1a9e04, mem-7f3c2a'), 'supersedes']
  ];

  it.each(cases)('%s', (reason, edited, key) => {
    expect(decodeProjectMemory(edited)).toEqual(key ? { kind: 'invalid', reason, key } : { kind: 'invalid', reason });
  });

  it('names every reason it has in a case above', () => {
    expect(new Set(cases.map(([reason]) => reason))).toEqual(new Set(PROJECT_MEMORY_INVALID_REASONS));
  });

  it('never carries the file\'s text in a refusal', () => {
    const secret = 'The Queen is the Duchess in disguise';
    const refusal = decodeProjectMemory(withLine(text, 'kind', `kind: canon\n${secret.toLowerCase().replace(/ /g, '-')}: yes`));
    expect(JSON.stringify(refusal)).not.toMatch(/queen|duchess/i);
  });

  it('a body exactly at its bound reads; one character past does not', () => {
    expect(decoded(encodeProjectMemory({ ...RABBIT, body: 'a'.repeat(8_000) })).body).toHaveLength(8_000);
    // A writer's memory may name the persona it came from.
    expect(decodeProjectMemory(withLine(text, 'origin', 'origin: writer')).kind).toBe('memory');
    expect(decodeProjectMemory(encodeProjectMemory({ ...RABBIT, body: 'a'.repeat(8_001) }))).toEqual({ kind: 'invalid', reason: 'too-long' });
  });

  it('a value written with a line break does not read back: the store refuses to write it', () => {
    expect(decodeProjectMemory(encodeProjectMemory({ ...RABBIT, title: 'Two\nlines' })).kind).toBe('invalid');
  });
});

describe('prepareProjectMemoryFile: what is written is what was meant (PR #194 F-01)', () => {
  it('encodes a memory that reads back field for field', () => {
    expect(prepareProjectMemoryFile(RABBIT)).toEqual({ kind: 'file', text: fixture('the-rabbits-watch-runs-backward-7f3c2a.md'), memory: RABBIT });
  });

  it('refuses a field with a line break before it is put on a line', () => {
    expect(prepareProjectMemoryFile({ ...RABBIT, title: 'Hello\ncreated: 2000-01-01T00:00:00Z' })).toEqual({ kind: 'invalid', reason: 'invalid-value', key: 'title' });
    expect(prepareProjectMemoryFile({ ...RABBIT, created: '2026-11-03T14:22:05Z\r' })).toEqual({ kind: 'invalid', reason: 'invalid-value', key: 'created' });
    expect(prepareProjectMemoryFile({ ...RABBIT, pinned: 'true' as unknown as boolean })).toEqual({ kind: 'invalid', reason: 'invalid-value', key: 'pinned' });
  });

  it('refuses a memory whose file would decode as another one', () => {
    // Surrounding space is not kept on a line, so this title would come back changed.
    expect(prepareProjectMemoryFile({ ...RABBIT, title: ' The Rabbit ' })).toEqual({ kind: 'invalid', reason: 'not-as-written' });
    expect(prepareProjectMemoryFile({ ...RABBIT, sourceTurns: [' turn-12-assistant-1730643725000'] })).toEqual({ kind: 'invalid', reason: 'not-as-written' });
  });
});

describe('the file\'s byte bound (PR #194 F-05)', () => {
  it('is checked on the encoded bytes before anything is written: at the bound it passes, one byte over it is refused', () => {
    const bytes = new TextEncoder().encode(encodeProjectMemory(RABBIT)).byteLength;
    expect(prepareProjectMemoryFile(RABBIT, bytes).kind).toBe('file');
    expect(prepareProjectMemoryFile(RABBIT, bytes - 1)).toEqual({ kind: 'invalid', reason: 'file-too-large' });
  });

  it('bounds a turn id\'s digit runs, so the field bounds imply a byte bound', () => {
    expect(decoded(withLine(fixture('the-rabbits-watch-runs-backward-7f3c2a.md'), 'source-turns', `source-turns: turn-999999999-user-${'9'.repeat(16)}`)).sourceTurns).toHaveLength(1);
    for (const turn of [`turn-1234567890-user-1`, `turn-1-user-${'9'.repeat(17)}`]) {
      expect(decodeProjectMemory(withLine(fixture('the-rabbits-watch-runs-backward-7f3c2a.md'), 'source-turns', `source-turns: ${turn}`)))
        .toEqual({ kind: 'invalid', reason: 'invalid-value', key: 'source-turns' });
    }
  });
});

describe('superseded, derived, with ADR D4\'s cycle rule (PR #194 N-01)', () => {
  const memory = (id: string, ...supersedes: string[]) => ({ id, supersedes });

  it('a memory another names is superseded; one that names nothing is not', () => {
    expect(supersededProjectMemoryIds([memory('mem-00000b', 'mem-00000a'), memory('mem-00000a')])).toEqual(new Set(['mem-00000a']));
    // A chain: each one named by a newer is superseded, the newest is not.
    expect(supersededProjectMemoryIds([memory('mem-00000c', 'mem-00000b'), memory('mem-00000b', 'mem-00000a'), memory('mem-00000a')]))
      .toEqual(new Set(['mem-00000a', 'mem-00000b']));
  });

  it('in a cycle, neither memory is superseded: A and B naming each other', () => {
    expect(supersededProjectMemoryIds([memory('mem-00000a', 'mem-00000b'), memory('mem-00000b', 'mem-00000a')])).toEqual(new Set());
  });

  it('in a longer cycle, none is: A → B → C → A', () => {
    expect(supersededProjectMemoryIds([memory('mem-00000a', 'mem-00000b'), memory('mem-00000b', 'mem-00000c'), memory('mem-00000c', 'mem-00000a')]))
      .toEqual(new Set());
  });

  it('a memory off the cycle that a cycle names is still superseded', () => {
    expect(supersededProjectMemoryIds([memory('mem-00000a', 'mem-00000b', 'mem-00000d'), memory('mem-00000b', 'mem-00000a'), memory('mem-00000d')]))
      .toEqual(new Set(['mem-00000d']));
  });
});
