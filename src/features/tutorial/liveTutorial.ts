import { classifyRightHand } from '../gestures/classifyRightHand'
import type { FingerPattern, HandsFrameAnalysis } from '../gestures/gesture.types'

export const LIVE_TUTORIAL_HOLD_MS = 650

export type LiveTutorialStepId =
  | 'left-sign'
  | 'left-major'
  | 'right-root'
  | 'right-inversion'
  | 'right-octave'

export interface LiveTutorialStep {
  id: LiveTutorialStepId
  label: string
  title: string
  instruction: string
  leftPattern: FingerPattern
  rightPattern?: FingerPattern
}

const leftIndex: FingerPattern = [false, true, false, false, false]

export const liveTutorialSteps: readonly LiveTutorialStep[] = [
  {
    id: 'left-sign',
    label: 'Choose a chord',
    title: 'Show the I sign.',
    instruction: 'Raise only your left index finger. The left hand chooses the chord, so this step stays silent.',
    leftPattern: leftIndex,
  },
  {
    id: 'left-major',
    label: 'Set its quality',
    title: 'Rotate slightly inward.',
    instruction: 'Keep the index sign and turn your left hand clockwise until the analyzer reads I major.',
    leftPattern: leftIndex,
  },
  {
    id: 'right-root',
    label: 'Complete the gate',
    title: 'Add your right index.',
    instruction: 'Keep I major live with your left hand. Raise only the right index finger to hear the root-position chord.',
    leftPattern: leftIndex,
    rightPattern: [false, true, false, false, false],
  },
  {
    id: 'right-inversion',
    label: 'Reshape the notes',
    title: 'Add the middle finger.',
    instruction: 'Keep the left hand unchanged. Show index and middle on your right hand to move into first inversion.',
    leftPattern: leftIndex,
    rightPattern: [false, true, true, false, false],
  },
  {
    id: 'right-octave',
    label: 'Use the thumb control',
    title: 'Spread the right thumb.',
    instruction: 'Keep the two-finger voicing and clearly spread your right thumb to lower the whole chord by one octave.',
    leftPattern: leftIndex,
    rightPattern: [true, true, true, false, false],
  },
] as const

function hasIMajor(frame: HandsFrameAnalysis): boolean {
  return frame.left?.candidate?.degree === 'I' && frame.left.candidate.quality === 'major'
}

export function matchesLiveTutorialStep(step: LiveTutorialStep, frame: HandsFrameAnalysis): boolean {
  if (step.id === 'left-sign') return frame.left?.degree === 'I'
  if (!hasIMajor(frame)) return false
  if (step.id === 'left-major') return true

  const right = classifyRightHand(frame.right)
  if (!right) return false
  if (step.id === 'right-root') return right.voicing === 'root' && right.octaveShift === 0
  if (step.id === 'right-inversion') return right.voicing === 'first-inversion' && right.octaveShift === 0
  return right.voicing === 'first-inversion' && right.octaveShift === -1
}

export function liveTutorialFeedback(step: LiveTutorialStep, frame: HandsFrameAnalysis): string {
  if (!frame.left) return 'Bring your left hand into the frame.'
  if (frame.left.degree !== 'I') return 'Left hand: show only your index finger.'
  if (step.id === 'left-sign') return 'That is the I sign. Hold it steady.'
  if (!frame.left.candidate) return 'Keep the sign and rotate your left hand slightly inward.'
  if (frame.left.candidate.quality !== 'major') return 'You found minor. Rotate gently in the opposite direction.'
  if (step.id === 'left-major') return 'I major detected. Hold that angle.'
  if (!frame.right) return 'Keep the left sign live and bring in your right hand.'

  const right = classifyRightHand(frame.right)
  if (!right) return 'Make the right-hand finger shape shown above.'
  if (step.id === 'right-root') {
    return right.voicing === 'root' && right.octaveShift === 0
      ? 'Root position detected. Hold both hands steady.'
      : 'Right hand: index only, with the thumb resting.'
  }
  if (step.id === 'right-inversion') {
    return right.voicing === 'first-inversion' && right.octaveShift === 0
      ? 'First inversion detected. Keep it live.'
      : 'Right hand: index and middle, with the thumb resting.'
  }
  return right.voicing === 'first-inversion' && right.octaveShift === -1
    ? 'Octave down detected. Hold the full shape.'
    : 'Keep index and middle up, then spread the right thumb farther.'
}
