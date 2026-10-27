/**
 * Words spelled two ways (Draft Edit Slice 3b, part 3; ADR 2026-10-21,
 * Amendment 2026-10-26): the closed table the consistency check reads. Pure
 * data.
 *
 * Each entry is one word, its two spellings side by side, one pair per
 * inflection, every form written out: the first side is the American
 * spelling where there is one. Where a convention spells it one way, the
 * entry names that side; where a convention takes either (British -ize and
 * -ise, Canadian toward and towards), it names none, and the counts decide.
 *
 * Kept out on purpose: pairs whose forms mean different things somewhere
 * ("any more" and "anymore", "every day" and "everyday", "while" and
 * "whilst", "a while"), past tenses both conventions write (burned and
 * burnt), and spellings American writers use for a sense of their own
 * (theatre, glamour).
 */

import type { ProofreadSpellingConvention } from '@/domain/models/DraftEdit';

/** One word spelled two ways. */
export interface VariantSpelling {
  /** One pair per inflection: [first spelling, second spelling]. The first pair names the sides. */
  readonly forms: readonly (readonly [string, string])[];
  /** The side (0 or 1) each convention spells; absent where it takes either. */
  readonly preferred?: Readonly<Partial<Record<ProofreadSpellingConvention, 0 | 1>>>;
}

/** American spells the first side; British, Canadian and Australian the second (-our, -re, -ll-, grey). */
const AMERICAN_ALONE = Object.freeze({ american: 0, british: 1, canadian: 1, australian: 1 } as const);
/** Canada spells these as America does (-ize, -yze, skeptic, cozy). */
const NORTH_AMERICAN = Object.freeze({ american: 0, canadian: 0, british: 1, australian: 1 } as const);
/** British takes either: Oxford spelling keeps -ize. */
const IZE = Object.freeze({ american: 0, canadian: 0, australian: 1 } as const);
/** Canada takes either. */
const AMERICAN_NOT_CANADIAN = Object.freeze({ american: 0, british: 1, australian: 1 } as const);

/** Pairs a word with its forms, the second spelling made from the first. */
const spelled = (preferred: VariantSpelling['preferred'], ...forms: [string, string][]): VariantSpelling =>
  Object.freeze({ forms: Object.freeze(forms.map((pair) => Object.freeze(pair))), ...(preferred ? { preferred } : {}) });

