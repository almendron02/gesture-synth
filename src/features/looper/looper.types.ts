import type { Chord } from '../music/chords'

export type LoopQuantization = 'off' | '1/4' | '1/8' | '1/16'
export type LooperMode = 'idle' | 'count-in' | 'recording' | 'playing' | 'overdub-count-in' | 'overdubbing'

export interface RecordedChordEvent {
  id: string
  startMs: number
  durationMs: number
  chord: Chord
  expression: number
  brightness: number
}

export interface GestureLoopLayer {
  id: string
  name: string
  createdAt: string
  muted: boolean
  events: RecordedChordEvent[]
}

export interface GestureLoop {
  version: 2
  id: string
  createdAt: string
  bpm: number
  bars: number
  quantization: LoopQuantization
  durationMs: number
  layers: GestureLoopLayer[]
}

export interface LoopRecordingOptions {
  bpm: number
  bars: number
  quantization: LoopQuantization
}
