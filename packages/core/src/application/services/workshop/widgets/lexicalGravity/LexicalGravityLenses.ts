import {
  LEXICAL_GRAVITY_LENS_VERSION,
  WorkshopLexicalGravityLens
} from '@messages';
import { cloneLexicalGravityLens } from './LexicalGravityConfigCodec';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const lens = (
  value: Omit<WorkshopLexicalGravityLens, 'version' | 'source'>
): WorkshopLexicalGravityLens => ({
  version: LEXICAL_GRAVITY_LENS_VERSION,
  source: 'built-in',
  ...value
});

/** The six approved Spread 02 starter fields. */
const BUILT_IN_LENSES: readonly WorkshopLexicalGravityLens[] = [
  lens({
    slug: 'photography', name: 'Photography',
    description: 'Interprets perception through selection, exposure, latent traces, and durable records.',
    logic: {
      premise: 'Perception is selective record-making: what is framed and exposed becomes evidence, while what falls outside the frame still shapes truth by its absence.',
      attention: {
        foregrounds: ['what an observer selects from a larger field', 'boundaries that include one fact and exclude another', 'changes in visibility, legibility, and exposure', 'traces that can become evidence or memory'],
        backgrounds: ['the fantasy of a complete and neutral view', 'detail that does not alter selection or interpretation', 'visual decoration without an observer or consequence']
      },
      axes: [
        { id: 'visibility', name: 'Visibility', poles: ['concealed', 'exposed'] },
        { id: 'selection', name: 'Selection', poles: ['outside the frame', 'inside the frame'] },
        { id: 'record-state', name: 'Record state', poles: ['fleeting impression', 'fixed record'] }
      ],
      roles: [
        { id: 'observer', name: 'Observer', description: 'The perceiver whose position and choices determine what can be seen.' },
        { id: 'subject', name: 'Subject', description: 'The person, object, or truth placed under attention and made available to interpretation.' },
        { id: 'frame', name: 'Frame', description: 'The boundary that grants relevance to what it includes and obscures what it excludes.' },
        { id: 'record', name: 'Record', description: 'The durable impression left after a transient perception has been selected and fixed.' }
      ],
      dynamics: [
        { id: 'focus', operation: 'Focus', movement: 'diffuse field -> selected subject', entailment: 'The selected detail gains explanatory weight while competing details lose immediate authority.', narrativeAffordance: 'Creates a question about why this detail was selected and what the observer refuses to see.' },
        { id: 'expose', operation: 'Expose', movement: 'latent or protected truth -> visible evidence', entailment: 'Once a truth is legible, ignorance becomes harder to claim and response becomes more obligatory.', narrativeAffordance: 'Stores pressure between what is now known and what a character is willing to acknowledge.' },
        { id: 'crop', operation: 'Crop', movement: 'context-rich field -> bounded account', entailment: 'The account becomes clearer but less complete; excluded context may challenge its fairness.', narrativeAffordance: 'Creates asymmetry between a persuasive image and the larger truth around it.' },
        { id: 'fix-record', operation: 'Fix the record', movement: 'transient impression -> durable memory', entailment: 'A passing act becomes part of how the relationship will be interpreted later.', narrativeAffordance: 'Makes repair answerable to remembered injury instead of allowing the moment to evaporate.' }
      ],
      guardrails: ['Do not treat the observer as neutral; framing is always selection.', 'Do not invent a camera, photograph, or visual fact absent from the passage.', 'Do not equate concealment with guilt or exposure with moral truth.', 'Prefer consequences of attention and record-making over decorative light imagery.']
    },
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
    description: 'Interprets relationship through patterned time, countervoice, interruption, resonance, and resolution.',
    logic: {
      premise: 'Meaning unfolds in time: voices establish patterns, answer or interrupt one another, create expectations, and make silence active whenever resolution is delayed.',
      attention: {
        foregrounds: ['timing between action and response', 'repetition, variation, and broken patterns', 'how separate voices support, compete with, or interrupt one another', 'silence and delay as active parts of an exchange'],
        backgrounds: ['isolated statements detached from their sequence', 'silence treated as empty space', 'emotional intensity without rhythm, expectation, or response']
      },
      axes: [
        { id: 'relation', name: 'Voice relation', poles: ['consonance', 'dissonance'] },
        { id: 'time', name: 'Temporal pressure', poles: ['pulse', 'suspension'] },
        { id: 'closure', name: 'Closure', poles: ['unresolved', 'resolved'] }
      ],
      roles: [
        { id: 'voice', name: 'Voice', description: 'A character, desire, or claim that establishes a distinct line in the exchange.' },
        { id: 'countervoice', name: 'Countervoice', description: 'A responding line whose agreement, resistance, or independence changes the first.' },
        { id: 'pulse', name: 'Pulse', description: 'The established timing or pattern against which changes become perceptible.' },
        { id: 'rest', name: 'Rest', description: 'A bounded absence of response that holds expectation rather than erasing it.' }
      ],
      dynamics: [
        { id: 'syncopate', operation: 'Syncopate', movement: 'expected response -> displaced or interrupted response', entailment: 'The established pattern can no longer predict what comes next.', narrativeAffordance: 'Creates instability by making a familiar relationship miss its expected beat.' },
        { id: 'modulate', operation: 'Modulate', movement: 'established tonal center -> new tonal center', entailment: 'Earlier words remain present but acquire a different emotional meaning under the new relation.', narrativeAffordance: 'Turns a familiar exchange into a new kind of conversation whose rules are unsettled.' },
        { id: 'introduce-dissonance', operation: 'Introduce dissonance', movement: 'compatible voices -> strained interval', entailment: 'The voices coexist, but their relation now produces pressure that asks for continuation or resolution.', narrativeAffordance: 'Stores energy in a disagreement that silence or forward motion has not answered.' },
        { id: 'hold-rest', operation: 'Hold the rest', movement: 'active exchange -> charged silence', entailment: 'The missing response becomes meaningful, leaving the initiating voice exposed inside the pause.', narrativeAffordance: 'Makes withheld reply an unresolved event that changes the next permissible beat.' }
      ],
      guardrails: ['Do not make every exchange harmonious; dissonance can be structurally honest.', 'Do not invent audible music, instruments, or performance absent from the passage.', 'Do not treat silence as consent, forgiveness, or emotional emptiness.', 'Prefer timing and relation among voices over ornamental sound vocabulary.']
    },
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
    description: 'Interprets situations through relation, proof, constraint, remainder, convergence, and contradiction.',
    logic: {
      premise: 'Meaning emerges from relations under constraints: an assertion has consequences, exceptions leave remainders, and a contradiction can invalidate the structure that contains it.',
      attention: {
        foregrounds: ['relations among quantities, claims, and constraints', 'what remains after an apparent solution', 'assumptions that make a conclusion possible', 'movement toward convergence, divergence, or contradiction'],
        backgrounds: ['numbers used as decoration without a relation', 'certainty unsupported by premises', 'complexity that does not alter the governing constraint']
      },
      axes: [
        { id: 'certainty', name: 'Certainty', poles: ['conjecture', 'proof'] },
        { id: 'relation', name: 'Relation', poles: ['independent', 'dependent'] },
        { id: 'fit', name: 'Fit', poles: ['contradictory', 'consistent'] }
      ],
      roles: [
        { id: 'given', name: 'Given', description: 'A fact or condition treated as the starting constraint.' },
        { id: 'unknown', name: 'Unknown', description: 'The person, motive, or outcome whose value remains unsettled.' },
        { id: 'operator', name: 'Operator', description: 'The action or pressure that changes a relation.' },
        { id: 'remainder', name: 'Remainder', description: 'What the attempted solution fails to absorb or explain.' }
      ],
      dynamics: [
        { id: 'derive', operation: 'Derive', movement: 'accepted premise -> unavoidable implication', entailment: 'Accepting the premise commits a character to consequences they may not welcome.', narrativeAffordance: 'Creates obligation by making denial inconsistent with what has already been accepted.' },
        { id: 'cancel', operation: 'Cancel', movement: 'opposed terms -> apparent removal', entailment: 'The visible conflict disappears, but only if the terms were truly equivalent.', narrativeAffordance: 'Leaves doubt about whether a neat resolution concealed an unequal cost.' },
        { id: 'converge', operation: 'Converge', movement: 'separate trajectories -> shared limit', entailment: 'Different paths increasingly constrain one another even before they meet.', narrativeAffordance: 'Builds inevitability without requiring immediate contact or resolution.' },
        { id: 'expose-remainder', operation: 'Expose the remainder', movement: 'complete-looking solution -> unresolved residue', entailment: 'The account cannot close while the leftover fact remains unexplained.', narrativeAffordance: 'Stores pressure in the exception that disproves a character\'s preferred solution.' }
      ],
      guardrails: ['Do not equate mathematical precision with emotional truth.', 'Do not invent quantities or calculations absent from the passage.', 'Do not use proof language to erase uncertainty the scene preserves.', 'Prefer relations and constraints over conspicuous equation imagery.']
    },
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
    description: 'Interprets scenes through pressure, fronts, accumulation, exposure, and changes that arrive before they are named.',
    logic: {
      premise: 'Conditions accumulate across a shared atmosphere: pressure changes precede visible events, fronts bring unlike states into contact, and every shelter distributes exposure unevenly.',
      attention: {
        foregrounds: ['subtle changes that announce a larger shift', 'pressure shared across people in one environment', 'boundaries where unlike conditions meet', 'who is exposed, sheltered, or forced to adapt'],
        backgrounds: ['weather as mood decoration without causal pressure', 'isolated feeling detached from the shared atmosphere', 'catastrophe unsupported by accumulating conditions']
      },
      axes: [
        { id: 'pressure', name: 'Pressure', poles: ['rising', 'releasing'] },
        { id: 'visibility', name: 'Visibility', poles: ['obscured', 'clear'] },
        { id: 'exposure', name: 'Exposure', poles: ['sheltered', 'exposed'] }
      ],
      roles: [
        { id: 'front', name: 'Front', description: 'The moving boundary where incompatible conditions meet.' },
        { id: 'barometer', name: 'Barometer', description: 'The person or detail that registers change before others name it.' },
        { id: 'shelter', name: 'Shelter', description: 'A protection that reduces exposure but may also limit perception or escape.' },
        { id: 'atmosphere', name: 'Atmosphere', description: 'The shared condition affecting everyone present, though not equally.' }
      ],
      dynamics: [
        { id: 'build-pressure', operation: 'Build pressure', movement: 'stable conditions -> accumulating strain', entailment: 'The absence of release makes a later break more likely and more consequential.', narrativeAffordance: 'Stores energy before any character chooses to name the conflict.' },
        { id: 'front-arrives', operation: 'Bring in a front', movement: 'separate conditions -> active boundary contact', entailment: 'Neither prior state can continue unchanged once the boundary reaches it.', narrativeAffordance: 'Makes encounter consequential without predetermining which condition will dominate.' },
        { id: 'break', operation: 'Break', movement: 'contained pressure -> visible event', entailment: 'What had been ambient becomes undeniable and demands adaptation.', narrativeAffordance: 'Converts background tension into an event whose effects may outlast its duration.' },
        { id: 'clear', operation: 'Clear', movement: 'obscured field -> altered visibility', entailment: 'New visibility reveals what the prior conditions hid, but does not undo what happened within them.', narrativeAffordance: 'Creates retrospective consequence as characters reassess actions taken under cover.' }
      ],
      guardrails: ['Do not invent literal weather or environmental facts absent from the passage.', 'Do not turn every emotion into a storm.', 'Do not assume clearing means repair or moral resolution.', 'Prefer pressure and shared conditions over decorative atmosphere.']
    },
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
    description: 'Interprets scenes through growth conditions, attachment, inheritance, pruning, dormancy, and propagation.',
    logic: {
      premise: 'Growth is relational and conditional: roots bind life to a medium, inheritance shapes possibility, and tending or pruning redirects what will consume future resources.',
      attention: {
        foregrounds: ['conditions that enable or stunt growth', 'hidden attachments and sources of nourishment', 'what spreads beyond its original boundary', 'cuts, grafts, and care that redirect future form'],
        backgrounds: ['growth treated as automatically good', 'natural imagery without material conditions', 'individual will detached from inheritance and environment']
      },
      axes: [
        { id: 'growth-state', name: 'Growth state', poles: ['dormant', 'active'] },
        { id: 'belonging', name: 'Belonging', poles: ['rootless', 'rooted'] },
        { id: 'spread', name: 'Spread', poles: ['contained', 'invasive'] }
      ],
      roles: [
        { id: 'rootstock', name: 'Rootstock', description: 'The inherited structure that supplies resilience, limits, and continuity.' },
        { id: 'growth', name: 'Growth', description: 'The emerging desire, relationship, or consequence competing for resources.' },
        { id: 'gardener', name: 'Gardener', description: 'The actor whose care or intervention redirects development.' },
        { id: 'medium', name: 'Medium', description: 'The environment that nourishes, constrains, or poisons what tries to grow.' }
      ],
      dynamics: [
        { id: 'take-root', operation: 'Take root', movement: 'temporary contact -> sustaining attachment', entailment: 'Removal now carries cost because the relationship has begun drawing support from its place.', narrativeAffordance: 'Turns a passing presence into a claim on future attention and resources.' },
        { id: 'graft', operation: 'Graft', movement: 'separate growth -> joined living structure', entailment: 'The joined parts must negotiate compatibility while carrying distinct histories.', narrativeAffordance: 'Creates mutual dependence without pretending that joining erases difference.' },
        { id: 'prune', operation: 'Prune', movement: 'possible growth -> deliberate removal', entailment: 'Resources are redirected, but the cut records which future was refused.', narrativeAffordance: 'Stores consequence in an absence whose purpose may later be challenged.' },
        { id: 'go-to-seed', operation: 'Go to seed', movement: 'contained form -> dispersed future possibility', entailment: 'What seemed finished can reproduce beyond the original actor\'s control.', narrativeAffordance: 'Lets an action propagate into later scenes without requiring immediate payoff.' }
      ],
      guardrails: ['Do not imply that natural growth is morally correct or inevitable.', 'Do not invent plants, gardens, or biological facts absent from the passage.', 'Do not confuse pruning with harmlessness; every cut removes a possibility.', 'Prefer conditions and propagation over decorative floral language.']
    },
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
    description: 'Interprets scenes through thresholds, loads, support, enclosure, access, and structural failure.',
    logic: {
      premise: 'Every structure distributes weight and access: visible surfaces depend on hidden supports, thresholds regulate passage, and damage reveals which elements were carrying more than they showed.',
      attention: {
        foregrounds: ['what bears weight for the whole arrangement', 'thresholds that permit or deny access', 'visible surfaces versus hidden supports', 'stress, deformation, and signs of structural failure'],
        backgrounds: ['buildings used as decoration without structural relation', 'support assumed to be infinite or costless', 'boundaries treated as passive scenery']
      },
      axes: [
        { id: 'integrity', name: 'Integrity', poles: ['failing', 'sound'] },
        { id: 'access', name: 'Access', poles: ['barred', 'open'] },
        { id: 'load', name: 'Load', poles: ['unsupported', 'supported'] }
      ],
      roles: [
        { id: 'foundation', name: 'Foundation', description: 'The prior commitment or condition on which the visible arrangement depends.' },
        { id: 'load-bearing-member', name: 'Load-bearing member', description: 'The person or promise carrying disproportionate weight for the whole.' },
        { id: 'threshold', name: 'Threshold', description: 'The boundary where passage becomes permission, refusal, or change.' },
        { id: 'facade', name: 'Facade', description: 'The visible account that may reveal or conceal the supporting structure.' }
      ],
      dynamics: [
        { id: 'transfer-load', operation: 'Transfer load', movement: 'one support -> another support', entailment: 'Relief for one member becomes new obligation or strain for another.', narrativeAffordance: 'Creates asymmetry by showing who must carry the consequence of someone else\'s release.' },
        { id: 'cross-threshold', operation: 'Cross the threshold', movement: 'outside condition -> admitted interior', entailment: 'Entry changes both access and responsibility; returning to the prior boundary is no longer neutral.', narrativeAffordance: 'Makes permission or disclosure consequential even before its result is known.' },
        { id: 'expose-support', operation: 'Expose the support', movement: 'finished surface -> visible structure', entailment: 'The arrangement can no longer hide who or what has been carrying it.', narrativeAffordance: 'Creates obligation toward an overlooked support and instability if it withdraws.' },
        { id: 'propagate-crack', operation: 'Propagate a crack', movement: 'local damage -> structural path', entailment: 'A small failure becomes evidence of stress elsewhere in the system.', narrativeAffordance: 'Stores future danger in a flaw that remains present even when the scene moves on.' }
      ],
      guardrails: ['Do not invent literal buildings or construction facts absent from the passage.', 'Do not confuse enclosure with safety or openness with virtue.', 'Do not make one person responsible for supporting an entire relationship by default.', 'Prefer load, access, and structural consequence over ornamental building language.']
    },
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
