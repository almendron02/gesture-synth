import type { Chord } from '../music/chords'

export type LoopQuantization = 'off' | '1/4' | '1/8' | '1/16'
export type LooperMode = 'idle' | 'count-in' | 'recording' | 'playing'

export interface RecordedChordEvent {
  id: string
  startMs: number
  durationMs: number
  chord: Chord
  expression: number
  brightness: number
}

export interface GestureLoop {
  version: 1
  id: string
  createdAt: string
  bpm: number
  bars: number
  quantization: LoopQuantization
  durationMs: number
  events: RecordedChordEvent[]
}

export interface LoopRecordingOptions {
  bpm: number
  bars: number
  quantization: LoopQuantization
}
