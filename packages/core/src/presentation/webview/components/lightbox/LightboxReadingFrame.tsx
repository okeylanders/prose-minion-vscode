/**
 * LightboxReadingFrame — the frame a lens's reading is drawn in (ADR
 * 2026-10-19 D3, D7).
 *
 * The register comes from the kind (`LIGHTBOX_TILE_REGISTER`). Around the
 * reading itself the frame shows what the honesty rules decided: skeletons
 * before and during the call, the group's failure or stop, a block withheld
 * by kind with its reason, claims withheld by title with theirs, and, for a
 * lens that found nothing, that empty answer with its friction. A lens read
 * against an earlier version of the text is labeled stale (D4). The withheld
 * lists are their own components, so a reading drawn outside a frame (the
 * headline, in the board's heading) shows its withheld state the same way.
 *
 * The header carries the lens's call control, Analyze (Slice 4I, epic
 * decision 43), when the board gives its controls: it runs this lens's
 * call, and stands in for the bare "read" badge.
 *
 * Every frame keeps a lens's earlier reading in view while its call reads
 * it again (Slice 4J, epic decision 49, generalizing the Opinion's decision
 * 47): "Analyzing… This is the earlier reading until the new one lands." in
 * place of the skeleton. After a call that did not replace it (failed,
 * stopped, cut off, withheld, or no tile), the earlier reading stays with a
 * quiet **Earlier reading** label and the host's reason. The note is the
 * frame's description, so a screen reader hears it with the frame's name.
 * `keep` gives a frame its own words (the Opinion's).
 *
 * A call that did not land is said once, in its note under the run line
 * (Slice 4J, epic decision 52): a frame whose state is that note's message
 * shows a short line pointing there instead ("Call E failed: see its note by
 * the run line. Analyze to try again.", or "Earlier reading · this call
 * failed: …" over its earlier reading), and is described by the note.
 */
import * as React from 'react';
import type { LightboxReadingTileKind, LightboxWithheldBlock, LightboxWithheldClaim } from '@messages';
import { LIGHTBOX_TILE_LENS } from '@shared/constants/lightbox';
import type { LightboxLensView } from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxOwnWithheldBlocks, lightboxWithheldQuoteText } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxCallLine, LightboxCallPointer } from '@components/lightbox/LightboxCallNotes';
import { LightboxTileFrame } from '@components/lightbox/LightboxTileFrame';
import { LightboxReadingPlaceholder } from '@components/lightbox/LightboxReadingPlaceholder';
import { LightboxAnalyzeButton, useLightboxHasCallControls } from '@components/lightbox/LightboxCallButton';
import { LIGHTBOX_EARLIER_LABEL, LIGHTBOX_KEEP_WORDS, type LightboxKeepWords } from '@shared/constants/lightboxProvenance';

