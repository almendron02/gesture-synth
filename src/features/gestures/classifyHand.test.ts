import { describe, expect, it } from 'vitest'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { classifyTilt, detectFingerStates } from './classifyHand'

function thumbLandmarks({
  mirrored = false,
  tip,
  joint,
}: {
  mirrored?: boolean
  tip: readonly [number, number]
  joint: readonly [number, number]
}): NormalizedLandmark[] {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7, z: 0, visibility: 1 }))
  landmarks[5] = { x: mirrored ? 0.6 : 0.4, y: 0.5, z: 0, visibility: 1 }
  landmarks[17] = { x: mirrored ? 0.4 : 0.6, y: 0.5, z: 0, visibility: 1 }
  landmarks[2] = { x: mirrored ? 1 - 0.4 : 0.4, y: 0.7, z: 0, visibility: 1 }
  landmarks[3] = { x: mirrored ? 1 - joint[0] : joint[0], y: joint[1], z: 0, visibility: 1 }
  landmarks[4] = { x: mirrored ? 1 - tip[0] : tip[0], y: tip[1], z: 0, visibility: 1 }
  return landmarks
}

describe('classifyTilt', () => {
  it('uses a small configurable neutral zone', () => {
    expect(classifyTilt(4.8, 'Left', 5)).toBe('neutral')
    expect(classifyTilt(5.2, 'Left', 5)).toBe('inward')
    expect(classifyTilt(-5.2, 'Left', 5)).toBe('outward')
  })

  it('mirrors inward and outward directions for the right hand', () => {
    expect(classifyTilt(-5.2, 'Right', 5)).toBe('inward')
    expect(classifyTilt(5.2, 'Right', 5)).toBe('outward')
  })
})

describe('thumb extension detection', () => {
  it('requires the thumb to project clearly beyond the index side of the palm', () => {
    const alongsideIndex = thumbLandmarks({ joint: [0.38, 0.525], tip: [0.36, 0.35] })

    expect(detectFingerStates(alongsideIndex)[0]).toBe(false)
  })

  it('recognizes a clearly spread thumb on both hands', () => {
    const spread = { joint: [0.32, 0.58], tip: [0.24, 0.46] } as const

    expect(detectFingerStates(thumbLandmarks(spread))[0]).toBe(true)
    expect(detectFingerStates(thumbLandmarks({ ...spread, mirrored: true }))[0]).toBe(true)
  })

  it('uses hysteresis while still releasing a thumb that returns beside the palm', () => {
    const borderline = thumbLandmarks({ joint: [0.366, 0.54], tip: [0.332, 0.38] })
    const alongsideIndex = thumbLandmarks({ joint: [0.38, 0.525], tip: [0.36, 0.35] })

    expect(detectFingerStates(borderline)[0]).toBe(false)
    expect(detectFingerStates(borderline, [true, false, false, false, false])[0]).toBe(true)
    expect(detectFingerStates(alongsideIndex, [true, false, false, false, false])[0]).toBe(false)
  })
})
