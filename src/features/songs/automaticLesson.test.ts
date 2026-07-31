import { describe, expect, it } from 'vitest'
import type { PerformanceGesture } from '../gestures/gesture.types'
import type { TutorialChord } from './songLibrary'
import { AutomaticLessonAdvancer, matchesTutorialChord, tutorialChordKey } from './automaticLesson'

const cMajor: TutorialChord = { id: 'c', name: 'C major', degree: 'I', quality: 'major' }
const performance: PerformanceGesture = {
  key: 'I-major-root',
  left: { key: 'I-major', degree: 'I', quality: 'major', handedness: 'Left', pattern: '01000', tilt: 'inward' },
  right: { key: 'root-octave-0', voicing: 'root', label: 'Root position', pattern: '01000', fingerCount: 1, octaveShift: 0 },
}

describe('automatic song lesson advancement', () => {
  it('matches the complete two-hand chord including standard octave', () => {
    expect(matchesTutorialChord(performance, cMajor)).toBe(true)
    expect(matchesTutorialChord({ ...performance, right: { ...performance.right, octaveShift: -1 } }, cMajor)).toBe(false)
    expect(tutorialChordKey(cMajor)).toBe('I-major-root-octave-0')
  })

  it('completes only after the gesture remains correct for the hold duration', () => {
    const advancer = new AutomaticLessonAdvancer(500)
    expect(advancer.update(true, 1000).progress).toBe(0)
    expect(advancer.update(true, 1300)).toMatchObject({ progress: 0.6, completed: false })
    expect(advancer.update(true, 1500)).toMatchObject({ progress: 1, completed: true })
  })

  it('requires release before accepting a repeated chord cue', () => {
    const advancer = new AutomaticLessonAdvancer(100)
    advancer.update(true, 0)
    expect(advancer.update(true, 100).completed).toBe(true)
    advancer.advance(true)

    expect(advancer.update(true, 250)).toMatchObject({ completed: false, waitingForRelease: true })
    expect(advancer.update(false, 260).waitingForRelease).toBe(false)
    expect(advancer.update(true, 300).progress).toBe(0)
    expect(advancer.update(true, 400).completed).toBe(true)
  })

  it('resets partial progress when the gesture becomes incorrect', () => {
    const advancer = new AutomaticLessonAdvancer(500)
    advancer.update(true, 1000)
    expect(advancer.update(false, 1200).progress).toBe(0)
    expect(advancer.update(true, 1300).progress).toBe(0)
  })
})
