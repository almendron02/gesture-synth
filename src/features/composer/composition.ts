import type { GestureLoop, GestureLoopLayer } from '../looper/looper.types'
import type { Composition, ComposerNote, ComposerTrack } from './composer.types'

export const BEATS_PER_BAR = 4
export const COMPOSER_PITCHES = buildPitchRange(2, 7)

const trackDefaults: readonly Pick<ComposerTrack, 'name' | 'preset' | 'color'>[] = [
  { name: 'Harmony', preset: 'dream-pad', color: 'lime' },
  { name: 'Melody', preset: 'original', color: 'violet' },
  { name: 'Texture', preset: 'choir', color: 'orange' },
  { name: 'Rhythm', preset: 'original', color: 'blue' },
]

function buildPitchRange(lowOctave: number, highOctave: number): string[] {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const pitches: string[] = []
  for (let octave = highOctave; octave >= lowOctave; octave -= 1) {
    for (let index = names.length - 1; index >= 0; index -= 1) pitches.push(`${names[index]}${octave}`)
  }
  return pitches
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyTrack(index: number): ComposerTrack {
  const defaults = trackDefaults[index % trackDefaults.length]
  return {
    id: createId('track'),
    name: defaults.name,
    preset: defaults.preset,
    color: defaults.color,
    muted: false,
    solo: false,
    notes: [],
  }
}

export function createComposition(now = new Date()): Composition {
  const timestamp = now.toISOString()
  return {
    version: 1,
    id: createId('composition'),
    name: 'Untitled composition',
    createdAt: timestamp,
    updatedAt: timestamp,
    bpm: 100,
    bars: 8,
    quantization: '1/8',
    tracks: trackDefaults.map((_, index) => createEmptyTrack(index)),
  }
}

export function totalBeats(composition: Pick<Composition, 'bars'>): number {
  return composition.bars * BEATS_PER_BAR
}

export function quantizationBeats(quantization: Composition['quantization']): number {
  if (quantization === '1/16') return 0.25
  if (quantization === '1/8') return 0.5
  return 1
}

export function snapBeat(beat: number, quantization: Composition['quantization']): number {
  const step = quantizationBeats(quantization)
  return Math.round(beat / step) * step
}

export function clampNote(note: ComposerNote, composition: Pick<Composition, 'bars' | 'quantization'>): ComposerNote {
  const maximumBeat = totalBeats(composition)
  const minimumDuration = quantizationBeats(composition.quantization)
  const startBeat = Math.max(0, Math.min(maximumBeat - minimumDuration, snapBeat(note.startBeat, composition.quantization)))
  const durationBeats = Math.max(
    minimumDuration,
    Math.min(maximumBeat - startBeat, snapBeat(note.durationBeats, composition.quantization)),
  )
  return {
    ...note,
    startBeat,
    durationBeats,
    velocity: Math.max(0.05, Math.min(1, note.velocity)),
    expression: Math.max(0, Math.min(1, note.expression)),
    brightness: Math.max(0, Math.min(1, note.brightness)),
  }
}

export function pitchToMidi(pitch: string): number | null {
  const match = pitch.match(/^([A-G])(#?)(-?\d+)$/)
  if (!match) return null
  const semitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  return (Number(match[3]) + 1) * 12 + semitones[match[1]] + (match[2] ? 1 : 0)
}

export function midiToPitch(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const safeMidi = Math.max(0, Math.min(127, Math.round(midi)))
  return `${names[safeMidi % 12]}${Math.floor(safeMidi / 12) - 1}`
}

export function transposePitch(pitch: string, semitones: number): string {
  const midi = pitchToMidi(pitch)
  return midi == null ? pitch : midiToPitch(midi + semitones)
}

export function gestureLoopToTracks(loop: GestureLoop): ComposerTrack[] {
  return loop.layers.map((layer, layerIndex) => ({
    id: createId('gesture-track'),
    name: `Gesture ${layerIndex + 1}`,
    preset: layerIndex % 2 === 0 ? 'dream-pad' : 'choir',
    color: trackDefaults[layerIndex % trackDefaults.length].color,
    muted: layer.muted,
    solo: false,
    notes: gestureLayerToNotes(layer, loop.bpm, layer.id),
  }))
}

export function gestureLayerToNotes(layer: GestureLoopLayer, bpm: number, takeId: string): ComposerNote[] {
  const beatMs = 60_000 / bpm
  return layer.events.flatMap((event) => event.chord.notes.map((pitch, noteIndex) => ({
    id: createId(`gesture-note-${noteIndex}`),
    pitch,
    startBeat: event.startMs / beatMs,
    durationBeats: event.durationMs / beatMs,
    velocity: event.expression,
    expression: event.expression,
    brightness: event.brightness,
    source: 'gesture' as const,
    takeId,
  })))
}

export function importGestureLoop(composition: Composition, loop: GestureLoop): Composition {
  const importedTracks = gestureLoopToTracks(loop)
  const existingTracks = composition.tracks.filter((track) => track.notes.length > 0)
  const tracks = [...existingTracks, ...importedTracks]
  while (tracks.length < 4) tracks.push(createEmptyTrack(tracks.length))
  return {
    ...composition,
    bpm: loop.bpm,
    bars: Math.max(composition.bars, loop.bars),
    quantization: loop.quantization === 'off' ? composition.quantization : loop.quantization,
    tracks,
    updatedAt: new Date().toISOString(),
  }
}
