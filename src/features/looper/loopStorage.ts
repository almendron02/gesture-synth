import type {
  GestureLoop,
  GestureLoopLayer,
  LoopQuantization,
  RecordedChordEvent,
} from './looper.types'

export const GESTURE_LOOP_STORAGE_KEY = 'gesture-synth:performance-loop-v1'
const quantizationValues: readonly LoopQuantization[] = ['off', '1/4', '1/8', '1/16']

interface LegacyGestureLoop {
  version: 1
  id: string
  createdAt: string
  bpm: number
  bars: number
  quantization: LoopQuantization
  durationMs: number
  events: RecordedChordEvent[]
}

interface StoredLoopShape {
  version?: number
  id?: string
  createdAt?: string
  bpm?: number
  bars?: number
  quantization?: LoopQuantization
  durationMs?: number
  events?: unknown[]
  layers?: unknown[]
}

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

function isLayer(value: unknown): value is GestureLoopLayer {
  if (!value || typeof value !== 'object') return false
  const layer = value as Partial<GestureLoopLayer>
  return typeof layer.id === 'string'
    && typeof layer.name === 'string'
    && typeof layer.createdAt === 'string'
    && typeof layer.muted === 'boolean'
    && Array.isArray(layer.events)
    && layer.events.every(isEvent)
}

function hasValidTransport(loop: StoredLoopShape): boolean {
  return typeof loop.id === 'string'
    && typeof loop.createdAt === 'string'
    && Number.isFinite(loop.bpm)
    && Number.isFinite(loop.bars)
    && Number.isFinite(loop.durationMs)
    && quantizationValues.includes(loop.quantization as LoopQuantization)
}

function migrateLegacyLoop(loop: LegacyGestureLoop): GestureLoop {
  return {
    version: 2,
    id: loop.id,
    createdAt: loop.createdAt,
    bpm: loop.bpm,
    bars: loop.bars,
    quantization: loop.quantization,
    durationMs: loop.durationMs,
    layers: [{
      id: `${loop.id}-layer-1`,
      name: 'Layer 1',
      createdAt: loop.createdAt,
      muted: false,
      events: loop.events,
    }],
  }
}

export function parseGestureLoop(serialized: string | null): GestureLoop | null {
  if (!serialized) return null
  try {
    const value = JSON.parse(serialized) as StoredLoopShape
    if (!hasValidTransport(value)) return null
    if (value.version === 1 && Array.isArray(value.events) && value.events.every(isEvent)) {
      return migrateLegacyLoop(value as unknown as LegacyGestureLoop)
    }
    if (value.version !== 2 || !Array.isArray(value.layers) || !value.layers.length || !value.layers.every(isLayer)) return null
    return value as GestureLoop
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
