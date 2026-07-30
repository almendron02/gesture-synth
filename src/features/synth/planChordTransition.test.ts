import { describe, expect, it } from 'vitest'
import { planChordTransition } from './planChordTransition'

describe('planChordTransition', () => {
  it('preserves shared notes while changing chords', () => {
    expect(planChordTransition(['C3', 'E3', 'G3'], ['C3', 'F3', 'A3'])).toEqual({
      entering: ['F3', 'A3'],
      leaving: ['E3', 'G3'],
      sustained: ['C3'],
    })
  })

  it('attacks every note when the synth is silent', () => {
    expect(planChordTransition([], ['A3', 'C4', 'E4'])).toEqual({
      entering: ['A3', 'C4', 'E4'],
      leaving: [],
      sustained: [],
    })
  })

  it('does not retrigger an unchanged voicing', () => {
    expect(planChordTransition(['C3', 'E3', 'G3'], ['C3', 'E3', 'G3'])).toEqual({
      entering: [],
      leaving: [],
      sustained: ['C3', 'E3', 'G3'],
    })
  })
})
