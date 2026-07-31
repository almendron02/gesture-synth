import { useCallback, useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import type { Chord } from '../music/chords'
import { SynthEngine } from '../synth/SynthEngine'
import type { SoundPreset } from '../synth/soundPresets'
import { GestureLoopRecorder, beatDurationMs, loopDurationMs } from './GestureLoopRecorder'
import { loadGestureLoop, removeGestureLoop, saveGestureLoop } from './loopStorage'
import type { GestureLoop, LooperMode, LoopQuantization } from './looper.types'

interface UseGestureLooperOptions {
  preset: SoundPreset
  volume: number
}

type CaptureKind = 'replace' | 'overdub'

const COUNT_IN_BEATS = 4
const MAX_LOOP_LAYERS = 4
const UI_UPDATE_INTERVAL_MS = 45

export function useGestureLooper({ preset, volume }: UseGestureLooperOptions) {
  const [loop, setLoop] = useState<GestureLoop | null>(loadGestureLoop)
  const [mode, setMode] = useState<LooperMode>('idle')
  const [bpm, setBpm] = useState(() => loop?.bpm ?? 100)
  const [bars, setBars] = useState(() => loop?.bars ?? 2)
  const [quantization, setQuantization] = useState<LoopQuantization>(() => loop?.quantization ?? '1/8')
  const [countInBeat, setCountInBeat] = useState<number | null>(null)
  const [transportProgress, setTransportProgress] = useState(0)
  const [audioError, setAudioError] = useState<string | null>(null)
  const recorderRef = useRef(new GestureLoopRecorder())
  const playbackSynthsRef = useRef(new Map<string, SynthEngine>())
  const loopRef = useRef(loop)
  const modeRef = useRef<LooperMode>('idle')
  const presetRef = useRef(preset)
  const volumeRef = useRef(volume)
  const captureTimerIdsRef = useRef<number[]>([])
  const playbackTimerIdsRef = useRef<number[]>([])
  const playbackActiveRef = useRef(false)
  const animationFrameRef = useRef(0)
  const transportStartedAtRef = useRef(0)
  const lastUiUpdateRef = useRef(0)

  loopRef.current = loop
  presetRef.current = preset
  volumeRef.current = volume

  const setTransportMode = useCallback((nextMode: LooperMode) => {
    modeRef.current = nextMode
    setMode(nextMode)
  }, [])

  const getLayerSynth = useCallback((layerId: string): SynthEngine => {
    const existing = playbackSynthsRef.current.get(layerId)
    if (existing) return existing
    const synth = new SynthEngine()
    synth.setPreset(presetRef.current)
    playbackSynthsRef.current.set(layerId, synth)
    return synth
  }, [])

  const releasePlayback = useCallback(() => {
    playbackSynthsRef.current.forEach((synth) => synth.release())
  }, [])

  const clearCaptureTimers = useCallback(() => {
    captureTimerIdsRef.current.forEach((timerId) => window.clearTimeout(timerId))
    captureTimerIdsRef.current = []
  }, [])

  const clearPlaybackTimers = useCallback(() => {
    playbackActiveRef.current = false
    playbackTimerIdsRef.current.forEach((timerId) => window.clearTimeout(timerId))
    playbackTimerIdsRef.current = []
  }, [])

  const stopProgressAnimation = useCallback(() => {
    cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = 0
  }, [])

  const startProgressAnimation = useCallback((durationMs: number, looping: boolean) => {
    stopProgressAnimation()
    lastUiUpdateRef.current = 0

    const updateProgress = (timestamp: number) => {
      if (timestamp - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
        lastUiUpdateRef.current = timestamp
        const elapsed = performance.now() - transportStartedAtRef.current
        const position = looping ? elapsed % durationMs : Math.min(durationMs, elapsed)
        setTransportProgress(durationMs > 0 ? position / durationMs : 0)
      }
      animationFrameRef.current = requestAnimationFrame(updateProgress)
    }
    animationFrameRef.current = requestAnimationFrame(updateProgress)
  }, [stopProgressAnimation])

  const preparePlayback = useCallback(async (nextLoop: GestureLoop) => {
    await Tone.start()
    await Promise.all(nextLoop.layers.map(async (layer) => {
      const synth = getLayerSynth(layer.id)
      synth.setPreset(presetRef.current)
      synth.setVolume(Math.max(0.001, volumeRef.current * 0.72))
      await synth.start()
    }))
  }, [getLayerSynth])

  const beginPlaybackReady = useCallback((nextLoop: GestureLoop, nextMode: LooperMode = 'playing') => {
    clearPlaybackTimers()
    releasePlayback()
    playbackActiveRef.current = true
    setTransportMode(nextMode)
    setCountInBeat(null)
    setTransportProgress(0)
    transportStartedAtRef.current = performance.now()

    const scheduleCycle = () => {
      if (!playbackActiveRef.current) return
      playbackTimerIdsRef.current = []
      const currentLoop = loopRef.current ?? nextLoop
      currentLoop.layers.forEach((layer) => {
        const synth = getLayerSynth(layer.id)
        layer.events.forEach((event, index) => {
          const startTimer = window.setTimeout(() => {
            const currentLayer = loopRef.current?.layers.find((candidate) => candidate.id === layer.id)
            if (!playbackActiveRef.current || !currentLayer || currentLayer.muted) return
            synth.setVolume(Math.max(0.001, volumeRef.current * event.expression * 0.72))
            synth.setBrightness(event.brightness)
            synth.play(event.chord)
          }, event.startMs)
          playbackTimerIdsRef.current.push(startTimer)

          const nextStart = layer.events[index + 1]?.startMs
            ?? currentLoop.durationMs + (layer.events[0]?.startMs ?? 0)
          const eventEnd = event.startMs + event.durationMs
          if (nextStart - eventEnd > 12) {
            const releaseTimer = window.setTimeout(() => {
              const currentLayer = loopRef.current?.layers.find((candidate) => candidate.id === layer.id)
              if (playbackActiveRef.current && currentLayer) synth.release()
            }, eventEnd)
            playbackTimerIdsRef.current.push(releaseTimer)
          }
        })
      })

      const cycleTimer = window.setTimeout(scheduleCycle, currentLoop.durationMs)
      playbackTimerIdsRef.current.push(cycleTimer)
    }

    scheduleCycle()
    startProgressAnimation(nextLoop.durationMs, true)
  }, [clearPlaybackTimers, getLayerSynth, releasePlayback, setTransportMode, startProgressAnimation])

  const stopPlayback = useCallback(() => {
    clearPlaybackTimers()
    releasePlayback()
    stopProgressAnimation()
    setTransportMode('idle')
    setTransportProgress(0)
  }, [clearPlaybackTimers, releasePlayback, setTransportMode, stopProgressAnimation])

  const startPlayback = useCallback(async () => {
    if (!loop || modeRef.current === 'recording' || modeRef.current === 'count-in'
      || modeRef.current === 'overdubbing' || modeRef.current === 'overdub-count-in') return
    setAudioError(null)
    try {
      await preparePlayback(loop)
      beginPlaybackReady(loop)
    } catch {
      setAudioError('Loop audio could not start. Check this site’s sound permissions.')
    }
  }, [beginPlaybackReady, loop, preparePlayback])

  const cancelRecording = useCallback(() => {
    clearCaptureTimers()
    clearPlaybackTimers()
    releasePlayback()
    stopProgressAnimation()
    recorderRef.current.cancel()
    setTransportMode('idle')
    setCountInBeat(null)
    setTransportProgress(0)
  }, [clearCaptureTimers, clearPlaybackTimers, releasePlayback, setTransportMode, stopProgressAnimation])

  const startCapture = useCallback(async (kind: CaptureKind) => {
    if (modeRef.current === 'recording' || modeRef.current === 'count-in'
      || modeRef.current === 'overdubbing' || modeRef.current === 'overdub-count-in') return
    const existingLoop = loopRef.current
    if (kind === 'overdub' && (!existingLoop || existingLoop.layers.length >= MAX_LOOP_LAYERS)) return
    if (modeRef.current === 'playing') stopPlayback()
    setAudioError(null)
    try {
      await Tone.start()
      if (kind === 'overdub' && existingLoop) await preparePlayback(existingLoop)
    } catch {
      setAudioError('Recorder audio could not start. Check this site’s sound permissions.')
      return
    }

    const safeBpm = kind === 'overdub' && existingLoop ? existingLoop.bpm : Math.max(40, Math.min(220, bpm))
    const safeBars = kind === 'overdub' && existingLoop ? existingLoop.bars : Math.max(1, Math.min(8, bars))
    const safeQuantization = kind === 'overdub' && existingLoop ? existingLoop.quantization : quantization
    const beatMs = beatDurationMs(safeBpm)
    const takeDuration = loopDurationMs(safeBpm, safeBars)
    clearCaptureTimers()
    recorderRef.current.cancel()
    setTransportMode(kind === 'overdub' ? 'overdub-count-in' : 'count-in')
    setCountInBeat(COUNT_IN_BEATS)
    setTransportProgress(0)

    for (let beat = 1; beat < COUNT_IN_BEATS; beat += 1) {
      const timerId = window.setTimeout(() => setCountInBeat(COUNT_IN_BEATS - beat), beat * beatMs)
      captureTimerIdsRef.current.push(timerId)
    }

    const beginTimer = window.setTimeout(() => {
      const expectedMode = kind === 'overdub' ? 'overdub-count-in' : 'count-in'
      if (modeRef.current !== expectedMode) return
      const recordingStartedAt = performance.now()
      recorderRef.current.start(recordingStartedAt, {
        bpm: safeBpm,
        bars: safeBars,
        quantization: safeQuantization,
      })
      setCountInBeat(null)
      transportStartedAtRef.current = recordingStartedAt
      if (kind === 'overdub' && existingLoop) {
        beginPlaybackReady(existingLoop, 'overdubbing')
      } else {
        setTransportMode('recording')
        startProgressAnimation(takeDuration, false)
      }

      const finishTimer = window.setTimeout(() => {
        const expectedRecordingMode = kind === 'overdub' ? 'overdubbing' : 'recording'
        if (modeRef.current !== expectedRecordingMode) return
        const currentLoop = loopRef.current
        const layerNumber = kind === 'overdub' ? (currentLoop?.layers.length ?? 1) + 1 : 1
        const layer = recorderRef.current.stop(recordingStartedAt + takeDuration, layerNumber)
        stopProgressAnimation()
        setTransportProgress(1)
        if (!layer) {
          if (kind === 'overdub' && currentLoop) beginPlaybackReady(currentLoop)
          else setTransportMode('idle')
          setAudioError('No complete two-hand chords were captured. Try another take.')
          return
        }

        if (kind === 'replace') {
          playbackSynthsRef.current.forEach((synth) => synth.dispose())
          playbackSynthsRef.current.clear()
        }

        const updatedLoop: GestureLoop = kind === 'overdub' && currentLoop
          ? { ...currentLoop, layers: [...currentLoop.layers, layer] }
          : {
              version: 2,
              id: `loop-${Date.now()}`,
              createdAt: new Date().toISOString(),
              bpm: safeBpm,
              bars: safeBars,
              quantization: safeQuantization,
              durationMs: takeDuration,
              layers: [layer],
            }
        saveGestureLoop(updatedLoop)
        loopRef.current = updatedLoop
        setLoop(updatedLoop)
        void preparePlayback(updatedLoop)
          .then(() => beginPlaybackReady(updatedLoop))
          .catch(() => {
            setTransportMode('idle')
            setAudioError('The take was saved, but loop playback could not start.')
          })
      }, takeDuration)
      captureTimerIdsRef.current.push(finishTimer)
    }, COUNT_IN_BEATS * beatMs)
    captureTimerIdsRef.current.push(beginTimer)
  }, [bars, beginPlaybackReady, bpm, clearCaptureTimers, preparePlayback, quantization, setTransportMode, startProgressAnimation, stopPlayback, stopProgressAnimation])

  const startRecording = useCallback(() => startCapture('replace'), [startCapture])
  const startOverdub = useCallback(() => startCapture('overdub'), [startCapture])

  const captureChord = useCallback((chord: Chord | null, timestamp: number, expression: number, brightness: number) => {
    if (modeRef.current !== 'recording' && modeRef.current !== 'overdubbing') return
    recorderRef.current.update(chord, timestamp, expression, brightness)
  }, [])

  const updateLoop = useCallback((updatedLoop: GestureLoop) => {
    loopRef.current = updatedLoop
    setLoop(updatedLoop)
    saveGestureLoop(updatedLoop)
  }, [])

  const toggleLayerMute = useCallback((layerId: string) => {
    const currentLoop = loopRef.current
    if (!currentLoop) return
    const updatedLoop = {
      ...currentLoop,
      layers: currentLoop.layers.map((layer) => layer.id === layerId ? { ...layer, muted: !layer.muted } : layer),
    }
    const updatedLayer = updatedLoop.layers.find((layer) => layer.id === layerId)
    if (updatedLayer?.muted) playbackSynthsRef.current.get(layerId)?.release()
    updateLoop(updatedLoop)
  }, [updateLoop])

  const removeLayer = useCallback((layerId: string) => {
    const currentLoop = loopRef.current
    if (!currentLoop) return
    if (currentLoop.layers.length === 1) {
      removeGestureLoop()
      setLoop(null)
      loopRef.current = null
      stopPlayback()
      return
    }
    const synth = playbackSynthsRef.current.get(layerId)
    synth?.dispose()
    playbackSynthsRef.current.delete(layerId)
    updateLoop({ ...currentLoop, layers: currentLoop.layers.filter((layer) => layer.id !== layerId) })
  }, [stopPlayback, updateLoop])

  const undoLastLayer = useCallback(() => {
    const currentLoop = loopRef.current
    const lastLayer = currentLoop?.layers.at(-1)
    if (!currentLoop || currentLoop.layers.length < 2 || !lastLayer) return
    removeLayer(lastLayer.id)
  }, [removeLayer])

  const clearLoop = useCallback(() => {
    if (modeRef.current === 'recording' || modeRef.current === 'count-in'
      || modeRef.current === 'overdubbing' || modeRef.current === 'overdub-count-in') cancelRecording()
    else if (modeRef.current === 'playing') stopPlayback()
    removeGestureLoop()
    loopRef.current = null
    setLoop(null)
    setTransportProgress(0)
    playbackSynthsRef.current.forEach((synth) => synth.dispose())
    playbackSynthsRef.current.clear()
  }, [cancelRecording, stopPlayback])

  useEffect(() => {
    playbackSynthsRef.current.forEach((synth) => synth.setPreset(preset))
  }, [preset])

  useEffect(() => {
    playbackSynthsRef.current.forEach((synth) => synth.setVolume(Math.max(0.001, volume * 0.72)))
  }, [volume])

  useEffect(() => () => {
    clearCaptureTimers()
    clearPlaybackTimers()
    stopProgressAnimation()
    playbackSynthsRef.current.forEach((synth) => synth.dispose())
    playbackSynthsRef.current.clear()
  }, [clearCaptureTimers, clearPlaybackTimers, stopProgressAnimation])

  return {
    loop,
    mode,
    bpm,
    setBpm,
    bars,
    setBars,
    quantization,
    setQuantization,
    countInBeat,
    transportProgress,
    audioError,
    maxLayers: MAX_LOOP_LAYERS,
    startRecording,
    startOverdub,
    cancelRecording,
    startPlayback,
    stopPlayback,
    captureChord,
    toggleLayerMute,
    removeLayer,
    undoLastLayer,
    clearLoop,
  }
}
