import { describe, expect, it } from 'vitest'
import { buildChord } from '../music/chords'
import { parseGestureLoop } from './loopStorage'
import type { GestureLoop } from './looper.types'

const savedLoop: GestureLoop = {
  version: 1,
  id: 'loop-1',
  createdAt: '2026-07-30T12:00:00.000Z',
  bpm: 100,
  bars: 2,
  quantization: '1/8',
  durationMs: 4800,
  events: [{
    id: 'event-1',
    startMs: 0,
    durationMs: 1200,
    chord: buildChord('I', 'major'),
    expression: 0.7,
    brightness: 0.5,
  }],
}

describe('loop storage', () => {
  it('accepts a serialized version-one gesture loop', () => {
    expect(parseGestureLoop(JSON.stringify(savedLoop))).toEqual(savedLoop)
  })

  it('rejects malformed or unsupported loop data', () => {
    expect(parseGestureLoop('{broken')).toBeNull()
    expect(parseGestureLoop(JSON.stringify({ ...savedLoop, version: 2 }))).toBeNull()
    expect(parseGestureLoop(JSON.stringify({ ...savedLoop, events: [{ nope: true }] }))).toBeNull()
  })
})
