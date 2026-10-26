/**
 * The editor context menu's **Prose Minion** submenu (Draft Edit Slice 3;
 * ADR 2026-10-21, Amendment 2026-10-26, D8).
 *
 * The manifest is read as VS Code 1.82.0 reads it, so these witnesses say
 * what a writer sees on right-click:
 * - a menu item is labelled by its command's `title`, and the Command
 *   Palette by "category: title" (`actions.ts` `MenuItemAction.label`,
 *   `commandsQuickAccess.ts`);
 * - an item shows when its `when` clause holds; groups sort lexically, then
 *   by order, then by title; and a submenu with nothing to show is left out
 *   (`menuService.ts` `createActionGroups`, `_compareMenuItems`).
 * The `when` reader below knows only the operators the manifest uses, and
 * fails on anything else rather than guessing.
 */

import * as fs from 'fs';
import * as path from 'path';

const EXTENSION_MANIFEST = path.resolve(__dirname, '..', '..', '..', 'package.json');
const SUBMENU = 'prose-minion.editorContext';

interface MenuEntry {
  readonly command?: string;
  readonly submenu?: string;
  readonly when?: string;
  readonly group?: string;
}

interface Manifest {
  contributes: {
    commands: Array<{ command: string; title: string; category?: string }>;
    submenus?: Array<{ id: string; label: string }>;
    menus: Record<string, MenuEntry[]>;
  };
}

const manifest = JSON.parse(fs.readFileSync(EXTENSION_MANIFEST, 'utf8')) as Manifest;
const titles = new Map(manifest.contributes.commands.map((entry) => [entry.command, entry.title]));

type Context = Readonly<Record<string, string | boolean>>;

/** A `when` clause: `||`, `&&`, `!`, `==` and parentheses, in VS Code's precedence. */
function holds(when: string | undefined, context: Context): boolean {
  if (when === undefined) {
    return true;
  }
  const tokens = when.match(/&&|\|\||==|!|\(|\)|[\w.-]+/g) ?? [];
  expect(tokens.join('')).toBe(when.replace(/\s+/g, ''));
  let at = 0;
  const take = () => tokens[at++];
  const either = (): boolean => {
    let value = both();
    while (tokens[at] === '||') {
      take();
      value = both() || value;
    }
    return value;
  };
  const both = (): boolean => {
    let value = single();
    while (tokens[at] === '&&') {
      take();
      value = single() && value;
    }
    return value;
  };
  const single = (): boolean => {
    const token = take();
    if (token === '!') {
      return !single();
    }
    if (token === '(') {
      const value = either();
      expect(take()).toBe(')');
      return value;
    }
    if (tokens[at] === '==') {
      take();
      return context[token] === take();
    }
    return context[token] === true;
  };
  const value = either();
  expect(at).toBe(tokens.length);
  return value;
}

/** A menu as VS Code draws it in `context`: its groups in order, each a list of labels. */
function drawn(menu: string, context: Context): string[][] {
  const groups = new Map<string, Array<{ order: number; label: string }>>();
  for (const entry of manifest.contributes.menus[menu] ?? []) {
    if (!holds(entry.when, context)) {
      continue;
    }
    const [group = '', order = '0'] = (entry.group ?? '').split('@');
    const label = entry.command
      ? titles.get(entry.command)!
      : manifest.contributes.submenus!.find((each) => each.id === entry.submenu)!.label;
    // A submenu with nothing to show is left out.
    if (entry.submenu && drawn(entry.submenu, context).length === 0) {
      continue;
    }
    groups.set(group, [...(groups.get(group) ?? []), { order: Number(order), label }]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === b ? 0 : !a ? 1 : !b ? -1 : a === 'navigation' ? -1 : b === 'navigation' ? 1 : a.localeCompare(b)))
    .map(([, items]) => items.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)).map((item) => item.label));
}

const markdownFile = { resourceScheme: 'file', editorLangId: 'markdown' };

describe('The editor context menu (Draft Edit Slice 3)', () => {
  it('holds one Prose Minion submenu in place of the flat list, with no when clause of its own', () => {
    expect(manifest.contributes.submenus).toEqual([{ id: SUBMENU, label: 'Prose Minion' }]);
    expect(manifest.contributes.menus['editor/context']).toEqual([{ submenu: SUBMENU, group: 'prose-minion' }]);
  });

  it.each<[string, Context, string[][]]>([
    ['a selection in a saved Markdown file', { ...markdownFile, editorHasSelection: true }, [
      ['Word Lookup', 'Assistant'],
      ['Send Selection to Workshop', 'Open Selection in Lightbox'],
      ['Proofread and Flag', 'Proofread and Fix'],
      ['Craft Flags']
    ]],
    ['a saved Markdown file with nothing selected', { ...markdownFile, editorHasSelection: false }, [
      ['Open File in Lightbox'],
      ['Proofread and Flag', 'Proofread and Fix'],
      ['Craft Flags']
    ]],
    ['an untitled plain-text buffer with nothing selected', { resourceScheme: 'untitled', editorLangId: 'plaintext', editorHasSelection: false }, [
      ['Proofread and Flag', 'Proofread and Fix'],
      ['Craft Flags']
    ]],
    ['a selection in a JavaScript file', { resourceScheme: 'file', editorLangId: 'javascript', editorHasSelection: true }, [
      ['Word Lookup', 'Assistant'],
      ['Send Selection to Workshop', 'Open Selection in Lightbox']
    ]]
  ])('offers, for %s, the commands the flat list offered, in its order, then Craft Flags in its own group (Slice 3c)', (_case, context, expected) => {
    expect(drawn('editor/context', context)).toEqual([['Prose Minion']]);
    expect(drawn(SUBMENU, context)).toEqual(expected);
  });

  it('shows no Prose Minion entry where it has nothing to offer: a JavaScript file with nothing selected', () => {
    expect(drawn('editor/context', { resourceScheme: 'file', editorLangId: 'javascript', editorHasSelection: false })).toEqual([]);
  });

  it('labels every command once: the menus by its short title, the Command Palette as "Prose Minion: title"', () => {
    const misnamed = manifest.contributes.commands.filter((entry) => entry.category !== 'Prose Minion' || entry.title.startsWith('Prose Minion'));
    expect(misnamed).toEqual([]);
  });
});
