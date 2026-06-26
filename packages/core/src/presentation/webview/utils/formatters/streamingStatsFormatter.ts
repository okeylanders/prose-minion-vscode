export interface StreamingStatsInput {
  chunkCount: number;
  elapsedMs: number;
  initialLatencyMs?: number;
  chunksPerSecond: number;
}

export interface StreamingStatPart {
  key: 'count' | 'elapsed' | 'initialLatency' | 'throughput';
  label: string;
}

const MIN_THROUGHPUT_ELAPSED_MS = 500;

const isUsableNumber = (value: number | undefined): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
);

export function formatDuration(ms: number): string {
  if (!isUsableNumber(ms)) {
    return '0.0s';
  }

  const seconds = ms / 1000;
  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatInitialLatency(ms: number | undefined): string | undefined {
  if (!isUsableNumber(ms)) {
    return undefined;
  }

  if (ms < 1000) {
    return `first ${Math.round(ms)}ms`;
  }

  return `first ${(ms / 1000).toFixed(1)}s`;
}

export function formatChunksPerSecond(chunksPerSecond: number): string | undefined {
  if (!isUsableNumber(chunksPerSecond) || chunksPerSecond === 0) {
    return undefined;
  }

  const rate = chunksPerSecond < 100
    ? chunksPerSecond.toFixed(1)
    : Math.round(chunksPerSecond).toString();

  return `${rate} chunks/s`;
}

export function formatStreamingStats(input: StreamingStatsInput): StreamingStatPart[] {
  const chunkCount = isUsableNumber(input.chunkCount) ? Math.floor(input.chunkCount) : 0;
  const elapsedMs = isUsableNumber(input.elapsedMs) ? input.elapsedMs : 0;

  const parts: StreamingStatPart[] = [
    { key: 'count', label: `${chunkCount} ${chunkCount === 1 ? 'chunk' : 'chunks'}` },
    { key: 'elapsed', label: formatDuration(elapsedMs) }
  ];

  const initialLatency = formatInitialLatency(input.initialLatencyMs);
  if (initialLatency) {
    parts.push({ key: 'initialLatency', label: initialLatency });
  }

  const throughput = formatChunksPerSecond(input.chunksPerSecond);
  if (throughput && chunkCount > 0 && elapsedMs >= MIN_THROUGHPUT_ELAPSED_MS) {
    parts.push({ key: 'throughput', label: throughput });
  }

  return parts;
}
