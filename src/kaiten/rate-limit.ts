export class RateLimiter {
  private nextAt = 0;

  constructor(private readonly minIntervalMs = 50) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const waitMs = Math.max(0, this.nextAt - now);
    this.nextAt = Math.max(now, this.nextAt) + this.minIntervalMs;
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
