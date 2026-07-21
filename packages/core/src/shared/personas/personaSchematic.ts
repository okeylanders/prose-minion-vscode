/**
 * Structured, read-only view-model of a Workshop persona's authored expression
 * spec — the data behind the persona configuration schematic
 * (docs/design/Prose Minion - Persona Schematic.html).
 *
 * SOURCE OF TRUTH TODAY: the persona prose in
 * `resources/system-prompts/workshop-personas/expression-profiles/<id>.md` and
 * `.../expression-calibrations/<id>.md` remains canonical — it is what gets
 * injected into persona prompts (ADR 2026-07-20). Each `<id>.json` schematic is
 * a hand-authored STRUCTURED EXTRACTION of that prose, consumed only by the
 * read-only schematic UI. The two are expected to agree; the prose wins on
 * conflict. A future ADR may invert this (JSON canonical → generated prompts +
 * an inline config editor), at which point the dashed `edit` affordances in the
 * design become live. Until then: edit the prose, then refresh the JSON.
 *
 * Presentation-only concerns (accent color, focus icon) are NOT authored here —
 * they live in the presentation layer keyed by persona id.
 */

/** A gradient stop track. Authored as 2–3 stops (default → mid → far). */
export interface PersonaGradient {
  /** Ordered stops from the persona's home register out to its governed edge. */
  stops: string[];
  /** Index into `stops` of the resting detent the persona returns to. */
  default: number;
  /** Optional gloss shown beside the track (e.g. "default: the directorial middle"). */
  note?: string | null;
}

/**
 * One trait tension: the strength pole, the named trigger that tips it into the
 * shadow, the regulator that restores it, and the hard caricature boundary.
 * `observable` and `boundary` are optional — a sparser persona (Penny) omits
 * them and still reads as tuned, not broken.
 */
export interface PersonaTension {
  title: string;
  strength: string;
  shadow: string;
  trigger: string;
  observable?: string;
  regulator: string;
  boundary?: string;
}

/** One field of the verbal palette. `none: true` renders the "NONE — plainness is the voice" cell. */
export interface PersonaPaletteField {
  label: string;
  value: string;
  none?: boolean;
}

/** One governed communication axis (default detent + optional closed/locked far end). */
export interface PersonaCommGradient {
  axis: string;
  stops: string[];
  default: number;
  /** Italic note under the track. */
  note?: string;
  /** When set, the far end is locked (padlock); the string is the lock label, e.g. "ceiling: one image". */
  lock?: string;
}

/** One trait-pressure track: default → mid → overreach ceiling (the red-ringed stop). */
export interface PersonaPressure {
  trait: string;
  stops: string[];
}

/**
 * The complete structured schematic for one persona. Identity fields
 * (name / specialty / description / focus icon) are NOT duplicated here — they
 * come from WORKSHOP_PERSONA_CATALOG. This carries only the expression spec.
 */
export interface PersonaSchematic {
  /** Primary metaphor field (Identity subtitle). `null` → "plainness is the voice". */
  metaphor: string | null;
  tensions: PersonaTension[];
  /** Turn-taking signature, in order. */
  turns: string[];
  aperture: {
    /** How wide the persona opens personally, 0 (guarded) … 1 (wide open). */
    openness: number;
    tag: string;
    text: string;
  };
  palette: PersonaPaletteField[];
  /** Default-assistant vocabulary the persona resists. */
  resist: string;
  saturation: {
    /** Lit segments (out of `of`). */
    lit: number;
    of: number;
    label: string;
    sub?: string;
    /** Renders the steady-glow variant (a low-but-deliberate saturation, e.g. Penny). */
    steady?: boolean;
  };
  gravity: {
    /** Noun neighborhoods — strong gravity, held close. */
    nouns: string[];
    /** Shown when a persona authors no noun neighborhoods; the absence is the field. */
    nounNote: string | null;
    /** Anti-vocabulary — weak gravity, drifting away. */
    anti: string[];
    verb: PersonaGradient;
    adj: PersonaGradient;
    analogy: string;
  };
  comm: PersonaCommGradient[];
  pressure: PersonaPressure[];
  floor: {
    lead: string;
    items: string[];
    note?: string | null;
  };
}
