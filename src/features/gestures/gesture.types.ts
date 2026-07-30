import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky'
export type FingerPattern = readonly [boolean, boolean, boolean, boolean, boolean]
export type Degree = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII'
export type ChordQuality = 'major' | 'minor'
export type Handedness = 'Left' | 'Right'
export type HandTilt = 'inward' | 'outward' | 'neutral'
export type RightHandVoicing = 'root' | 'first-inversion' | 'seventh' | 'color-seventh'

export interface GestureDefinition {
  degree: Degree
  name: string
  pattern: FingerPattern
  hint: string
}

export interface GestureCandidate {
  key: string
  degree: Degree
  quality: ChordQuality
  handedness: Handedness
  pattern: string
  tilt: Exclude<HandTilt, 'neutral'>
}

export interface RightHandModifier {
  key: string
  voicing: RightHandVoicing
  label: string
  pattern: string
  fingerCount: 1 | 2 | 3 | 4
  octaveShift: -1 | 0 | 1
}

export interface PerformanceGesture {
  key: string
  left: GestureCandidate
  right: RightHandModifier
}

export interface HandAnalysis {
  handDetected: boolean
  handedness: Handedness | null
  confidence: number
  landmarks: NormalizedLandmark[] | null
  fingers: FingerPattern
  pattern: string
  degree: Degree | null
  tilt: HandTilt
  rollAngle: number
  candidate: GestureCandidate | null
}

export interface HandsFrameAnalysis {
  left: HandAnalysis | null
  right: HandAnalysis | null
  handCount: number
}

export const EMPTY_ANALYSIS: HandAnalysis = {
  handDetected: false,
  handedness: null,
  confidence: 0,
  landmarks: null,
  fingers: [false, false, false, false, false],
  pattern: '00000',
  degree: null,
  tilt: 'neutral',
  rollAngle: 0,
  candidate: null,
}

export const EMPTY_HANDS_FRAME: HandsFrameAnalysis = {
  left: null,
  right: null,
  handCount: 0,
}