export const VARIANT_SPELLINGS: readonly VariantSpelling[] = Object.freeze([
  // Either spelling, in every convention.
  spelled(undefined, ['OK', 'okay']),
  spelled(undefined, ['email', 'e-mail'], ['emails', 'e-mails'], ['emailed', 'e-mailed'], ['emailing', 'e-mailing']),
  spelled(undefined, ['all right', 'alright']),
  spelled(AMERICAN_NOT_CANADIAN, ['toward', 'towards']),
  spelled(AMERICAN_NOT_CANADIAN, ['afterward', 'afterwards']),
  spelled({ american: 0 }, ['among', 'amongst']),
  spelled({ american: 0 }, ['amid', 'amidst']),
  spelled(AMERICAN_NOT_CANADIAN, ['judgment', 'judgement'], ['judgments', 'judgements'], ['judgmental', 'judgemental']),
  spelled(AMERICAN_ALONE,
    ['gray', 'grey'], ['grays', 'greys'], ['grayer', 'greyer'], ['grayest', 'greyest'], ['grayish', 'greyish'],
    ['graying', 'greying'], ['grayed', 'greyed'], ['grayness', 'greyness']),
  // -or and -our.
  spelled(AMERICAN_ALONE,
    ['color', 'colour'], ['colors', 'colours'], ['colored', 'coloured'], ['coloring', 'colouring'],
    ['colorful', 'colourful'], ['colorless', 'colourless']),
  spelled(AMERICAN_ALONE,
    ['honor', 'honour'], ['honors', 'honours'], ['honored', 'honoured'], ['honoring', 'honouring'],
    ['honorable', 'honourable'], ['honorably', 'honourably']),
  spelled(AMERICAN_ALONE,
    ['favor', 'favour'], ['favors', 'favours'], ['favored', 'favoured'], ['favoring', 'favouring'],
    ['favorite', 'favourite'], ['favorites', 'favourites'], ['favorable', 'favourable'], ['favorably', 'favourably']),
  spelled(AMERICAN_ALONE,
    ['neighbor', 'neighbour'], ['neighbors', 'neighbours'], ['neighboring', 'neighbouring'],
    ['neighborhood', 'neighbourhood'], ['neighborhoods', 'neighbourhoods'], ['neighborly', 'neighbourly']),
  spelled(AMERICAN_ALONE, ['behavior', 'behaviour'], ['behaviors', 'behaviours'], ['behavioral', 'behavioural']),
  spelled(AMERICAN_ALONE, ['harbor', 'harbour'], ['harbors', 'harbours'], ['harbored', 'harboured'], ['harboring', 'harbouring']),
  spelled(AMERICAN_ALONE,
    ['humor', 'humour'], ['humors', 'humours'], ['humored', 'humoured'], ['humoring', 'humouring'], ['humorless', 'humourless']),
  spelled(AMERICAN_ALONE, ['rumor', 'rumour'], ['rumors', 'rumours'], ['rumored', 'rumoured']),
  spelled(AMERICAN_ALONE, ['odor', 'odour'], ['odors', 'odours'], ['odorless', 'odourless']),
  spelled(AMERICAN_ALONE, ['armor', 'armour'], ['armored', 'armoured'], ['armory', 'armoury'], ['armorer', 'armourer']),
  spelled(AMERICAN_ALONE, ['parlor', 'parlour'], ['parlors', 'parlours']),
  spelled(AMERICAN_ALONE,
    ['flavor', 'flavour'], ['flavors', 'flavours'], ['flavored', 'flavoured'], ['flavoring', 'flavouring'],
    ['flavorful', 'flavourful'], ['flavorless', 'flavourless']),
  spelled(AMERICAN_ALONE,
    ['labor', 'labour'], ['labors', 'labours'], ['labored', 'laboured'], ['laboring', 'labouring'],
    ['laborer', 'labourer'], ['laborers', 'labourers']),
  spelled(AMERICAN_ALONE, ['vapor', 'vapour'], ['vapors', 'vapours']),
  spelled(AMERICAN_ALONE, ['splendor', 'splendour']),
  spelled(AMERICAN_ALONE, ['endeavor', 'endeavour'], ['endeavors', 'endeavours'], ['endeavored', 'endeavoured'], ['endeavoring', 'endeavouring']),
  spelled(AMERICAN_ALONE, ['savor', 'savour'], ['savors', 'savours'], ['savored', 'savoured'], ['savoring', 'savouring'], ['savory', 'savoury']),
  spelled(AMERICAN_ALONE, ['clamor', 'clamour'], ['clamored', 'clamoured'], ['clamoring', 'clamouring']),
  spelled(AMERICAN_ALONE, ['smolder', 'smoulder'], ['smolders', 'smoulders'], ['smoldered', 'smouldered'], ['smoldering', 'smouldering']),
  spelled(AMERICAN_ALONE, ['mold', 'mould'], ['molds', 'moulds'], ['molded', 'moulded'], ['molding', 'moulding'], ['moldy', 'mouldy']),
  // -er and -re.
  spelled(AMERICAN_ALONE, ['center', 'centre'], ['centers', 'centres'], ['centered', 'centred'], ['centering', 'centring']),
  spelled(AMERICAN_ALONE, ['somber', 'sombre'], ['somberly', 'sombrely']),
  spelled(AMERICAN_ALONE, ['fiber', 'fibre'], ['fibers', 'fibres']),
  spelled(AMERICAN_ALONE, ['meager', 'meagre']),
  spelled(AMERICAN_ALONE, ['specter', 'spectre'], ['specters', 'spectres']),
  spelled(AMERICAN_ALONE, ['luster', 'lustre']),
  spelled(AMERICAN_ALONE, ['saber', 'sabre'], ['sabers', 'sabres']),
  // -l- and -ll-.
  spelled(AMERICAN_ALONE, ['traveled', 'travelled'], ['traveling', 'travelling'], ['traveler', 'traveller'], ['travelers', 'travellers']),
  spelled(AMERICAN_ALONE, ['canceled', 'cancelled'], ['canceling', 'cancelling']),
  spelled(AMERICAN_ALONE, ['marveled', 'marvelled'], ['marveling', 'marvelling']),
  spelled(AMERICAN_ALONE, ['quarreled', 'quarrelled'], ['quarreling', 'quarrelling']),
  spelled(AMERICAN_ALONE, ['leveled', 'levelled'], ['leveling', 'levelling']),
  spelled(AMERICAN_ALONE, ['labeled', 'labelled'], ['labeling', 'labelling']),
  spelled(AMERICAN_ALONE, ['signaled', 'signalled'], ['signaling', 'signalling']),
  spelled(AMERICAN_ALONE, ['modeled', 'modelled'], ['modeling', 'modelling']),
  spelled(AMERICAN_ALONE, ['fueled', 'fuelled'], ['fueling', 'fuelling']),
  spelled(AMERICAN_ALONE, ['shriveled', 'shrivelled'], ['shriveling', 'shrivelling']),
  spelled(AMERICAN_ALONE, ['jewelry', 'jewellery'], ['jeweler', 'jeweller'], ['jewelers', 'jewellers']),
  // -ize and -ise, -yze and -yse.
  spelled(IZE, ['realize', 'realise'], ['realizes', 'realises'], ['realized', 'realised'], ['realizing', 'realising'], ['realization', 'realisation']),
  spelled(IZE,
    ['recognize', 'recognise'], ['recognizes', 'recognises'], ['recognized', 'recognised'], ['recognizing', 'recognising'],
    ['recognizable', 'recognisable']),
  spelled(IZE, ['apologize', 'apologise'], ['apologizes', 'apologises'], ['apologized', 'apologised'], ['apologizing', 'apologising']),
  spelled(IZE,
    ['organize', 'organise'], ['organizes', 'organises'], ['organized', 'organised'], ['organizing', 'organising'],
    ['organization', 'organisation']),
  // Never "analyses": it is also the plural of "analysis", in every convention.
  spelled(NORTH_AMERICAN, ['analyze', 'analyse'], ['analyzed', 'analysed'], ['analyzing', 'analysing']),
  spelled(NORTH_AMERICAN, ['paralyze', 'paralyse'], ['paralyzed', 'paralysed'], ['paralyzing', 'paralysing']),
  // Others.
  spelled(NORTH_AMERICAN,
    ['skeptic', 'sceptic'], ['skeptics', 'sceptics'], ['skeptical', 'sceptical'], ['skeptically', 'sceptically'],
    ['skepticism', 'scepticism']),
  spelled(NORTH_AMERICAN, ['cozy', 'cosy'], ['cozier', 'cosier'], ['coziest', 'cosiest'], ['coziness', 'cosiness']),
  spelled(AMERICAN_ALONE, ['pajamas', 'pyjamas']),
  spelled(AMERICAN_ALONE, ['mustache', 'moustache'], ['mustaches', 'moustaches'], ['mustached', 'moustached']),
  spelled(AMERICAN_ALONE, ['plow', 'plough'], ['plows', 'ploughs'], ['plowed', 'ploughed'], ['plowing', 'ploughing']),
  spelled(AMERICAN_ALONE, ['defense', 'defence'], ['defenses', 'defences'], ['defenseless', 'defenceless']),
  spelled(AMERICAN_ALONE, ['offense', 'offence'], ['offenses', 'offences']),
  spelled(AMERICAN_ALONE, ['pretense', 'pretence'], ['pretenses', 'pretences'])
]);
