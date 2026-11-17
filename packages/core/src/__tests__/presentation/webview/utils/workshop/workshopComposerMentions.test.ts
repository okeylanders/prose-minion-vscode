/**
 * `@` in the Workshop composer, the pure rules (Everyday Conveniences round
 * two, item G): where an `@` opens the list, what a query keeps, the token a
 * file leaves in the sentence (decision A2), and the draft after a pick.
 */

import type { ConfiguredResourceEntry } from '@messages';
import {
  applyWorkshopMentionPick,
  detectWorkshopMentionTrigger,
  filterWorkshopMentionFiles,
  isWorkshopFileMentionToken,
  removeWorkshopMentionTrigger,
  workshopMentionKey,
  workshopMentionTokens
} from '@utils/workshop/workshopComposerMentions';

const file = (
  group: ConfiguredResourceEntry['group'],
  path: string,
  sizeBytes = 2048
): ConfiguredResourceEntry => ({ group, path, label: path.split('/').pop() as string, sizeBytes });

const CATALOG: ConfiguredResourceEntry[] = [
  file('characters', 'story/characters/alice.md'),
  file('characters', 'story/characters/notes.md'),
  file('characters', 'story/characters/jill'),
  file('locations', 'story/locations/notes.md'),
  file('chapters', 'drafts/alice-ch3.md'),
  file('chapters', 'drafts/chapter 4.md'),
  file('chapters', 'drafts/Élan.md'),
  file('general', 'README')
];

const NONE = new Set<string>();

describe('detectWorkshopMentionTrigger', () => {
  const at = (text: string, caret = text.length) => detectWorkshopMentionTrigger(text, caret);

  it('opens at the start of the text', () => {
    expect(at('@')).toEqual({ start: 0, end: 1, query: '' });
    expect(at('@ali')).toEqual({ start: 0, end: 4, query: 'ali' });
  });

  it('opens after whitespace, a new line included', () => {
    expect(at('compare this with @ch')).toEqual({ start: 18, end: 21, query: 'ch' });
    expect(at('first line\n@ch')).toEqual({ start: 11, end: 14, query: 'ch' });
  });

  it.each(['(', '[', '{', '"', "'", '“', '‘'])('opens after an opening %s', (opener) => {
    expect(at(`see ${opener}@ch`)).toEqual({ start: 5, end: 8, query: 'ch' });
  });

  it('opens nothing for an @ inside a word', () => {
    expect(at('write to alice@example')).toBeNull();
    expect(at('alice@')).toBeNull();
    expect(at('a.b@c.d')).toBeNull();
  });

  it('closes once whitespace follows the @', () => {
    expect(at('meet me @ noon')).toBeNull();
    expect(at('see @alice.md and')).toBeNull();
  });

  it('reads the query up to the caret, not the end of the text', () => {
    expect(at('see @alice and more', 8)).toEqual({ start: 4, end: 8, query: 'ali' });
    expect(at('see @alice and more', 3)).toBeNull();
  });

  it('opens nothing with no @ at all', () => {
    expect(at('')).toBeNull();
    expect(at('plain words')).toBeNull();
  });
});

describe('workshopMentionTokens', () => {
  const tokens = workshopMentionTokens(CATALOG);
  const tokenOf = (group: ConfiguredResourceEntry['group'], path: string) =>
    tokens.get(workshopMentionKey({ group, path }));

  it('uses the base name when it is the only file of that name: its pill label', () => {
    expect(tokenOf('characters', 'story/characters/alice.md')).toBe('alice.md');
    expect(tokenOf('chapters', 'drafts/alice-ch3.md')).toBe('alice-ch3.md');
  });

  it('tells files of one base name apart by the shortest unique path', () => {
    expect(tokenOf('characters', 'story/characters/notes.md')).toBe('characters/notes.md');
    expect(tokenOf('locations', 'story/locations/notes.md')).toBe('locations/notes.md');
  });

  it('gives a file with no extension its folder, so it cannot read as a persona', () => {
    expect(tokenOf('characters', 'story/characters/jill')).toBe('characters/jill');
    expect(tokenOf('general', 'README')).toBe('./README');
  });

  it('keeps the rule in the first word of a name that holds a space', () => {
    expect(tokenOf('chapters', 'drafts/chapter 4.md')).toBe('drafts/chapter 4.md');
  });

  it('decision A2: every token the list can insert holds a . or a / in its first word', () => {
    const wide = [
      ...CATALOG,
      file('things', 'props/the lamp'),
      file('things', 'other/the lamp'),
      file('themes', 'a b/c d'),
      file('manuscript', 'book.txt'),
      file('general', 'notes.md')
    ];
    const all = workshopMentionTokens(wide);
    expect(all.size).toBe(wide.length);
    for (const token of all.values()) {
      expect(isWorkshopFileMentionToken(token)).toBe(true);
      expect(token.split(/\s/)[0]).toMatch(/[./]/);
    }
    // A persona token holds neither.
    expect(isWorkshopFileMentionToken('Jill')).toBe(false);
  });

  it('gives every file a token of its own, each the end of its path', () => {
    const seen = new Set(tokens.values());
    expect(seen.size).toBe(CATALOG.length);
    for (const entry of CATALOG) {
      const token = tokens.get(workshopMentionKey(entry)) as string;
      expect(`/${entry.path}`.endsWith(`/${token.replace(/^\.\//, '')}`)).toBe(true);
    }
  });
});

