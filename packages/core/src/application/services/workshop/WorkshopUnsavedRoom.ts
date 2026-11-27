import type { WorkshopPersistedSessionV2 } from './WorkshopPersistedSession';
import type { WorkshopSessionStateV1 } from './WorkshopSessionStateV1';
import { DEFAULT_WORKSHOP_PERSONA_ID } from '@shared/constants/workshopPersonas';
import type { WorkshopTurn } from '@messages';

export type WorkshopUnsavedRoomStatus = 'empty' | 'saved' | 'unsaved';

function isStartupTurn(turn: WorkshopTurn): boolean {
  if (turn.role !== 'system' || turn.participant !== 'session' || turn.kind !== 'divider' ||
    Object.keys(turn).some(key => !['artifact', 'content', 'excerptVersion', 'id', 'kind', 'participant', 'role', 'timestamp'].includes(key))) { return false; }
  return (turn.artifact === 'session_start' && turn.content.startsWith('Session started ')) ||
    (turn.artifact === 'session_resume' && turn.content.startsWith('Session resumed '));
}

/** An untouched room still contains host-generated identity, counters, timestamps and a start marker. */
export function hasWorkshopRoomWork(session: WorkshopPersistedSessionV2): boolean {
  const room = session.workshop;
  return Boolean(room.excerpt || room.shelvedExcerpt || room.scope || room.selectedToolId ||
    room.turns.some(turn => !isStartupTurn(turn)) ||
    room.contextAttachments.length || room.pendingMessageAttachments.length || room.threadArtifacts?.length ||
    room.todos.length || room.bookmarks?.length || room.reactions?.length || room.widgetConfigs?.length ||
    room.standingDirectives?.length || room.lastCommittedPersonaBehavior ||
    room.participants.host.personaId !== DEFAULT_WORKSHOP_PERSONA_ID || room.participants.host.conversationKey ||
    room.participants.personaGuests.length || room.participants.toolSidecars.length ||
    room.writerSources.host.length || Object.values(room.writerSources.tools).some(sources => sources.length) ||
    room.writerSources.guests.some(guest => guest.sources.length) || session.conversations.length);
}

type PreviewSource = Pick<WorkshopSessionStateV1, 'turns'> & {
  excerpt?: { text: string };
  shelvedExcerpt?: { text: string };
};

export function workshopUnsavedRoomPreview(room: PreviewSource): string {
  const text = room.excerpt?.text || room.shelvedExcerpt?.text || room.turns.find(turn => turn.role === 'user')?.content || '';
  return text.trim().replace(/\s+/g, ' ').slice(0, 160);
}
