import { describe, expect, it } from 'vitest'
import { buildChord } from '../music/chords'
import { GestureLoopRecorder, beatDurationMs, chordEventKey, loopDurationMs } from './GestureLoopRecorder'

describe('GestureLoopRecorder', () => {
  it('records chord changes and averages their expression', () => {
    const recorder = new GestureLoopRecorder()
    const cMajor = buildChord('I', 'major')
    const fMajor = buildChord('IV', 'major')
    recorder.start(1000, { bpm: 120, bars: 1, quantization: 'off' })
    recorder.update(cMajor, 1100, 0.5, 0.4)
    recorder.update(cMajor, 1300, 0.9, 0.8)
    recorder.update(fMajor, 1500, 0.7, 0.6)
    const loop = recorder.stop(3000)

    expect(loop?.name).toBe('Layer 1')
    expect(loop?.events).toHaveLength(2)
    expect(loop?.events[0]).toMatchObject({ startMs: 100, durationMs: 400 })
    expect(loop?.events[0].expression).toBeCloseTo(0.7)
    expect(loop?.events[0].brightness).toBeCloseTo(0.6)
    expect(loop?.events[1]).toMatchObject({ startMs: 500, durationMs: 1500 })
  })

  it('quantizes event boundaries while preserving a full-bar loop', () => {
    const recorder = new GestureLoopRecorder()
    const chord = buildChord('VI', 'minor', 'seventh')
    recorder.start(0, { bpm: 120, bars: 2, quantization: '1/8' })
    recorder.update(chord, 130, 0.65, 0.5)
    recorder.update(null, 615, 0.65, 0.5)
    const loop = recorder.stop(4000)

    expect(loop?.events[0]).toMatchObject({ startMs: 250, durationMs: 250 })
  })

  it('returns no take when no valid chord was performed', () => {
    const recorder = new GestureLoopRecorder()
    recorder.start(0, { bpm: 100, bars: 1, quantization: '1/8' })
    expect(recorder.stop(2400)).toBeNull()
  })

  it('provides stable musical timing and chord keys', () => {
    expect(beatDurationMs(120)).toBe(500)
    expect(loopDurationMs(120, 4)).toBe(8000)
    expect(chordEventKey(buildChord('I', 'major'))).toBe('I-major-root-0')
  })
})
