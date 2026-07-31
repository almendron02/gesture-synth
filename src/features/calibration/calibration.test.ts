import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { describe, expect, it } from 'vitest'
import type { HandAnalysis, Handedness, HandsFrameAnalysis } from '../gestures/gesture.types'
import {
  CALIBRATION_SAMPLE_TARGET,
  createCalibrationProfile,
  estimateNeutralOffset,
  estimateNeutralOffsets,
  estimateThumbThreshold,
  estimateThumbThresholds,
  parseCalibrationProfile,
} from './calibration'

function landmarksFor(handedness: Handedness, roll: number, spreadThumb: boolean): NormalizedLandmark[] {
  const mirrored = handedness === 'Right'
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7, z: 0, visibility: 1 }))
  const reflect = (x: number) => mirrored ? 1 - x : x
  landmarks[0] = { x: 0.5 + Math.tan(roll * Math.PI / 180) * 0.3, y: 0.8, z: 0, visibility: 1 }
  landmarks[9] = { x: 0.5, y: 0.5, z: 0, visibility: 1 }
  landmarks[5] = { x: reflect(0.4), y: 0.55, z: 0, visibility: 1 }
  landmarks[17] = { x: reflect(0.6), y: 0.55, z: 0, visibility: 1 }
  landmarks[2] = { x: reflect(0.4), y: 0.68, z: 0, visibility: 1 }
  landmarks[3] = spreadThumb
    ? { x: reflect(0.31), y: 0.58, z: 0, visibility: 1 }
    : { x: reflect(0.38), y: 0.52, z: 0, visibility: 1 }
  landmarks[4] = spreadThumb
    ? { x: reflect(0.22), y: 0.48, z: 0, visibility: 1 }
    : { x: reflect(0.36), y: 0.35, z: 0, visibility: 1 }
  return landmarks
}

function analysis(handedness: Handedness, roll: number, spreadThumb: boolean): HandAnalysis {
  return {
    handDetected: true,
    handedness,
    confidence: 0.96,
    landmarks: landmarksFor(handedness, roll, spreadThumb),
    fingers: [spreadThumb, true, true, true, true],
    pattern: spreadThumb ? '11111' : '01111',
    degree: 'V',
    tilt: 'neutral',
    rollAngle: roll,
    candidate: null,
  }
}

function frames(spreadThumb: boolean): HandsFrameAnalysis[] {
  return Array.from({ length: CALIBRATION_SAMPLE_TARGET }, () => ({
    left: analysis('Left', 10, spreadThumb),
    right: analysis('Right', -8, spreadThumb),
    handCount: 2,
  }))
}

function oneHandFrames(handedness: Handedness, spreadThumb: boolean): HandsFrameAnalysis[] {
  return Array.from({ length: CALIBRATION_SAMPLE_TARGET }, () => ({
    left: handedness === 'Left' ? analysis('Left', 10, spreadThumb) : null,
    right: handedness === 'Right' ? analysis('Right', -8, spreadThumb) : null,
    handCount: 1,
  }))
}

describe('personal calibration', () => {
  it('estimates a stable neutral offset independently for each hand', () => {
    const result = estimateNeutralOffsets(frames(false))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.Left).toBeCloseTo(10, 5)
    expect(result.value.Right).toBeCloseTo(-8, 5)
  })

  it('derives strict per-hand thresholds from clearly spread thumbs', () => {
    const result = estimateThumbThresholds(frames(true))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.Left.activate.gapRatio).toBeGreaterThanOrEqual(0.74)
    expect(result.value.Right.activate.outwardRatio).toBeGreaterThanOrEqual(0.34)
    expect(result.value.Left.hold.gapRatio).toBeLessThan(result.value.Left.activate.gapRatio)
  })

  it('calibrates one hand without requiring the other hand in frame', () => {
    const leftNeutral = estimateNeutralOffset(oneHandFrames('Left', false), 'Left')
    const rightThumb = estimateThumbThreshold(oneHandFrames('Right', true), 'Right')

    expect(leftNeutral.ok).toBe(true)
    if (!leftNeutral.ok) return
    expect(leftNeutral.value).toBeCloseTo(10, 5)
    expect(rightThumb.ok).toBe(true)
  })

  it('does not accept samples from the wrong hand', () => {
    const result = estimateNeutralOffset(oneHandFrames('Right', false), 'Left')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('left hand')
  })

  it('rejects a thumb that is long but remains alongside the hand', () => {
    const result = estimateThumbThresholds(frames(false))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('thumb farther')
  })

  it('round-trips valid profiles and ignores corrupted storage', () => {
    const neutral = estimateNeutralOffsets(frames(false))
    const thumbs = estimateThumbThresholds(frames(true))
    if (!neutral.ok || !thumbs.ok) throw new Error('Expected valid calibration fixtures')
    const profile = createCalibrationProfile(neutral.value, thumbs.value, '2026-07-30T00:00:00.000Z')

    expect(parseCalibrationProfile(JSON.stringify(profile))).toEqual(profile)
    expect(parseCalibrationProfile('{"version":1}')).toBeNull()
    expect(parseCalibrationProfile('not-json')).toBeNull()
  })
})
