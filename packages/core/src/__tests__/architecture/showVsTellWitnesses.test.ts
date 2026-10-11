import * as fs from 'fs';
import * as path from 'path';
import * as vocabulary from '@shared/constants/narrativeHandlingVocabulary';

/**
 * Sprint 05, Slice 6 closing witnesses for Show vs. Tell (deliverable 7).
 *
 *  (a) One shared five-position → three-lever mapping, owned by
 *      `narrativeHandlingVocabulary.ts` and imported, never restated.
 *  (b) Static independence from Lexical Gravity's application gear and
 *      evidence mode, and from the standing-directive family that carries them.
 *      The behavioral half lives in the Workshop route and opening-hook suites.
 *  (c) Complements Prose Controller without shared state: the vocabulary module
 *      is frozen data and types, and Show vs. Tell holds no Controller state.
 *
 * `boundaries.test.ts` already guards sibling-feature imports and the
 * descriptor floor; this file adds the vocabulary and gear/evidence witnesses
 * that are specific to this feature.
 */

const SRC_ROOT = path.resolve(__dirname, '..', '..');
const REPOSITORY_ROOT = path.resolve(SRC_ROOT, '..', '..', '..');
const VOCABULARY_FILE = path.join(SRC_ROOT, 'shared', 'constants', 'narrativeHandlingVocabulary.ts');
const VOCABULARY_SPECIFIER = '@shared/constants/narrativeHandlingVocabulary';
const SPRINT_04_DOC = path.join(
  REPOSITORY_ROOT,
  '.todo/epics/epic-conversation-widgets-2026-07-22/sprints/04-prose-controller.md'
);

