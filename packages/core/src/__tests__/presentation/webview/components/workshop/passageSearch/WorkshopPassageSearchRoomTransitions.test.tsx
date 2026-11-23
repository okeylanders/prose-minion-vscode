/** @jest-environment jsdom */

/**
 * A pending passage-search card across a room change, mounted as the app
 * mounts it: the production card under the production controls and hook,
 * answers arriving as window messages (PR #296 F1).
 *
 * A card asks its price in its own effect, and a child's effects run before
 * its parent's. So the room a request names must be the one the render
 * drew, never one an effect has yet to learn:
 * - a card drawn when the first snapshot lands (loading → restored) asks
 *   once, under that room, and shows its price and Run;
 * - Open from room 5 to room 6, the card's turn id unchanged, asks again
 *   under room 6, takes room 6's answer, and ignores room 5's late one;
 * - a price refused because the host had already moved on is asked again,
 *   once, when the new room's snapshot lands.
 * Made-up text: Alice.
 */

import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MessageType, type WorkshopPassageSearchCardView, type WorkshopTurn } from '@messages';
import { WorkshopPassageSearchCard } from '@components/workshop/passageSearch/WorkshopPassageSearchCard';
import { useWorkshopPassageSearchControls } from '@components/workshop/passageSearch/useWorkshopPassageSearchControls';
import { WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS } from '@shared/constants/workshopPassageSearchWords';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const TURN = 'turn-4-assistant-1008';
const estimate = (planKey: string, usd: number) => ({ planKey, calls: 23, files: 6, model: 'model/search', usd, organizes: false });

const card = (view: WorkshopPassageSearchCardView = { status: 'pending' }): WorkshopTurn => ({
  id: TURN, role: 'assistant', participant: 'host', personaLabel: 'Jill', content: 'Asking.',
  passageSearchRequest: { question: 'Find every time the Rabbit checks his watch.', scopes: [{ kind: 'group', group: 'chapters' }], view }
}) as WorkshopTurn;

interface RoomProps {
  readonly ready: boolean;
  readonly revision: number;
  readonly turns: readonly WorkshopTurn[];
}

/** What `WorkshopApp` does for these cards: one controls hook for the room, a card per turn. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
function Room({ ready, revision, turns }: RoomProps): React.ReactElement {
  const controls = useWorkshopPassageSearchControls({
    roomKey: ready ? `room:${revision}` : 'pending',
    ...(ready ? { roomRevision: revision } : {}),
    locked: false
  });
  return <>{turns.map((turn) => <WorkshopPassageSearchCard key={turn.id} turn={turn} controls={controls} />)}</>;
}

describe('a pending passage-search card across a room change', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const estimates = () => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; payload: { requestId: string; roomRevision: number; turnId: string } }]) => message)
    .filter((message) => message.type === MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE)
    .map((message) => message.payload);
  const answer = (payload: Record<string, unknown>) => act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: MessageType.WORKSHOP_PASSAGE_SEARCH_RESULT, source: 'extension.workshop.passageSearch', timestamp: 2, payload: { turnId: TURN, action: 'estimate', ...payload } }
    }));
  });
  const buttons = () => screen.queryAllByRole('button').map((button) => button.textContent);

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('loading → restored: the card asks once, under the restored room, and shows its price and Run', () => {
    const { rerender } = render(<Room ready={false} revision={0} turns={[]} />);
    expect(vscode.postMessage).not.toHaveBeenCalled();

    rerender(<Room ready revision={5} turns={[card()]} />);
    expect(estimates()).toEqual([{ requestId: expect.any(String), roomRevision: 5, turnId: TURN }]);
    expect(screen.getByText('Working out the price…')).toBeTruthy();

    answer({ requestId: estimates()[0].requestId, outcome: 'done', estimate: estimate('key-5', 0.42) });
    expect(screen.getByText('23 calls · ≈ $0.42 · model/search')).toBeTruthy();
    expect(buttons()).toEqual(['Run', 'Cancel']);
    // Asked once in this room: drawing the card again asks nothing more.
    rerender(<Room ready revision={5} turns={[card()]} />);
    expect(estimates()).toHaveLength(1);
  });

  it('Open from room 5 to room 6 asks again under room 6, takes its answer, and ignores room 5\'s late one', () => {
    const { rerender } = render(<Room ready revision={5} turns={[card()]} />);
    const [inFive] = estimates();
    expect(inFive.roomRevision).toBe(5);

    // The new room's card has the same turn id, so it is the same component: only the room moved.
    rerender(<Room ready revision={6} turns={[card()]} />);
    expect(estimates().map((payload) => payload.roomRevision)).toEqual([5, 6]);
    const inSix = estimates()[1];
    expect(screen.getByText('Working out the price…')).toBeTruthy();

    // Room 5's answer is late, and names a room no longer on screen: it changes nothing.
    answer({ requestId: inFive.requestId, outcome: 'done', estimate: estimate('key-5', 0.42) });
    expect(screen.queryByText('23 calls · ≈ $0.42 · model/search')).toBeNull();
    expect(screen.getByText('Working out the price…')).toBeTruthy();

    answer({ requestId: inSix.requestId, outcome: 'done', estimate: estimate('key-6', 0.61) });
    expect(screen.getByText('23 calls · ≈ $0.61 · model/search')).toBeTruthy();
    expect(buttons()).toEqual(['Run', 'Cancel']);

    act(() => screen.getByText('Run').click());
    const run = vscode.postMessage.mock.calls.map(([message]) => message).find((message) => message.type === MessageType.WORKSHOP_PASSAGE_SEARCH_RUN);
    expect(run.payload).toEqual({ requestId: expect.any(String), roomRevision: 6, turnId: TURN, planKey: 'key-6' });
  });

  it('a price refused because the host had moved on is asked again, once, when the new room lands', () => {
    const { rerender } = render(<Room ready revision={5} turns={[card()]} />);
    answer({ requestId: estimates()[0].requestId, outcome: 'refused', reason: 'room-changed', message: WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['room-changed'] });
    expect(screen.getByText(WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['room-changed'])).toBeTruthy();
    expect(buttons()).toEqual(['Check the price again', 'Cancel']);

    rerender(<Room ready revision={6} turns={[card()]} />);
    expect(estimates().map((payload) => payload.roomRevision)).toEqual([5, 6]);
    expect(screen.queryByText(WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['room-changed'])).toBeNull();
    rerender(<Room ready revision={6} turns={[card()]} />);
    expect(estimates()).toHaveLength(2);
  });

  it('a new room drops the last room\'s waits, so its card is never stuck on a press it made there', () => {
    const { rerender } = render(<Room ready revision={5} turns={[card({ status: 'ready', counts: {
      instances: 2, files: 1, labels: 1, dropped: 0, calls: { planned: 4, answered: 2, failed: 0, cut: 0, unsent: 1, cancelled: 1 }, ended: 'stopped', organized: false
    }, partial: true })]} />);
    act(() => screen.getByText('Send partial results to Jill').click());
    // Waiting on the Send: every press of the card is held.
    expect((screen.getByText('Discard') as HTMLButtonElement).disabled).toBe(true);

    rerender(<Room ready revision={6} turns={[card()]} />);
    expect(buttons()).toEqual(['Cancel']);
    expect((screen.getByText('Cancel') as HTMLButtonElement).disabled).toBe(false);
    expect(estimates().map((payload) => payload.roomRevision)).toEqual([6]);
  });
});
