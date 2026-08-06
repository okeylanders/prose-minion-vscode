import {
  WorkshopLexicalGravityLens
} from '@messages';
import { cloneLexicalGravityLens } from './LexicalGravityConfigCodec';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const lens = (
  value: Omit<WorkshopLexicalGravityLens, 'version' | 'source'>
): WorkshopLexicalGravityLens => ({ version: 1, source: 'built-in', ...value });

/** The six approved Spread 02 starter fields. */
const BUILT_IN_LENSES: readonly WorkshopLexicalGravityLens[] = [
  lens({
    slug: 'photography', name: 'Photography',
    degrees: {
      1: { nouns: ['aperture', 'exposure', 'frame', 'shutter', 'negative'], verbs: ['focus', 'expose', 'frame', 'develop', 'capture'], modifiers: ['overexposed', 'blurred', 'sharp', 'backlit'] },
      2: { nouns: ['grain', 'contrast', 'darkroom', 'silhouette', 'light-leak'], verbs: ['crop', 'burn', 'fix', 'enlarge'], modifiers: ['grainy', 'high-contrast', 'sepia', 'unfocused'] },
      3: { nouns: ['silver bath', 'ghosting', 'latency', 'contact sheet'], verbs: ['bracket', 'dodge', 'redevelop'], modifiers: ['halated', 'solarized', 'undeveloped'] }
    },
    gradient: ['glance', 'look', 'gaze', 'study', 'frame', 'exposure', 'contact print'],
    cliches: [
      { worn: 'picture-perfect', fresh: 'framed too carefully to trust' },
      { worn: 'a snapshot in time', fresh: 'one frame pulled from the reel' },
      { worn: 'rose-tinted lenses', fresh: 'printed warmer than it was shot' },
      { worn: 'the big picture', fresh: 'the whole contact sheet' }
    ],
    substitutions: { plan: 'framing', conflict: 'glare', agreement: 'focus', turning: 'the develop', ending: 'the final print' },
    metaphor: 'the whole evening a contact sheet he would never print',
    sample: 'She stood at the window, overexposed in the last light, and he stopped the moment down until it held.'
  }),
  lens({
    slug: 'music', name: 'Music',
    degrees: {
      1: { nouns: ['tempo', 'chord', 'key', 'refrain', 'cadence'], verbs: ['tune', 'resolve', 'swell', 'hum'], modifiers: ['off-key', 'muted', 'resonant', 'minor'] },
      2: { nouns: ['dissonance', 'downbeat', 'tremolo', 'rest', 'interval'], verbs: ['modulate', 'syncopate', 'harmonize', 'transpose'], modifiers: ['staccato', 'legato', 'atonal'] },
      3: { nouns: ['coda', 'attack', 'decay', 'overtone', 'cadenza'], verbs: ['orchestrate', 'improvise', 'retune'], modifiers: ['contrapuntal', 'unresolved', 'polyphonic'] }
    },
    gradient: ['plan', 'outline', 'pattern', 'sequence', 'arrangement', 'composition', 'score'],
    cliches: [
      { worn: 'struck a chord', fresh: 'resonated in a minor key' },
      { worn: 'music to my ears', fresh: 'landed like a held note' },
      { worn: 'marching to their own drum', fresh: 'keeping a time signature nobody else could count' },
      { worn: 'change their tune', fresh: 'modulate mid-phrase' }
    ],
    substitutions: { plan: 'score', conflict: 'dissonance', agreement: 'harmony', turning: 'key change', ending: 'coda' },
    metaphor: 'her patience a held note going flat',
    sample: 'The kitchen kept its own tempo — kettle, clock, her knife on the board — and his apology came in under the beat.'
  }),
  lens({
    slug: 'mathematics', name: 'Mathematics',
    degrees: {
      1: { nouns: ['sum', 'angle', 'proof', 'factor', 'curve'], verbs: ['divide', 'count', 'equal', 'solve'], modifiers: ['even', 'odd', 'exact', 'negative'] },
      2: { nouns: ['asymptote', 'remainder', 'axiom', 'vector', 'prime'], verbs: ['converge', 'derive', 'approximate', 'cancel'], modifiers: ['irrational', 'finite', 'parallel', 'inverse'] },
      3: { nouns: ['limit', 'series', 'integral', 'singularity'], verbs: ['integrate', 'tend', 'diverge'], modifiers: ['undefined', 'imaginary', 'asymptotic'] }
    },
    gradient: ['hunch', 'guess', 'estimate', 'conjecture', 'hypothesis', 'theorem', 'proof'],
    cliches: [
      { worn: 'do the math', fresh: 'run the proof' },
      { worn: 'it doesn’t add up', fresh: 'the remainder never comes out even' },
      { worn: 'lowest common denominator', fresh: 'the term everything reduces to' },
      { worn: 'a zero-sum game', fresh: 'an equation that only balances by loss' }
    ],
    substitutions: { plan: 'a proof', conflict: 'contradiction', agreement: 'equality', turning: 'inflection point', ending: 'the limit' },
    metaphor: 'their marriage an equation that balanced only when nobody checked the work',
    sample: 'He kept subtracting himself from the room, and the remainder was always her.'
  }),
  lens({
    slug: 'weather', name: 'Weather',
    degrees: {
      1: { nouns: ['front', 'drizzle', 'thaw', 'gust', 'forecast'], verbs: ['clear', 'cloud', 'gust', 'thaw'], modifiers: ['overcast', 'humid', 'brisk', 'unsettled'] },
      2: { nouns: ['pressure', 'squall', 'fogbank', 'barometer'], verbs: ['lift', 'break', 'settle in', 'blow over'], modifiers: ['low-pressure', 'gale-force', 'socked-in'] },
      3: { nouns: ['isobar', 'petrichor', 'doldrums', 'microclimate'], verbs: ['precipitate', 'occlude'], modifiers: ['anticyclonic', 'becalmed'] }
    },
    gradient: ['mood', 'temper', 'air', 'atmosphere', 'pressure', 'front'],
    cliches: [
      { worn: 'the calm before the storm', fresh: 'the pressure dropping before anyone smells rain' },
      { worn: 'under the weather', fresh: 'socked in' },
      { worn: 'a ray of sunshine', fresh: 'a break in the overcast' },
      { worn: 'weather the storm', fresh: 'ride out the squall' }
    ],
    substitutions: { plan: 'forecast', conflict: 'squall', agreement: 'clear skies', turning: 'the front', ending: 'the clearing' },
    metaphor: 'his moods moving through the house like fronts',
    sample: 'Something in her had been overcast for days and was only now considering rain.'
  }),
  lens({
    slug: 'botany', name: 'Botany',
    degrees: {
      1: { nouns: ['root', 'stem', 'bloom', 'seed', 'thorn'], verbs: ['bloom', 'wilt', 'prune', 'take root'], modifiers: ['overgrown', 'budding', 'fallow', 'tender'] },
      2: { nouns: ['graft', 'tendril', 'sap', 'canopy', 'perennial'], verbs: ['graft', 'deadhead', 'propagate', 'cling'], modifiers: ['deep-rooted', 'invasive', 'hardy', 'dormant'] },
      3: { nouns: ['rhizome', 'sepal', 'understory', 'cambium'], verbs: ['etiolate', 'photosynthesize', 'self-seed'], modifiers: ['heliotropic', 'vestigial', 'deciduous'] }
    },
    gradient: ['kin', 'line', 'stock', 'strain', 'graft', 'rootstock'],
    cliches: [
      { worn: 'nipped in the bud', fresh: 'pruned before it could set fruit' },
      { worn: 'putting down roots', fresh: 'going rootbound in a small pot' },
      { worn: 'a late bloomer', fresh: 'flowering out of season' },
      { worn: 'the grass is greener', fresh: 'envying the neighbor’s loam' }
    ],
    substitutions: { plan: 'the graft', conflict: 'blight', agreement: 'full bloom', turning: 'first frost', ending: 'going to seed' },
    metaphor: 'an apology grafted onto old wood',
    sample: 'The silence between them had gone to seed.'
  }),
  lens({
    slug: 'architecture', name: 'Architecture',
    degrees: {
      1: { nouns: ['threshold', 'beam', 'wall', 'arch', 'foundation'], verbs: ['frame', 'brace', 'anchor', 'build on'], modifiers: ['load-bearing', 'structural', 'sound', 'level'] },
      2: { nouns: ['cantilever', 'facade', 'joist', 'footing', 'lintel'], verbs: ['shore up', 'underpin', 'buttress'], modifiers: ['freestanding', 'condemned', 'plumb', 'vaulted'] },
      3: { nouns: ['spandrel', 'vault', 'shear', 'cornice'], verbs: ['cantilever', 'retrofit'], modifiers: ['brutalist', 'trabeated', 'unreinforced'] }
    },
    gradient: ['idea', 'sketch', 'plan', 'draft', 'schematic', 'blueprint'],
    cliches: [
      { worn: 'built on a solid foundation', fresh: 'footings poured deep' },
      { worn: 'the walls closing in', fresh: 'the room losing its plumb' },
      { worn: 'hit the ceiling', fresh: 'crack the lintel' },
      { worn: 'a bridge too far', fresh: 'a span past its load rating' }
    ],
    substitutions: { plan: 'blueprint', conflict: 'shear', agreement: 'true plumb', turning: 'the keystone', ending: 'the capstone' },
    metaphor: 'the marriage a cantilever, all its weight on one hidden beam',
    sample: 'The doorway held them, a threshold neither of them would load.'
  })
];

