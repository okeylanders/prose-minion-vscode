/**
 * Shared balance formatting (single-provider adaptation of FM's ADR-010 helper).
 *
 * One source of truth for the headline metric so the collapsed pill and the
 * expanded panel can never disagree on the number they show.
 */
import { OpenRouterBalance } from '@messages';

/** USD-formatted dollars (OpenRouter is single-currency). */
export function fmtUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Tone hint for the headline amount — drives muted/zero styling. */
export type BalanceTone = 'normal' | 'muted' | 'zero';

export interface BalanceHeadline {
  text: string;
  tone: BalanceTone;
}

/**
 * The single prominent number for OpenRouter — the account balance, matching
 * the expanded panel's headline. Falls back to the enforced key-limit remaining
 * ONLY when the account balance (`/credits`) is unreadable, so a non-management
 * key still surfaces the one number it has.
 */
export function openRouterHeadline(
  balance: OpenRouterBalance | null,
  isLoading: boolean
): BalanceHeadline {
  if (!balance) {
    return { text: isLoading ? '…' : '—', tone: 'muted' };
  }
  if (balance.status === 'no_key') {
    return { text: 'no key', tone: 'muted' };
  }
  if (balance.status === 'unavailable') {
    return { text: '—', tone: 'muted' };
  }

  const { keyLimit, credits } = balance;

  // Favor the total account balance — the number users want at a glance. The
  // per-key spend limit is a secondary guard, used only as a fallback.
  if (credits) {
    return { text: fmtUsd(credits.remaining), tone: credits.remaining <= 0 ? 'zero' : 'normal' };
  }

  const hasEnforcedLimit =
    keyLimit != null && keyLimit.limit != null && keyLimit.limitRemaining != null;
  if (hasEnforcedLimit) {
    if (keyLimit!.limit === 0) {
      return { text: fmtUsd(0), tone: 'zero' };
    }
    const remaining = keyLimit!.limitRemaining!;
    return { text: fmtUsd(remaining), tone: remaining <= 0 ? 'zero' : 'normal' };
  }

  return { text: '—', tone: 'muted' };
}
