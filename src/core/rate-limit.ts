const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms))

/** Espaça chamadas em 1000/rps ms — a uMov.me limita em 4 req/s por token. */
export class RateLimiter {
  private nextSlot = 0

  constructor(private readonly rps: number) {}

  async acquire(): Promise<void> {
    const now = Date.now()
    const wait = Math.max(0, this.nextSlot - now)
    this.nextSlot = Math.max(now, this.nextSlot) + 1000 / this.rps
    if (wait > 0) await sleep(wait)
  }
}
