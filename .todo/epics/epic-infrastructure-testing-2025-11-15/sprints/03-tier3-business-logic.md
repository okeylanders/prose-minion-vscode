# Sprint 03: Tier 3 - Business Logic

**Epic**: [Infrastructure Testing Framework](../epic-infrastructure-testing.md)
**Status**: Pending
**Branch**: `epic/infrastructure-testing-2025-11-15`
**Commit Prefix**: `[Sprint 03]`
**Estimated Effort**: 2-3 days
**ADR**: [ADR-2025-11-15: Lightweight Testing Framework](../../../docs/adr/2025-11-15-lightweight-testing-framework.md)
**Depends On**: Sprint 01 (Infrastructure Patterns), Sprint 02 (Domain Handlers)

---

## Goals

Test critical business logic and algorithms that have high complexity or user impact. Focus on functionality that is easy to break during refactoring and has well-defined inputs/outputs.

**Focus**: Complex algorithms, data transformations, and business rules

---

## Scope

### In Scope
- ✅ Word search clustering algorithm
- ✅ Context window trimming (sentence boundary preservation)
- ✅ Publishing standards comparison logic
- ✅ Word frequency filtering and analysis
- ✅ POS tagging integration (wink-pos-tagger)
- ✅ Prose statistics calculations

### Out of Scope
- ❌ OpenRouter API integration (external dependency - manual testing)
- ❌ VSCode extension activation (requires @vscode/test-electron)
- ❌ UI component testing (Tier 4 - deferred to v1.0)
- ❌ File system operations (integration testing - defer)

---

## Business Logic to Test

### 1. Word Search Clustering Algorithm

**Location**: `src/infrastructure/api/services/search/WordSearchService.ts`

**Complexity**: Clusters word matches based on proximity window

**Why Test**: Core feature, non-trivial algorithm, easy to break with subtle bugs

---

### 2. Context Window Trimming

**Location**: `src/tools/shared/contextWindowHelpers.ts` (or similar)

**Complexity**: Trims prose to word limits while preserving sentence boundaries

**Why Test**: Critical for preventing API errors, subtle edge cases (partial sentences)

---

### 3. Publishing Standards Comparison

**Location**: `src/infrastructure/api/services/resources/StandardsService.ts`, `src/domain/models/PublishingStandardsRepository.ts`

**Complexity**: Loads genre standards, calculates comparisons (averages, ranges)

**Why Test**: Complex data transformations, easy to introduce off-by-one errors

---

### 4. Word Frequency Analysis

**Location**: `src/infrastructure/api/services/measurement/WordFrequencyService.ts`

**Complexity**: Token filtering, POS tagging, bigram/trigram extraction, lemmatization

**Why Test**: Multiple settings-driven branches, offline processing (no API), data-heavy

---

### 5. Prose Statistics Calculations

**Location**: `src/infrastructure/api/services/measurement/ProseStatsService.ts`

**Complexity**: Word count, sentence count, dialogue percentage, pacing metrics

**Why Test**: Foundation for metrics features, math-heavy, precision matters

---

## Tasks

### Test Files to Create

#### 1. Word Clustering Service

- [ ] **`src/__tests__/infrastructure/api/services/search/WordClusteringService.test.ts`**

  **What to test**:
  - Matches within window distance are clustered together
  - Matches outside window are separate clusters
  - Minimum cluster size enforced
  - Edge cases: single match, overlapping clusters, empty input

  **Example**:
  ```typescript
  import { clusterMatches } from '@/infrastructure/api/services/search/WordSearchService';

  describe('Word Clustering Algorithm', () => {
    it('should cluster matches within window distance', () => {
      const matches = [
        { position: 10, word: 'test' },
        { position: 15, word: 'test' },
        { position: 100, word: 'test' }
      ];
      const settings = { clusterWindow: 50, minClusterSize: 2 };

      const clusters = clusterMatches(matches, settings);

      expect(clusters).toHaveLength(2);
      expect(clusters[0].matches).toHaveLength(2); // positions 10, 15
      expect(clusters[1].matches).toHaveLength(1); // position 100
    });

    it('should respect minimum cluster size', () => {
      const matches = [
        { position: 10, word: 'test' },
        { position: 100, word: 'test' }
      ];
      const settings = { clusterWindow: 50, minClusterSize: 2 };

      const clusters = clusterMatches(matches, settings);

      expect(clusters).toHaveLength(0); // No clusters meet minimum size
    });

    it('should handle overlapping clusters', () => {
      const matches = [
        { position: 10, word: 'test' },
        { position: 50, word: 'test' },
        { position: 90, word: 'test' }
      ];
      const settings = { clusterWindow: 50, minClusterSize: 2 };

      const clusters = clusterMatches(matches, settings);

      // Verify clustering behavior (implementation-specific)
    });

    it('should handle empty input gracefully', () => {
      const matches = [];
      const settings = { clusterWindow: 50, minClusterSize: 2 };

      const clusters = clusterMatches(matches, settings);

      expect(clusters).toHaveLength(0);
    });
  });
  ```

