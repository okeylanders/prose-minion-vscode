/**
 * WorkshopOpenChatStart — the open-conversation start block (Sprint 13A §8/§10;
 * design source: "Prose Minion - Assistant Tab.html", `.wk-openstart`).
 *
 * The honesty copy lives here in the writer's own view, saying the same thing
 * the persona's system frame says: nothing has been read, and nothing will
 * pretend otherwise. It also states the part that is easy to assume away —
 * context attachments DO ride along; only the excerpt is missing.
 *
 * Starters are code-owned prompts, deliberately generic: the comp's examples
 * name a character from its demo novel, which no real project shares. They
 * prefill the composer rather than sending — the writer still presses send.
 */

import * as React from 'react';

/** Code-owned openings; the model never invents an affordance here. */
export const WORKSHOP_OPEN_CHAT_STARTERS: readonly string[] = [
  'Help me plan the next scene',
  'Something feels off about a character',
  'How do you handle a time skip?',
  'Tell me how you read'
];

interface WorkshopOpenChatStartProps {
  hostLabel: string;
  disabled: boolean;
  onStarter: (prompt: string) => void;
}

export const WorkshopOpenChatStart: React.FC<WorkshopOpenChatStartProps> = ({
  hostLabel,
  disabled,
  onStarter
}) => (
  <div className="pm-ws-open-start">
    <div className="pm-ws-open-start-kicker">Session scope · Open conversation</div>
    <h3>Open conversation with {hostLabel}.</h3>
    <p>
      No pages attached — {hostLabel} hasn’t read anything yet, and won’t pretend to. Plan a
      scene, untangle a character, discuss craft, or get to know your writing partner. Project
      context you attach still rides along; only the excerpt is missing.
    </p>
    <div className="pm-ws-starters">
      {WORKSHOP_OPEN_CHAT_STARTERS.map((starter) => (
        <button
          key={starter}
          className="pm-ws-starter"
          type="button"
          disabled={disabled}
          onClick={() => onStarter(starter)}
        >
          {starter}
        </button>
      ))}
    </div>
  </div>
);

interface WorkshopExcerptAdoptedNoticeProps {
  hostLabel: string;
}

/**
 * The "scope changed" block that follows the excerpt-added divider (§10). It
 * exists to answer the question the transition raises: did I just lose the
 * conversation? No — and it says which things changed instead.
 */
export const WorkshopExcerptAdoptedNotice: React.FC<WorkshopExcerptAdoptedNoticeProps> = ({
  hostLabel
}) => (
  <div className="pm-ws-open-start">
    <div className="pm-ws-open-start-kicker">Scope changed</div>
    <h3>{hostLabel} can read the passage now.</h3>
    <p>
      Everything you’ve said so far is still here. Analysis tools have unlocked on the left, and
      the excerpt stays pinned while the conversation continues.
    </p>
  </div>
);
