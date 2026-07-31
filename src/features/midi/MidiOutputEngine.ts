import type { Chord } from '../music/chords'

export interface MidiOutputDevice {
  id: string
  name: string
  manufacturer: string
}

type DevicesChangedListener = (devices: MidiOutputDevice[]) => void

const NOTE_OFF = 0x80
const NOTE_ON = 0x90
const CONTROL_CHANGE = 0xb0
const EXPRESSION_CC = 11
const BRIGHTNESS_CC = 74
const ALL_SOUND_OFF_CC = 120
const ALL_NOTES_OFF_CC = 123
const CONTROLLER_INTERVAL_MS = 24

const noteOffsets: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

export function noteNameToMidi(noteName: string): number | null {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(noteName.trim())
  if (!match) return null
  const [, letter, accidental, octaveText] = match
  const accidentalOffset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
  const midiNote = (Number(octaveText) + 1) * 12 + noteOffsets[letter.toUpperCase()] + accidentalOffset
  return Number.isInteger(midiNote) && midiNote >= 0 && midiNote <= 127 ? midiNote : null
}

export function normalizedToMidiValue(value: number): number {
  return Math.round(clamp(value, 0, 1) * 127)
}

function channelStatus(message: number, channel: number): number {
  return message | (clamp(Math.round(channel), 1, 16) - 1)
}

export class MidiOutputEngine {
  private access: MIDIAccess | null = null
  private output: MIDIOutput | null = null
  private channel = 1
  private activeNotes = new Set<number>()
  private expression = 0.65
  private brightness = 0.55
  private lastExpressionValue = -1
  private lastBrightnessValue = -1
  private lastControllerSentAt = 0
  private devicesChangedListener: DevicesChangedListener | null = null

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'
  }

  async requestAccess(): Promise<MidiOutputDevice[]> {
    if (!this.isSupported()) throw new Error('Web MIDI is not supported in this browser.')
    if (!this.access) {
      this.access = await navigator.requestMIDIAccess({ sysex: false })
      this.access.onstatechange = () => {
        if (this.output?.state === 'disconnected') {
          this.output = null
          this.activeNotes.clear()
        }
        this.emitDevicesChanged()
      }
    }
    const devices = this.getOutputs()
    this.devicesChangedListener?.(devices)
    return devices
  }

  setDevicesChangedListener(listener: DevicesChangedListener | null): void {
    this.devicesChangedListener = listener
  }

  getOutputs(): MidiOutputDevice[] {
    if (!this.access) return []
    return Array.from(this.access.outputs.values())
      .filter((output) => output.state === 'connected')
      .map((output) => ({
        id: output.id,
        name: output.name || 'Unnamed MIDI output',
        manufacturer: output.manufacturer || 'Unknown maker',
      }))
  }

  async selectOutput(outputId: string | null): Promise<void> {
    this.release()
    this.output = null
    if (!outputId || !this.access) return
    const nextOutput = this.access.outputs.get(outputId)
    if (!nextOutput || nextOutput.state !== 'connected') throw new Error('That MIDI output is no longer connected.')
    await nextOutput.open()
    this.output = nextOutput
    this.sendControllers(true)
  }

  setChannel(channel: number): void {
    const nextChannel = clamp(Math.round(channel), 1, 16)
    if (nextChannel === this.channel) return
    this.release()
    this.channel = nextChannel
    this.lastExpressionValue = -1
    this.lastBrightnessValue = -1
    this.sendControllers(true)
  }

  play(chord: Chord): void {
    if (!this.output) return
    const nextNotes = new Set(chord.notes.map(noteNameToMidi).filter((note): note is number => note !== null))
    const statusOff = channelStatus(NOTE_OFF, this.channel)
    const statusOn = channelStatus(NOTE_ON, this.channel)
    const velocity = clamp(32 + Math.round(this.expression * 95), 1, 127)

    this.activeNotes.forEach((note) => {
      if (!nextNotes.has(note)) this.send([statusOff, note, 0])
    })
    nextNotes.forEach((note) => {
      if (!this.activeNotes.has(note)) this.send([statusOn, note, velocity])
    })
    this.activeNotes = nextNotes
  }

  updateControllers(expression: number, brightness: number, timestamp = performance.now()): void {
    this.expression = clamp(expression, 0, 1)
    this.brightness = clamp(brightness, 0, 1)
    if (timestamp - this.lastControllerSentAt < CONTROLLER_INTERVAL_MS) return
    this.sendControllers(false)
    this.lastControllerSentAt = timestamp
  }

  release(): void {
    if (!this.activeNotes.size) return
    const status = channelStatus(NOTE_OFF, this.channel)
    this.activeNotes.forEach((note) => this.send([status, note, 0]))
    this.activeNotes.clear()
  }

  panic(): void {
    this.release()
    const status = channelStatus(CONTROL_CHANGE, this.channel)
    this.send([status, ALL_NOTES_OFF_CC, 0])
    this.send([status, ALL_SOUND_OFF_CC, 0])
  }

  getActiveNoteCount(): number {
    return this.activeNotes.size
  }

  dispose(): void {
    this.panic()
    if (this.access) this.access.onstatechange = null
    this.devicesChangedListener = null
    this.output = null
    this.access = null
  }

  private sendControllers(force: boolean): void {
    if (!this.output) return
    const expressionValue = normalizedToMidiValue(this.expression)
    const brightnessValue = normalizedToMidiValue(this.brightness)
    const status = channelStatus(CONTROL_CHANGE, this.channel)
    if (force || expressionValue !== this.lastExpressionValue) {
      this.send([status, EXPRESSION_CC, expressionValue])
      this.lastExpressionValue = expressionValue
    }
    if (force || brightnessValue !== this.lastBrightnessValue) {
      this.send([status, BRIGHTNESS_CC, brightnessValue])
      this.lastBrightnessValue = brightnessValue
    }
  }

  private send(message: number[]): void {
    if (!this.output || this.output.state !== 'connected') return
    try {
      this.output.send(message)
    } catch {
      this.activeNotes.clear()
    }
  }

  private emitDevicesChanged(): void {
    this.devicesChangedListener?.(this.getOutputs())
  }
}
