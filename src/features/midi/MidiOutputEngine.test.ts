import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildChord } from '../music/chords'
import { normalizedToMidiValue, noteNameToMidi } from './MidiOutputEngine'
import { MidiOutputEngine } from './MidiOutputEngine'

afterEach(() => vi.unstubAllGlobals())

describe('MIDI note conversion', () => {
  it('converts scientific pitch notation into MIDI note numbers', () => {
    expect(noteNameToMidi('C4')).toBe(60)
    expect(noteNameToMidi('C#4')).toBe(61)
    expect(noteNameToMidi('Bb3')).toBe(58)
    expect(noteNameToMidi('C2')).toBe(36)
  })

  it('rejects malformed and out-of-range notes', () => {
    expect(noteNameToMidi('H4')).toBeNull()
    expect(noteNameToMidi('C-2')).toBeNull()
    expect(noteNameToMidi('G10')).toBeNull()
  })
})

describe('MIDI controller conversion', () => {
  it('maps normalized expression into seven-bit values', () => {
    expect(normalizedToMidiValue(0)).toBe(0)
    expect(normalizedToMidiValue(0.5)).toBe(64)
    expect(normalizedToMidiValue(1)).toBe(127)
    expect(normalizedToMidiValue(2)).toBe(127)
  })
})

describe('MIDI output engine', () => {
  it('sends controllers, chord notes, releases, and panic messages on the selected channel', async () => {
    const send = vi.fn()
    const output = {
      id: 'virtual-port',
      name: 'DAW Port',
      manufacturer: 'Virtual',
      state: 'connected',
      connection: 'closed',
      open: vi.fn().mockResolvedValue(undefined),
      send,
    } as unknown as MIDIOutput
    const access = {
      outputs: new Map([[output.id, output]]),
      onstatechange: null,
    } as unknown as MIDIAccess
    vi.stubGlobal('navigator', { requestMIDIAccess: vi.fn().mockResolvedValue(access) })

    const engine = new MidiOutputEngine()
    engine.setChannel(2)
    await engine.requestAccess()
    await engine.selectOutput(output.id)
    engine.updateControllers(0.5, 1, 100)
    engine.play(buildChord('I', 'major'))
    engine.release()
    engine.panic()

    expect(send).toHaveBeenCalledWith([0xb1, 11, 83])
    expect(send).toHaveBeenCalledWith([0xb1, 74, 70])
    expect(send).toHaveBeenCalledWith([0x91, 48, 80])
    expect(send).toHaveBeenCalledWith([0x81, 48, 0])
    expect(send).toHaveBeenCalledWith([0xb1, 123, 0])
    expect(send).toHaveBeenCalledWith([0xb1, 120, 0])
  })
})
