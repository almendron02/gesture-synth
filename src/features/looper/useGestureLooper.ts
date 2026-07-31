import { useCallback, useEffect, useRef, useState } from 'react'
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

const COUNT_IN_BEATS = 4
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
  const playbackSynthRef = useRef(new SynthEngine())
  const modeRef = useRef<LooperMode>('idle')
  const presetRef = useRef(preset)
  const volumeRef = useRef(volume)
  const timerIdsRef = useRef<number[]>([])
  const animationFrameRef = useRef(0)
  const transportStartedAtRef = useRef(0)
  const lastUiUpdateRef = useRef(0)

  presetRef.current = preset
  volumeRef.current = volume

  const setTransportMode = useCallback((nextMode: LooperMode) => {
    modeRef.current = nextMode
    setMode(nextMode)
  }, [])

  const clearTransportTimers = useCallback(() => {
    timerIdsRef.current.forEach((timerId) => window.clearTimeout(timerId))
    timerIdsRef.current = []
    cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = 0
  }, [])

  const startProgressAnimation = useCallback((durationMs: number, looping: boolean) => {
    cancelAnimationFrame(animationFrameRef.current)
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
  }, [])

  const beginPlaybackReady = useCallback((nextLoop: GestureLoop) => {
    clearTransportTimers()
    playbackSynthRef.current.release()
    playbackSynthRef.current.setPreset(presetRef.current)
    playbackSynthRef.current.setVolume(Math.max(0.001, volumeRef.current * 0.8))
    setTransportMode('playing')
    setCountInBeat(null)
    setTransportProgress(0)
    transportStartedAtRef.current = performance.now()

    const scheduleCycle = () => {
      if (modeRef.current !== 'playing') return
      timerIdsRef.current = []
      nextLoop.events.forEach((event, index) => {
        const startTimer = window.setTimeout(() => {
          if (modeRef.current !== 'playing') return
          playbackSynthRef.current.setVolume(Math.max(0.001, volumeRef.current * event.expression * 0.8))
          playbackSynthRef.current.setBrightness(event.brightness)
          playbackSynthRef.current.play(event.chord)
        }, event.startMs)
        timerIdsRef.current.push(startTimer)

        const nextStart = nextLoop.events[index + 1]?.startMs
          ?? nextLoop.durationMs + (nextLoop.events[0]?.startMs ?? 0)
        const eventEnd = event.startMs + event.durationMs
        if (nextStart - eventEnd > 12) {
          const releaseTimer = window.setTimeout(() => {
            if (modeRef.current === 'playing') playbackSynthRef.current.release()
          }, eventEnd)
          timerIdsRef.current.push(releaseTimer)
        }
      })

      const cycleTimer = window.setTimeout(scheduleCycle, nextLoop.durationMs)
      timerIdsRef.current.push(cycleTimer)
    }

    scheduleCycle()
    startProgressAnimation(nextLoop.durationMs, true)
  }, [clearTransportTimers, setTransportMode, startProgressAnimation])

  const stopPlayback = useCallback(() => {
    clearTransportTimers()
    playbackSynthRef.current.release()
    setTransportMode('idle')
    setTransportProgress(0)
  }, [clearTransportTimers, setTransportMode])

  const startPlayback = useCallback(async () => {
    if (!loop || modeRef.current === 'recording' || modeRef.current === 'count-in') return
    setAudioError(null)
    try {
      await playbackSynthRef.current.start()
      beginPlaybackReady(loop)
    } catch {
      setAudioError('Loop audio could not start. Check this site’s sound permissions.')
    }
  }, [beginPlaybackReady, loop])

  const cancelRecording = useCallback(() => {
    clearTransportTimers()
    recorderRef.current.cancel()
    setTransportMode('idle')
    setCountInBeat(null)
    setTransportProgress(0)
  }, [clearTransportTimers, setTransportMode])

  const startRecording = useCallback(async () => {
    if (modeRef.current === 'recording' || modeRef.current === 'count-in') return
    if (modeRef.current === 'playing') stopPlayback()
    setAudioError(null)
    try {
      await playbackSynthRef.current.start()
    } catch {
      setAudioError('Recorder audio could not start. Check this site’s sound permissions.')
      return
    }

    const safeBpm = Math.max(40, Math.min(220, bpm))
    const safeBars = Math.max(1, Math.min(8, bars))
    const beatMs = beatDurationMs(safeBpm)
    const takeDuration = loopDurationMs(safeBpm, safeBars)
    clearTransportTimers()
    recorderRef.current.cancel()
    setTransportMode('count-in')
    setCountInBeat(COUNT_IN_BEATS)
    setTransportProgress(0)

    for (let beat = 1; beat < COUNT_IN_BEATS; beat += 1) {
      const timerId = window.setTimeout(() => setCountInBeat(COUNT_IN_BEATS - beat), beat * beatMs)
      timerIdsRef.current.push(timerId)
    }

    const beginTimer = window.setTimeout(() => {
      if (modeRef.current !== 'count-in') return
      const recordingStartedAt = performance.now()
      recorderRef.current.start(recordingStartedAt, {
        bpm: safeBpm,
        bars: safeBars,
        quantization,
      })
      setTransportMode('recording')
      setCountInBeat(null)
      transportStartedAtRef.current = recordingStartedAt
      startProgressAnimation(takeDuration, false)

      const finishTimer = window.setTimeout(() => {
        if (modeRef.current !== 'recording') return
        cancelAnimationFrame(animationFrameRef.current)
        const take = recorderRef.current.stop(recordingStartedAt + takeDuration)
        setTransportProgress(1)
        if (!take) {
          setTransportMode('idle')
          setAudioError('No complete two-hand chords were captured. Try another take.')
          return
        }
        saveGestureLoop(take)
        setLoop(take)
        beginPlaybackReady(take)
      }, takeDuration)
      timerIdsRef.current.push(finishTimer)
    }, COUNT_IN_BEATS * beatMs)
    timerIdsRef.current.push(beginTimer)
  }, [bars, beginPlaybackReady, bpm, clearTransportTimers, quantization, setTransportMode, startProgressAnimation, stopPlayback])

  const captureChord = useCallback((chord: Chord | null, timestamp: number, expression: number, brightness: number) => {
    if (modeRef.current !== 'recording') return
    recorderRef.current.update(chord, timestamp, expression, brightness)
  }, [])

  const clearLoop = useCallback(() => {
    if (modeRef.current === 'playing') stopPlayback()
    removeGestureLoop()
    setLoop(null)
    setTransportProgress(0)
  }, [stopPlayback])

  useEffect(() => {
    playbackSynthRef.current.setPreset(preset)
  }, [preset])

  useEffect(() => {
    playbackSynthRef.current.setVolume(Math.max(0.001, volume * 0.8))
  }, [volume])

  useEffect(() => () => {
    clearTransportTimers()
    playbackSynthRef.current.dispose()
  }, [clearTransportTimers])

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
    startRecording,
    cancelRecording,
    startPlayback,
    stopPlayback,
    captureChord,
    clearLoop,
  }
}
