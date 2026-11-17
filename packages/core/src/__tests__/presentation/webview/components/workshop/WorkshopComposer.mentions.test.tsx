/**
 * @jest-environment jsdom
 */

/**
 * `@` in the Workshop composer (Everyday Conveniences round two, item G), as
 * the writer meets it: the list above the textarea, its keys, its combobox
 * ARIA, a pick staging through the message-attach action, and Enter sending
 * only when the list did not take it.
 */

import * as React from 'react';
import { cleanup, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkshopComposer } from '@components/workshop/WorkshopComposer';
import {
  ConfiguredResourceEntry,
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  WorkshopMessageAttachmentSnapshot
} from '@messages';

const file = (group: ConfiguredResourceEntry['group'], path: string, sizeBytes = 2048): ConfiguredResourceEntry => ({
  group,
  path,
  label: path.split('/').pop() as string,
  sizeBytes
});

const CATALOG = [
  file('characters', 'characters/alice.md'),
  file('characters', 'characters/notes.md', 512),
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

type ComposerProps = React.ComponentProps<typeof WorkshopComposer>;

function renderComposer(overrides: Partial<ComposerProps> = {}) {
  const mentions = { catalog: CATALOG as ConfiguredResourceEntry[] | null, onRequestCatalog: jest.fn(), onAttach: jest.fn() };
  const props: ComposerProps = {
    canMessage: true,
    scope: 'excerpt',
    hasExcerpt: true,
    roomHasMemory: false,
    onAddExcerpt: jest.fn(),
    hasConversation: true,
    recipientLabel: 'Jill',
    isRunning: false,
    sessionReady: true,
    conversationBehavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR },
    writerProfileShared: false,
    messageAttachments: [],
    mentions,
    onSend: jest.fn(),
    onCancel: jest.fn(),
    onOpenContext: jest.fn(),
    onAttachToMessage: jest.fn(),
    onRemoveMessageAttachment: jest.fn(),
    onOpenTools: jest.fn(),
    onOpenWidgets: jest.fn(),
    onOpenConversationSettings: jest.fn(),
    ...overrides
  };
  const view = render(<WorkshopComposer {...props} />);
  const input = screen.getByRole('textbox', { name: 'Message Jill' }) as HTMLTextAreaElement;
  const type = (value: string) => fireEvent.change(input, { target: { value } });
  const options = () => screen.queryAllByRole('option').map((option) => option.textContent);
  return { ...view, props, mentions, input, type, options };
}

afterEach(cleanup);

