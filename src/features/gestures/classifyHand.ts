import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { degreeForPattern, patternToString } from './gesturePatterns'
import type { ChordQuality, FingerPattern, GestureCandidate, HandAnalysis, Handedness, HandTilt } from './gesture.types'

const DEFAULT_TILT_THRESHOLD = 12

const thumbThresholds = {
  activate: { straightAngle: 145, gapRatio: 0.78, outwardRatio: 0.38 },
  hold: { straightAngle: 136, gapRatio: 0.66, outwardRatio: 0.28 },
} as const

const fingerJoints = [
  [5, 6, 8],
  [9, 10, 12],
  [13, 14, 16],
  [17, 18, 20],
] as const

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0))
}

function distance2d(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function angle(a: NormalizedLandmark, vertex: NormalizedLandmark, c: NormalizedLandmark): number {
  const first = { x: a.x - vertex.x, y: a.y - vertex.y, z: (a.z ?? 0) - (vertex.z ?? 0) }
  const second = { x: c.x - vertex.x, y: c.y - vertex.y, z: (c.z ?? 0) - (vertex.z ?? 0) }
  const dot = first.x * second.x + first.y * second.y + first.z * second.z
  const firstLength = Math.hypot(first.x, first.y, first.z)
  const secondLength = Math.hypot(second.x, second.y, second.z)
  if (!firstLength || !secondLength) return 0
  return Math.acos(Math.max(-1, Math.min(1, dot / (firstLength * secondLength)))) * 180 / Math.PI
}

export function detectFingerStates(
  landmarks: NormalizedLandmark[],
  previous: FingerPattern = [false, false, false, false, false],
): FingerPattern {
  const wrist = landmarks[0]
  const indexMcp = landmarks[5]
  const pinkyMcp = landmarks[17]
  const thumbTip = landmarks[4]
  const palmWidth = distance2d(indexMcp, pinkyMcp)
  const thumbThreshold = previous[0] ? thumbThresholds.hold : thumbThresholds.activate
  const thumbGapRatio = palmWidth > 0 ? distance2d(thumbTip, indexMcp) / palmWidth : 0
  // Project onto the index-facing side of the palm. This is rotation-invariant and
  // works for either hand because indexMcp - pinkyMcp always points toward the thumb.
  const thumbOutwardRatio = palmWidth > 0
    ? ((thumbTip.x - indexMcp.x) * (indexMcp.x - pinkyMcp.x)
      + (thumbTip.y - indexMcp.y) * (indexMcp.y - pinkyMcp.y)) / (palmWidth * palmWidth)
    : 0
  const thumbStraight = angle(landmarks[2], landmarks[3], thumbTip) > thumbThreshold.straightAngle
  const thumbExtended = thumbStraight
    && thumbGapRatio > thumbThreshold.gapRatio
    && thumbOutwardRatio > thumbThreshold.outwardRatio

  const fingers = fingerJoints.map(([mcp, pip, tip], index) => {
    const wasExtended = previous[index + 1]
    const straight = angle(landmarks[mcp], landmarks[pip], landmarks[tip]) > (wasExtended ? 145 : 155)
    const reachesPastJoint = distance(landmarks[tip], wrist) > distance(landmarks[pip], wrist) * (wasExtended ? 1.06 : 1.12)
    return straight && reachesPastJoint
  })

  return [thumbExtended, fingers[0], fingers[1], fingers[2], fingers[3]]
}

export function calculateDisplayedRoll(landmarks: NormalizedLandmark[]): number {
  const wrist = landmarks[0]
  const middleMcp = landmarks[9]
  // The video is mirrored with CSS, so reverse the horizontal component here.
  return Math.atan2(wrist.x - middleMcp.x, wrist.y - middleMcp.y) * 180 / Math.PI
}

function normalizedAngle(angle: number): number {
  return ((angle + 180) % 360 + 360) % 360 - 180
}

export function classifyTilt(
  rollAngle: number,
  handedness: Handedness,
  tiltThreshold = DEFAULT_TILT_THRESHOLD,
): HandTilt {
  if (Math.abs(rollAngle) < tiltThreshold) return 'neutral'
  const movesInward = handedness === 'Left' ? rollAngle > 0 : rollAngle < 0
  return movesInward ? 'inward' : 'outward'
}

export function analyzeHand(
  landmarks: NormalizedLandmark[],
  handedness: Handedness,
  confidence: number,
  tiltThreshold = DEFAULT_TILT_THRESHOLD,
  tiltOffset = 0,
  previousFingers?: FingerPattern,
): HandAnalysis {
  const fingers = detectFingerStates(landmarks, previousFingers)
  const pattern = patternToString(fingers)
  const degree = degreeForPattern(fingers)
  const rollAngle = normalizedAngle(calculateDisplayedRoll(landmarks) - tiltOffset)
  const tilt = classifyTilt(rollAngle, handedness, tiltThreshold)
  const quality: ChordQuality | null = tilt === 'neutral' ? null : tilt === 'inward' ? 'major' : 'minor'
  let candidate: GestureCandidate | null = null
  if (degree && quality && tilt !== 'neutral' && handedness === 'Left') {
    candidate = { key: `${degree}-${quality}`, degree, quality, handedness, pattern, tilt }
  }

  return {
    handDetected: true,
    handedness,
    confidence,
    landmarks,
    fingers,
    pattern,
    degree,
    tilt,
    rollAngle,
    candidate,
  }
}
