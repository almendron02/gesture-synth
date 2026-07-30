import { describe, expect, it } from 'vitest'
import { degreeForPattern, patternToString } from './gesturePatterns'

describe('gesture pattern classification', () => {
  it.each([
    [[false, true, false, false, false], 'I'],
    [[false, true, true, false, false], 'II'],
    [[false, true, true, true, false], 'III'],
    [[false, true, true, true, true], 'IV'],
    [[true, true, true, true, true], 'V'],
    [[false, true, false, false, true], 'VI'],
    [[true, true, false, false, true], 'VII'],
  ] as const)('maps %s to degree %s', (pattern, degree) => {
    expect(degreeForPattern(pattern)).toBe(degree)
  })

  it('rejects a random combination instead of relying on finger count', () => {
    expect(degreeForPattern([true, true, false, false, false])).toBeNull()
    expect(degreeForPattern([false, false, true, true, false])).toBeNull()
  })

  it('serializes fingers in thumb-to-pinky order', () => {
    expect(patternToString([false, true, false, false, true])).toBe('01001')
  })
})