---

#### 2. Context Window Trimming

- [ ] **`src/__tests__/tools/shared/contextWindowHelpers.test.ts`**

  **What to test**:
  - Trimming to word limit preserves complete sentences
  - Edge case: text shorter than limit (no trimming)
  - Edge case: single sentence longer than limit (trim mid-sentence with ellipsis)
  - Word count accuracy (matches prose stats)

  **Example**:
  ```typescript
  import { trimToWordLimit } from '@/tools/shared/contextWindowHelpers';

  describe('Context Window Trimming', () => {
    it('should trim to word limit while preserving sentences', () => {
      const prose = 'This is sentence one. This is sentence two. This is sentence three.';
      const limit = 6; // "This is sentence one."

      const result = trimToWordLimit(prose, limit);

      expect(result.text).toBe('This is sentence one.');
      expect(result.wordCount).toBe(4);
      expect(result.wasTrimmed).toBe(true);
    });

    it('should not trim text shorter than limit', () => {
      const prose = 'Short text.';
      const limit = 100;

      const result = trimToWordLimit(prose, limit);

      expect(result.text).toBe('Short text.');
      expect(result.wasTrimmed).toBe(false);
    });

    it('should handle single sentence longer than limit', () => {
      const prose = 'This is a very long sentence that exceeds the word limit significantly.';
      const limit = 5;

      const result = trimToWordLimit(prose, limit);

      expect(result.text).toContain('...');
      expect(result.wasTrimmed).toBe(true);
    });
  });
  ```

---

#### 3. Publishing Standards Comparison

- [ ] **`src/__tests__/domain/models/PublishingStandardsRepository.test.ts`**

  **What to test**:
  - Genre standard loading from JSON
  - Trim size filtering by genre
  - Comparison calculations (average words/page, etc.)
  - Edge case: unknown genre (fallback to manuscript)

  **Example**:
  ```typescript
  import { PublishingStandardsRepository } from '@/domain/models/PublishingStandardsRepository';

  describe('Publishing Standards Repository', () => {
    it('should load genre standards correctly', () => {
      const repo = new PublishingStandardsRepository();
      const genre = repo.getGenreStandard('thriller');

      expect(genre).toHaveProperty('name', 'Thriller');
      expect(genre).toHaveProperty('word_count');
      expect(genre.word_count).toHaveProperty('min');
      expect(genre.word_count).toHaveProperty('max');
    });

    it('should filter trim sizes by genre', () => {
      const repo = new PublishingStandardsRepository();
      const trimSizes = repo.getTrimSizesByGenre('thriller');

      expect(trimSizes.length).toBeGreaterThan(0);
      expect(trimSizes[0]).toHaveProperty('format');
      expect(trimSizes[0]).toHaveProperty('words_per_page');
    });

    it('should fallback to manuscript for unknown genre', () => {
      const repo = new PublishingStandardsRepository();
      const genre = repo.getGenreStandard('unknown-genre');

      expect(genre.name).toBe('Manuscript');
    });
  });
  ```

- [ ] **`src/__tests__/infrastructure/api/services/resources/StandardsComparisonService.test.ts`**

  **What to test**:
  - Comparison data calculation (user metrics vs. genre standards)
  - Percentage calculations
  - Range checks (within/outside genre norms)

---

#### 4. Word Frequency Analysis

- [ ] **`src/__tests__/infrastructure/api/services/measurement/WordFrequencyService.test.ts`**

  **What to test**:
  - Word length filtering (minCharacterLength setting)
  - Stopword filtering (contentWordsOnly setting)
  - POS tagging integration (when enabled)
  - Bigram/trigram extraction
  - Hapax detection
  - Lemmatization (when enabled)
  - Top N word limiting

  **Example**:
  ```typescript
  import { WordFrequencyService } from '@/infrastructure/api/services/measurement/WordFrequencyService';

  describe('Word Frequency Service', () => {
    it('should filter words by minimum length', () => {
      const prose = 'a an the cat dog elephant';
      const settings = { minCharacterLength: 3, contentWordsOnly: false };

      const result = await service.analyze(prose, settings);

      // "a" and "an" should be filtered out (< 3 chars)
      expect(result.topWords.find(w => w.word === 'a')).toBeUndefined();
      expect(result.topWords.find(w => w.word === 'an')).toBeUndefined();
      expect(result.topWords.find(w => w.word === 'the')).toBeDefined();
    });

    it('should filter stopwords when contentWordsOnly enabled', () => {
      const prose = 'the cat and the dog';
      const settings = { contentWordsOnly: true };

      const result = await service.analyze(prose, settings);

      // "the" and "and" should be filtered (stopwords)
      expect(result.topWords.find(w => w.word === 'the')).toBeUndefined();
      expect(result.topWords.find(w => w.word === 'and')).toBeUndefined();
    });

    it('should extract bigrams correctly', () => {
      const prose = 'the quick brown fox jumps';
      const settings = { includeBigrams: true };

      const result = await service.analyze(prose, settings);

      expect(result.bigrams).toContainEqual({ phrase: 'quick brown', count: 1 });
      expect(result.bigrams).toContainEqual({ phrase: 'brown fox', count: 1 });
    });

    it('should identify hapax legomena', () => {
      const prose = 'cat cat dog elephant';
      const settings = { includeHapaxList: true };

      const result = await service.analyze(prose, settings);

      expect(result.hapax).toContainEqual('dog');
      expect(result.hapax).toContainEqual('elephant');
      expect(result.hapax).not.toContainEqual('cat'); // frequency > 1
    });
  });
  ```

