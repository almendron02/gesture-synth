import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCamera } from '../features/camera/useCamera'
import {
  CALIBRATION_SAMPLE_TARGET,
  DEFAULT_THUMB_SETTINGS,
  DEFAULT_TILT_OFFSETS,
  createCalibrationProfile,
  estimateNeutralOffset,
  estimateThumbThreshold,
  loadCalibrationProfile,
  saveCalibrationProfile,
  type CalibrationProfile,
} from '../features/calibration/calibration'
import { FingerDiagram } from '../features/gestures/FingerDiagram'
import { GestureStabilizer } from '../features/gestures/GestureStabilizer'
import {
  classifyRightHand,
  combinePerformanceGesture,
  rightHandBrightness,
  rightHandExpression,
} from '../features/gestures/classifyRightHand'
import { gestureDefinitions } from '../features/gestures/gesturePatterns'
import {
  EMPTY_HANDS_FRAME,
  type HandAnalysis,
  type HandsFrameAnalysis,
  type PerformanceGesture,
} from '../features/gestures/gesture.types'
import { useHandTracking } from '../features/hand-tracking/useHandTracking'
import { LooperPanel } from '../features/looper/LooperPanel'
import { useGestureLooper } from '../features/looper/useGestureLooper'
import { buildChord, type Chord } from '../features/music/chords'
import { SynthEngine } from '../features/synth/SynthEngine'
import { soundPresetDefinitions, type SoundPreset } from '../features/synth/soundPresets'
import { LiveTutorialCoach } from '../features/tutorial/LiveTutorialCoach'
import {
  LIVE_TUTORIAL_HOLD_MS,
  liveTutorialFeedback,
  liveTutorialSteps,
  matchesLiveTutorialStep,
} from '../features/tutorial/liveTutorial'

const fingerLabels = ['T', 'I', 'M', 'R', 'P']
const LOST_GESTURE_HOLD_MS = 500
const GESTURE_START_DELAY_MS = 60
const GESTURE_CHANGE_DELAY_MS = 24
type CalibrationStage = 'idle' | 'left-neutral' | 'left-thumb' | 'right-neutral' | 'right-thumb' | 'complete'
type TutorialStage = 'idle' | 'active' | 'complete'

function looperIsCapturing(mode: string): boolean {
  return mode === 'count-in' || mode === 'recording' || mode === 'overdub-count-in' || mode === 'overdubbing'
}

function calibrationHand(stage: CalibrationStage): 'Left' | 'Right' | null {
  if (stage === 'left-neutral' || stage === 'left-thumb') return 'Left'
  if (stage === 'right-neutral' || stage === 'right-thumb') return 'Right'
  return null
}

function calibrationStep(stage: CalibrationStage): number {
  return ['left-neutral', 'left-thumb', 'right-neutral', 'right-thumb'].indexOf(stage) + 1
}

const rightHandStudioGuides = [
  { key: 'root', fingers: '1 finger', label: 'Root', pattern: [false, true, false, false, false] },
  { key: 'first-inversion', fingers: '2 fingers', label: '1st inversion', pattern: [false, true, true, false, false] },
  { key: 'seventh', fingers: '3 fingers', label: '7th chord', pattern: [false, true, true, true, false] },
  { key: 'color-seventh', fingers: '4 fingers', label: 'Color 7th', pattern: [false, true, true, true, true] },
  { key: 'octave-down', fingers: 'Thumb out', label: '−1 octave', pattern: [true, true, false, false, false] },
] as const

function FingerStates({ analysis }: { analysis: HandAnalysis | null }) {
  return (
    <div className="finger-state-row">
      {(analysis?.fingers ?? [false, false, false, false, false]).map((extended, index) => (
        <span className={extended ? 'extended' : ''} key={fingerLabels[index]}>{fingerLabels[index]}</span>
      ))}
    </div>
  )
}

