/**
 * Guard: WORD_SEARCH_DEFAULTS must equal package.json's contributed defaults.
 *
 * package.json can't import the TS constant, so the constant documents that the
 * two are kept in sync "by hand" (review #4). This turns that hand-sync chore
 * into a CI failure: edit one without the other and this test goes red.
 */

import * as fs from 'fs';
import * as path from 'path';
import { WORD_SEARCH_DEFAULTS } from '@shared/constants/wordSearchDefaults';

describe('WORD_SEARCH_DEFAULTS ↔ package.json contributed defaults', () => {
  it('matches the proseMinion.wordSearch.* defaults in package.json', () => {
    const pkgPath = path.resolve(__dirname, '..', '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const props = pkg?.contributes?.configuration?.properties ?? {};

    const contributed = {
      contextWords: props['proseMinion.wordSearch.contextWords']?.default,
      clusterWindow: props['proseMinion.wordSearch.clusterWindow']?.default,
      minClusterSize: props['proseMinion.wordSearch.minClusterSize']?.default,
      caseSensitive: props['proseMinion.wordSearch.caseSensitive']?.default,
      enableAssistantExpansion: props['proseMinion.wordSearch.enableAssistantExpansion']?.default,
    };

    expect(contributed).toEqual(WORD_SEARCH_DEFAULTS);
  });
});
