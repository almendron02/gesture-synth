import type { SoundPreset } from '../synth/soundPresets'

export type NoteSource = 'drawn' | 'keyboard' | 'gesture'

export interface ComposerNote {
  id: string
  pitch: string
  startBeat: number
  durationBeats: number
  velocity: number
  expression: number
  brightness: number
  source: NoteSource
}

export interface ComposerTrack {
  id: string
  name: string
  preset: SoundPreset
  color: 'lime' | 'violet' | 'orange' | 'blue'
  muted: boolean
  solo: boolean
  notes: ComposerNote[]
}

export interface Composition {
  version: 1
  id: string
  name: string
  createdAt: string
  updatedAt: string
  bpm: number
  bars: number
  quantization: '1/4' | '1/8' | '1/16'
  tracks: ComposerTrack[]
}
