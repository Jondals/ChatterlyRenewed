/**
 * src/security/throttle.ts
 * Sign-in attempt limiter: locks an account after several failures in a row.
 */
export interface LockoutOptions {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
}

interface Entry {
  failures: number[];
  lockedUntil: number;
}

/**
 * Per-account brute-force protection (on top of the per-IP rate limiter). After `maxFailures`
 * failed logins inside `windowMs` the account is locked for `lockMs`, regardless of source IP.
 */
export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly options: LockoutOptions,
    private readonly now: () => number = Date.now,
  ) {}

  /** Seconds the caller must wait, or 0 when allowed. */
  retryAfter(key: string): number {
    const entry = this.entries.get(key.toLowerCase());
    if (!entry) return 0;
    const remaining = entry.lockedUntil - this.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  /**
   * Writes down a failed sign-in; after several in a row the account is locked for a while, whatever the address.
   */
  recordFailure(key: string): void {
    const k = key.toLowerCase();
    const now = this.now();
    const entry = this.entries.get(k) ?? { failures: [], lockedUntil: 0 };
    entry.failures = entry.failures.filter(
      function (this: LoginThrottle, t: number) {
        return now - t < this.options.windowMs;
      }.bind(this),
    );
    entry.failures.push(now);
    if (entry.failures.length >= this.options.maxFailures) {
      entry.lockedUntil = now + this.options.lockMs;
      entry.failures = [];
    }
    this.entries.set(k, entry);
    if (this.entries.size > 10_000) this.prune();
  }

  /** A good sign-in clears the failures of the account. */
  recordSuccess(key: string): void {
    this.entries.delete(key.toLowerCase());
  }

  /** Forgets the accounts whose lock and failures are old, so the memory does not grow. */
  private prune(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (
        entry.lockedUntil < now &&
        entry.failures.every(
          function (this: LoginThrottle, t: number) {
            return now - t >= this.options.windowMs;
          }.bind(this),
        )
      ) {
        this.entries.delete(key);
      }
    }
  }
}
