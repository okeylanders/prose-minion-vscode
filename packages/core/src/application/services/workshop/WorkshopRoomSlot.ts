/** Existing installations and pre-tab panel state keep their original rolling file. */
export const PRIMARY_WORKSHOP_ROOM_ID = 'legacy';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isWorkshopRoomId(value: unknown): value is string {
  return typeof value === 'string' && (value === PRIMARY_WORKSHOP_ROOM_ID || uuid.test(value));
}

export function workshopRoomFileName(roomId: string): string {
  if (!isWorkshopRoomId(roomId)) {
    throw new Error('Invalid Workshop room id.');
  }
  return roomId === PRIMARY_WORKSHOP_ROOM_ID ? 'current.json' : `current-${roomId}.json`;
}

export function roomIdFromWorkshopFile(name: string): string | undefined {
  if (name === 'current.json') {
    return PRIMARY_WORKSHOP_ROOM_ID;
  }
  const id = name.startsWith('current-') && name.endsWith('.json')
    ? name.slice('current-'.length, -'.json'.length) : '';
  return uuid.test(id) ? id : undefined;
}

export function isNamedSessionFileName(name: string): boolean {
  return name.endsWith('.json') && !name.endsWith('.summary.json') && !roomIdFromWorkshopFile(name);
}
