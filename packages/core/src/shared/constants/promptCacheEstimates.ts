/** User-facing guideline; Meta does not guarantee an in-memory cache lifetime. */
export const META_MUSE_CACHE_ESTIMATE_SECONDS = 300;

const META_MUSE_CACHE_ESTIMATE_MODELS = new Set([
  'meta/muse-spark-1.1',
  'meta/muse-spark-1.2',
  'meta/muse-spark-1.3',
  'meta/muse-wonder'
]);

/** Keep the estimate policy and its visible disclaimer on the same model set. */
export function isMetaMuseCacheEstimateModel(model: string): boolean {
  return META_MUSE_CACHE_ESTIMATE_MODELS.has(model.replace(/^~/, '').split(':')[0]);
}
