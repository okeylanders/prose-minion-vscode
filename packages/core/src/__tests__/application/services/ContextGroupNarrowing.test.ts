/**
 * The one rule a narrowed group is read by (ADR 2026-11-20 S42–S46): a list
 * read as a context-path setting is read, each pattern held to the
 * context-path rules, and the group's authoritative listing intersected
 * with what the patterns find, by host file identity. The real resolver
 * walks a made-up *Alice* project.
 */
/* eslint-disable @typescript-eslint/naming-convention -- made-up roots and setting keys, keyed by their paths and names. */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import {
  contextGroupMatchRefused,
  narrowContextGroup,
  readContextGroupMatch,
  walkContextGroupPatterns
} from '@/application/services/ContextGroupNarrowing';
import { readContextGroupMatchList, splitContextPathList } from '@/utils/contextGroupMatchList';
import { contextPathSettingPatterns } from '@/application/services/contextPaths/ContextPathPatternSafety';
import { aliceProject, type AliceProjectOptions } from './contextPaths/aliceProject';

const bounds = PROMPT_BUDGETS.contextPaths;

const BOOK = [
  'Drafts/chapter-1.md',
  'Drafts/chapter-1.2.md',
  'Drafts/chapter-4.1.md',
  'Drafts/chapter-4.2.md',
  'Drafts/chapter-10.md',
  'Drafts/outline.txt',
  'Notes/lore.md',
  'Notes/chapter-4-notes.md'
];

function project(options: Partial<AliceProjectOptions> = {}) {
  const alice = aliceProject({
    roots: { '/alice': BOOK },
    settings: { 'contextPaths.chapters': 'Drafts/**', 'contextPaths.general': 'Notes/**' },
    ...options
  });
  const resolver = new ContextResourceResolver(alice.settings, alice.fileSystem, alice.workspace, alice.log);
  return { alice, resolver };
}

async function narrowed(patterns: string[], options: Partial<AliceProjectOptions> = {}) {
  const { alice, resolver } = project(options);
  const listed = await resolver.listGroupFiles(['chapters']);
  const walk = await walkContextGroupPatterns(resolver, [{ group: 'chapters', patterns }]);
  return { alice, outcome: narrowContextGroup(listed, { group: 'chapters', patterns }, walk) };
}

describe('reading a narrowing as written', () => {
  it('splits a list as a context-path setting is split: commas, trimmed, empties dropped', () => {
    expect(readContextGroupMatch(['Drafts/chapter-4.*.md, Drafts/chapter-1*.md,'])).toEqual({
      kind: 'patterns', patterns: ['Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md']
    });
    // One rule: the setting's own split is this one.
    expect(contextPathSettingPatterns(' a.md ,, b.md , ')).toEqual(splitContextPathList(' a.md ,, b.md , '));
  });

  it('joins several lists in order, as a call\'s repeated <match> is', () => {
    expect(readContextGroupMatch(['Drafts/a.md', 'Drafts/b.md, Drafts/c.md'])).toEqual({
      kind: 'patterns', patterns: ['Drafts/a.md', 'Drafts/b.md', 'Drafts/c.md']
    });
  });

  it.each<[string, string[], string]>([
    ['nothing but commas', [' , ,'], 'empty'],
    ['a list longer than matchCharacters', [`Drafts/${'a'.repeat(bounds.matchCharacters)}.md`], 'too-long'],
    ['more than matchPatterns', [Array.from({ length: bounds.matchPatterns + 1 }, (_, index) => `Drafts/${index}.md`).join(',')], 'too-many'],
    ['a parent segment', ['Drafts/*.md, ../secrets/*.md'], 'unsafe'],
    ['a leading slash', ['/Drafts/*.md'], 'unsafe'],
    ['a drive', ['C:/Drafts/*.md'], 'unsafe'],
    ['a home path', ['~/Drafts/*.md'], 'unsafe'],
    ['a workspace prefix', ['workspace:Drafts/*.md'], 'unsafe'],
    ['a backslash', ['Drafts\\*.md'], 'unsafe'],
    ['a pattern over patternCharacters', [`Drafts/${'a'.repeat(bounds.patternCharacters)}.md`], 'unsafe']
  ])('refuses %s', (_what, written, fault) => {
    expect(readContextGroupMatch(written)).toEqual({ kind: 'refused', fault });
  });

  it('holds an already-split list to the same rule', () => {
    expect(contextGroupMatchRefused(['Drafts/*.md'])).toBe(false);
    expect(contextGroupMatchRefused([])).toBe(true);
    expect(contextGroupMatchRefused(['../x.md'])).toBe(true);
    expect(contextGroupMatchRefused(['a.md, b.md'])).toBe(true);
    expect(contextGroupMatchRefused(Array.from({ length: bounds.matchPatterns + 1 }, (_, index) => `${index}.md`))).toBe(true);
  });

  it('fits every list of the most patterns at their longest, joined as a continuation writes one, within matchCharacters', () => {
    const longest = Array.from({ length: bounds.matchPatterns }, (_, index) => `${index}${'a'.repeat(bounds.patternCharacters - 1)}`);
    const joined = longest.join(', ');
    expect(joined.length).toBeLessThanOrEqual(bounds.matchCharacters);
    expect(readContextGroupMatchList([joined])).toEqual({ kind: 'patterns', patterns: longest });
  });
});

