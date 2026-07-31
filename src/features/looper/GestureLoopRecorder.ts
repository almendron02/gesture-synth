import type { Chord } from '../music/chords'
import type {
  GestureLoopLayer,
  LoopQuantization,
  LoopRecordingOptions,
  RecordedChordEvent,
} from './looper.types'

interface ActiveRecordingEvent {
  chord: Chord
  startedAt: number
  expressionTotal: number
  brightnessTotal: number
  sampleCount: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

export function chordEventKey(chord: Chord): string {
  return `${chord.degree}-${chord.quality}-${chord.voicing}-${chord.octaveShift}`
}

export function beatDurationMs(bpm: number): number {
  return 60_000 / clamp(bpm, 40, 220)
}

export function loopDurationMs(bpm: number, bars: number): number {
  return beatDurationMs(bpm) * 4 * clamp(Math.round(bars), 1, 8)
}

function quantizationStepMs(bpm: number, quantization: LoopQuantization): number | null {
  if (quantization === 'off') return null
  const beat = beatDurationMs(bpm)
  if (quantization === '1/16') return beat / 4
  if (quantization === '1/8') return beat / 2
  return beat
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step
}

function normalizedEvents(
  events: readonly RecordedChordEvent[],
  durationMs: number,
  bpm: number,
  quantization: LoopQuantization,
): RecordedChordEvent[] {
  const step = quantizationStepMs(bpm, quantization)
  const normalized = events
    .map((event) => {
      const rawStart = clamp(event.startMs, 0, durationMs)
      const rawEnd = clamp(event.startMs + event.durationMs, 0, durationMs)
      const startMs = step ? clamp(quantize(rawStart, step), 0, durationMs) : rawStart
      const endMs = step
        ? clamp(Math.max(startMs + step, quantize(rawEnd, step)), 0, durationMs)
        : rawEnd
      return { ...event, startMs, durationMs: Math.max(0, endMs - startMs) }
    })
    .filter((event) => event.durationMs >= 24 && event.startMs < durationMs)
    .sort((a, b) => a.startMs - b.startMs)

  return normalized.map((event, index) => {
    const nextStart = normalized[index + 1]?.startMs ?? durationMs
    return {
      ...event,
      durationMs: Math.max(0, Math.min(event.durationMs, nextStart - event.startMs)),
    }
  }).filter((event) => event.durationMs >= 24)
}

export class GestureLoopRecorder {
  private recordingStartedAt: number | null = null
  private options: LoopRecordingOptions | null = null
  private activeEvent: ActiveRecordingEvent | null = null
  private events: RecordedChordEvent[] = []

  start(timestamp: number, options: LoopRecordingOptions): void {
    this.recordingStartedAt = timestamp
    this.options = options
    this.activeEvent = null
    this.events = []
  }

  update(chord: Chord | null, timestamp: number, expression: number, brightness: number): void {
    if (this.recordingStartedAt == null || !this.options) return

    const elapsed = clamp(timestamp - this.recordingStartedAt, 0, loopDurationMs(this.options.bpm, this.options.bars))
    if (!chord) {
      this.closeActiveEvent(elapsed)
      return
    }

    if (this.activeEvent && chordEventKey(this.activeEvent.chord) === chordEventKey(chord)) {
      this.activeEvent.expressionTotal += expression
      this.activeEvent.brightnessTotal += brightness
      this.activeEvent.sampleCount += 1
      return
    }

    this.closeActiveEvent(elapsed)
    this.activeEvent = {
      chord,
      startedAt: elapsed,
      expressionTotal: expression,
      brightnessTotal: brightness,
      sampleCount: 1,
    }
  }

  stop(timestamp: number, layerNumber = 1): GestureLoopLayer | null {
    if (this.recordingStartedAt == null || !this.options) return null
    const options = this.options
    const duration = loopDurationMs(options.bpm, options.bars)
    this.closeActiveEvent(clamp(timestamp - this.recordingStartedAt, 0, duration))
    const events = normalizedEvents(this.events, duration, options.bpm, options.quantization)
    this.reset()
    if (!events.length) return null

    return {
      id: `layer-${Date.now()}-${layerNumber}`,
      name: `Layer ${layerNumber}`,
      createdAt: new Date().toISOString(),
      muted: false,
      events,
    }
  }

  cancel(): void {
    this.reset()
  }

  private closeActiveEvent(endedAt: number): void {
    if (!this.activeEvent) return
    const sampleCount = Math.max(1, this.activeEvent.sampleCount)
    const durationMs = endedAt - this.activeEvent.startedAt
    if (durationMs >= 24) {
      this.events.push({
        id: `event-${this.events.length + 1}`,
        startMs: this.activeEvent.startedAt,
        durationMs,
        chord: this.activeEvent.chord,
        expression: clamp(this.activeEvent.expressionTotal / sampleCount, 0.2, 1),
        brightness: clamp(this.activeEvent.brightnessTotal / sampleCount, 0, 1),
      })
    }
    this.activeEvent = null
  }

  private reset(): void {
    this.recordingStartedAt = null
    this.options = null
    this.activeEvent = null
    this.events = []
  }
}
