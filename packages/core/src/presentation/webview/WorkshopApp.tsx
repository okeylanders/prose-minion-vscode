/**
 * WorkshopApp — the Workshop editor-tab React root (ADR 2026-07-03, Sprint 1).
 *
 * Static shell only: header (brand, model-select placeholder, balance
 * placeholder, New-session), left rail (pinned-excerpt placeholder, context
 * brief placeholder, tool palette), empty thread, DISABLED composer. Zero AI,
 * zero session state — every control is inert until Sprint 2 wires the
 * workshop domain (useWorkshop ↔ WorkshopHandler) and Sprint 2 swaps the
 * header placeholders for useModelsSettings / useAccountBalance.
 *
 * Rendered when the host stamps `data-pm-surface="workshop"` on #root; the
 * sidebar keeps rendering <App/>. One bundle, two roots.
 */

import * as React from 'react';
import { Icon, IconName } from './components/shared/Icon';
import { PmLogo } from './components/shared/PmLogo';
import { WritingToolsFocus } from '@shared/types';
import './workshop.css';

/**
 * The Workshop tool catalog — the design prototype's 14 tools, mapped 1:1
 * onto the EXISTING analysis contracts: `dialogue`, `prose`, and the twelve
 * WritingToolsFocus modes. Labels/grouping come from the approved Direction B
 * prototype (docs/design/pm-frames-fulltab.js); ids are the wire values the
 * Sprint 2 handler will route on. Deterministic, in code — the LLM never
 * names buttons (epic invariant).
 */
type WorkshopToolId = 'dialogue' | 'prose' | WritingToolsFocus;

interface WorkshopTool {
  id: WorkshopToolId;
  label: string;
  icon: IconName;
  group: 'Primary' | 'Craft & Voice' | 'Technical';
}

export const WORKSHOP_TOOLS: readonly WorkshopTool[] = [
  { id: 'dialogue', label: 'Dialogue & Beats', icon: 'dialogue', group: 'Primary' },
  { id: 'prose', label: 'Prose', icon: 'pen', group: 'Primary' },
  { id: 'gestures', label: 'Gestures', icon: 'hand', group: 'Primary' },
  { id: 'cliche', label: 'Cliché', icon: 'stamp', group: 'Craft & Voice' },
  { id: 'repetition', label: 'Repetition', icon: 'repeat', group: 'Craft & Voice' },
  { id: 'decision-points', label: 'Decision Points', icon: 'branch', group: 'Craft & Voice' },
  { id: 'show-and-tell', label: 'Show & Tell', icon: 'eye', group: 'Craft & Voice' },
  { id: 'choreography', label: 'Choreography', icon: 'move', group: 'Craft & Voice' },
  { id: 'stock-and-signature', label: 'Stock & Signature', icon: 'target', group: 'Craft & Voice' },
  { id: 'placeholders', label: 'Placeholders', icon: 'search', group: 'Craft & Voice' },
  { id: 'style', label: 'Style', icon: 'palette', group: 'Technical' },
  { id: 'editor', label: 'Editor', icon: 'list', group: 'Technical' },
  { id: 'continuity', label: 'Continuity', icon: 'link', group: 'Technical' },
  { id: 'fresh', label: 'Fresh', icon: 'sprout', group: 'Technical' },
];

/** Rail shows the prototype's first six; the rest arrive with the Sprint 4 tools modal. */
const RAIL_TOOL_COUNT = 6;

export const WorkshopApp: React.FC = () => {
  return (
    <div className="pm-ws">
      <header className="pm-ws-header">
        <div className="pm-ws-brand">
          <div className="pm-ws-logo">
            <PmLogo />
          </div>
          <div>
            <div className="pm-ws-eyebrow pm-ws-header-eyebrow">Prose Minion · Assistant</div>
            <h1 className="pm-ws-title">Workshop</h1>
            <p className="pm-ws-subtitle">
              <Icon name="doc" size={12} /> No excerpt pinned yet
            </p>
          </div>
        </div>
        <div className="pm-ws-header-actions">
          <button className="pm-ws-reset" type="button" disabled title="Start a fresh session (Sprint 2)">
            <Icon name="refresh" size={13} /> New session
          </button>
          {/* Static placeholder — wired to useModelsSettings in Sprint 2 */}
          <button className="pm-ws-model" type="button" disabled title="Model selection (Sprint 2)">
            Model <Icon name="chevDown" size={13} />
          </button>
          {/* Static placeholder — wired to useAccountBalance in Sprint 2 */}
          <div className="pm-ws-balance" title="OpenRouter balance (Sprint 2)">
            <span className="pm-ws-balance-dot" />
            <span className="pm-ws-balance-label">OpenRouter</span>
            <span className="pm-ws-balance-val">$ —</span>
          </div>
        </div>
      </header>

      <div className="pm-ws-split">
        <aside className="pm-ws-rail" aria-label="Session rail">
          <div className="pm-ws-block">
            <div className="pm-ws-block-head">
              <div className="pm-ws-eyebrow">
                <Icon name="pin" size={12} /> Working Excerpt
              </div>
              <span className="pm-ws-pill">Pinned</span>
            </div>
            <div className="pm-ws-excerpt pm-ws-excerpt-empty">
              Nothing pinned yet. Select a passage in the editor and send it to the
              Workshop — it stays in view while you iterate.
            </div>
          </div>

          <div className="pm-ws-block">
            <div className="pm-ws-eyebrow">Context Brief</div>
            <p className="pm-ws-brief-empty">No context brief loaded.</p>
          </div>

          <div className="pm-ws-block pm-ws-block-grow">
            <div className="pm-ws-eyebrow">Tools</div>
            <div className="pm-ws-tools" role="list">
              {WORKSHOP_TOOLS.slice(0, RAIL_TOOL_COUNT).map((tool) => (
                <button key={tool.id} className="pm-ws-tool" type="button" disabled role="listitem">
                  <Icon name={tool.icon} size={15} /> {tool.label}
                </button>
              ))}
              <button className="pm-ws-tool pm-ws-tool-ghost" type="button" disabled>
                <Icon name="grid" size={15} /> All {WORKSHOP_TOOLS.length} tools…
              </button>
            </div>
          </div>
        </aside>

        <section className="pm-ws-main" aria-label="Session thread">
          <div className="pm-ws-thread">
            <div className="pm-ws-thread-empty">
              <Icon name="sparkle" size={22} />
              <p className="pm-ws-thread-empty-title">The thread starts when you run a tool.</p>
              <p className="pm-ws-thread-empty-sub">
                Analyses and follow-ups will stream in here, with your excerpt pinned on the left.
              </p>
            </div>
          </div>

          <div className="pm-ws-composer-wrap">
            <div className="pm-ws-composer">
              <button className="pm-ws-comp-add" type="button" disabled title="Writing tools (Sprint 4)">
                <Icon name="plus" size={18} />
              </button>
              <input
                className="pm-ws-comp-input"
                type="text"
                disabled
                placeholder="Ask a follow-up, or pick a tool…"
                aria-label="Message the Workshop (available in a later sprint)"
              />
              <div className="pm-ws-comp-right">
                <span className="pm-ws-comp-pill">
                  <Icon name="grid" size={13} /> Tools
                </span>
                <button className="pm-ws-comp-send" type="button" disabled title="Send (Sprint 2)">
                  <Icon name="send" size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
