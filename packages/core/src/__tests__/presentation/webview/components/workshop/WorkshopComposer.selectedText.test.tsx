/**
 * @jest-environment jsdom
 */

/**
 * The composer's Selected Text (ADR 2026-11-14 D9, D14): the "Include
 * selected text" toggle, a staged pill, the live pill, a cut pill and a
 * disabled pill, each drawn from props. *Alice*.
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkshopComposer } from '@components/workshop/WorkshopComposer';
import {
  workshopAttachmentSize,
  workshopAttachmentTitle,
  workshopSelectedTextDetail
} from '@components/workshop/workshopAttachmentPills';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  WORKSHOP_SELECTED_TEXT_FULL_REASON,
  type WorkshopMessageAttachmentSnapshot,
  type WorkshopSelectedTextSummary
} from '@messages';

const selection = (over: Partial<WorkshopSelectedTextSummary> = {}): WorkshopSelectedTextSummary => ({
  snapshotId: 'snap-1',
  displayName: 'Drafts/alice-ch3.md',
  startLine: 40,
  endLine: 44,
  words: 62,
  preview: 'The Caterpillar and Alice looked at each other',
  ...over
});
const staged: WorkshopMessageAttachmentSnapshot = {
  id: 'ta-1',
  label: 'Selected Text',
  words: 62,
  relativePath: 'Drafts/alice-ch3.md',
  selectedText: { snapshotId: 'snap-0', startLine: 12, endLine: 12 }
};

describe('WorkshopComposer — Selected Text', () => {
  afterEach(cleanup);

  const renderComposer = (overrides: Partial<React.ComponentProps<typeof WorkshopComposer>> = {}) => {
    const props: React.ComponentProps<typeof WorkshopComposer> = {
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
    render(<WorkshopComposer {...props} />);
    return props;
  };

  it('draws no toggle and no pill when it is given no Selected Text', () => {
    renderComposer();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(document.querySelector('.pm-ws-comp-attachments')).toBeNull();
  });

  it('draws the toggle as a switch that says its state, and reports a press', () => {
    const onIncludeSelectedTextChange = jest.fn();
    renderComposer({ selectedText: { includeSelectedText: false, onIncludeSelectedTextChange, livePill: null } });
    const toggle = screen.getByRole('switch', { name: 'Include selected text' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(onIncludeSelectedTextChange).toHaveBeenCalledWith(true);
  });

  it('draws the live pill with its file, lines and words, after the staged pills, with no remove control', () => {
    renderComposer({
      messageAttachments: [staged],
      selectedText: { includeSelectedText: true, onIncludeSelectedTextChange: jest.fn(), livePill: { selection: selection() } }
    });
    expect(screen.getByRole('switch', { name: 'Include selected text' }).getAttribute('aria-checked')).toBe('true');
    const pills = Array.from(document.querySelectorAll('.pm-ws-comp-attachment'));
    expect(pills).toHaveLength(2);
    expect(pills[0].textContent).toContain('Selected Text');
    expect(pills[0].textContent).toContain('alice-ch3.md · line 12 · 62 words');
    expect(pills[0].querySelector('button')).not.toBeNull();

    const live = pills[1];
    expect(live.className).toContain('pm-ws-comp-attachment-live');
    expect(live.textContent).toContain('Selected Text');
    expect(live.textContent).toContain('alice-ch3.md · lines 40–44 · 62 words');
    expect(live.textContent).toContain('follows the editor’s selection');
    expect(live.querySelector('button')).toBeNull();
    expect(live.getAttribute('aria-disabled')).toBeNull();
    expect(live.getAttribute('title')).toContain('Drafts/alice-ch3.md');
    expect(screen.getAllByRole('button', { name: 'Remove Selected Text from this message' })).toHaveLength(1);
  });

  it('says a cut selection was cut, before the send', () => {
    renderComposer({
      selectedText: {
        includeSelectedText: true,
        onIncludeSelectedTextChange: jest.fn(),
        livePill: { selection: selection({ words: 5_000, truncation: { keptWords: 5_000, totalWords: 8_120 }, startLine: 1, endLine: 912 }) }
      }
    });
    expect(document.querySelector('.pm-ws-comp-attachment-live')?.textContent)
      .toContain('alice-ch3.md · lines 1–912 · first 5,000 of 8,120 words');
    // No staged pill, so the staged pills' hint is not drawn.
    expect(screen.queryByText('rides the next message only')).toBeNull();
  });

  it('draws the live pill disabled, with the reason in words, when the message has no room', () => {
    renderComposer({
      selectedText: {
        includeSelectedText: true,
        onIncludeSelectedTextChange: jest.fn(),
        livePill: { selection: selection(), disabledReason: WORKSHOP_SELECTED_TEXT_FULL_REASON }
      }
    });
    const live = document.querySelector('.pm-ws-comp-attachment-live')!;
    expect(live.className).toContain('is-disabled');
    expect(live.getAttribute('aria-disabled')).toBe('true');
    expect(live.textContent).toContain(`not included: ${WORKSHOP_SELECTED_TEXT_FULL_REASON}`);
    expect(live.getAttribute('title')).toBe(WORKSHOP_SELECTED_TEXT_FULL_REASON);
  });
});

describe('workshopAttachmentPills — Selected Text', () => {
  it('says the file name, the lines and the words, one line as one line, one word as one word', () => {
    expect(workshopSelectedTextDetail({ path: 'Drafts/alice-ch3.md', startLine: 40, endLine: 44, words: 62 }))
      .toBe('alice-ch3.md · lines 40–44 · 62 words');
    expect(workshopSelectedTextDetail({ path: 'alice-ch3.md', startLine: 7, endLine: 7, words: 1 })).toBe('alice-ch3.md · line 7 · 1 word');
    expect(workshopSelectedTextDetail({ startLine: 7, endLine: 8, words: 1_200 })).toBe('lines 7–8 · 1,200 words');
  });

  it('writes a staged and a sent selection the same way, with the whole display path on hover', () => {
    const cut = { ...staged, words: 5_000, truncation: { keptWords: 5_000, totalWords: 8_120 } };
    expect(workshopAttachmentSize(staged, 'composer')).toBe('alice-ch3.md · line 12 · 62 words');
    expect(workshopAttachmentSize(cut, 'turn')).toBe('alice-ch3.md · line 12 · first 5,000 of 8,120 words');
    expect(workshopAttachmentTitle(staged)).toBe('Drafts/alice-ch3.md · line 12 · 62 words');
    // A file's pill is what it was.
    expect(workshopAttachmentSize({ id: 'ta-2', label: 'notes.md', words: 10 }, 'composer')).toBe('10 words');
  });
});
