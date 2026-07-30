import { describe, expect, it } from 'vitest'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { LandmarkSmoother } from './LandmarkSmoother'

function handAt(x: number): NormalizedLandmark[] {
  return Array.from({ length: 21 }, (_, index) => ({ x: x + index * 0.001, y: 0.5, z: 0, visibility: 1 }))
}

describe('LandmarkSmoother', () => {
  it('keeps the initial hand position unchanged', () => {
    const smoother = new LandmarkSmoother()
    expect(smoother.smooth('Left', handAt(0.2))[0].x).toBe(0.2)
  })

  it('dampens small landmark jitter', () => {
    const smoother = new LandmarkSmoother()
    smoother.smooth('Left', handAt(0.2))
    const smoothed = smoother.smooth('Left', handAt(0.21))
    expect(smoothed[0].x).toBeGreaterThan(0.2)
    expect(smoothed[0].x).toBeLessThan(0.21)
  })

  it('tracks faster movement more responsively than small jitter', () => {
    const small = new LandmarkSmoother()
    small.smooth('Left', handAt(0.2))
    const smallProgress = small.smooth('Left', handAt(0.21))[0].x - 0.2

    const fast = new LandmarkSmoother()
    fast.smooth('Left', handAt(0.2))
    const fastProgress = fast.smooth('Left', handAt(0.3))[0].x - 0.2

    expect(fastProgress / 0.1).toBeGreaterThan(smallProgress / 0.01)
  })
})
