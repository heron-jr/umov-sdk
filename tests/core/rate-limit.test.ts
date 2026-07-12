import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RateLimiter } from '../../src/core/rate-limit'

describe('RateLimiter', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('espaça aquisições em 1/rps segundos', async () => {
    const limiter = new RateLimiter(4) // 250ms entre requests
    const timestamps: number[] = []
    const run = (async () => {
      for (let i = 0; i < 3; i++) {
        await limiter.acquire()
        timestamps.push(Date.now())
      }
    })()
    await vi.advanceTimersByTimeAsync(1000)
    await run
    expect(timestamps[1]! - timestamps[0]!).toBeGreaterThanOrEqual(250)
    expect(timestamps[2]! - timestamps[1]!).toBeGreaterThanOrEqual(250)
  })

  it('primeira aquisição é imediata', async () => {
    const limiter = new RateLimiter(4)
    const p = limiter.acquire()
    await vi.advanceTimersByTimeAsync(0)
    await expect(p).resolves.toBeUndefined()
  })
})
