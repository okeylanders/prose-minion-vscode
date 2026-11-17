/** @jest-environment jsdom */

/**
 * useWorkshopComposerMentions (Everyday Conveniences round two, item G): the
 * `@` list's state machine. A pick stages by catalog key through the injected
 * attach action and returns the draft to apply; the pill is the truth
 * (decision A1), and nothing is persisted.
 */

import { act, renderHook } from '@testing-library/react';
import {
  useWorkshopComposerMentions,
  UseWorkshopComposerMentionsOptions
} from '@hooks/domain/workshop/controllers/useWorkshopComposerMentions';
import type { ConfiguredResourceEntry, WorkshopMessageAttachmentSnapshot } from '@messages';

const file = (group: ConfiguredResourceEntry['group'], path: string): ConfiguredResourceEntry => ({
  group,
  path,
  label: path.split('/').pop() as string,
  sizeBytes: 1024
});

const CATALOG = [
  file('characters', 'characters/alice.md'),
  file('characters', 'characters/notes.md'),
  file('locations', 'locations/notes.md'),
  file('chapters', 'drafts/alice-ch3.md')
];

const pill = (id: string, entry: ConfiguredResourceEntry): WorkshopMessageAttachmentSnapshot => ({
  id,
  label: entry.label,
  words: 100,
  relativePath: entry.path,
  configuredResource: { group: entry.group, path: entry.path }
});

function setup(overrides: Partial<UseWorkshopComposerMentionsOptions> = {}) {
  const effects = { onRequestCatalog: jest.fn(), onAttach: jest.fn(), onBrowse: jest.fn() };
  const initialProps: UseWorkshopComposerMentionsOptions = {
    catalog: CATALOG,
    staged: [],
    enabled: true,
    ...effects,
    ...overrides
  };
  const view = renderHook((props: UseWorkshopComposerMentionsOptions) => useWorkshopComposerMentions(props), {
    initialProps
  });
  const type = (text: string, caret = text.length) => act(() => view.result.current.syncDraft(text, caret));
  const key = (name: string, text: string, shiftKey = false) => {
    let result!: ReturnType<typeof view.result.current.keyDown>;
    act(() => {
      result = view.result.current.keyDown({ key: name, shiftKey }, text);
    });
    return result;
  };
  const rows = () => view.result.current.sections[0].rows.map((row) => row.entry.path);
  return { ...view, initialProps, effects, type, key, rows };
}