const SOURCE_EXTENSION = /\.tsx?$/;
const TESTS_DIR = path.join(SRC_ROOT, '__tests__');

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full !== TESTS_DIR) {
        collectSourceFiles(full, acc);
      }
    } else if (entry.isFile() && SOURCE_EXTENSION.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Comments may describe the independence; code may not depend on it. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

const IMPORT_STATEMENT =
  /(?:import|export)\s+(?:type\s+)?(?:[\w$*{},\s]+?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;

function moduleSpecifiers(source: string): string[] {
  return [...stripComments(source).matchAll(IMPORT_STATEMENT)]
    .map((match) => match[1] ?? match[2] ?? match[3]);
}

const relative = (file: string): string => path.relative(SRC_ROOT, file);
const read = (file: string): string => fs.readFileSync(file, 'utf8');

const ALL_SOURCE = collectSourceFiles(SRC_ROOT);
const SHOW_VS_TELL_SOURCE = ALL_SOURCE.filter((file) => /ShowVsTell/i.test(relative(file)));

/**
 * Lexical Gravity's own modules plus the standing-directive family that
 * carries its gear (`applicationMode`) and evidence mode.
 */
const LEXICAL_AND_STANDING_SOURCE = ALL_SOURCE.filter((file) =>
  /LexicalGravity|lexicalGravity|StandingDirective|standingDirective|\/directives\//
    .test(`/${relative(file)}`)
);

const GEAR_AND_EVIDENCE_MODE_TOKEN =
  /(?:applicationMode|ApplicationMode|APPLICATION_MODES?\b|evidenceMode|EvidenceMode|EVIDENCE_MODES?\b)|\b(?:\w*LexicalGravity\w*|LEXICAL_GRAVITY_\w+|\w*StandingDirective\w*|\w*standingDirective\w*|STANDING_DIRECTIVE\w*)\b/;

const LEXICAL_OR_STANDING_SPECIFIER =
  /LexicalGravity|lexicalGravity|lexical-gravity|StandingDirective|standingDirective|\/directives\//;
const SHOW_VS_TELL_SPECIFIER = /ShowVsTell|showVsTell|show-vs-tell/;
const PROSE_CONTROLLER_TOKEN =
  /\b(?:ProseController|proseController|PROSE_CONTROLLER|prose-controller|useProseController)\w*\b/;

/** The shared lever values and the position → lever association. */
const LEVER_VALUE_LITERAL = /['"`](?:summary-allowed|scene-only)['"`]/;
const POSITION_TO_LEVER_ASSOCIATION =
  /\b(?:state-it|summarize|hinge|evidence|inhabit)['"`]?\s*(?::|=>|,)\s*['"`](?:summary-allowed|mixed|scene-only)['"`]/;

const declaresPositionLeverMapping = (source: string): boolean => {
  const code = stripComments(source);
  return LEVER_VALUE_LITERAL.test(code) || POSITION_TO_LEVER_ASSOCIATION.test(code);
};

describe('Show vs. Tell closing witnesses — inventory', () => {
  it('finds the Show vs. Tell and Lexical/standing-directive module sets (the scans are not vacuous)', () => {
    expect(SHOW_VS_TELL_SOURCE.length).toBeGreaterThanOrEqual(28);
    expect(LEXICAL_AND_STANDING_SOURCE.length).toBeGreaterThanOrEqual(15);
    expect(SHOW_VS_TELL_SOURCE.map(relative)).toEqual(expect.arrayContaining([
      expect.stringMatching(/ShowVsTellReadout\.tsx$/),
      expect.stringMatching(/ShowVsTellConfigCodec\.ts$/)
    ]));
    expect(LEXICAL_AND_STANDING_SOURCE.map(relative)).toEqual(expect.arrayContaining([
      expect.stringMatching(/LexicalGravityConfigCodec\.ts$/),
      expect.stringMatching(/WorkshopStandingDirectiveService\.ts$/)
    ]));
  });
});

describe('Show vs. Tell closing witnesses — (a) one shared mapping', () => {
  it('has the readout read the mapping and labels from the shared module', () => {
    const readout = SHOW_VS_TELL_SOURCE.find((file) => /ShowVsTellReadout\.tsx$/.test(file))!;
    const source = stripComments(read(readout));

    expect(moduleSpecifiers(source)).toContain(VOCABULARY_SPECIFIER);
    expect(source).toMatch(/NARRATIVE_HANDLING_SHOW_TELL_BY_POSITION\s*\[/);
    expect(source).toMatch(/NARRATIVE_HANDLING_SHOW_TELL_LABELS\s*\[/);
    expect(declaresPositionLeverMapping(source)).toBe(false);
  });

  it('imports the vocabulary from its one module wherever any source uses a shared name', () => {
    const consumers = ALL_SOURCE
      .filter((file) => file !== VOCABULARY_FILE)
      .filter((file) => /NARRATIVE_HANDLING_|NarrativeHandling/.test(stripComments(read(file))));

    expect(consumers.length).toBeGreaterThan(0);
    const offenders = consumers
      .filter((file) => !moduleSpecifiers(read(file)).includes(VOCABULARY_SPECIFIER))
      .map(relative);
    expect(offenders).toEqual([]);
  });

  it('lets no file outside the vocabulary module declare the five → three mapping', () => {
    const offenders = ALL_SOURCE
      .filter((file) => file !== VOCABULARY_FILE)
      .filter((file) => declaresPositionLeverMapping(read(file)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('keeps the mapping scan honest against a restated mapping', () => {
    expect(declaresPositionLeverMapping("const M = { hinge: 'mixed', inhabit: 'scene-only' };"))
      .toBe(true);
    expect(declaresPositionLeverMapping("const levers = ['summary-allowed', 'mixed'];"))
      .toBe(true);
    expect(declaresPositionLeverMapping("// hinge: 'mixed' is documented, not declared"))
      .toBe(false);
    expect(declaresPositionLeverMapping("const position = 'hinge'; const label = 'mixed';"))
      .toBe(false);
  });

  it('records Sprint 04 as adopting the shared constant by its module path', () => {
    const doc = read(SPRINT_04_DOC);
    const modulePath = 'packages/core/src/shared/constants/narrativeHandlingVocabulary.ts';

    expect(doc).toContain(modulePath);
    expect(doc).toMatch(/must not redeclare the values or the mapping/);
    expect(fs.existsSync(path.join(REPOSITORY_ROOT, modulePath))).toBe(true);
    expect(path.join(REPOSITORY_ROOT, modulePath)).toBe(VOCABULARY_FILE);
  });
});

describe('Show vs. Tell closing witnesses — (b) independence from Lexical Gravity gear and evidence mode', () => {
  it('has no Show vs. Tell module import or reference the standing-directive family, the gear, or evidence mode', () => {
    const importOffenders = SHOW_VS_TELL_SOURCE.flatMap((file) =>
      moduleSpecifiers(read(file))
        .filter((specifier) => LEXICAL_OR_STANDING_SPECIFIER.test(specifier))
        .map((specifier) => `${relative(file)} imports ${specifier}`)
    );
    const tokenOffenders = SHOW_VS_TELL_SOURCE
      .filter((file) => GEAR_AND_EVIDENCE_MODE_TOKEN.test(stripComments(read(file))))
      .map((file) => `${relative(file)} names ${
        stripComments(read(file)).match(GEAR_AND_EVIDENCE_MODE_TOKEN)![0]
      }`);

    expect([...importOffenders, ...tokenOffenders]).toEqual([]);
  });

  it('has no Lexical Gravity or standing-directive module import or reference Show vs. Tell', () => {
    const offenders = LEXICAL_AND_STANDING_SOURCE.flatMap((file) => {
      const code = stripComments(read(file));
      const imports = moduleSpecifiers(code)
        .filter((specifier) => SHOW_VS_TELL_SPECIFIER.test(specifier))
        .map((specifier) => `${relative(file)} imports ${specifier}`);
      const names = SHOW_VS_TELL_SPECIFIER.test(code) ? [`${relative(file)} names Show vs. Tell`] : [];
      return [...imports, ...names];
    });

    expect(offenders).toEqual([]);
  });

  it('keeps the gear/evidence scan honest against a dependent module', () => {
    expect(GEAR_AND_EVIDENCE_MODE_TOKEN.test('const g = draft.applicationMode;')).toBe(true);
    expect(GEAR_AND_EVIDENCE_MODE_TOKEN.test('setEvidenceMode(next)')).toBe(true);
    expect(GEAR_AND_EVIDENCE_MODE_TOKEN.test('type X = WorkshopLexicalGravityEvidenceMode;')).toBe(true);
    expect(GEAR_AND_EVIDENCE_MODE_TOKEN.test('uses draft.evidenceMode')).toBe(true);
    expect(LEXICAL_OR_STANDING_SPECIFIER.test('@/application/services/workshop/directives/Foo')).toBe(true);
    // Show vs. Tell's own "evidence" vocabulary is unrelated and stays legal.
    expect(GEAR_AND_EVIDENCE_MODE_TOKEN.test("position: 'evidence'; channel: 'sensory-evidence'"))
      .toBe(false);
  });
});

describe('Show vs. Tell closing witnesses — (c) complements Prose Controller without shared state', () => {
  const VALUE_EXPORTS = [
    'NARRATIVE_HANDLING_POSITIONS',
    'NARRATIVE_HANDLING_SHOW_TELL_BY_POSITION',
    'NARRATIVE_HANDLING_SHOW_TELL_LABELS',
    'NARRATIVE_HANDLING_SHOW_TELL_VALUES'
  ];

  const deeplyFrozen = (value: unknown): boolean =>
    typeof value !== 'object' || value === null
      || (Object.isFrozen(value) && Object.values(value).every(deeplyFrozen));

  it('exports exactly the four frozen data tables and no function or state', () => {
    const exported = vocabulary as Record<string, unknown>;

    expect(Object.keys(exported).sort()).toEqual([...VALUE_EXPORTS].sort());
    for (const name of VALUE_EXPORTS) {
      expect(typeof exported[name]).toBe('object');
      expect(deeplyFrozen(exported[name])).toBe(true);
    }
    expect(Object.values(exported).some((value) => typeof value === 'function')).toBe(false);
  });

  it('declares only const exports and types, imports nothing, and mutates nothing', () => {
    const code = stripComments(read(VOCABULARY_FILE));

    expect(moduleSpecifiers(code)).toEqual([]);
    const exportLines = code.split('\n').filter((line) => /^export\b/.test(line));
    expect(exportLines.length).toBeGreaterThan(0);
    expect(exportLines.filter((line) => !/^export (?:const|type) /.test(line))).toEqual([]);
    expect(code).not.toMatch(/\b(?:let|var|class|function|async|await|new)\b|=>/);
    expect(code).not.toMatch(/\b(?:push|splice|assign|defineProperty|setItem|localStorage|process|window)\b/);
  });

  it('holds no Prose Controller state in any Show vs. Tell module', () => {
    const offenders = SHOW_VS_TELL_SOURCE
      .filter((file) => PROSE_CONTROLLER_TOKEN.test(stripComments(read(file))))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('lets no Prose Controller module (once built) import Show vs. Tell, only the vocabulary', () => {
    const controllerSource = ALL_SOURCE.filter((file) =>
      /ProseController|proseController|prose-controller/.test(relative(file))
    );
    const offenders = controllerSource.flatMap((file) =>
      moduleSpecifiers(read(file))
        .filter((specifier) => SHOW_VS_TELL_SPECIFIER.test(specifier))
        .map((specifier) => `${relative(file)} imports ${specifier}`)
    );

    expect(offenders).toEqual([]);
  });
});
