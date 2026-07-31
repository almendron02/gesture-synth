import { describe, expect, it } from 'vitest'
import { buildChord } from '../music/chords'
import { parseGestureLoop } from './loopStorage'
import type { GestureLoop, RecordedChordEvent } from './looper.types'

const recordedEvent: RecordedChordEvent = {
  id: 'event-1',
  startMs: 0,
  durationMs: 1200,
  chord: buildChord('I', 'major'),
  expression: 0.7,
  brightness: 0.5,
}

const savedLoop: GestureLoop = {
  version: 2,
  id: 'loop-1',
  createdAt: '2026-07-30T12:00:00.000Z',
  bpm: 100,
  bars: 2,
  quantization: '1/8',
  durationMs: 4800,
  layers: [{
    id: 'layer-1',
    name: 'Layer 1',
    createdAt: '2026-07-30T12:00:00.000Z',
    muted: false,
    events: [recordedEvent],
  }, {
    id: 'layer-2',
    name: 'Layer 2',
    createdAt: '2026-07-30T12:01:00.000Z',
    muted: true,
    events: [{ ...recordedEvent, id: 'event-2', startMs: 2400 }],
  }],
}

describe('loop storage', () => {
  it('accepts a serialized multi-layer gesture loop', () => {
    expect(parseGestureLoop(JSON.stringify(savedLoop))).toEqual(savedLoop)
    expect(parseGestureLoop(JSON.stringify(savedLoop))?.layers).toHaveLength(2)
  })

  it('migrates a version-one take into the first layer', () => {
    const legacy = {
      ...savedLoop,
      version: 1,
      layers: undefined,
      events: [recordedEvent],
    }
    const migrated = parseGestureLoop(JSON.stringify(legacy))
    expect(migrated?.version).toBe(2)
    expect(migrated?.layers).toHaveLength(1)
    expect(migrated?.layers[0]).toMatchObject({ name: 'Layer 1', muted: false, events: [recordedEvent] })
  })

  it('rejects malformed or unsupported loop data', () => {
    expect(parseGestureLoop('{broken')).toBeNull()
    expect(parseGestureLoop(JSON.stringify({ ...savedLoop, version: 3 }))).toBeNull()
    expect(parseGestureLoop(JSON.stringify({ ...savedLoop, layers: [{ nope: true }] }))).toBeNull()
  })
})
