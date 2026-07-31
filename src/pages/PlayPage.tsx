import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCamera } from '../features/camera/useCamera'
import {
  CALIBRATION_SAMPLE_TARGET,
  createCalibrationProfile,
  estimateNeutralOffsets,
  estimateThumbThresholds,
  loadCalibrationProfile,
  saveCalibrationProfile,
  type CalibrationProfile,
} from '../features/calibration/calibration'
import { FingerDiagram } from '../features/gestures/FingerDiagram'
import { GestureStabilizer } from '../features/gestures/GestureStabilizer'
import { DEFAULT_THUMB_THRESHOLDS } from '../features/gestures/classifyHand'
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
import { buildChord, type Chord } from '../features/music/chords'
import { SynthEngine } from '../features/synth/SynthEngine'
import { soundPresetDefinitions, type SoundPreset } from '../features/synth/soundPresets'

const fingerLabels = ['T', 'I', 'M', 'R', 'P']
const LOST_GESTURE_HOLD_MS = 500
const GESTURE_START_DELAY_MS = 60
const GESTURE_CHANGE_DELAY_MS = 24
const DEFAULT_TILT_OFFSETS = { Left: 0, Right: 0 } as const
const DEFAULT_THUMB_SETTINGS = {
  Left: DEFAULT_THUMB_THRESHOLDS,
  Right: DEFAULT_THUMB_THRESHOLDS,
} as const