export interface LightboxReadingFrameProps {
  kind: LightboxReadingTileKind;
  title: string;
  span: 3 | 6;
  view: LightboxLensView;
  /** What an empty answer means for this lens. */
  empty: string;
  /** A note beside the badge row, e.g. "affinity is a claim, not a score". */
  aside?: React.ReactNode;
  footnote?: React.ReactNode;
  /** Shown whenever the lens has been read, tiles or none (lineage's set-aside list). */
  after?: React.ReactNode;
  /** The stale note before the aside, for a frame whose aside holds its readings (the numbers). */
  staleFirst?: boolean;
  /** The frame's own chip and class (the Opinion, Slice 4D). */
  chip?: React.ReactNode;
  frameClass?: string;
  /** Its own words for an earlier reading kept while its call reads it again, and after (the Opinion's, decision 47). */
  keep?: LightboxKeepWords;
  children: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxReadingFrame: React.FC<LightboxReadingFrameProps> = ({
  kind,
  title,
  span,
  view,
  empty,
  aside,
  footnote,
  after,
  staleFirst,
  chip,
  frameClass,
  keep = LIGHTBOX_KEEP_WORDS,
  children
}) => {
  const read = view.phase === 'ok';
  const blocks = lightboxOwnWithheldBlocks(view);
  const nothing = read && !view.callNote && view.tiles.length === 0 && blocks.length === 0 && view.withheldClaims.length === 0;
  const analyze = useLightboxHasCallControls() ? <LightboxAnalyzeButton lens={LIGHTBOX_TILE_LENS[kind]} /> : undefined;
  const noteId = React.useId();
  const kept = view.reanalyzing || view.earlier !== undefined;
  // Decision 52: a frame whose state is its call's note points there, and is described by it.
  const pointer = view.callNote && !kept;
  const describedBy = [kept || pointer ? noteId : undefined, view.callNote?.id].filter(Boolean).join(' ');
  return (
    <LightboxTileFrame
      kind={kind}
      span={span}
      title={title}
      footnote={read && view.tiles.length > 0 ? footnote : undefined}
      chip={chip}
      className={`${frameClass ?? ''}${kept ? ' is-earlier' : ''}`.trim() || undefined}
      action={analyze}
      describedBy={describedBy || undefined}
    >
      {staleFirst && view.stale && <LightboxStaleNote />}
      {aside}
      {!staleFirst && view.stale && <LightboxStaleNote />}
      {(view.phase === 'not-run' || view.phase === 'reading') && <LightboxReadingPlaceholder live={view.phase === 'reading'} />}
      <LightboxKeptNote view={view} words={keep} id={noteId} />
      {pointer && view.callNote && <LightboxCallLine lens={view.lens} note={view.callNote} id={noteId} />}
      {view.notice && !view.callNote && (
        <p className={`pm-lb-reading-notice${read ? '' : ' is-failed'}`} role={read ? undefined : 'alert'}>
          {view.notice}
        </p>
      )}
      <LightboxWithheldBlocks blocks={blocks} />
      {nothing && (
        <div className="pm-lb-empty-reading">
          <p>{empty}</p>
          {view.friction && <p className="pm-lb-empty-friction"><b>Where this reading strains:</b> {view.friction}</p>}
        </div>
      )}
      {read && view.tiles.length > 0 && children}
      {read && after}
      <LightboxWithheldClaims claims={view.withheldClaims} />
    </LightboxTileFrame>
  );
};

/**
 * An earlier reading on show (Slice 4J, epic decision 49): while its call
 * reads it again, the live note beside the spinner; after a call that did
 * not replace it, the quiet **Earlier reading** label and the host's reason.
 * Nothing for a lens whose reading is its latest. Every reading's frame,
 * the headline, the tension line and the Spark lane draw it.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxKeptNote: React.FC<{
  view: Pick<LightboxLensView, 'lens' | 'reanalyzing' | 'earlier' | 'callNote'>;
  words?: LightboxKeepWords;
  id?: string;
}> = ({ view, words = LIGHTBOX_KEEP_WORDS, id }) => {
  if (view.reanalyzing) {
    return (
      <p id={id} className="pm-lb-reading-notice is-live" role="status">
        <span className="pm-lb-spin is-small" aria-hidden="true" />
        {words.reading}
      </p>
    );
  }
  if (view.earlier === undefined) {
    return null;
  }
  // Decision 52: a reason that is its call's note's is said there once; this line points to it.
  return (
    <p id={id} className="pm-lb-earlier-note">
      <b className="pm-lb-earlier-label">{LIGHTBOX_EARLIER_LABEL}</b>
      {view.callNote
        ? <>{' · '}<LightboxCallPointer lens={view.lens} note={view.callNote} earlier /></>
        : ` ${words.kept} ${view.earlier}`}
    </p>
  );
};

/** A lens read against an earlier version of the text (D4): every reading's frame, and the Spark lane, say so. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxStaleNote: React.FC = () => (
  <p className="pm-lb-stale-note">
    <b>Stale</b> Read against an earlier version of this chapter. Its quotes were checked again against
    this one, and its counts recounted. Re-analyze to read it fresh.
  </p>
);

/** Lens blocks withheld by kind, each with its reason. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxWithheldBlocks: React.FC<{ blocks: readonly LightboxWithheldBlock[]; label?: string }> = ({
  blocks,
  label = 'Withheld'
}) => (
  <>
    {blocks.map((block) => (
      <p key={`${block.kind}:${block.reason}`} className="pm-lb-withheld-block">
        <b>{label}</b> {block.reason}
      </p>
    ))}
  </>
);

/** Claims withheld by title, each with its reason and its failed quotes' reasons (never their text). */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxWithheldClaims: React.FC<{ claims: readonly LightboxWithheldClaim[] }> = ({ claims }) =>
  claims.length === 0 ? null : (
    <ul className="pm-lb-withheld-claims" aria-label="Withheld claims">
      {claims.map((claim, index) => (
        <li key={`${claim.title}:${index}`}>
          <b>Withheld · {claim.title}</b>
          <span>{claim.reason}</span>
          {claim.quotes.map((quote, quoteIndex) => (
            <span key={quoteIndex} className="pm-lb-withheld-quote">¶{quote.paragraph}: {lightboxWithheldQuoteText(quote)}</span>
          ))}
        </li>
      ))}
    </ul>
  );
