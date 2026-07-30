import { describe, expect, it } from 'vitest'
import type { GestureCandidate } from './gesture.types'
import { GestureStabilizer } from './GestureStabilizer'

const first: GestureCandidate = {
  key: 'I-major', degree: 'I', quality: 'major', handedness: 'Left', pattern: '01000', tilt: 'inward',
}
const fourth: GestureCandidate = {
  key: 'IV-minor', degree: 'IV', quality: 'minor', handedness: 'Left', pattern: '01111', tilt: 'outward',
}

describe('GestureStabilizer', () => {
  it('waits for a stable sign before activating', () => {
    const stabilizer = new GestureStabilizer<GestureCandidate>({ startDelayMs: 100, releaseDelayMs: 50 })
    expect(stabilizer.update(first, 0)).toBeNull()
    expect(stabilizer.update(first, 99)).toBeNull()
    expect(stabilizer.update(first, 100)).toEqual(first)
  })

  it('holds briefly before releasing when recognition disappears', () => {
    const stabilizer = new GestureStabilizer<GestureCandidate>({ startDelayMs: 100, releaseDelayMs: 500 })
    stabilizer.update(first, 0)
    stabilizer.update(first, 100)
    expect(stabilizer.update(null, 110)).toEqual(first)
    expect(stabilizer.update(null, 609)).toEqual(first)
    expect(stabilizer.update(null, 610)).toBeNull()
  })

  it('keeps the previous sign live while stabilizing its replacement', () => {
    const stabilizer = new GestureStabilizer<GestureCandidate>({ startDelayMs: 100, changeDelayMs: 100, releaseDelayMs: 50 })
    stabilizer.update(first, 0)
    stabilizer.update(first, 100)
    expect(stabilizer.update(fourth, 120)).toEqual(first)
    expect(stabilizer.update(fourth, 219)).toEqual(first)
    expect(stabilizer.update(fourth, 220)).toEqual(fourth)
  })

  it('cancels a pending release when the live sign returns', () => {
    const stabilizer = new GestureStabilizer<GestureCandidate>({ startDelayMs: 100, releaseDelayMs: 500 })
    stabilizer.update(first, 0)
    stabilizer.update(first, 100)
    expect(stabilizer.update(null, 150)).toEqual(first)
    expect(stabilizer.update(first, 400)).toEqual(first)
    expect(stabilizer.update(null, 450)).toEqual(first)
    expect(stabilizer.update(null, 949)).toEqual(first)
  })

  it('restarts replacement confirmation after returning to the active sign', () => {
    const stabilizer = new GestureStabilizer<GestureCandidate>({ startDelayMs: 100, changeDelayMs: 100, releaseDelayMs: 500 })
    stabilizer.update(first, 0)
    stabilizer.update(first, 100)
    expect(stabilizer.update(fourth, 120)).toEqual(first)
    expect(stabilizer.update(first, 180)).toEqual(first)
    expect(stabilizer.update(fourth, 250)).toEqual(first)
    expect(stabilizer.update(fourth, 349)).toEqual(first)
    expect(stabilizer.update(fourth, 350)).toEqual(fourth)
  })

  it('can confirm a replacement faster than the first gesture', () => {
    const stabilizer = new GestureStabilizer<GestureCandidate>({ startDelayMs: 60, changeDelayMs: 24 })
    stabilizer.update(first, 0)
    expect(stabilizer.update(first, 59)).toBeNull()
    expect(stabilizer.update(first, 60)).toEqual(first)
    expect(stabilizer.update(fourth, 90)).toEqual(first)
    expect(stabilizer.update(fourth, 113)).toEqual(first)
    expect(stabilizer.update(fourth, 114)).toEqual(fourth)
  })
})