type CalibrationStage = 'idle' | 'neutral' | 'thumbs' | 'complete'

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
  const pendingTiltOffsetsRef = useRef<CalibrationProfile['tiltOffsets'] | null>(null)
  const lastCalibrationUiUpdateRef = useRef(0)
  const calibrationDismissedRef = useRef(false)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [frame, setFrame] = useState<HandsFrameAnalysis>(EMPTY_HANDS_FRAME)
  const [activeGesture, setActiveGesture] = useState<PerformanceGesture | null>(null)
  const [activeChord, setActiveChord] = useState<Chord | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [calibrationProfile, setCalibrationProfile] = useState<CalibrationProfile | null>(loadCalibrationProfile)
  const [calibrationStage, setCalibrationStage] = useState<CalibrationStage>('idle')
  const [calibrationError, setCalibrationError] = useState<string | null>(null)
  const [calibrationSampleCount, setCalibrationSampleCount] = useState(0)
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
  const { status: cameraStatus, error: cameraError, start: startCamera, stop: stopCamera } = useCamera(videoRef)

  // Higher sensitivity means a smaller rotation is needed to leave the neutral zone.
  const tiltThreshold = useMemo(() => 2 + (100 - tiltSensitivity) * 0.12, [tiltSensitivity])
  const tiltOffsets = calibrationProfile?.tiltOffsets ?? DEFAULT_TILT_OFFSETS
  const thumbThresholds = calibrationProfile?.thumbThresholds ?? DEFAULT_THUMB_SETTINGS

  const handleAnalysis = useCallback((nextFrame: HandsFrameAnalysis, timestamp: number) => {
    const calibrationActive = calibrationStageRef.current !== 'idle'
    if (calibrationStageRef.current === 'neutral' || calibrationStageRef.current === 'thumbs') {
      if (nextFrame.left?.landmarks && nextFrame.right?.landmarks
        && nextFrame.left.confidence >= 0.65 && nextFrame.right.confidence >= 0.65) {
        calibrationFramesRef.current = [...calibrationFramesRef.current.slice(-23), nextFrame]
      }
      if (timestamp - lastCalibrationUiUpdateRef.current > 100) {
        lastCalibrationUiUpdateRef.current = timestamp
        setCalibrationSampleCount(Math.min(CALIBRATION_SAMPLE_TARGET, calibrationFramesRef.current.length))
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

    const performance = calibrationActive ? null : combinePerformanceGesture(nextFrame.left, nextFrame.right)
    const stable = calibrationActive ? null : stabilizerRef.current.update(performance, timestamp)
    const nextKey = stable?.key ?? null

    const expression = rightHandExpression(nextFrame.right)
    expressionRef.current = expression
    synthRef.current.setVolume(volumeRef.current * expression)
    synthRef.current.setBrightness(rightHandBrightness(nextFrame.right))

    if (nextKey !== activeKeyRef.current) {
      activeKeyRef.current = nextKey
      if (stable) {
        const chord = buildChord(
          stable.left.degree,
          stable.left.quality,
          stable.right.voicing,
          stable.right.octaveShift,
        )
        synthRef.current.play(chord)
        setActiveChord(chord)
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
  }, [])

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

  const endSession = useCallback(() => {
    synthRef.current.release()
    stabilizerRef.current.reset()
    activeKeyRef.current = null
    lastHandCountRef.current = 0
    calibrationStageRef.current = 'idle'
    calibrationFramesRef.current = []
    calibrationDismissedRef.current = false
    stopCamera()
    setSessionStarted(false)
    setFrame(EMPTY_HANDS_FRAME)
    setActiveGesture(null)
    setActiveChord(null)
    setCalibrationStage('idle')
    setCalibrationError(null)
    setCalibrationSampleCount(0)
  }, [stopCamera])

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

  const startCalibration = useCallback(() => {
    calibrationDismissedRef.current = false
    calibrationStageRef.current = 'neutral'
    calibrationFramesRef.current = []
    pendingTiltOffsetsRef.current = null
    setCalibrationStage('neutral')
    setCalibrationError(null)
    setCalibrationSampleCount(0)
    stabilizerRef.current.reset()
    activeKeyRef.current = null
    synthRef.current.release()
    setActiveGesture(null)
    setActiveChord(null)
  }, [])

  const cancelCalibration = useCallback(() => {
    calibrationDismissedRef.current = true
    calibrationStageRef.current = 'idle'
    calibrationFramesRef.current = []
    pendingTiltOffsetsRef.current = null
    setCalibrationStage('idle')
    setCalibrationError(null)
    setCalibrationSampleCount(0)
  }, [])

  const captureNeutral = useCallback(() => {
    const result = estimateNeutralOffsets(calibrationFramesRef.current)
    if (!result.ok) {
      setCalibrationError(result.message)
      return
    }
    pendingTiltOffsetsRef.current = result.value
    calibrationFramesRef.current = []
    calibrationStageRef.current = 'thumbs'
    setCalibrationStage('thumbs')
    setCalibrationError(null)
    setCalibrationSampleCount(0)
  }, [])

  const captureThumbs = useCallback(() => {
    const tiltOffsetsResult = pendingTiltOffsetsRef.current
    if (!tiltOffsetsResult) {
      startCalibration()
      return
    }
    const result = estimateThumbThresholds(calibrationFramesRef.current)
    if (!result.ok) {
      setCalibrationError(result.message)
      return
    }
    const profile = createCalibrationProfile(tiltOffsetsResult, result.value)
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
    pendingTiltOffsetsRef.current = null
    setCalibrationStage('idle')
    setCalibrationError(null)
    setCalibrationSampleCount(0)
  }, [])

  useEffect(() => {
    if (sessionStarted && tracker.status === 'ready' && !calibrationProfile
      && calibrationStage === 'idle' && !calibrationDismissedRef.current) {
      startCalibration()
    }
  }, [calibrationProfile, calibrationStage, sessionStarted, startCalibration, tracker.status])

  const rightModifier = classifyRightHand(frame.right)
  const expression = rightHandExpression(frame.right)
  const brightness = rightHandBrightness(frame.right)

  const statusCopy = useMemo(() => {
    if (!sessionStarted) return 'Studio offline'
    if (cameraStatus === 'requesting') return 'Waiting for camera'
    if (tracker.status === 'loading') return 'Loading hand model'
    if (cameraStatus === 'denied' || cameraStatus === 'error' || tracker.status === 'error') return 'Needs attention'
    if (calibrationStage !== 'idle') return 'Personal calibration in progress'
    if (activeChord) return 'Two-hand chord is live'
    if (!frame.left && !frame.right) return 'Show both hands'
    if (!frame.left) return 'Show your left chord hand'
    if (!frame.right) return 'Add your right voicing hand'
    if (!frame.left.degree) return 'Left sign is not exact'
    if (frame.left.tilt === 'neutral') return 'Rotate the left hand for major or minor'
    if (!rightModifier) return 'Right hand: show one to four fingers'
    return 'Hold both signs steady'
  }, [activeChord, calibrationStage, cameraStatus, frame, rightModifier, sessionStarted, tracker.status])

  const error = cameraError ?? tracker.error ?? audioError
  const confidenceCopy = frame.handCount
    ? `${frame.handCount}/2 hands · L ${Math.round((frame.left?.confidence ?? 0) * 100)} · R ${Math.round((frame.right?.confidence ?? 0) * 100)}`
    : 'Place both hands inside the frame'
  const bothHandsReady = Boolean(
    frame.left?.landmarks && frame.right?.landmarks
      && frame.left.confidence >= 0.65 && frame.right.confidence >= 0.65,
  )

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
            <button className="ghost-button" type="button" onClick={startCalibration} disabled={tracker.status !== 'ready'}>
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
            {sessionStarted && calibrationStage !== 'idle' && !error && (
              <div className="calibration-overlay" role="dialog" aria-modal="true" aria-labelledby="calibration-title">
                <div className="calibration-progress" aria-label={`Calibration step ${calibrationStage === 'neutral' ? 1 : 2} of 2`}>
                  <i className="complete" />
                  <i className={calibrationStage === 'thumbs' || calibrationStage === 'complete' ? 'complete' : ''} />
                </div>

                {calibrationStage === 'neutral' && (
                  <>
                    <p className="eyebrow"><span /> Personal calibration · 01 / 02</p>
                    <h2 id="calibration-title">Show your neutral hands.</h2>
                    <p>Face both palms toward the camera, keep your fingers together, and let your thumbs rest naturally beside each hand.</p>
                    <div className="calibration-hand-status">
                      <span className={frame.left ? 'ready' : ''}><i /> Left hand <small>{frame.left ? 'tracked' : 'missing'}</small></span>
                      <span className={frame.right ? 'ready' : ''}><i /> Right hand <small>{frame.right ? 'tracked' : 'missing'}</small></span>
                    </div>
                    {calibrationError && <p className="calibration-error" role="alert">{calibrationError}</p>}
                    <div className="calibration-actions">
                      <button className="ghost-button" type="button" onClick={cancelCalibration}>Use defaults</button>
                      <button className="button button-primary" type="button" onClick={captureNeutral} disabled={!bothHandsReady || calibrationSampleCount < CALIBRATION_SAMPLE_TARGET}>
                        Capture neutral <span>→</span>
                      </button>
                    </div>
                    <small className="calibration-samples">Hold steady · {calibrationSampleCount}/{CALIBRATION_SAMPLE_TARGET} clean frames</small>
                  </>
                )}

                {calibrationStage === 'thumbs' && (
                  <>
                    <p className="eyebrow"><span /> Personal calibration · 02 / 02</p>
                    <h2 id="calibration-title">Spread both thumbs.</h2>
                    <p>Keep your palms facing forward and push each thumb clearly away from the hand. This becomes your deliberate thumb-out position.</p>
                    <div className="calibration-hand-status thumb-status">
                      <span className={frame.left?.fingers[0] ? 'ready' : ''}><i /> Left thumb <small>{frame.left?.fingers[0] ? 'clear' : 'spread farther'}</small></span>
                      <span className={frame.right?.fingers[0] ? 'ready' : ''}><i /> Right thumb <small>{frame.right?.fingers[0] ? 'clear' : 'spread farther'}</small></span>
                    </div>
                    {calibrationError && <p className="calibration-error" role="alert">{calibrationError}</p>}
                    <div className="calibration-actions">
                      <button className="ghost-button" type="button" onClick={startCalibration}>Back to neutral</button>
                      <button className="button button-primary" type="button" onClick={captureThumbs} disabled={!bothHandsReady || calibrationSampleCount < CALIBRATION_SAMPLE_TARGET}>
                        Save calibration <span>→</span>
                      </button>
                    </div>
                    <small className="calibration-samples">Hold the full spread · {calibrationSampleCount}/{CALIBRATION_SAMPLE_TARGET} clean frames</small>
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
                    <button className="button button-primary" type="button" onClick={finishCalibration}>Start playing <span>→</span></button>
                    <small className="calibration-samples">Saved only in this browser · recalibrate any time</small>
                  </>
                )}
              </div>
            )}
            {!sessionStarted && (
              <div className="start-overlay">
                <div className="start-orb"><span>✦</span></div>
                <p className="eyebrow"><span /> Camera + audio</p>
                <h2>Your hands are<br />the instrument.</h2>
                <p>Left hand selects the chord. Right hand shapes its voicing, octave, volume, and tone.</p>
                <button className="button button-primary" type="button" onClick={beginSession}>Enable &amp; play <span>→</span></button>
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
    </div>
  )
}