describe('filterWorkshopMentionFiles', () => {
  const names = (query: string) =>
    filterWorkshopMentionFiles(CATALOG, query, NONE).rows.map((row) => row.entry.path);

  it('keeps every file for an empty query, in the catalog order', () => {
    expect(names('')).toEqual(CATALOG.map((entry) => entry.path));
  });

  it('puts a name that starts with the query ahead of one that holds it, then a path', () => {
    expect(names('ali')).toEqual(['story/characters/alice.md', 'drafts/alice-ch3.md']);
    expect(names('ch')).toEqual([
      'drafts/chapter 4.md',
      'drafts/alice-ch3.md',
      'story/characters/alice.md',
      'story/characters/notes.md',
      'story/characters/jill'
    ]);
  });

  it('folds case and accents', () => {
    expect(names('ELAN')).toEqual(['drafts/Élan.md']);
    expect(names('élan')).toEqual(['drafts/Élan.md']);
  });

  it('treats the query as plain text, never a pattern', () => {
    expect(names('.*')).toEqual([]);
    expect(names('notes.md')).toEqual(['story/characters/notes.md', 'story/locations/notes.md']);
    expect(names('a(')).toEqual([]);
  });

  it('marks a file already staged for this message, by catalog key', () => {
    const staged = new Set([workshopMentionKey({ group: 'locations', path: 'story/locations/notes.md' })]);
    const rows = filterWorkshopMentionFiles(CATALOG, 'notes', staged).rows;
    expect(rows.map((row) => [row.entry.group, row.staged])).toEqual([['characters', false], ['locations', true]]);
  });

  it('draws at most the limit and still counts every match', () => {
    const matches = filterWorkshopMentionFiles(CATALOG, '', NONE, 3);
    expect(matches.rows).toHaveLength(3);
    expect(matches.total).toBe(CATALOG.length);
  });

  it('carries each row\'s token', () => {
    const rows = filterWorkshopMentionFiles(CATALOG, 'notes', NONE).rows;
    expect(rows.map((row) => row.token)).toEqual(['characters/notes.md', 'locations/notes.md']);
  });
});

describe('applyWorkshopMentionPick', () => {
  it('replaces the typed @… with the token and a space, the caret after it', () => {
    const text = 'compare this with @ch';
    const trigger = detectWorkshopMentionTrigger(text, text.length)!;
    expect(applyWorkshopMentionPick(text, trigger, 'alice-ch3.md')).toEqual({
      text: 'compare this with @alice-ch3.md ',
      caret: 32
    });
  });

  it('keeps the rest of the sentence, and adds no second space', () => {
    const text = 'compare @ch with the draft';
    const trigger = detectWorkshopMentionTrigger(text, 11)!;
    const edit = applyWorkshopMentionPick(text, trigger, 'alice-ch3.md');
    expect(edit.text).toBe('compare @alice-ch3.md with the draft');
    expect(edit.text.slice(0, edit.caret)).toBe('compare @alice-ch3.md ');
  });

  it('puts a space before text that follows the caret directly', () => {
    const text = '(@ch)';
    const trigger = detectWorkshopMentionTrigger(text, 4)!;
    const edit = applyWorkshopMentionPick(text, trigger, 'alice-ch3.md');
    expect(edit.text).toBe('(@alice-ch3.md )');
    expect(edit.caret).toBe('(@alice-ch3.md '.length);
  });
});

describe('removeWorkshopMentionTrigger', () => {
  it('takes the typed @… out and leaves the caret where it stood', () => {
    const text = 'look at @ch please';
    const trigger = detectWorkshopMentionTrigger(text, 11)!;
    expect(removeWorkshopMentionTrigger(text, trigger)).toEqual({ text: 'look at  please', caret: 8 });
  });
});
