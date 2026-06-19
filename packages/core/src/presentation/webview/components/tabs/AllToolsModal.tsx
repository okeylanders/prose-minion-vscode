/**
 * AllToolsModal — guide-style picker for the Assistant's writing tools
 * (Pass-2 Wave-3c, FM design language). Mirrors the handoff's "Writing Tools"
 * modal: grouped cards (icon tile + name + one-line description). Every tool
 * here maps to a REAL PM analysis handler — no invented tools.
 *
 * The Assistant tab keeps the three primary actions inline; this modal holds
 * the full set (focused dialogue variants + craft & voice + technical).
 */
import * as React from 'react';
import { DialogueFocus, WritingToolsFocus } from '@shared/types';
import { Icon, IconName } from '@components/shared/Icon';

type ToolAction =
  | { kind: 'dialogue'; focus: DialogueFocus }
  | { kind: 'prose' }
  | { kind: 'writingTool'; focus: WritingToolsFocus };

interface ToolDef {
  group: string;
  name: string;
  icon: IconName;
  desc: string;
  action: ToolAction;
}

const TOOLS: ToolDef[] = [
  { group: 'Primary', name: 'Dialogue & Beats', icon: 'dialogue', desc: 'Cadence, subtext, and the microbeats between lines.', action: { kind: 'dialogue', focus: 'both' } },
  { group: 'Primary', name: 'Prose', icon: 'pen', desc: 'Line-level rewrite suggestions for flow and clarity.', action: { kind: 'prose' } },
  { group: 'Primary', name: 'Gestures', icon: 'hand', desc: 'Body language — variety, repetition, and intent.', action: { kind: 'writingTool', focus: 'gestures' } },

  { group: 'Dialogue (focused)', name: 'Dialogue Only', icon: 'dialogue', desc: 'Just the spoken lines — tags, rhythm, and voice.', action: { kind: 'dialogue', focus: 'dialogue' } },
  { group: 'Dialogue (focused)', name: 'Microbeats Only', icon: 'sparkle', desc: 'Just the action beats woven through the dialogue.', action: { kind: 'dialogue', focus: 'microbeats' } },

  { group: 'Craft & Voice', name: 'Cliché', icon: 'stamp', desc: 'Surface tired phrasings and stock images.', action: { kind: 'writingTool', focus: 'cliche' } },
  { group: 'Craft & Voice', name: 'Repetition', icon: 'repeat', desc: 'Echoed words, structures, and tics across the passage.', action: { kind: 'writingTool', focus: 'repetition' } },
  { group: 'Craft & Voice', name: 'Decision Points', icon: 'branch', desc: 'Moments where a character chooses — and the stakes.', action: { kind: 'writingTool', focus: 'decision-points' } },
  { group: 'Craft & Voice', name: 'Show & Tell', icon: 'eye', desc: 'Where you summarize vs. dramatize on the page.', action: { kind: 'writingTool', focus: 'show-and-tell' } },
  { group: 'Craft & Voice', name: 'Choreography', icon: 'move', desc: 'Spatial logic of movement through a scene.', action: { kind: 'writingTool', focus: 'choreography' } },
  { group: 'Craft & Voice', name: 'Stock & Signature', icon: 'target', desc: 'Generic beats vs. your distinctive authorial moves.', action: { kind: 'writingTool', focus: 'stock-and-signature' } },
  { group: 'Craft & Voice', name: 'Placeholders', icon: 'search', desc: 'Find TODOs, [brackets], and unfinished seams.', action: { kind: 'writingTool', focus: 'placeholders' } },

  { group: 'Technical', name: 'Style', icon: 'palette', desc: 'Weak verbs, adverbs, filler, and passive voice.', action: { kind: 'writingTool', focus: 'style' } },
  { group: 'Technical', name: 'Editor', icon: 'list', desc: 'A holistic developmental editor pass.', action: { kind: 'writingTool', focus: 'editor' } },
  { group: 'Technical', name: 'Continuity', icon: 'link', desc: 'Contradictions against characters and prior chapters.', action: { kind: 'writingTool', focus: 'continuity' } },
  { group: 'Technical', name: 'Fresh', icon: 'sprout', desc: 'Fresh-eyes reactions, as a first-time reader.', action: { kind: 'writingTool', focus: 'fresh' } }
];

const GROUP_ORDER = ['Primary', 'Dialogue (focused)', 'Craft & Voice', 'Technical'];

export interface AllToolsModalProps {
  open: boolean;
  disabled: boolean;
  onClose: () => void;
  onDialogue: (focus: DialogueFocus) => void;
  onProse: () => void;
  onWritingTool: (focus: WritingToolsFocus) => void;
}

export const AllToolsModal: React.FC<AllToolsModalProps> = ({
  open,
  disabled,
  onClose,
  onDialogue,
  onProse,
  onWritingTool
}) => {
  // Close on Escape while open.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const run = (action: ToolAction) => {
    if (disabled) return;
    switch (action.kind) {
      case 'dialogue':
        onDialogue(action.focus);
        break;
      case 'prose':
        onProse();
        break;
      case 'writingTool':
        onWritingTool(action.focus);
        break;
    }
    onClose();
  };

  return (
    <div className="tm-backdrop" role="dialog" aria-modal="true" aria-label="Writing tools" onClick={onClose}>
      <div className="tm" onClick={(e) => e.stopPropagation()}>
        <div className="tm-head">
          <div>
            <div className="pm-eyebrow">Prose Excerpt Assistant</div>
            <div className="tm-title">Writing Tools</div>
            <div className="tm-subtitle">Pick an analysis. Each runs on your excerpt with the context brief attached.</div>
          </div>
          <button type="button" className="btn ghost tm-close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        {GROUP_ORDER.map((group) => {
          const tools = TOOLS.filter((t) => t.group === group);
          if (tools.length === 0) return null;
          return (
            <React.Fragment key={group}>
              <div className="pm-rule-row">
                <span className="pm-eyebrow">{group}</span>
                <hr />
              </div>
              <div className="tm-grid">
                {tools.map((t) => (
                  <button
                    type="button"
                    key={t.name}
                    className="tm-card"
                    onClick={() => run(t.action)}
                    disabled={disabled}
                    title={disabled ? 'Add an excerpt first' : t.desc}
                  >
                    <span className="tm-ic">
                      <Icon name={t.icon} size={20} />
                    </span>
                    <span className="tm-n">{t.name}</span>
                    <span className="tm-d">{t.desc}</span>
                  </button>
                ))}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
