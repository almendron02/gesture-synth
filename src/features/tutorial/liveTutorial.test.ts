import { describe, expect, it } from 'vitest'
import type { FingerPattern, HandAnalysis, HandsFrameAnalysis } from '../gestures/gesture.types'
import { liveTutorialFeedback, liveTutorialSteps, matchesLiveTutorialStep } from './liveTutorial'

function hand(handedness: 'Left' | 'Right', pattern: FingerPattern, quality: 'major' | 'minor' | null = null): HandAnalysis {
  const patternKey = pattern.map((finger) => finger ? '1' : '0').join('')
  const degree = handedness === 'Left' && patternKey === '01000' ? 'I' : null
  return {
    handDetected: true,
    handedness,
    confidence: 0.95,
    landmarks: null,
    fingers: pattern,
    pattern: patternKey,
    degree,
    tilt: quality === 'major' ? 'inward' : quality === 'minor' ? 'outward' : 'neutral',
    rollAngle: 0,
    candidate: degree && quality ? {
      key: `I-${quality}`,
      degree,
      quality,
      handedness: 'Left',
      pattern: '01000',
      tilt: quality === 'major' ? 'inward' : 'outward',
    } : null,
  }
}

function frame(left: HandAnalysis | null, right: HandAnalysis | null = null): HandsFrameAnalysis {
  return { left, right, handCount: Number(Boolean(left)) + Number(Boolean(right)) }
}

const leftIndex: FingerPattern = [false, true, false, false, false]

describe('live gesture tutorial', () => {
  it('accepts the left sign before it has a chord quality', () => {
    expect(matchesLiveTutorialStep(liveTutorialSteps[0], frame(hand('Left', leftIndex)))).toBe(true)
    expect(matchesLiveTutorialStep(liveTutorialSteps[1], frame(hand('Left', leftIndex)))).toBe(false)
  })

  it('requires I major throughout the right-hand lessons', () => {
    const rightRoot = hand('Right', [false, true, false, false, false])
    expect(matchesLiveTutorialStep(liveTutorialSteps[2], frame(hand('Left', leftIndex, 'major'), rightRoot))).toBe(true)
    expect(matchesLiveTutorialStep(liveTutorialSteps[2], frame(hand('Left', leftIndex, 'minor'), rightRoot))).toBe(false)
  })

  it('teaches thumb-out without changing the two-finger voicing', () => {
    const left = hand('Left', leftIndex, 'major')
    const octaveDown = hand('Right', [true, true, true, false, false])
    const thumbResting = hand('Right', [false, true, true, false, false])

    expect(matchesLiveTutorialStep(liveTutorialSteps[4], frame(left, octaveDown))).toBe(true)
    expect(matchesLiveTutorialStep(liveTutorialSteps[4], frame(left, thumbResting))).toBe(false)
    expect(liveTutorialFeedback(liveTutorialSteps[4], frame(left, thumbResting))).toContain('spread')
  })
})
