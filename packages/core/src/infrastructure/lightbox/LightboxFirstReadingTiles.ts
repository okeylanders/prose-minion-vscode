/**
 * From Slice 2B's decoded blocks to board tiles (ADR 2026-10-19 D3, D7):
 * the headline, motifs, the tension arc, characters, voice and the genre
 * neighborhood. Pure: no host, no I/O. Called by `LightboxReadingTiles`
 * through its claim assembler, so every claim meets the same rules as
 * every other reading: quotes checked against the paragraph they name, a
 * claim with none withheld by title, its kind's gate (`LightboxTileGates`)
 * applied as stale carry applies it, ids minted per run. Split from the
 * assembler (Slice 4C) so each module stays within its size; unchanged.
 */

import type { LightboxClaimAssembler } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { lightboxMeasuredMusic } from '@/infrastructure/lightbox/LightboxTileCounts';
import { LIGHTBOX_VOICE_TRAITS, type LightboxDecodedBlock } from '@/infrastructure/lightbox/LightboxReadingWire';

export type LightboxFirstReadingBlock = Extract<
  LightboxDecodedBlock,
  { lens: 'headline' | 'motif' | 'tension' | 'characters' | 'voice' | 'genre' }
>;

export function assembleFirstReadingBlock(block: LightboxFirstReadingBlock, assembler: LightboxClaimAssembler): void {
  switch (block.lens) {
    case 'headline':
      assembler.claim(
        { kind: 'headline', lens: 'headline', title: block.sentence, claim: block.sentence,
          quotes: block.evidence, terms: block.terms, friction: block.friction },
        (base) => ({ ...base, kind: 'headline' })
      );
      return;
    case 'motif':
      assembler.malformed('motif', 'motif', block.malformed);
      for (const motif of block.items) {
        assembler.claim(
          { kind: 'motif', lens: 'motif', title: motif.title, claim: motif.claim, quotes: motif.evidence,
            terms: motif.terms, friction: block.friction },
          (base) => ({ ...base, kind: 'motif', gist: motif.gist })
        );
      }
      return;
    case 'tension':
      assembler.claim(
        { kind: 'tension-arc', lens: 'tension', title: 'Tension arc', claim: block.claim, quotes: block.peaks,
          terms: [], friction: block.friction },
        (base) => ({ ...base, kind: 'tension-arc', scores: [...block.scores], columnKeys: [...(assembler.context.columnKeys ?? [])] })
      );
      return;
    case 'characters':
      assembler.malformed('character', 'characters', block.malformed);
      for (const character of block.items) {
        assembler.claim(
          { kind: 'character', lens: 'characters', title: character.name, claim: character.claim,
            quotes: character.evidence, terms: [character.name, ...character.aliases], friction: block.friction },
          (base) => ({
            ...base,
            kind: 'character',
            archetype: character.archetype,
            energy: character.energy,
            wants: character.wants,
            hides: character.hides
          })
        );
      }
      return;
    case 'voice': {
      const average = assembler.context.averageWordsPerSentence;
      assembler.claim(
        { kind: 'voice', lens: 'voice', title: 'Narrative voice', claim: block.claim, quotes: block.evidence,
          terms: [], friction: block.friction },
        (base) => ({
          ...base,
          kind: 'voice',
          traits: block.traits.map(({ key, value }) => ({
            label: LIGHTBOX_VOICE_TRAITS.find(([candidate]) => candidate === key)?.[1] ?? key,
            value,
            ...(key === 'music' ? lightboxMeasuredMusic(average) : {})
          }))
        })
      );
      return;
    }
    case 'genre':
      assembler.malformed('genre-neighbor', 'genre', block.malformed);
      for (const neighbor of block.neighbors) {
        assembler.claim(
          { kind: 'genre-neighbor', lens: 'genre', title: neighbor.genre, claim: neighbor.claim,
            quotes: neighbor.evidence, terms: [], friction: block.friction },
          (base) => ({ ...base, kind: 'genre-neighbor', affinity: neighbor.affinity, nearMiss: neighbor.nearMiss })
        );
      }
      assembler.claim(
        { kind: 'reader-promise', lens: 'genre', title: 'Reader promise', claim: block.promise.text,
          quotes: block.promise.evidence, terms: [], friction: block.friction },
        (base) => ({ ...base, kind: 'reader-promise' })
      );
      return;
  }
}
