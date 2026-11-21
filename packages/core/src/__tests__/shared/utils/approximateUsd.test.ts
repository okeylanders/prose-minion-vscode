/** The one "≈ $…" formatter (ADR 2026-11-20 D14): never "up to". */
import { formatApproximateUsd } from '@shared/utils/approximateUsd';

describe('formatApproximateUsd', () => {
  it('writes an estimate with ≈ and two places', () => {
    expect(formatApproximateUsd(0.42)).toBe('≈ $0.42');
    expect(formatApproximateUsd(0.005)).toBe('≈ $0.01');
    expect(formatApproximateUsd(12)).toBe('≈ $12.00');
  });

  it('says "< $0.01" for a price that rounds to nothing', () => {
    expect(formatApproximateUsd(0.0049)).toBe('< $0.01');
    expect(formatApproximateUsd(0)).toBe('< $0.01');
  });
});
