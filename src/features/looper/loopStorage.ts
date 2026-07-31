import type { GestureLoop, LoopQuantization, RecordedChordEvent } from './looper.types'

export const GESTURE_LOOP_STORAGE_KEY = 'gesture-synth:performance-loop-v1'
const quantizationValues: readonly LoopQuantization[] = ['off', '1/4', '1/8', '1/16']

function isEvent(value: unknown): value is RecordedChordEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<RecordedChordEvent>
  return typeof event.id === 'string'
    && Number.isFinite(event.startMs)
    && Number.isFinite(event.durationMs)
    && Number.isFinite(event.expression)
    && Number.isFinite(event.brightness)
    && Boolean(event.chord)
    && Array.isArray(event.chord?.notes)
}

export function parseGestureLoop(serialized: string | null): GestureLoop | null {
  if (!serialized) return null
  try {
    const loop = JSON.parse(serialized) as Partial<GestureLoop>
    if (loop.version !== 1 || typeof loop.id !== 'string' || typeof loop.createdAt !== 'string') return null
    if (!Number.isFinite(loop.bpm) || !Number.isFinite(loop.bars) || !Number.isFinite(loop.durationMs)) return null
    if (!quantizationValues.includes(loop.quantization as LoopQuantization)) return null
    if (!Array.isArray(loop.events) || !loop.events.every(isEvent)) return null
    return loop as GestureLoop
  } catch {
    return null
  }
}

export function loadGestureLoop(): GestureLoop | null {
  return parseGestureLoop(window.localStorage.getItem(GESTURE_LOOP_STORAGE_KEY))
}

export function saveGestureLoop(loop: GestureLoop): void {
  window.localStorage.setItem(GESTURE_LOOP_STORAGE_KEY, JSON.stringify(loop))
}

export function removeGestureLoop(): void {
  window.localStorage.removeItem(GESTURE_LOOP_STORAGE_KEY)
}