---

#### 5. Prose Statistics Service

- [ ] **`src/__tests__/infrastructure/api/services/measurement/ProseStatsService.test.ts`**

  **What to test**:
  - Word count accuracy
  - Sentence count accuracy
  - Dialogue percentage calculation
  - Pacing metrics (words per sentence, etc.)
  - Edge cases: empty prose, dialogue-only, prose-only

  **Example**:
  ```typescript
  import { ProseStatsService } from '@/infrastructure/api/services/measurement/ProseStatsService';

  describe('Prose Statistics Service', () => {
    it('should count words accurately', () => {
      const prose = 'The quick brown fox jumps.';
      const result = service.analyze(prose);

      expect(result.wordCount).toBe(5);
    });

    it('should count sentences accurately', () => {
      const prose = 'Sentence one. Sentence two! Sentence three?';
      const result = service.analyze(prose);

      expect(result.sentenceCount).toBe(3);
    });

    it('should calculate dialogue percentage', () => {
      const prose = '"Hello," she said. She walked away. "Goodbye," he replied.';
      const result = service.analyze(prose);

      // "Hello," and "Goodbye," are dialogue (4 words out of 9)
      expect(result.dialoguePercentage).toBeCloseTo(44.4, 1);
    });

    it('should handle empty prose gracefully', () => {
      const prose = '';
      const result = service.analyze(prose);

      expect(result.wordCount).toBe(0);
      expect(result.sentenceCount).toBe(0);
    });
  });
  ```

---

## Acceptance Criteria

- [ ] Word clustering algorithm tested with multiple scenarios
- [ ] Context window trimming preserves sentence boundaries
- [ ] Publishing standards comparison calculations validated
- [ ] Word frequency filtering works correctly for all settings
- [ ] POS tagging integration tested (when enabled)
- [ ] Prose statistics calculations accurate
- [ ] All edge cases handled gracefully (empty input, extreme values)
- [ ] All tests pass (`npm test`)
- [ ] Code coverage reaches 40%+ (epic goal achieved)

---

## Implementation Notes

### Testing Offline Services

Services that don't use OpenRouter API (metrics, search) are **ideal for testing**:
- No API mocking required
- Deterministic outputs
- Fast execution
- No rate limits or costs

Focus testing effort here for maximum value.

---

### Fixture Data

Create realistic test fixtures:

```typescript
// fixtures/prose-samples.ts
export const PROSE_SAMPLES = {
  simple: 'The cat sat on the mat.',
  dialogue: '"Hello," she said. "How are you?"',
  complex: 'Long multi-sentence prose with dialogue, narrative, and description...'
};
```

Use fixtures to ensure consistent test data across tests.

---

### Testing POS Tagging

**Challenge**: `wink-pos-tagger` initialization can fail

**Solution**: Test both success and failure paths

```typescript
it('should handle POS tagging when enabled', () => {
  // Mock successful initialization
});

it('should gracefully handle POS tagging failures', () => {
  // Mock initialization failure
  // Verify service marks POS sections as unavailable
});
```

---

## Deliverables

- ✅ `src/__tests__/infrastructure/api/services/search/WordClusteringService.test.ts`
- ✅ `src/__tests__/tools/shared/contextWindowHelpers.test.ts`
- ✅ `src/__tests__/domain/models/PublishingStandardsRepository.test.ts`
- ✅ `src/__tests__/infrastructure/api/services/resources/StandardsComparisonService.test.ts`
- ✅ `src/__tests__/infrastructure/api/services/measurement/WordFrequencyService.test.ts`
- ✅ `src/__tests__/infrastructure/api/services/measurement/ProseStatsService.test.ts`
- ✅ Fixture data files (prose samples, test settings)

---

## Success Metrics

After Sprint 03:
- ✅ 40%+ code coverage (epic goal achieved)
- ✅ Complex algorithms have regression tests
- ✅ Refactoring is safe and fast
- ✅ New features can be tested in isolation
- ✅ Business logic defects caught before manual testing

---

## Related Documentation

- [Epic: Infrastructure Testing](../epic-infrastructure-testing.md)
- [Sprint 01: Tier 1 - Infrastructure Patterns](01-tier1-infrastructure-patterns.md)
- [Sprint 02: Tier 2 - Domain Handlers](02-tier2-domain-handlers.md)
- [ADR-2025-11-15: Lightweight Testing Framework](../../../docs/adr/2025-11-15-lightweight-testing-framework.md)

---

**Status**: Pending
**Next Action**: Begin after Sprint 02 completion
