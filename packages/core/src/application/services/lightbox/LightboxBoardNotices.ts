/**
 * What the rail's Boards section says when an open, a delete or a rename
 * did not happen as asked (Slice 5A; Slice 5A.1). Host words, shared by
 * `LightboxBoardLibrary` and `LightboxBoardEdits`; the library re-exports
 * them. None carries the writer's text or a board's name.
 */
export const LIGHTBOX_BOARD_NOTICES = {
  reading: 'A run is reading this board. Stop it, or let it finish, before opening a saved board.',
  missing: 'That saved board is no longer in the boards folder.',
  unreadable: 'That saved board could not be read, so it was left as it is.',
  unavailable: 'Boards are kept for this session only, so there is no saved board to open or delete.',
  severalSources: 'That saved board holds more than one source, and this version opens boards of one source.',
  deleteUnreadable: 'That file could not be read as a board, so it was not deleted.',
  deleteFailed: 'That saved board could not be deleted. The output log says why.',
  // Slice 5A.1: renames, and a file another window is rewriting.
  busy: 'That saved board is being changed in another window. Try again in a moment.',
  boardGone: 'That board is no longer open, so it was not named. Name the board on screen.',
  renameFailed: 'That saved board could not be renamed. The output log says why.',
  nameKeptUnreadable: 'The board on screen is named, but the file it was saved to could not be read, so the file was left as it is.',
  nameKeptFailed: 'The board on screen is named, but the file it was saved to could not be changed. The output log says why.',
  // PR #167 F-02: a name typed for a board that another board replaced on screen before it was sent.
  boardChanged: 'Another board came on screen before the name was given, so nothing was renamed. Rename the board on screen.'
} as const;

/** What an open, a delete or a rename left for the rail to say. */
export interface LightboxBoardAction {
  notice?: string;
}
