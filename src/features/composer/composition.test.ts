import { describe, expect, it } from 'vitest'
import { buildChord } from '../music/chords'
import type { GestureLoop } from '../looper/looper.types'
import { clampNote, createComposition, gestureLoopToTracks, importGestureLoop, midiToPitch, pitchToMidi, snapBeat } from './composition'

describe('composition model', () => {
  it('creates a four-track beat-based project', () => {
    const composition = createComposition(new Date('2026-07-31T12:00:00.000Z'))

    expect(composition).toMatchObject({ version: 1, bpm: 100, bars: 8, quantization: '1/8' })
    expect(composition.tracks).toHaveLength(4)
  })

  it('converts between pitch names and MIDI numbers', () => {
    expect(pitchToMidi('C4')).toBe(60)
    expect(pitchToMidi('C#7')).toBe(97)
    expect(midiToPitch(69)).toBe('A4')
  })

  it('snaps and clamps notes to the project grid', () => {
    expect(snapBeat(1.31, '1/8')).toBe(1.5)
    expect(clampNote({
      id: 'note-1',
      pitch: 'C4',
      startBeat: 31.9,
      durationBeats: 4,
      velocity: 2,
      expression: -1,
      brightness: 0.5,
      source: 'drawn',
    }, { bars: 8, quantization: '1/8' })).toMatchObject({ startBeat: 31.5, durationBeats: 0.5, velocity: 1, expression: 0 })
  })

  it('turns gesture chords into editable note tracks while preserving expression', () => {
    const loop: GestureLoop = {
      version: 2,
      id: 'loop-1',
      createdAt: '2026-07-31T12:00:00.000Z',
      bpm: 120,
      bars: 2,
      quantization: '1/8',
      durationMs: 4000,
      layers: [{
        id: 'layer-1',
        name: 'Layer 1',
        createdAt: '2026-07-31T12:00:00.000Z',
        muted: false,
        events: [{
          id: 'event-1',
          startMs: 500,
          durationMs: 1000,
          chord: buildChord('I', 'major'),
          expression: 0.8,
          brightness: 0.65,
        }],
      }],
    }

    const tracks = gestureLoopToTracks(loop)
    expect(tracks[0].notes).toHaveLength(3)
    expect(tracks[0].notes[0]).toMatchObject({ startBeat: 1, durationBeats: 2, velocity: 0.8, brightness: 0.65, source: 'gesture', takeId: 'layer-1' })

    const imported = importGestureLoop(createComposition(), loop)
    expect(imported.bpm).toBe(120)
    expect(imported.tracks.some((track) => track.name === 'Gesture 1')).toBe(true)
  })
})
