import { classifyRightHand } from '../gestures/classifyRightHand'
import type { HandsFrameAnalysis, PerformanceGesture } from '../gestures/gesture.types'
import type { TutorialChord } from './songLibrary'

export const LESSON_GESTURE_HOLD_MS = 520

export interface LessonAdvanceState {
  progress: number
  completed: boolean
  waitingForRelease: boolean
}

export class AutomaticLessonAdvancer {
  private matchedAt: number | null = null
  private waitingForRelease = false
  private readonly holdMs: number

  constructor(holdMs = LESSON_GESTURE_HOLD_MS) {
    this.holdMs = holdMs
  }

  update(matches: boolean, timestamp: number): LessonAdvanceState {
    if (this.waitingForRelease) {
      if (!matches) this.waitingForRelease = false
      return { progress: 0, completed: false, waitingForRelease: this.waitingForRelease }
    }

    if (!matches) {
      this.matchedAt = null
      return { progress: 0, completed: false, waitingForRelease: false }
    }

    this.matchedAt ??= timestamp
    const progress = Math.min(1, (timestamp - this.matchedAt) / this.holdMs)
    return { progress, completed: progress >= 1, waitingForRelease: false }
  }

  advance(requiresRelease: boolean): void {
    this.matchedAt = null
    this.waitingForRelease = requiresRelease
  }

  reset(): void {
    this.matchedAt = null
    this.waitingForRelease = false
  }
}

export function tutorialChordKey(chord: TutorialChord): string {
  return `${chord.degree}-${chord.quality}-${chord.voicing ?? 'root'}-octave-0`
}

export function matchesTutorialChord(gesture: PerformanceGesture | null, chord: TutorialChord): boolean {
  return Boolean(
    gesture
    && gesture.left.degree === chord.degree
    && gesture.left.quality === chord.quality
    && gesture.right.voicing === (chord.voicing ?? 'root')
    && gesture.right.octaveShift === 0,
  )
}

export function automaticLessonFeedback(frame: HandsFrameAnalysis, chord: TutorialChord): string {
  if (!frame.left) return `Show the left-hand degree ${chord.degree} sign.`
  if (frame.left.degree !== chord.degree) return `Left hand: change to degree ${chord.degree}.`
  if (!frame.left.candidate) {
    return `Tilt the left hand ${chord.quality === 'major' ? 'inward' : 'outward'} for ${chord.quality}.`
  }
  if (frame.left.candidate.quality !== chord.quality) {
    return `The chord is ${frame.left.candidate.quality}; rotate the other direction for ${chord.quality}.`
  }
  if (!frame.right) return 'Keep the left sign live and add your right hand.'

  const right = classifyRightHand(frame.right)
  const targetVoicing = chord.voicing ?? 'root'
  if (!right || right.voicing !== targetVoicing) {
    const fingers = targetVoicing === 'root' ? 'one finger'
      : targetVoicing === 'first-inversion' ? 'two fingers'
        : targetVoicing === 'seventh' ? 'three fingers' : 'four fingers'
    return `Right hand: show ${fingers} for the target voicing.`
  }
  if (right.octaveShift !== 0) return 'Rest the right thumb for the standard octave.'
  return `${chord.name} detected. Hold both hands steady.`
}
