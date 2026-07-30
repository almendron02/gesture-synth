import { describe, expect, it } from 'vitest'
import { buildChord } from './chords'

describe('buildChord', () => {
  it('builds C major from degree I', () => {
    expect(buildChord('I', 'major')).toMatchObject({
      name: 'C major', notes: ['C3', 'E3', 'G3'], degree: 'I', quality: 'major', voicing: 'root',
    })
  })

  it('builds A minor from degree VI with octave wrapping', () => {
    expect(buildChord('VI', 'minor')).toMatchObject({
      name: 'A minor', notes: ['A3', 'C4', 'E4'], degree: 'VI', quality: 'minor', voicing: 'root',
    })
  })

  it('uses the gesture quality directly', () => {
    expect(buildChord('IV', 'minor').notes).toEqual(['F3', 'G#3', 'C4'])
  })

  it('moves the root into the top voice for first inversion', () => {
    expect(buildChord('I', 'major', 'first-inversion').notes).toEqual(['E3', 'G3', 'C4'])
  })

  it('creates quality-aware seventh chords', () => {
    expect(buildChord('I', 'major', 'seventh').notes).toEqual(['C3', 'E3', 'G3', 'B3'])
    expect(buildChord('I', 'minor', 'color-seventh').notes).toEqual(['C3', 'D#3', 'F#3', 'A3'])
  })

  it('applies the right thumb octave shift', () => {
    expect(buildChord('I', 'major', 'root', -1).notes).toEqual(['C2', 'E2', 'G2'])
  })
})