describe('WorkshopComposer @ mentions', () => {
  it('opens a sectioned listbox above the textarea, wired as a combobox', () => {
    const { input, type, mentions } = renderComposer();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.hasAttribute('aria-controls')).toBe(false);
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);

    type('compare with @');
    const list = screen.getByRole('listbox', { name: 'Attach a project file to this message' });
    expect(input.getAttribute('aria-controls')).toBe(list.id);
    expect(mentions.onRequestCatalog).toHaveBeenCalledTimes(1);

    const files = within(list).getByRole('group', { name: 'Files' });
    expect(within(files).getAllByRole('option')).toHaveLength(4);
    const all = within(list).getAllByRole('option');
    expect(all).toHaveLength(5);
    expect(all[4].textContent).toBe('Browse project…');

    const active = all.filter((option) => option.getAttribute('aria-selected') === 'true');
    expect(active).toEqual([all[0]]);
    expect(input.getAttribute('aria-activedescendant')).toBe(all[0].id);
    expect(screen.getByRole('status').textContent).toBe('4 files');
    expect(list.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows each file\'s name, token, group and size', () => {
    const { type } = renderComposer();
    type('@notes');
    const rows = screen.getAllByRole('option');
    expect(rows[0].textContent).toBe('notes.md@characters/notes.mdCharacters512 B');
    expect(rows[1].textContent).toBe('notes.md@locations/notes.mdLocations & Settings2.0 KB');
    expect(screen.getByRole('status').textContent).toBe('2 files');
  });

  it('does not open for an email address', () => {
    const { type, mentions } = renderComposer();
    type('write to alice@example.com');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(mentions.onRequestCatalog).not.toHaveBeenCalled();
  });

  it('Enter picks the active file: the token goes in the draft, the file is staged, nothing is sent', () => {
    const { input, type, mentions, props } = renderComposer();
    type('compare with @alice-');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input.value).toBe('compare with @alice-ch3.md ');
    expect(input.selectionStart).toBe(input.value.length);
    expect(mentions.onAttach).toHaveBeenCalledTimes(1);
    expect(mentions.onAttach).toHaveBeenCalledWith([{ group: 'chapters', path: 'drafts/alice-ch3.md' }]);
    expect(props.onSend).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();

    // The list is closed: Enter sends again.
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSend).toHaveBeenCalledWith('compare with @alice-ch3.md');
  });

  it('arrows move the active option and Tab picks it', () => {
    const { input, type, mentions } = renderComposer();
    type('@notes');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const rows = screen.getAllByRole('option');
    expect(input.getAttribute('aria-activedescendant')).toBe(rows[1].id);
    expect(rows[1].getAttribute('aria-selected')).toBe('true');

    const tab = createEvent.keyDown(input, { key: 'Tab' });
    fireEvent(input, tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(input.value).toBe('@locations/notes.md ');
    expect(mentions.onAttach).toHaveBeenCalledWith([{ group: 'locations', path: 'locations/notes.md' }]);
  });

  it('puts the caret after a token picked mid-sentence', () => {
    const { input, mentions } = renderComposer();
    fireEvent.change(input, { target: { value: 'compare @ali with the draft', selectionStart: 12, selectionEnd: 12 } });
    input.setSelectionRange(12, 12);
    fireEvent.select(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input.value).toBe('compare @alice.md with the draft');
    expect(input.selectionStart).toBe('compare @alice.md '.length);
    expect(mentions.onAttach).toHaveBeenCalledWith([{ group: 'characters', path: 'characters/alice.md' }]);
  });

  it('Escape closes the list, keeps the draft, and reaches nothing else', () => {
    const { input, type, props, mentions } = renderComposer();
    type('see @ali');
    const escape = createEvent.keyDown(input, { key: 'Escape' });
    const onDocument = jest.fn();
    document.addEventListener('keydown', onDocument);
    fireEvent(input, escape);
    document.removeEventListener('keydown', onDocument);

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.value).toBe('see @ali');
    expect(escape.defaultPrevented).toBe(true);
    expect(onDocument).not.toHaveBeenCalled();
    expect(mentions.onAttach).not.toHaveBeenCalled();

    // Closed for that @: Enter sends what was typed.
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSend).toHaveBeenCalledWith('see @ali');
  });

  it('with no matching file Enter sends as it always has', () => {
    const { input, type, props, mentions } = renderComposer();
    type('meet me @home');
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getByText('No configured file matches.')).toBeTruthy();
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSend).toHaveBeenCalledWith('meet me @home');
    expect(mentions.onAttach).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Shift+Enter stays a new line with the list open', () => {
    const { input, type, props, mentions } = renderComposer();
    type('@ali');
    const event = createEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    fireEvent(input, event);
    expect(event.defaultPrevented).toBe(false);
    expect(props.onSend).not.toHaveBeenCalled();
    expect(mentions.onAttach).not.toHaveBeenCalled();
  });

  it('Browse project… opens the picker for this message and takes the typed @… out', () => {
    const { input, type, props, mentions } = renderComposer();
    type('look at @zz');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onAttachToMessage).toHaveBeenCalledTimes(1);
    expect(mentions.onAttach).not.toHaveBeenCalled();
    expect(props.onSend).not.toHaveBeenCalled();
    expect(input.value).toBe('look at ');
  });

  it('a click picks without taking focus from the textarea', () => {
    const { input, type, mentions } = renderComposer();
    type('@ali');
    const row = screen.getAllByRole('option')[1];
    const press = createEvent.mouseDown(row);
    fireEvent(row, press);
    expect(press.defaultPrevented).toBe(true);
    fireEvent.click(row);

    expect(input.value).toBe('@alice-ch3.md ');
    expect(mentions.onAttach).toHaveBeenCalledWith([{ group: 'chapters', path: 'drafts/alice-ch3.md' }]);
  });

  it('a file already staged says so, takes its token, and is not staged twice', () => {
    const { input, type, mentions } = renderComposer({ messageAttachments: [pill('ta-1', CATALOG[3])] });
    type('and again @alice-');
    expect(screen.getAllByRole('option')[0].textContent).toContain('attached');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input.value).toBe('and again @alice-ch3.md ');
    expect(mentions.onAttach).not.toHaveBeenCalled();
  });

  it('decision A1: deleting a token removes no pill, and removing a pill leaves the text', () => {
    const staged = [pill('ta-1', CATALOG[3])];
    const { input, type, props } = renderComposer({ messageAttachments: staged });
    type('compare @alice-ch3.md with this');
    type('compare with this');
    expect(props.onRemoveMessageAttachment).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Remove alice-ch3.md from this message' })).toBeTruthy();

    type('compare @alice-ch3.md with this');
    fireEvent.click(screen.getByRole('button', { name: 'Remove alice-ch3.md from this message' }));
    expect(props.onRemoveMessageAttachment).toHaveBeenCalledWith('ta-1');
    expect(input.value).toBe('compare @alice-ch3.md with this');
  });

  it('nothing acts during IME composition: no list, no pick, no send', () => {
    const { input, type, props, mentions } = renderComposer();
    fireEvent.compositionStart(input);
    type('@ali');
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(props.onSend).not.toHaveBeenCalled();
    expect(mentions.onAttach).not.toHaveBeenCalled();
    expect(input.value).toBe('@ali');

    fireEvent.compositionEnd(input);
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('says it is loading until the first catalog arrives', () => {
    const { type, rerender, props } = renderComposer({
      mentions: { catalog: null, onRequestCatalog: jest.fn(), onAttach: jest.fn() }
    });
    type('@');
    expect(screen.getByText('Loading project files…')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Loading project files');

    rerender(<WorkshopComposer {...props} mentions={{ ...props.mentions!, catalog: CATALOG }} />);
    expect(screen.queryByText('Loading project files…')).toBeNull();
    expect(screen.getAllByRole('option')).toHaveLength(5);
  });

  it('closes when the textarea loses focus, and keeps the draft', () => {
    const { input, type } = renderComposer();
    type('@ali');
    fireEvent.blur(input);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.value).toBe('@ali');
  });

  it('without the mentions prop an @ is only a character', () => {
    const { input, type, props } = renderComposer({ mentions: undefined });
    type('@ali');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.hasAttribute('aria-autocomplete')).toBe(false);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSend).toHaveBeenCalledWith('@ali');
  });
});
