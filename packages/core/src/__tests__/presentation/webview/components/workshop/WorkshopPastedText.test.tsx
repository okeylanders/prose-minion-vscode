/** @jest-environment jsdom */
import * as React from 'react';
import { act, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, MessageType, type WorkshopMessageAttachmentSnapshot,
  type WorkshopMessageTextResultPayload, type WorkshopSessionStateMessage, type WorkshopStageMessageTextPayload
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { useWorkshopPastedText } from '@hooks/domain/workshop/useWorkshopPastedText';
import { WorkshopComposer } from '@components/workshop/WorkshopComposer';
import { WorkshopPastedTextSheet } from '@components/workshop/WorkshopPastedTextSheet';

jest.mock('@hooks/useVSCodeApi');
jest.mock('marked', () => ({ marked: Object.assign((text: string) => text, { setOptions: jest.fn() }) }));

const pill: WorkshopMessageAttachmentSnapshot = { id: 'ta-4', label: 'Pasted text', words: 12, pastedText: { truncated: true } };
const body = 'Alice followed the rabbit. '.repeat(25);

function mount() {
  const onSend = jest.fn();
  const postMessage = jest.fn();
  (useVSCodeApi as jest.Mock).mockReturnValue({ postMessage });
  let owner: ReturnType<typeof useWorkshopPastedText>;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- React components use PascalCase.
  function Fixture({ attachments }: { attachments: WorkshopMessageAttachmentSnapshot[] }) {
    owner = useWorkshopPastedText();
    return <>
      <WorkshopComposer recipientLabel="Jill" scope="open" canMessage hasExcerpt={false} roomHasMemory={false}
        hasConversation isRunning={false} sessionReady writerProfileShared={false} onSend={onSend}
        conversationBehavior={DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR} messageAttachments={attachments}
        pastedText={owner.composer} onAddExcerpt={jest.fn()} onCancel={jest.fn()} onOpenContext={jest.fn()}
        onAttachToMessage={jest.fn()} onRemoveMessageAttachment={jest.fn()} onOpenConversationSettings={jest.fn()}
        onOpenTools={jest.fn()} onOpenWidgets={jest.fn()} />
      <WorkshopPastedTextSheet pasted={owner} locked={false} />
    </>;
  }
  const view = render(<Fixture attachments={[]} />);
  const state = (attachments: WorkshopMessageAttachmentSnapshot[], revision = 1) => {
    act(() => owner.handleSessionState({ payload: { session: { roomRevision: revision, pendingMessageAttachments: attachments } } } as WorkshopSessionStateMessage));
    view.rerender(<Fixture attachments={attachments} />);
  };
  state([]);
  const last = (): WorkshopStageMessageTextPayload => postMessage.mock.lastCall[0].payload;
  const answer = (result: WorkshopMessageTextResultPayload) =>
    act(() => owner.handleResult({ type: MessageType.WORKSHOP_MESSAGE_TEXT_RESULT, source: 'extension.workshop', timestamp: 0, payload: result }));
  const ok = (text?: string) => answer({ ...last(), ok: true, attachmentId: pill.id, text });
  const refuse = (reason: string) => answer({ ...last(), ok: false, reason });
  return { ...view, state, last, ok, refuse, answer, onSend, postMessage };
}

const input = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message Jill' });
const send = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Send message to Jill' });
function paste(text: string) {
  const event = createEvent.paste(input(), { clipboardData: { getData: (format: string) => format === 'text/plain' ? text : '<b>Formatted</b>' } });
  fireEvent(input(), event);
  return event;
}

describe('pasted text in the Workshop composer', () => {
  it('keeps 499 characters native, stages each 500-character plain paste once, and holds Enter while pending', () => {
    const r = mount();
    fireEvent.change(input(), { target: { value: 'Keep this.' } });
    expect(paste('x'.repeat(499)).defaultPrevented).toBe(false);
    expect(r.postMessage).not.toHaveBeenCalled();
    const rich = 'a\r\n🙂' + 'x'.repeat(495);
    expect(rich.length).toBe(500);
    expect(paste(rich).defaultPrevented).toBe(true);
    const first = r.last();
    expect(first).toMatchObject({ action: 'stage', text: rich, roomRevision: 1 });
    paste(rich);
    const second = r.last();
    expect(first.requestId).not.toBe(second.requestId);
    expect(screen.getAllByText('Staging pasted text…')).toHaveLength(2);
    expect(input().value).toBe('Keep this.');
    expect(send().disabled).toBe(true);
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(r.onSend).not.toHaveBeenCalled();
    r.answer({ ...first, ok: true, attachmentId: 'ta-3' });
    expect(send().disabled).toBe(true);
    r.refuse('The tray is full.');
    expect(screen.getByRole('alert').textContent).toBe('The tray is full.');
    expect(input().value).toBe('Keep this.');
    expect(send().disabled).toBe(false);
  });

  it.each([
    { keptWords: 1, totalWords: 1, size: '1 word · first 500 of 800 characters' },
    { keptWords: 75, totalWords: 120, size: 'first 75 of 120 words' }
  ])('discloses the cut before sending, including a single clipped word ($size)', ({ keptWords, totalWords, size }) => {
    const r = mount();
    r.state([{ ...pill, words: keptWords, pastedText: { truncated: true,
      truncation: { keptWords, totalWords, keptCharacters: 500, totalCharacters: 800 } } }]);
    const inspect = screen.getByRole('button', { name: 'Inspect or edit Pasted text' });
    expect(document.getElementById(inspect.getAttribute('aria-describedby')!)?.textContent).toBe(size);
    expect(send().disabled).toBe(false);
  });

  it('reads on demand, keeps refused edits open, retries with the same ID, and sends an attachment-only message', () => {
    const r = mount();
    r.state([pill]);
    const group = screen.getByRole('group', { name: 'Attachment 1: Pasted text' });
    expect(within(group).getByText('12 words · shortened')).toBeTruthy();
    fireEvent.click(within(group).getByRole('button', { name: 'Inspect or edit Pasted text' }));
    expect(r.last()).toMatchObject({ action: 'read', attachmentId: pill.id, roomRevision: 1 });
    r.ok(body);
    const editor = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Edit: Pasted text' });
    expect(editor.value).toBe(body);
    fireEvent.change(editor, { target: { value: 'Edited text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(r.last()).toMatchObject({ action: 'update', attachmentId: pill.id, text: 'Edited text' });
    r.refuse('The room is busy.');
    expect(editor.value).toBe('Edited text');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    r.ok();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(r.onSend).toHaveBeenCalledWith('');
  });

  it.each([false, true])('inserts at the caret and preserves typing made during the host release (newer=%s)', (newer) => {
    const r = mount();
    r.state([pill]);
    fireEvent.change(input(), { target: { value: 'one two' } });
    input().setSelectionRange(4, 7);
    fireEvent.click(screen.getByRole('button', { name: 'Insert into message' }));
    expect(r.last()).toMatchObject({ action: 'take', attachmentId: pill.id });
    if (newer) {
      fireEvent.change(input(), { target: { value: 'one newer two' } });
      input().setSelectionRange(4, 9);
    }
    r.state([]);
    r.ok('Pasted.');
    expect(input().value).toBe(newer ? 'one Pasted.newer two' : 'one Pasted.');
    expect(input().selectionStart).toBe('one Pasted.'.length);
    expect(document.activeElement).toBe(input());
  });

  it('closes read state on room replacement and ignores results after closing the panel', () => {
    const r = mount();
    r.state([pill]);
    fireEvent.click(screen.getByRole('button', { name: 'Inspect or edit Pasted text' }));
    const oldRead = r.last();
    r.state([pill], 3);
    r.answer({ ...oldRead, ok: true, attachmentId: pill.id, text: body });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Insert into message' }));
    const oldTake = r.last();
    const draft = input();
    r.unmount();
    r.answer({ ...oldTake, ok: true, attachmentId: pill.id, text: body });
    expect(draft.value).toBe('');
  });

  it('drops late inserts when a rewind reuses the same staged ID, and uses the new room for removal', () => {
    const r = mount();
    r.state([pill]);
    fireEvent.click(screen.getByRole('button', { name: 'Insert into message' }));
    const previous = r.last();
    r.state([pill], 2);
    r.answer({ ...previous, ok: true, attachmentId: pill.id, text: body });
    expect(input().value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Pasted text from this message' }));
    expect(r.last()).toMatchObject({ action: 'remove', roomRevision: 2, attachmentId: pill.id });
    expect(send().disabled).toBe(true);
    r.refuse('Please try again.');
    expect(screen.getByRole('group', { name: 'Attachment 1: Pasted text' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Pasted text from this message' }));
    r.state([], 2);
    r.ok();
    expect(send().disabled).toBe(true);
  });
});