export function builtInLexicalGravityLenses(): WorkshopLexicalGravityLens[] {
  return BUILT_IN_LENSES.map(cloneLexicalGravityLens);
}

export function builtInLexicalGravityLens(
  slug: string
): WorkshopLexicalGravityLens | undefined {
  const found = BUILT_IN_LENSES.find((candidate) => candidate.slug === slug);
  return found ? cloneLexicalGravityLens(found) : undefined;
}

/** Stable project filename component; empty means the lookup has no usable name. */
export function lexicalGravityLensSlug(
  value: string,
  maximumCharacters = PROMPT_BUDGETS.workshopWidgets.lexicalLensSlugCharacters
): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maximumCharacters)
    .replace(/-+$/g, '');
}

/** Compose a subject + variant filename while preserving both within the shared bound. */
export function composeLexicalGravityLensSlug(subject: string, variant: string): string {
  const maximum = PROMPT_BUDGETS.workshopWidgets.lexicalLensSlugCharacters;
  const variantMaximum = Math.floor((maximum - 1) / 2);
  const variantSlug = lexicalGravityLensSlug(variant, variantMaximum);
  if (!variantSlug) {return lexicalGravityLensSlug(subject);}
  const subjectSlug = lexicalGravityLensSlug(subject, maximum - variantSlug.length - 1);
  return `${subjectSlug}-${variantSlug}`;
}
