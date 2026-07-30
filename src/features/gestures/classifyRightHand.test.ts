import { describe, expect, it } from 'vitest'
import type { HandAnalysis } from './gesture.types'
import { classifyRightHand } from './classifyRightHand'

function rightHand(pattern: string): HandAnalysis {
  const fingers = pattern.split('').map((value) => value === '1') as unknown as HandAnalysis['fingers']
  return {
    handDetected: true,
    handedness: 'Right',
    confidence: 0.95,
    landmarks: null,
    fingers,
    pattern,
    degree: null,
    tilt: 'neutral',
    rollAngle: 0,
    candidate: null,
  }
}

describe('classifyRightHand', () => {
  it.each([
    ['01000', 'root'],
    ['01100', 'first-inversion'],
    ['01110', 'seventh'],
    ['01111', 'color-seventh'],
  ] as const)('maps %s to %s voicing', (pattern, voicing) => {
    expect(classifyRightHand(rightHand(pattern))?.voicing).toBe(voicing)
  })

  it('uses an extended thumb to lower any valid voicing by one octave', () => {
    expect(classifyRightHand(rightHand('11100'))).toMatchObject({
      voicing: 'first-inversion',
      octaveShift: -1,
    })
  })

  it('keeps the standard octave while the thumb is closed', () => {
    expect(classifyRightHand(rightHand('01100'))?.octaveShift).toBe(0)
  })

  it('rejects non-sequential melodic finger combinations', () => {
    expect(classifyRightHand(rightHand('01001'))).toBeNull()
  })
})