describe('narrowing a group', () => {
  it('keeps the group\'s files at least one pattern finds, in the listing\'s order, with each pattern\'s count', async () => {
    const { outcome } = await narrowed(['Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md']);
    expect(outcome.kind).toBe('narrowed');
    if (outcome.kind !== 'narrowed') {
      return;
    }
    expect(outcome.files.map((file) => file.relativePath).sort()).toEqual([
      'Drafts/chapter-1.2.md', 'Drafts/chapter-1.md', 'Drafts/chapter-10.md', 'Drafts/chapter-4.1.md', 'Drafts/chapter-4.2.md'
    ]);
    expect(outcome.patterns).toEqual([
      { pattern: 'Drafts/chapter-4.*.md', files: 2 },
      { pattern: 'Drafts/chapter-1*.md', files: 3 }
    ]);
  });

  it('never reaches a file outside its group: a pattern that finds only another group\'s files counts none', async () => {
    const { outcome } = await narrowed(['Notes/*.md', '**/chapter-4*.md']);
    expect(outcome.kind === 'narrowed' && outcome.files.map((file) => file.relativePath).sort())
      .toEqual(['Drafts/chapter-4.1.md', 'Drafts/chapter-4.2.md']);
    // `Notes/chapter-4-notes.md` matches the second pattern, and is no file of chapters.
    expect(outcome.kind === 'narrowed' && outcome.patterns).toEqual([
      { pattern: 'Notes/*.md', files: 0 },
      { pattern: '**/chapter-4*.md', files: 2 }
    ]);
  });

  it('reads an incomplete walk as incomplete, never as zero files (ADR 2026-11-19 D22a)', async () => {
    const failing = await narrowed(['Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md'], { failingGlobs: ['Drafts/chapter-1*.md'] });
    expect(failing.outcome).toEqual({ kind: 'incomplete' });
    // A match the walk could not inspect, though the group's own listing read whole.
    const unreadable = await narrowed(['Drafts/chapter-4.*.md', '**/lore.md'], { unreadable: ['Notes/lore.md'] });
    expect(unreadable.outcome).toEqual({ kind: 'incomplete' });
  });

  it('reads a walk that throws as failed, and so incomplete', async () => {
    const walk = await walkContextGroupPatterns({ matchPatterns: async () => { throw new Error('host error'); } }, [{ group: 'chapters', patterns: ['a.md'] }]);
    expect(walk).toEqual({ kind: 'failed' });
    expect(narrowContextGroup([], { group: 'chapters', patterns: ['a.md'] }, walk)).toEqual({ kind: 'incomplete' });
  });

  it('with no workspace folder open, every pattern finds nothing', async () => {
    const { resolver } = project({ roots: {} });
    const walk = await walkContextGroupPatterns(resolver, [{ group: 'chapters', patterns: ['Drafts/*.md'] }]);
    expect(walk).toEqual({ kind: 'no-folder' });
    expect(narrowContextGroup([], { group: 'chapters', patterns: ['Drafts/*.md'] }, walk))
      .toEqual({ kind: 'narrowed', files: [], patterns: [{ pattern: 'Drafts/*.md', files: 0 }] });
  });

  it('keeps two workspace folders\' files with the same path apart, by host identity', async () => {
    const { resolver } = project({ roots: { '/alice': BOOK, '/looking-glass': ['Drafts/chapter-4.1.md'] } });
    const listed = await resolver.listGroupFiles(['chapters']);
    const walk = await walkContextGroupPatterns(resolver, [{ group: 'chapters', patterns: ['Drafts/chapter-4.1.md'] }]);
    const outcome = narrowContextGroup(listed, { group: 'chapters', patterns: ['Drafts/chapter-4.1.md'] }, walk);
    expect(outcome.kind === 'narrowed' && outcome.files.map((file) => file.absolutePath).sort())
      .toEqual(['/alice/Drafts/chapter-4.1.md', '/looking-glass/Drafts/chapter-4.1.md']);
    expect(outcome.kind === 'narrowed' && outcome.patterns).toEqual([{ pattern: 'Drafts/chapter-4.1.md', files: 2 }]);
  });

  it('walks every narrowing of an operation once', async () => {
    const { resolver } = project();
    const matchPatterns = jest.spyOn(resolver, 'matchPatterns');
    await walkContextGroupPatterns(resolver, [
      { group: 'chapters', patterns: ['Drafts/chapter-4.*.md'] },
      { group: 'general', patterns: ['Notes/*.md'] },
      { group: 'chapters', patterns: ['Drafts/chapter-4.*.md', 'Drafts/outline.txt'] }
    ]);
    expect(matchPatterns).toHaveBeenCalledTimes(1);
    expect(matchPatterns).toHaveBeenCalledWith({ chapters: ['Drafts/chapter-4.*.md', 'Drafts/outline.txt'], general: ['Notes/*.md'] });
  });

  it('logs nothing that names a pattern or a file', async () => {
    const { alice } = await narrowed(['Drafts/chapter-4.*.md']);
    const logged = alice.lines.join('\n');
    expect(logged).not.toMatch(/chapter|Drafts|Notes/);
  });
});
