/**
 * A room whose host reply carries a passage-search card, through the real
 * router, room handler, session and completion, with the fake engine of
 * `passageSearchRouteFixtures` (ADR 2026-11-20 D17–D21). The provider is the
 * harness's mock; nothing is billable. Made-up text: Alice.
 */

import { MessageType, type WorkshopPassageSearchCardView, type WorkshopTurn } from '@messages';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness, type WorkshopRouteTestHarnessOptions } from './WorkshopRouteTestHarness';
import { fakePassageSearch, searchFrame, type FakePassageSearch } from './passageSearchRouteFixtures';

export const ASKED = 'I would like every watch moment found before we talk about pacing.';

export interface PassageSearchRouteDriver {
  readonly harness: WorkshopRouteTestHarness;
  readonly search: FakePassageSearch;
  /** The card the routes act on: the host reply that carries it. */
  card: WorkshopTurn;
  route(type: MessageType, payload: unknown): Promise<void>;
  /** Post an action for the card under the room on screen now; resolves once routed, not once answered. */
  act(type: MessageType, extra?: Record<string, unknown>): Promise<{ requestId: string; running: Promise<void> }>;
  /** The same, settled: every answer its request id was given. */
  done(type: MessageType, extra?: Record<string, unknown>): Promise<any[]>;
  answersOf(requestId: string): any[];
  view(turnId?: string): Promise<WorkshopPassageSearchCardView | undefined>;
  ledger(): readonly WorkshopTurn[];
  /** The writer-role turns a delivery recorded. */
  requestTurns(): WorkshopTurn[];
  /** A host reply carrying another card, settled. */
  askAgain(): Promise<WorkshopTurn>;
  settle(): Promise<void>;
  logs(): string;
}

/** `cardTurnId` names a card the shared session already holds (a scripted room a real coordinator opened); otherwise the host is asked for one. */
export async function passageSearchRouteDriver(options: WorkshopRouteTestHarnessOptions = {}, cardTurnId?: string): Promise<PassageSearchRouteDriver> {
  const search = fakePassageSearch();
  const harness = createWorkshopRouteTestHarness({ passageSearch: search.ports, ...options });
  let asked = 0;
  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const settle = async () => {
    for (let round = 0; round < 10; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const ledger = () => harness.session.readRoomLedger();
  const answersOf = (requestId: string) => harness.posted(MessageType.WORKSHOP_PASSAGE_SEARCH_RESULT)
    .map((entry) => entry.payload).filter((payload) => payload.requestId === requestId);
  const askAgain = async (): Promise<WorkshopTurn> => {
    const reply = analysisResult(`${ASKED}\n\n${searchFrame()}`, { conversationId: 'host-conv' }) as never;
    if (harness.session.hasHostConversation()) {
      harness.service.continueConversation.mockResolvedValueOnce(reply);
    } else {
      harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(reply);
    }
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Where does the Rabbit check his watch?' });
    await settle();
    return [...ledger()].reverse().find((turn) => turn.passageSearchRequest)!;
  };
  const driver: PassageSearchRouteDriver = {
    harness,
    search,
    card: undefined as unknown as WorkshopTurn,
    route,
    act: async (type, extra = {}) => {
      asked += 1;
      const requestId = `ps-${asked}`;
      const running = route(type, { requestId, roomRevision: harness.session.readRoomRevision(), turnId: driver.card.id, ...extra });
      return { requestId, running };
    },
    done: async (type, extra = {}) => {
      const { requestId, running } = await driver.act(type, extra);
      await running;
      await settle();
      return answersOf(requestId);
    },
    answersOf,
    view: async (turnId = driver.card.id) => {
      await route(MessageType.WORKSHOP_REQUEST_SESSION, {});
      return harness.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1)!.payload.session.turns
        .find((turn: WorkshopTurn) => turn.id === turnId)?.passageSearchRequest?.view;
    },
    ledger,
    requestTurns: () => ledger().filter((turn) => turn.passageSearchResults),
    askAgain,
    settle,
    logs: () => (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line)).join('\n')
  };
  if (cardTurnId !== undefined) {
    driver.card = ledger().find((turn) => turn.id === cardTurnId)!;
    return driver;
  }
  if (!options.session) {
    await harness.pin();
  }
  driver.card = await askAgain();
  harness.service.continueConversation.mockClear();
  return driver;
}

/** A provider reply that waits: `reply` lands it, as the provider would. */
export function heldReply(harness: WorkshopRouteTestHarness, method: 'continueConversation' | 'startWorkshopPersonaConversation' = 'continueConversation') {
  let land!: (value: unknown) => void;
  harness.service[method].mockImplementationOnce(() => new Promise((resolve) => { land = resolve; }) as never);
  return { reply: (content: string) => land(analysisResult(content, { conversationId: 'host-conv' })) };
}
