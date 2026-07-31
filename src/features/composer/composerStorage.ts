import type { Composition, ComposerNote, ComposerTrack } from './composer.types'

export const COMPOSITION_STORAGE_KEY = 'gesture-synth:composition-v1'

function isNote(value: unknown): value is ComposerNote {
  if (!value || typeof value !== 'object') return false
  const note = value as Partial<ComposerNote>
  return typeof note.id === 'string'
    && typeof note.pitch === 'string'
    && Number.isFinite(note.startBeat)
    && Number.isFinite(note.durationBeats)
    && Number.isFinite(note.velocity)
    && Number.isFinite(note.expression)
    && Number.isFinite(note.brightness)
    && (note.source === 'drawn' || note.source === 'keyboard' || note.source === 'gesture')
}

function isTrack(value: unknown): value is ComposerTrack {
  if (!value || typeof value !== 'object') return false
  const track = value as Partial<ComposerTrack>
  return typeof track.id === 'string'
    && typeof track.name === 'string'
    && (track.preset === 'original' || track.preset === 'choir' || track.preset === 'dream-pad')
    && (track.color === 'lime' || track.color === 'violet' || track.color === 'orange' || track.color === 'blue')
    && typeof track.muted === 'boolean'
    && typeof track.solo === 'boolean'
    && Array.isArray(track.notes)
    && track.notes.every(isNote)
}

export function parseComposition(serialized: string | null): Composition | null {
  if (!serialized) return null
  try {
    const composition = JSON.parse(serialized) as Partial<Composition>
    if (composition.version !== 1
      || typeof composition.id !== 'string'
      || typeof composition.name !== 'string'
      || typeof composition.createdAt !== 'string'
      || typeof composition.updatedAt !== 'string'
      || !Number.isFinite(composition.bpm)
      || !Number.isFinite(composition.bars)
      || !['1/4', '1/8', '1/16'].includes(composition.quantization ?? '')
      || !Array.isArray(composition.tracks)
      || !composition.tracks.length
      || !composition.tracks.every(isTrack)) return null
    return composition as Composition
  } catch {
    return null
  }
}

export function loadComposition(): Composition | null {
  return parseComposition(window.localStorage.getItem(COMPOSITION_STORAGE_KEY))
}

export function saveComposition(composition: Composition): void {
  window.localStorage.setItem(COMPOSITION_STORAGE_KEY, JSON.stringify(composition))
}