export function PlayPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const synthRef = useRef(new SynthEngine())
  const stabilizerRef = useRef(new GestureStabilizer<PerformanceGesture>({
    startDelayMs: GESTURE_START_DELAY_MS,
    changeDelayMs: GESTURE_CHANGE_DELAY_MS,
    releaseDelayMs: LOST_GESTURE_HOLD_MS,
  }))
  const activeKeyRef = useRef<string | null>(null)
  const lastUiUpdateRef = useRef(0)
  const lastHandCountRef = useRef(0)
  const volumeRef = useRef(0.42)
  const expressionRef = useRef(0.65)
  const calibrationStageRef = useRef<CalibrationStage>('idle')
  const calibrationFramesRef = useRef<HandsFrameAnalysis[]>([])
  const pendingTiltOffsetsRef = useRef<Partial<CalibrationProfile['tiltOffsets']>>({})
  const pendingThumbThresholdsRef = useRef<Partial<CalibrationProfile['thumbThresholds']>>({})
  const lastCalibrationUiUpdateRef = useRef(0)
  const calibrationDismissedRef = useRef(false)
  const tutorialStageRef = useRef<TutorialStage>('idle')
  const tutorialStepIndexRef = useRef(0)
  const tutorialMatchStartedAtRef = useRef<number | null>(null)
  const lastTutorialUiUpdateRef = useRef(0)
  const tutorialRequestedRef = useRef(new URLSearchParams(window.location.search).get('tutorial') === '1')
  const [sessionStarted, setSessionStarted] = useState(false)
  const [frame, setFrame] = useState<HandsFrameAnalysis>(EMPTY_HANDS_FRAME)
  const [activeGesture, setActiveGesture] = useState<PerformanceGesture | null>(null)
  const [activeChord, setActiveChord] = useState<Chord | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [calibrationProfile, setCalibrationProfile] = useState<CalibrationProfile | null>(loadCalibrationProfile)
  const [calibrationStage, setCalibrationStage] = useState<CalibrationStage>('idle')
  const [calibrationError, setCalibrationError] = useState<string | null>(null)
  const [calibrationSampleCount, setCalibrationSampleCount] = useState(0)
  const [tutorialStage, setTutorialStage] = useState<TutorialStage>('idle')
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0)
  const [tutorialMatchProgress, setTutorialMatchProgress] = useState(0)
  const [tutorialFeedback, setTutorialFeedback] = useState(liveTutorialSteps[0].instruction)
  const [soundPreset, setSoundPreset] = useState<SoundPreset>(() => {
    const stored = window.localStorage.getItem('gesture-synth:sound-preset')
    return soundPresetDefinitions.some((preset) => preset.id === stored) ? stored as SoundPreset : 'original'
  })
  const [volume, setVolume] = useState(0.42)
  const [tiltSensitivity, setTiltSensitivity] = useState(() => {
    const stored = window.localStorage.getItem('gesture-synth:tilt-sensitivity-v2')
    if (stored == null) return 78
    const saved = Number(stored)
    return Number.isFinite(saved) && saved >= 0 && saved <= 100 ? saved : 78
  })
  const looper = useGestureLooper({ preset: soundPreset, volume })
  const captureLoopChord = looper.captureChord
  const { status: cameraStatus, error: cameraError, start: startCamera, stop: stopCamera } = useCamera(videoRef)

  // Higher sensitivity means a smaller rotation is needed to leave the neutral zone.
  const tiltThreshold = useMemo(() => 2 + (100 - tiltSensitivity) * 0.12, [tiltSensitivity])
  const tiltOffsets = calibrationProfile?.tiltOffsets ?? DEFAULT_TILT_OFFSETS
  const thumbThresholds = calibrationProfile?.thumbThresholds ?? DEFAULT_THUMB_SETTINGS

  const handleAnalysis = useCallback((nextFrame: HandsFrameAnalysis, timestamp: number) => {
    const calibrationActive = calibrationStageRef.current !== 'idle'
    const targetHand = calibrationHand(calibrationStageRef.current)
    if (targetHand) {
      const targetAnalysis = targetHand === 'Left' ? nextFrame.left : nextFrame.right
      if (targetAnalysis?.landmarks && targetAnalysis.confidence >= 0.65) {
        calibrationFramesRef.current = [...calibrationFramesRef.current.slice(-23), nextFrame]
      }
      if (timestamp - lastCalibrationUiUpdateRef.current > 100) {
        lastCalibrationUiUpdateRef.current = timestamp
        setCalibrationSampleCount(Math.min(CALIBRATION_SAMPLE_TARGET, calibrationFramesRef.current.length))
      }
    }

    if (tutorialStageRef.current === 'active') {
      const currentStep = liveTutorialSteps[tutorialStepIndexRef.current]
      const matches = matchesLiveTutorialStep(currentStep, nextFrame)
      if (matches) {
        tutorialMatchStartedAtRef.current ??= timestamp
        const progress = Math.min(1, (timestamp - tutorialMatchStartedAtRef.current) / LIVE_TUTORIAL_HOLD_MS)
        if (progress >= 1) {
          tutorialMatchStartedAtRef.current = null
          const nextStepIndex = tutorialStepIndexRef.current + 1
          if (nextStepIndex >= liveTutorialSteps.length) {
            tutorialStageRef.current = 'complete'
            setTutorialStage('complete')
            setTutorialMatchProgress(1)
          } else {
            tutorialStepIndexRef.current = nextStepIndex
            setTutorialStepIndex(nextStepIndex)
            setTutorialMatchProgress(0)
            setTutorialFeedback(liveTutorialSteps[nextStepIndex].instruction)
          }
        } else if (timestamp - lastTutorialUiUpdateRef.current > 70) {
          lastTutorialUiUpdateRef.current = timestamp
          setTutorialMatchProgress(progress)
          setTutorialFeedback(liveTutorialFeedback(currentStep, nextFrame))
        }
      } else {
        tutorialMatchStartedAtRef.current = null
        if (timestamp - lastTutorialUiUpdateRef.current > 70) {
          lastTutorialUiUpdateRef.current = timestamp
          setTutorialMatchProgress(0)
          setTutorialFeedback(liveTutorialFeedback(currentStep, nextFrame))
        }
      }
    }

    if (calibrationActive) {
      stabilizerRef.current.reset()
      if (activeKeyRef.current !== null) {
        activeKeyRef.current = null
        synthRef.current.release()
        setActiveGesture(null)
        setActiveChord(null)
      }
    }

    const tutorialBlocksSound = tutorialStageRef.current === 'active' && tutorialStepIndexRef.current < 2
    const performance = calibrationActive || tutorialBlocksSound ? null : combinePerformanceGesture(nextFrame.left, nextFrame.right)
    const stable = calibrationActive ? null : stabilizerRef.current.update(performance, timestamp)
    const nextKey = stable?.key ?? null

    const expression = rightHandExpression(nextFrame.right)
    const brightness = rightHandBrightness(nextFrame.right)
    expressionRef.current = expression
    synthRef.current.setVolume(volumeRef.current * expression)
    synthRef.current.setBrightness(brightness)
    const performanceChord = stable
      ? buildChord(stable.left.degree, stable.left.quality, stable.right.voicing, stable.right.octaveShift)
      : null
    captureLoopChord(performanceChord, timestamp, expression, brightness)

    if (nextKey !== activeKeyRef.current) {
      activeKeyRef.current = nextKey
      if (stable && performanceChord) {
        synthRef.current.play(performanceChord)
        setActiveChord(performanceChord)
      } else {
        synthRef.current.release()
        setActiveChord(null)
      }
      setActiveGesture(stable)
    }

    if (timestamp - lastUiUpdateRef.current > 85 || nextFrame.handCount !== lastHandCountRef.current) {
      lastUiUpdateRef.current = timestamp
      lastHandCountRef.current = nextFrame.handCount
      setFrame(nextFrame)
    }
  }, [captureLoopChord])

  const tracker = useHandTracking({
    videoRef,
    canvasRef,
    enabled: sessionStarted && cameraStatus === 'ready',
    tiltThreshold,
    tiltOffsets,
    thumbThresholds,
    onAnalysis: handleAnalysis,
  })

  const beginSession = useCallback(async () => {
    setAudioError(null)
    try {
      await synthRef.current.start()
      synthRef.current.setVolume(volumeRef.current * expressionRef.current)
    } catch {
      setAudioError('Audio could not start. Check this site’s sound permissions.')
    }
    setSessionStarted(true)
    await startCamera()
  }, [startCamera])

  const beginTutorialSession = useCallback(async () => {
    tutorialRequestedRef.current = true
    await beginSession()
  }, [beginSession])

  const endSession = useCallback(() => {
    if (looperIsCapturing(looper.mode)) looper.cancelRecording()
    if (looper.mode === 'playing') looper.stopPlayback()
    synthRef.current.release()
    stabilizerRef.current.reset()
    activeKeyRef.current = null
    lastHandCountRef.current = 0
    calibrationStageRef.current = 'idle'
    calibrationFramesRef.current = []
    pendingTiltOffsetsRef.current = {}
    pendingThumbThresholdsRef.current = {}
    calibrationDismissedRef.current = false
    tutorialStageRef.current = 'idle'
    tutorialStepIndexRef.current = 0
    tutorialMatchStartedAtRef.current = null
    tutorialRequestedRef.current = false
    stopCamera()
    setSessionStarted(false)
    setFrame(EMPTY_HANDS_FRAME)
    setActiveGesture(null)
    setActiveChord(null)
    setCalibrationStage('idle')
    setCalibrationError(null)
    setCalibrationSampleCount(0)
    setTutorialStage('idle')
    setTutorialStepIndex(0)
    setTutorialMatchProgress(0)
  }, [looper, stopCamera])

  useEffect(() => {
    volumeRef.current = volume
    synthRef.current.setVolume(volume * expressionRef.current)
  }, [volume])

  useEffect(() => {
    window.localStorage.setItem('gesture-synth:tilt-sensitivity-v2', String(tiltSensitivity))
  }, [tiltSensitivity])

  useEffect(() => {
    synthRef.current.setPreset(soundPreset)
    window.localStorage.setItem('gesture-synth:sound-preset', soundPreset)
  }, [soundPreset])

  useEffect(() => () => synthRef.current.dispose(), [])

  const startLiveTutorial = useCallback(() => {
    if (looperIsCapturing(looper.mode)) looper.cancelRecording()
    if (looper.mode === 'playing') looper.stopPlayback()
    tutorialRequestedRef.current = false
    tutorialStageRef.current = 'active'
    tutorialStepIndexRef.current = 0
    tutorialMatchStartedAtRef.current = null
    setTutorialStage('active')
    setTutorialStepIndex(0)
    setTutorialMatchProgress(0)
    setTutorialFeedback(liveTutorialSteps[0].instruction)
    stabilizerRef.current.reset()
    activeKeyRef.current = null
    synthRef.current.release()
    setActiveGesture(null)
    setActiveChord(null)
  }, [looper])

  const exitLiveTutorial = useCallback(() => {
    tutorialRequestedRef.current = false
    tutorialStageRef.current = 'idle'
    tutorialMatchStartedAtRef.current = null
    setTutorialStage('idle')
    setTutorialMatchProgress(0)
  }, [])

  const startCalibration = useCallback(() => {
    if (looperIsCapturing(looper.mode)) looper.cancelRecording()
    if (looper.mode === 'playing') looper.stopPlayback()
    calibrationDismissedRef.current = false
    calibrationStageRef.current = 'left-neutral'
    calibrationFramesRef.current = []
    pendingTiltOffsetsRef.current = {}
    pendingThumbThresholdsRef.current = {}
    tutorialStageRef.current = 'idle'
    tutorialMatchStartedAtRef.current = null
    setTutorialStage('idle')
    setCalibrationStage('left-neutral')
    setCalibrationError(null)
    setCalibrationSampleCount(0)
    stabilizerRef.current.reset()
    activeKeyRef.current = null
    synthRef.current.release()
    setActiveGesture(null)
    setActiveChord(null)
  }, [looper])

  const cancelCalibration = useCallback(() => {
    calibrationDismissedRef.current = true
    calibrationStageRef.current = 'idle'
    calibrationFramesRef.current = []
    pendingTiltOffsetsRef.current = {}
    pendingThumbThresholdsRef.current = {}
    setCalibrationStage('idle')
    setCalibrationError(null)
    setCalibrationSampleCount(0)
    if (tutorialRequestedRef.current) startLiveTutorial()
  }, [startLiveTutorial])

  const captureCalibrationStep = useCallback(() => {
    const stage = calibrationStageRef.current
    const handedness = calibrationHand(stage)
    if (!handedness) return

    const isNeutral = stage === 'left-neutral' || stage === 'right-neutral'
    const result = isNeutral
      ? estimateNeutralOffset(calibrationFramesRef.current, handedness)
      : estimateThumbThreshold(calibrationFramesRef.current, handedness)
    if (!result.ok) {
      setCalibrationError(result.message)
      return
    }

    if (isNeutral) {
      pendingTiltOffsetsRef.current[handedness] = result.value as number
    } else {
      pendingThumbThresholdsRef.current[handedness] = result.value as CalibrationProfile['thumbThresholds']['Left']
    }

    calibrationFramesRef.current = []
    setCalibrationError(null)
    setCalibrationSampleCount(0)

    const nextStageByStage: Record<Exclude<CalibrationStage, 'idle' | 'complete'>, CalibrationStage> = {
      'left-neutral': 'left-thumb',
      'left-thumb': 'right-neutral',
      'right-neutral': 'right-thumb',
      'right-thumb': 'complete',
    }
    const nextStage = nextStageByStage[stage as Exclude<CalibrationStage, 'idle' | 'complete'>]
    if (nextStage !== 'complete') {
      calibrationStageRef.current = nextStage
      setCalibrationStage(nextStage)
      return
    }

    const pendingTiltOffsets = pendingTiltOffsetsRef.current
    const pendingThumbThresholds = pendingThumbThresholdsRef.current
    if (pendingTiltOffsets.Left == null || pendingTiltOffsets.Right == null
      || !pendingThumbThresholds.Left || !pendingThumbThresholds.Right) {
      startCalibration()
      return
    }
    const profile = createCalibrationProfile(
      { Left: pendingTiltOffsets.Left, Right: pendingTiltOffsets.Right },
      { Left: pendingThumbThresholds.Left, Right: pendingThumbThresholds.Right },
    )
    saveCalibrationProfile(profile)
    setCalibrationProfile(profile)
    calibrationStageRef.current = 'complete'
    calibrationFramesRef.current = []
    setCalibrationStage('complete')
    setCalibrationError(null)
    setCalibrationSampleCount(CALIBRATION_SAMPLE_TARGET)
  }, [startCalibration])

  const finishCalibration = useCallback(() => {
    calibrationStageRef.current = 'idle'
    calibrationFramesRef.current = []
    pendingTiltOffsetsRef.current = {}
    pendingThumbThresholdsRef.current = {}
    setCalibrationStage('idle')
    setCalibrationError(null)
    setCalibrationSampleCount(0)
    if (tutorialRequestedRef.current) startLiveTutorial()
  }, [startLiveTutorial])

  useEffect(() => {
    if (sessionStarted && tracker.status === 'ready' && !calibrationProfile
      && calibrationStage === 'idle' && !calibrationDismissedRef.current) {
      startCalibration()
    }
  }, [calibrationProfile, calibrationStage, sessionStarted, startCalibration, tracker.status])

  useEffect(() => {
    if (sessionStarted && tracker.status === 'ready' && calibrationProfile
      && calibrationStage === 'idle' && tutorialStage === 'idle' && tutorialRequestedRef.current) {
      startLiveTutorial()
    }
  }, [calibrationProfile, calibrationStage, sessionStarted, startLiveTutorial, tracker.status, tutorialStage])

  const rightModifier = classifyRightHand(frame.right)
  const expression = rightHandExpression(frame.right)
  const brightness = rightHandBrightness(frame.right)

  const statusCopy = useMemo(() => {
    if (!sessionStarted) return 'Studio offline'
    if (cameraStatus === 'requesting') return 'Waiting for camera'
    if (tracker.status === 'loading') return 'Loading hand model'
    if (cameraStatus === 'denied' || cameraStatus === 'error' || tracker.status === 'error') return 'Needs attention'
    if (calibrationStage !== 'idle') return 'Personal calibration in progress'
    if (tutorialStage === 'active') return `Live tutorial · step ${tutorialStepIndex + 1} of ${liveTutorialSteps.length}`
    if (tutorialStage === 'complete') return 'Live tutorial complete'
    if (activeChord) return 'Two-hand chord is live'
    if (!frame.left && !frame.right) return 'Show both hands'
    if (!frame.left) return 'Show your left chord hand'
    if (!frame.right) return 'Add your right voicing hand'
    if (!frame.left.degree) return 'Left sign is not exact'
    if (frame.left.tilt === 'neutral') return 'Rotate the left hand for major or minor'
    if (!rightModifier) return 'Right hand: show one to four fingers'
    return 'Hold both signs steady'
  }, [activeChord, calibrationStage, cameraStatus, frame, rightModifier, sessionStarted, tracker.status, tutorialStage, tutorialStepIndex])

  const error = cameraError ?? tracker.error ?? audioError
  const confidenceCopy = frame.handCount
    ? `${frame.handCount}/2 hands · L ${Math.round((frame.left?.confidence ?? 0) * 100)} · R ${Math.round((frame.right?.confidence ?? 0) * 100)}`
    : 'Place both hands inside the frame'
  const currentCalibrationHand = calibrationHand(calibrationStage)
  const calibrationAnalysis = currentCalibrationHand === 'Left' ? frame.left : currentCalibrationHand === 'Right' ? frame.right : null
  const calibrationHandReady = Boolean(calibrationAnalysis?.landmarks && calibrationAnalysis.confidence >= 0.65)
  const calibrationIsThumbStep = calibrationStage === 'left-thumb' || calibrationStage === 'right-thumb'
  const calibrationStepNumber = calibrationStep(calibrationStage)

  return (
    <div className="studio-page">
      <header className="studio-heading">
        <div><p className="eyebrow"><span /> Two-hand instrument</p><h1>Gesture studio</h1></div>
        <div className="studio-controls">
          <div className="sound-preset-control" role="group" aria-label="Instrument sound">
            <span>Sound</span>
            <div>
              {soundPresetDefinitions.map((preset) => (
                <button
                  type="button"
                  data-preset={preset.id}
                  aria-pressed={soundPreset === preset.id}
                  className={soundPreset === preset.id ? 'active' : ''}
                  title={preset.description}
                  onClick={() => setSoundPreset(preset.id)}
                  key={preset.id}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <label className="volume-control">
            <span>Volume</span>
            <input aria-label="Synth volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
            <strong>{Math.round(volume * 100)}</strong>
          </label>
          <label className="volume-control sensitivity-control" title={`Current neutral zone: ±${tiltThreshold.toFixed(1)}°`}>
            <span>Sensitivity</span>
            <input aria-label="Rotation sensitivity" type="range" min="0" max="100" step="1" value={tiltSensitivity} onChange={(event) => setTiltSensitivity(Number(event.target.value))} />
            <strong>{tiltSensitivity}</strong>
          </label>
          {sessionStarted && (
            <button
              className="ghost-button tutorial-button"
              type="button"
              onClick={startLiveTutorial}
              disabled={tracker.status !== 'ready' || calibrationStage !== 'idle'}
            >
              {tutorialStage === 'idle' ? 'Live tutorial' : 'Restart tutorial'}
            </button>
          )}
          {sessionStarted && (
            <button className="ghost-button" type="button" onClick={startCalibration} disabled={tracker.status !== 'ready' || calibrationStage !== 'idle'}>
              {calibrationProfile ? 'Recalibrate' : 'Calibrate'}
            </button>
          )}
          {sessionStarted && <button className="ghost-button" type="button" onClick={endSession}>End session</button>}
        </div>
      </header>

      <section className={`studio-grid ${activeChord ? 'is-playing' : ''}`}>
        <div className="camera-panel">
          <div className="camera-stage">
            <video ref={videoRef} muted playsInline aria-label="Mirrored camera view" />
            <canvas ref={canvasRef} aria-hidden="true" />
            <div className="camera-vignette" />
            <div className="camera-corners"><i /><i /><i /><i /></div>
            <div className="camera-topline">
              <span className={`live-indicator ${sessionStarted ? 'on' : ''}`}><i /> {sessionStarted ? 'Camera live' : 'Camera off'}</span>
              <span>{tracker.status === 'ready' ? `${frame.handCount}/2 hands tracked` : 'Local processing'}</span>
            </div>
            {activeChord && (
              <div className="active-chord-hero">
                <small>{activeChord.voicingLabel}</small>
                <strong>{activeGesture?.left.degree}</strong>
                <span>{activeChord.name}</span>
              </div>
            )}
            {sessionStarted && calibrationStage === 'idle' && tutorialStage === 'idle'
              && looperIsCapturing(looper.mode) && (
                <div className={`camera-loop-transport ${looper.mode}`} aria-live="polite">
                  {looper.mode === 'count-in' || looper.mode === 'overdub-count-in' ? (
                    <><small>{looper.mode === 'overdub-count-in' ? 'Overdub starts in' : 'Recording starts in'}</small><strong>{looper.countInBeat}</strong><span>Raise both hands</span></>
                  ) : (
                    <>
                      <div><small><i /> {looper.mode === 'overdubbing' ? 'Overdubbing' : 'Recording'}</small><strong>{looper.loop?.bars ?? looper.bars} bars · {looper.loop?.bpm ?? looper.bpm} BPM</strong></div>
                      <span>{activeChord ? activeChord.name : 'Waiting for a complete chord'}</span>
                      <b><i style={{ width: `${looper.transportProgress * 100}%` }} /></b>
                    </>
                  )}
                </div>
              )}
            {sessionStarted && calibrationStage !== 'idle' && !error && (
              <div className="calibration-overlay" role="dialog" aria-modal="true" aria-labelledby="calibration-title">
                <div className="calibration-progress" aria-label={`Calibration step ${calibrationStage === 'complete' ? 4 : calibrationStepNumber} of 4`}>
                  {[1, 2, 3, 4].map((step) => (
                    <i className={calibrationStage === 'complete' || step < calibrationStepNumber ? 'complete' : step === calibrationStepNumber ? 'active' : ''} key={step} />
                  ))}
                </div>

                {currentCalibrationHand && (
                  <>
                    <p className="eyebrow"><span /> Personal calibration · {String(calibrationStepNumber).padStart(2, '0')} / 04 · {currentCalibrationHand} hand</p>
                    <h2 id="calibration-title">
                      {calibrationIsThumbStep ? `Spread your ${currentCalibrationHand.toLowerCase()} thumb.` : `Show your neutral ${currentCalibrationHand.toLowerCase()} hand.`}
                    </h2>
                    <p>
                      {calibrationIsThumbStep
                        ? `Keep your ${currentCalibrationHand.toLowerCase()} palm facing forward and push the thumb clearly away from the hand.`
                        : `Face your ${currentCalibrationHand.toLowerCase()} palm toward the camera, keep the fingers together, and let the thumb rest naturally.`}
                      {' '}Your other hand stays free to use the controls.
                    </p>
                    <div className="calibration-hand-preview" aria-hidden="true">
                      <FingerDiagram
                        hand={currentCalibrationHand}
                        pattern={calibrationIsThumbStep ? [true, true, true, true, true] : [false, true, true, true, true]}
                        accent={currentCalibrationHand === 'Right' ? 'violet' : 'lime'}
                      />
                    </div>
                    <div className="calibration-hand-status single-hand">
                      <span className={calibrationHandReady && (!calibrationIsThumbStep || calibrationAnalysis?.fingers[0]) ? 'ready' : ''}>
                        <i /> {currentCalibrationHand} {calibrationIsThumbStep ? 'thumb' : 'hand'}
                        <small>{!calibrationHandReady ? 'missing' : calibrationIsThumbStep && !calibrationAnalysis?.fingers[0] ? 'spread farther' : 'ready'}</small>
                      </span>
                    </div>
                    {calibrationError && <p className="calibration-error" role="alert">{calibrationError}</p>}
                    <div className="calibration-actions">
                      <button className="ghost-button" type="button" onClick={calibrationStepNumber === 1 ? cancelCalibration : startCalibration}>
                        {calibrationStepNumber === 1 ? 'Use defaults' : 'Start over'}
                      </button>
                      <button className="button button-primary" type="button" onClick={captureCalibrationStep} disabled={!calibrationHandReady || calibrationSampleCount < CALIBRATION_SAMPLE_TARGET}>
                        {calibrationStage === 'right-thumb' ? 'Save calibration' : 'Save & continue'} <span>→</span>
                      </button>
                    </div>
                    <small className="calibration-samples">Hold {calibrationIsThumbStep ? 'the full spread' : 'steady'} · {calibrationSampleCount}/{CALIBRATION_SAMPLE_TARGET} clean frames</small>
                  </>
                )}

                {calibrationStage === 'complete' && (
                  <>
                    <div className="calibration-success" aria-hidden="true">✓</div>
                    <p className="eyebrow"><span /> Calibration saved</p>
                    <h2 id="calibration-title">Your hands are mapped.</h2>
                    <p>Neutral rotation and deliberate thumb spread are now personalized independently for your left and right hands.</p>
                    <div className="calibration-summary">
                      <span><small>Left neutral</small><strong>{calibrationProfile?.tiltOffsets.Left.toFixed(1)}°</strong></span>
                      <span><small>Right neutral</small><strong>{calibrationProfile?.tiltOffsets.Right.toFixed(1)}°</strong></span>
                      <span><small>Profile</small><strong>Local</strong></span>
                    </div>
                    <button className="button button-primary" type="button" onClick={finishCalibration}>
                      {tutorialRequestedRef.current ? 'Start live tutorial' : 'Start playing'} <span>→</span>
                    </button>
                    <small className="calibration-samples">Saved only in this browser · recalibrate any time</small>
                  </>
                )}
              </div>
            )}
            {sessionStarted && calibrationStage === 'idle' && tutorialStage !== 'idle' && !error && (
              <LiveTutorialCoach
                stepIndex={tutorialStepIndex}
                matchProgress={tutorialMatchProgress}
                feedback={tutorialFeedback}
                complete={tutorialStage === 'complete'}
                onExit={exitLiveTutorial}
                onRestart={startLiveTutorial}
              />
            )}
            {!sessionStarted && (
              <div className="start-overlay">
                <div className="start-orb"><span>✦</span></div>
                <p className="eyebrow"><span /> Camera + audio</p>
                <h2>Your hands are<br />the instrument.</h2>
                <p>Left hand selects the chord. Right hand shapes its voicing, octave, volume, and tone.</p>
                <div className="start-actions">
                  <button className="button button-primary" type="button" onClick={tutorialRequestedRef.current ? beginTutorialSession : beginSession}>
                    {tutorialRequestedRef.current ? 'Enable live tutorial' : 'Enable & play'} <span>→</span>
                  </button>
                  {!tutorialRequestedRef.current && <button className="ghost-button" type="button" onClick={beginTutorialSession}>Live tutorial</button>}
                </div>
                <small>Keep both hands separated and inside the frame</small>
              </div>
            )}
            {sessionStarted && error && (
              <div className="camera-error"><strong>We hit a snag</strong><p>{error}</p><button type="button" onClick={beginSession}>Try again</button></div>
            )}
          </div>
          <div className="camera-statusbar">
            <span className={activeChord ? 'status-live' : ''}><i /> {statusCopy}</span>
            <p>{confidenceCopy}</p>
          </div>
        </div>

        <aside className="analyzer-panel">
          <div className="analyzer-title"><span>Performance analyzer</span><small>{tracker.status === 'ready' ? 'ONLINE' : 'STANDBY'}</small></div>
          <section className="chord-readout">
            <small>Combined output</small>
            <div className="chord-degree">{activeGesture?.left.degree ?? '—'}</div>
            <h2>{activeChord?.name ?? 'Silent'}</h2>
            <p>{activeChord ? `${activeChord.notes.join(' · ')} / ${activeChord.voicingLabel}` : 'Complete both hand signs'}</p>
            <div className="mini-wave" aria-hidden="true">
              {[10, 19, 12, 27, 18, 34, 25, 16, 31, 18, 11, 22].map((height, index) => <i key={index} style={{ height }} />)}
            </div>
          </section>

          <section className="diagnostic-block hand-diagnostic">
            <div className="diagnostic-row"><span>Left · chord</span><strong>{frame.left?.candidate?.degree ?? '—'} {frame.left?.candidate?.quality ?? ''}</strong></div>
            <div className="diagnostic-row"><span>Pattern</span><strong className="mono">{frame.left?.pattern ?? '00000'}</strong></div>
            <FingerStates analysis={frame.left} />
          </section>

          <section className="diagnostic-block hand-diagnostic">
            <div className="diagnostic-row"><span>Right · voicing</span><strong>{rightModifier?.label ?? '—'}</strong></div>
            <div className="diagnostic-row"><span>Thumb · octave</span><strong>{rightModifier ? (rightModifier.octaveShift === -1 ? 'One down' : 'Standard') : '—'}</strong></div>
            <div className="diagnostic-row"><span>Pattern</span><strong className="mono">{frame.right?.pattern ?? '00000'}</strong></div>
            <FingerStates analysis={frame.right} />
          </section>

          <section className="tilt-block">
            <div className="diagnostic-row"><span>Left palm tilt</span><strong>{frame.left?.tilt ?? 'neutral'}</strong></div>
            <div className="tilt-meter"><i style={{ left: `${Math.max(4, Math.min(96, 50 + (frame.left?.rollAngle ?? 0)))}%` }} /></div>
            <div className="tilt-labels"><span>Minor</span><span>±{tiltThreshold.toFixed(1)}°</span><span>Major</span></div>
          </section>

          <section className="expression-block">
            <div><span>Expression</span><strong>{Math.round(expression * 100)}</strong><i><b style={{ width: `${expression * 100}%` }} /></i></div>
            <div><span>Brightness</span><strong>{Math.round(brightness * 100)}</strong><i><b style={{ width: `${brightness * 100}%` }} /></i></div>
          </section>

          <div className="quick-tip"><span>i</span><p><strong>Two-hand gate</strong>Both exact signs must remain visible. Losing either hand releases the chord.</p></div>
        </aside>
      </section>

      <section className="gesture-dock" aria-label="Left-hand chord guide">
        <div><small>Left hand</small><strong>Chord degree</strong></div>
        {gestureDefinitions.map((gesture) => (
          <div className={frame.left?.degree === gesture.degree ? 'detected' : ''} key={gesture.degree}>
            <FingerDiagram hand="Left" pattern={gesture.pattern} size="studio" />
            <small>{gesture.degree}</small>
          </div>
        ))}
        <p><b>↻</b> Inward = major<br /><b>↺</b> Outward = minor</p>
      </section>

      <section className="modifier-dock" aria-label="Right-hand voicing guide">
        <div><small>Right hand</small><strong>Voicing + expression</strong></div>
        {rightHandStudioGuides.map((guide) => (
          <div
            className={guide.key === 'octave-down'
              ? (rightModifier?.octaveShift === -1 ? 'detected' : '')
              : (rightModifier?.voicing === guide.key ? 'detected' : '')}
            key={guide.key}
          >
            <FingerDiagram hand="Right" pattern={guide.pattern} accent="violet" size="studio" />
            <small>{guide.fingers}</small>
            <strong>{guide.label}</strong>
          </div>
        ))}
        <p><b>↕</b> Height = volume<br /><b>↻</b> Tilt = brightness</p>
      </section>

      <LooperPanel
        loop={looper.loop}
        mode={looper.mode}
        bpm={looper.bpm}
        bars={looper.bars}
        quantization={looper.quantization}
        countInBeat={looper.countInBeat}
        transportProgress={looper.transportProgress}
        activeChord={activeChord}
        audioError={looper.audioError}
        canRecord={sessionStarted && tracker.status === 'ready' && calibrationStage === 'idle' && tutorialStage === 'idle'}
        maxLayers={looper.maxLayers}
        onBpmChange={looper.setBpm}
        onBarsChange={looper.setBars}
        onQuantizationChange={looper.setQuantization}
        onRecord={() => {
          if (looper.loop && !window.confirm('Replace the current layered session with a new base take?')) return
          document.querySelector('.camera-stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          void looper.startRecording()
        }}
        onOverdub={() => {
          document.querySelector('.camera-stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          void looper.startOverdub()
        }}
        onCancelRecording={looper.cancelRecording}
        onPlay={() => void looper.startPlayback()}
        onStopPlayback={looper.stopPlayback}
        onToggleLayerMute={looper.toggleLayerMute}
        onRemoveLayer={(layerId) => {
          if (window.confirm('Delete this loop layer? The other layers will stay intact.')) looper.removeLayer(layerId)
        }}
        onUndoLayer={looper.undoLastLayer}
        onClear={() => {
          if (window.confirm('Clear the saved performance loop? This take cannot be recovered.')) looper.clearLoop()
        }}
      />
    </div>
  )
}
