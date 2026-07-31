import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCamera } from '../camera/useCamera'
import { DEFAULT_THUMB_SETTINGS, DEFAULT_TILT_OFFSETS, loadCalibrationProfile } from '../calibration/calibration'
import { GestureStabilizer } from '../gestures/GestureStabilizer'
import { combinePerformanceGesture, rightHandBrightness, rightHandExpression } from '../gestures/classifyRightHand'
import { EMPTY_HANDS_FRAME, type HandsFrameAnalysis, type PerformanceGesture } from '../gestures/gesture.types'
import { useHandTracking } from '../hand-tracking/useHandTracking'
import { buildChord, type Chord } from '../music/chords'
import { SynthEngine } from '../synth/SynthEngine'
import type { SoundPreset } from '../synth/soundPresets'

const GESTURE_START_DELAY_MS = 60
const GESTURE_CHANGE_DELAY_MS = 24
const LOST_GESTURE_HOLD_MS = 500

interface ComposerGestureInputOptions {
  preset: SoundPreset
  onGestureFrame: (chord: Chord | null, timestamp: number, expression: number, brightness: number) => void
}

export function useComposerGestureInput({ preset, onGestureFrame }: ComposerGestureInputOptions) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const monitorRef = useRef(new SynthEngine())
  const stabilizerRef = useRef(new GestureStabilizer<PerformanceGesture>({
    startDelayMs: GESTURE_START_DELAY_MS,
    changeDelayMs: GESTURE_CHANGE_DELAY_MS,
    releaseDelayMs: LOST_GESTURE_HOLD_MS,
  }))
  const callbackRef = useRef(onGestureFrame)
  const activeKeyRef = useRef<string | null>(null)
  const lastUiUpdateRef = useRef(0)
  const presetRef = useRef(preset)
  const [enabled, setEnabled] = useState(false)
  const [frame, setFrame] = useState<HandsFrameAnalysis>(EMPTY_HANDS_FRAME)
  const [activeGesture, setActiveGesture] = useState<PerformanceGesture | null>(null)
  const [activeChord, setActiveChord] = useState<Chord | null>(null)
  const [expression, setExpression] = useState(0.65)
  const [brightness, setBrightness] = useState(0.55)
  const [audioError, setAudioError] = useState<string | null>(null)
  const calibrationProfile = useMemo(loadCalibrationProfile, [])
  const tiltSensitivity = useMemo(() => {
    const saved = Number(window.localStorage.getItem('gesture-synth:tilt-sensitivity-v2'))
    return Number.isFinite(saved) && saved >= 0 && saved <= 100 ? saved : 78
  }, [])
  const tiltThreshold = 2 + (100 - tiltSensitivity) * 0.12
  const tiltOffsets = calibrationProfile?.tiltOffsets ?? DEFAULT_TILT_OFFSETS
  const thumbThresholds = calibrationProfile?.thumbThresholds ?? DEFAULT_THUMB_SETTINGS
  const { status: cameraStatus, error: cameraError, start: startCamera, stop: stopCamera } = useCamera(videoRef)

  callbackRef.current = onGestureFrame
  presetRef.current = preset

  useEffect(() => {
    monitorRef.current.setPreset(preset)
  }, [preset])

  const handleAnalysis = useCallback((nextFrame: HandsFrameAnalysis, timestamp: number) => {
    const performance = combinePerformanceGesture(nextFrame.left, nextFrame.right)
    const stable = stabilizerRef.current.update(performance, timestamp)
    const nextExpression = rightHandExpression(nextFrame.right)
    const nextBrightness = rightHandBrightness(nextFrame.right)
    const chord = stable
      ? buildChord(stable.left.degree, stable.left.quality, stable.right.voicing, stable.right.octaveShift)
      : null

    callbackRef.current(chord, timestamp, nextExpression, nextBrightness)
    monitorRef.current.setVolume(nextExpression * 0.28)
    monitorRef.current.setBrightness(nextBrightness)
    if ((stable?.key ?? null) !== activeKeyRef.current) {
      activeKeyRef.current = stable?.key ?? null
      if (chord) monitorRef.current.play(chord)
      else monitorRef.current.release()
      setActiveGesture(stable)
      setActiveChord(chord)
    }

    if (timestamp - lastUiUpdateRef.current >= 80) {
      lastUiUpdateRef.current = timestamp
      setFrame(nextFrame)
      setExpression(nextExpression)
      setBrightness(nextBrightness)
    }
  }, [])

  const tracker = useHandTracking({
    videoRef,
    canvasRef,
    enabled: enabled && cameraStatus === 'ready',
    tiltThreshold,
    tiltOffsets,
    thumbThresholds,
    onAnalysis: handleAnalysis,
  })

  const start = useCallback(async () => {
    setAudioError(null)
    try {
      monitorRef.current.setPreset(presetRef.current)
      await monitorRef.current.start()
    } catch {
      setAudioError('Gesture monitoring could not start, but camera recording can still work.')
    }
    setEnabled(true)
    const started = await startCamera()
    if (!started) setEnabled(false)
    return started
  }, [startCamera])

  const stop = useCallback(() => {
    monitorRef.current.release()
    stabilizerRef.current.reset()
    activeKeyRef.current = null
    stopCamera()
    setEnabled(false)
    setFrame(EMPTY_HANDS_FRAME)
    setActiveGesture(null)
    setActiveChord(null)
  }, [stopCamera])

  useEffect(() => () => monitorRef.current.dispose(), [])

  return {
    videoRef,
    canvasRef,
    enabled,
    frame,
    activeGesture,
    activeChord,
    expression,
    brightness,
    cameraStatus,
    trackerStatus: tracker.status,
    error: cameraError ?? tracker.error ?? audioError,
    calibrated: Boolean(calibrationProfile),
    start,
    stop,
  }
}
