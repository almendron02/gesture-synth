import {
  calculateDisplayedRoll,
  DEFAULT_THUMB_THRESHOLDS,
  measureThumbPose,
  type ThumbDetectionThresholds,
  type ThumbPoseMeasurements,
} from '../gestures/classifyHand'
import type { Handedness, HandsFrameAnalysis } from '../gestures/gesture.types'

export const CALIBRATION_STORAGE_KEY = 'gesture-synth:calibration-v1'
export const CALIBRATION_SAMPLE_TARGET = 8

export interface CalibrationProfile {
  version: 1
  calibratedAt: string
  tiltOffsets: Record<Handedness, number>
  thumbThresholds: Record<Handedness, ThumbDetectionThresholds>
}

export type CalibrationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string }

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function usableLandmarks(frames: readonly HandsFrameAnalysis[], handedness: Handedness) {
  const key = handedness === 'Left' ? 'left' : 'right'
  return frames.flatMap((frame) => {
    const analysis = frame[key]
    return analysis?.landmarks && analysis.confidence >= 0.65 ? [analysis.landmarks] : []
  })
}

function enoughSamples(leftCount: number, rightCount: number): CalibrationResult<never> | null {
  if (leftCount >= CALIBRATION_SAMPLE_TARGET && rightCount >= CALIBRATION_SAMPLE_TARGET) return null
  return {
    ok: false,
    message: `Hold both hands steady a little longer (${Math.min(leftCount, rightCount)}/${CALIBRATION_SAMPLE_TARGET}).`,
  }
}

export function estimateNeutralOffsets(
  frames: readonly HandsFrameAnalysis[],
): CalibrationResult<Record<Handedness, number>> {
  const left = usableLandmarks(frames, 'Left')
  const right = usableLandmarks(frames, 'Right')
  const sampleError = enoughSamples(left.length, right.length)
  if (sampleError) return sampleError

  return {
    ok: true,
    value: {
      Left: median(left.map(calculateDisplayedRoll)),
      Right: median(right.map(calculateDisplayedRoll)),
    },
  }
}

function medianThumbPose(frames: readonly HandsFrameAnalysis[], handedness: Handedness): ThumbPoseMeasurements | null {
  const landmarks = usableLandmarks(frames, handedness)
  if (landmarks.length < CALIBRATION_SAMPLE_TARGET) return null
  const poses = landmarks.map(measureThumbPose)
  return {
    straightAngle: median(poses.map((pose) => pose.straightAngle)),
    gapRatio: median(poses.map((pose) => pose.gapRatio)),
    outwardRatio: median(poses.map((pose) => pose.outwardRatio)),
  }
}

function deriveThumbThresholds(pose: ThumbPoseMeasurements): ThumbDetectionThresholds {
  const activateGap = clamp(pose.gapRatio * 0.9, 0.74, 0.95)
  const activateOutward = clamp(pose.outwardRatio * 0.85, 0.34, 0.62)
  return {
    activate: {
      straightAngle: DEFAULT_THUMB_THRESHOLDS.activate.straightAngle,
      gapRatio: activateGap,
      outwardRatio: activateOutward,
    },
    hold: {
      straightAngle: DEFAULT_THUMB_THRESHOLDS.hold.straightAngle,
      gapRatio: activateGap * 0.86,
      outwardRatio: activateOutward * 0.76,
    },
  }
}

export function estimateThumbThresholds(
  frames: readonly HandsFrameAnalysis[],
): CalibrationResult<Record<Handedness, ThumbDetectionThresholds>> {
  const leftPose = medianThumbPose(frames, 'Left')
  const rightPose = medianThumbPose(frames, 'Right')
  if (!leftPose || !rightPose) {
    return {
      ok: false,
      message: `Hold both hands steady a little longer (${Math.min(
        usableLandmarks(frames, 'Left').length,
        usableLandmarks(frames, 'Right').length,
      )}/${CALIBRATION_SAMPLE_TARGET}).`,
    }
  }

  const insufficientHand = (['Left', 'Right'] as const).find((handedness) => {
    const pose = handedness === 'Left' ? leftPose : rightPose
    return pose.straightAngle < 140 || pose.gapRatio < 0.78 || pose.outwardRatio < 0.38
  })
  if (insufficientHand) {
    return {
      ok: false,
      message: `Spread your ${insufficientHand.toLowerCase()} thumb farther away from the palm, then hold it still.`,
    }
  }

  return {
    ok: true,
    value: {
      Left: deriveThumbThresholds(leftPose),
      Right: deriveThumbThresholds(rightPose),
    },
  }
}

export function createCalibrationProfile(
  tiltOffsets: Record<Handedness, number>,
  thumbThresholds: Record<Handedness, ThumbDetectionThresholds>,
  calibratedAt = new Date().toISOString(),
): CalibrationProfile {
  return { version: 1, calibratedAt, tiltOffsets, thumbThresholds }
}

function isThresholds(value: unknown): value is ThumbDetectionThresholds {
  if (!value || typeof value !== 'object') return false
  const candidate = value as ThumbDetectionThresholds
  return ['activate', 'hold'].every((state) => {
    const thresholds = candidate[state as keyof ThumbDetectionThresholds]
    return thresholds
      && Number.isFinite(thresholds.straightAngle)
      && Number.isFinite(thresholds.gapRatio)
      && Number.isFinite(thresholds.outwardRatio)
  })
}

export function parseCalibrationProfile(serialized: string | null): CalibrationProfile | null {
  if (!serialized) return null
  try {
    const value = JSON.parse(serialized) as Partial<CalibrationProfile>
    if (value.version !== 1 || !value.tiltOffsets || !value.thumbThresholds || !value.calibratedAt) return null
    if (!Number.isFinite(value.tiltOffsets.Left) || !Number.isFinite(value.tiltOffsets.Right)) return null
    if (!isThresholds(value.thumbThresholds.Left) || !isThresholds(value.thumbThresholds.Right)) return null
    return value as CalibrationProfile
  } catch {
    return null
  }
}

export function loadCalibrationProfile(): CalibrationProfile | null {
  return parseCalibrationProfile(window.localStorage.getItem(CALIBRATION_STORAGE_KEY))
}

export function saveCalibrationProfile(profile: CalibrationProfile): void {
  window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(profile))
}
