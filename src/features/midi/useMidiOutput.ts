import { useCallback, useEffect, useRef, useState } from 'react'
import type { Chord } from '../music/chords'
import { MidiOutputEngine, type MidiOutputDevice } from './MidiOutputEngine'

export type MidiConnectionStatus = 'unsupported' | 'idle' | 'requesting' | 'ready' | 'error'

const OUTPUT_STORAGE_KEY = 'gesture-synth:midi-output-id'
const CHANNEL_STORAGE_KEY = 'gesture-synth:midi-channel'

function savedChannel(): number {
  const value = Number(window.localStorage.getItem(CHANNEL_STORAGE_KEY))
  return Number.isInteger(value) && value >= 1 && value <= 16 ? value : 1
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'SecurityError') {
    return 'MIDI permission was blocked. Allow MIDI access in your browser settings.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'MIDI could not connect. Check the device and browser permission.'
}

export function useMidiOutput() {
  const [channel, setChannelState] = useState(savedChannel)
  const engineRef = useRef<MidiOutputEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new MidiOutputEngine()
    engineRef.current.setChannel(channel)
  }
  const engine = engineRef.current
  const supported = engine.isSupported()
  const [status, setStatus] = useState<MidiConnectionStatus>(supported ? 'idle' : 'unsupported')
  const [outputs, setOutputs] = useState<MidiOutputDevice[]>([])
  const [outputId, setOutputIdState] = useState<string | null>(null)
  const outputIdRef = useRef<string | null>(null)
  const [activeNoteCount, setActiveNoteCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const setOutputId = useCallback((nextOutputId: string | null) => {
    outputIdRef.current = nextOutputId
    setOutputIdState(nextOutputId)
    if (nextOutputId) window.localStorage.setItem(OUTPUT_STORAGE_KEY, nextOutputId)
    else window.localStorage.removeItem(OUTPUT_STORAGE_KEY)
  }, [])

  useEffect(() => {
    engine.setDevicesChangedListener((devices) => {
      setOutputs(devices)
      const selectedOutputId = outputIdRef.current
      if (selectedOutputId && !devices.some((device) => device.id === selectedOutputId)) {
        void engine.selectOutput(null)
        setOutputId(null)
        setActiveNoteCount(0)
        setStatus('idle')
        setError('The selected MIDI output was disconnected.')
      }
    })
    return () => engine.dispose()
  }, [engine, setOutputId])

  const selectOutput = useCallback(async (nextOutputId: string | null) => {
    setError(null)
    setStatus('requesting')
    try {
      await engine.selectOutput(nextOutputId)
      setOutputId(nextOutputId)
      setActiveNoteCount(0)
      setStatus(nextOutputId ? 'ready' : 'idle')
    } catch (nextError) {
      setStatus('error')
      setError(errorMessage(nextError))
    }
  }, [engine, setOutputId])

  const connect = useCallback(async () => {
    if (!supported) return
    setStatus('requesting')
    setError(null)
    try {
      const devices = await engine.requestAccess()
      setOutputs(devices)
      if (!devices.length) {
        setStatus('idle')
        setError('No MIDI outputs found. Connect a device or create a virtual MIDI port, then rescan.')
        return
      }
      const storedOutputId = window.localStorage.getItem(OUTPUT_STORAGE_KEY)
      const preferredOutputId = devices.some((device) => device.id === outputIdRef.current)
        ? outputIdRef.current
        : devices.some((device) => device.id === storedOutputId)
          ? storedOutputId
          : devices[0].id
      await engine.selectOutput(preferredOutputId)
      setOutputId(preferredOutputId)
      setStatus('ready')
    } catch (nextError) {
      setStatus('error')
      setError(errorMessage(nextError))
    }
  }, [engine, setOutputId, supported])

  const setChannel = useCallback((nextChannel: number) => {
    const safeChannel = Math.max(1, Math.min(16, Math.round(nextChannel)))
    engine.setChannel(safeChannel)
    setActiveNoteCount(0)
    setChannelState(safeChannel)
    window.localStorage.setItem(CHANNEL_STORAGE_KEY, String(safeChannel))
  }, [engine])

  const playChord = useCallback((chord: Chord) => {
    engine.play(chord)
    setActiveNoteCount(engine.getActiveNoteCount())
  }, [engine])

  const release = useCallback(() => {
    engine.release()
    setActiveNoteCount(0)
  }, [engine])

  const updateControllers = useCallback((expression: number, brightness: number, timestamp?: number) => {
    engine.updateControllers(expression, brightness, timestamp)
  }, [engine])

  const panic = useCallback(() => {
    engine.panic()
    setActiveNoteCount(0)
  }, [engine])

  return {
    supported,
    status,
    outputs,
    outputId,
    channel,
    activeNoteCount,
    error,
    connect,
    selectOutput,
    setChannel,
    playChord,
    release,
    updateControllers,
    panic,
  }
}