describe('useWorkshopComposerMentions', () => {
  it('is closed until an @ opens it, and asks for the catalog once per opening', () => {
    const { result, effects, type } = setup();
    expect(result.current.open).toBe(false);
    expect(result.current.activeIndex).toBe(-1);

    type('see @');
    expect(result.current.open).toBe(true);
    expect(effects.onRequestCatalog).toHaveBeenCalledTimes(1);

    type('see @al');
    type('see @ali');
    expect(effects.onRequestCatalog).toHaveBeenCalledTimes(1);

    type('see @ali ');
    expect(result.current.open).toBe(false);
    type('see @ali @');
    expect(effects.onRequestCatalog).toHaveBeenCalledTimes(2);
  });

  it('does not open for an @ inside a word', () => {
    const { result, effects, type } = setup();
    type('alice@example.com');
    expect(result.current.open).toBe(false);
    expect(effects.onRequestCatalog).not.toHaveBeenCalled();
  });

  it('lists one Files section, filters as the writer types, and says the count', () => {
    const { result, type, rows } = setup();
    type('@');
    expect(result.current.sections.map((section) => [section.id, section.label])).toEqual([['files', 'Files']]);
    expect(rows()).toHaveLength(4);
    expect(result.current.status).toBe('4 files');
    expect(result.current.browseIndex).toBe(4);

    type('@alice-');
    expect(rows()).toEqual(['drafts/alice-ch3.md']);
    expect(result.current.status).toBe('1 file');
    expect(result.current.activeIndex).toBe(0);
  });

  it('shows loading while no catalog has arrived, then the files', () => {
    const { result, rerender, initialProps, type } = setup({ catalog: null });
    type('@');
    expect(result.current.loading).toBe(true);
    expect(result.current.status).toBe('Loading project files');
    expect(result.current.activeIndex).toBe(-1);

    rerender({ ...initialProps, catalog: CATALOG });
    expect(result.current.loading).toBe(false);
    expect(result.current.activeIndex).toBe(0);
  });

  it('moves with the arrows, wraps through Browse project…, and resets when the query changes', () => {
    const { result, type, key } = setup();
    type('@notes');
    expect(result.current.activeIndex).toBe(0);
    expect(key('ArrowDown', '@notes')).toEqual({ handled: true });
    expect(result.current.activeIndex).toBe(1);
    key('ArrowDown', '@notes');
    expect(result.current.activeIndex).toBe(result.current.browseIndex);
    key('ArrowDown', '@notes');
    expect(result.current.activeIndex).toBe(0);
    key('ArrowUp', '@notes');
    expect(result.current.activeIndex).toBe(result.current.browseIndex);

    type('@notes.');
    expect(result.current.activeIndex).toBe(0);
  });

  it.each(['Enter', 'Tab'])('%s picks the active file: token into the draft, staged by catalog key', (name) => {
    const { result, effects, type, key } = setup();
    const text = 'compare with @notes';
    type(text);
    key('ArrowDown', text);

    const taken = key(name, text);
    expect(taken).toEqual({
      handled: true,
      edit: { text: 'compare with @locations/notes.md ', caret: 33 }
    });
    expect(effects.onAttach).toHaveBeenCalledTimes(1);
    expect(effects.onAttach).toHaveBeenCalledWith([{ group: 'locations', path: 'locations/notes.md' }]);
    expect(result.current.open).toBe(false);
  });

  it('a file already staged takes its token and stages nothing twice', () => {
    const { effects, type, key } = setup({ staged: [pill('ta-1', CATALOG[3])] });
    type('@alice-');
    const taken = key('Enter', '@alice-');
    expect(taken.edit?.text).toBe('@alice-ch3.md ');
    expect(effects.onAttach).not.toHaveBeenCalled();
  });

  it('marks a staged file in its row', () => {
    const { result, type } = setup({ staged: [pill('ta-1', CATALOG[3])] });
    type('@ali');
    expect(result.current.sections[0].rows.map((row) => row.staged)).toEqual([false, true]);
  });

  it('with no match nothing is active, so Enter and Tab are the composer\'s; ↓ reaches Browse project…', () => {
    const { result, effects, type, key } = setup();
    type('meet @home');
    expect(result.current.open).toBe(true);
    expect(result.current.status).toBe('No files match');
    expect(result.current.activeIndex).toBe(-1);
    expect(key('Enter', 'meet @home')).toEqual({ handled: false });
    expect(key('Tab', 'meet @home')).toEqual({ handled: false });

    key('ArrowDown', 'meet @home');
    expect(result.current.activeIndex).toBe(result.current.browseIndex);
    const taken = key('Enter', 'meet @home');
    expect(taken).toEqual({ handled: true, edit: { text: 'meet ', caret: 5 } });
    expect(effects.onBrowse).toHaveBeenCalledTimes(1);
    expect(effects.onAttach).not.toHaveBeenCalled();
  });

  it('Shift+Enter is never the list\'s', () => {
    const { effects, type, key } = setup();
    type('@ali');
    expect(key('Enter', '@ali', true)).toEqual({ handled: false });
    expect(effects.onAttach).not.toHaveBeenCalled();
  });

  it('Escape closes the list for that @ and returns no edit; a new @ opens it again', () => {
    const { result, type, key } = setup();
    type('@ali');
    expect(key('Escape', '@ali')).toEqual({ handled: true });
    expect(result.current.open).toBe(false);

    type('@alic');
    expect(result.current.open).toBe(false);
    expect(key('Enter', '@alic')).toEqual({ handled: false });

    type('@alic and @');
    expect(result.current.open).toBe(true);
  });

  it('takes no key while closed', () => {
    const { key } = setup();
    for (const name of ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape']) {
      expect(key(name, 'plain')).toEqual({ handled: false });
    }
  });

  it('leaves other keys to the textarea while open', () => {
    const { type, key } = setup();
    type('@ali');
    expect(key('a', '@ali')).toEqual({ handled: false });
    expect(key('ArrowLeft', '@ali')).toEqual({ handled: false });
  });

  it('shows nothing during IME composition, and opens once it ends', () => {
    const { result, effects, type } = setup();
    act(() => result.current.setComposing(true));
    type('@あ');
    expect(result.current.open).toBe(false);
    expect(effects.onRequestCatalog).not.toHaveBeenCalled();

    act(() => result.current.setComposing(false));
    expect(result.current.open).toBe(true);
  });

  it('a click picks by index, and close leaves the draft to the composer', () => {
    const { result, effects, type } = setup();
    type('@ali');
    let edit: ReturnType<typeof result.current.pickOption>;
    act(() => {
      edit = result.current.pickOption(1, '@ali');
    });
    expect(edit!).toEqual({ text: '@alice-ch3.md ', caret: 14 });
    expect(effects.onAttach).toHaveBeenCalledWith([{ group: 'chapters', path: 'drafts/alice-ch3.md' }]);

    type('@no');
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
  });

  it('touches nothing when the draft is not the one it was told of', () => {
    const { result, effects, type } = setup();
    type('@ali');
    let edit: ReturnType<typeof result.current.pickOption>;
    act(() => {
      edit = result.current.pickOption(0, 'something else');
    });
    expect(edit!).toBeUndefined();
    expect(effects.onAttach).not.toHaveBeenCalled();
  });

  it('stays closed while disabled', () => {
    const { result, effects, type } = setup({ enabled: false });
    type('@ali');
    expect(result.current.open).toBe(false);
    expect(effects.onRequestCatalog).not.toHaveBeenCalled();
  });

  it('counts what it does not draw', () => {
    const many = Array.from({ length: 60 }, (_, index) => file('chapters', `drafts/ch-${index}.md`));
    const { result, type } = setup({ catalog: many });
    type('@');
    expect(result.current.sections[0].rows).toHaveLength(50);
    expect(result.current.sections[0].more).toBe(10);
    expect(result.current.status).toBe('60 files, the first 50 shown');
  });

  it('persists nothing', () => {
    const { result, type } = setup();
    type('@ali');
    expect(result.current.persistedState).toEqual({});
  });
});
