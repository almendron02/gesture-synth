import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  DEFAULT_THUMB_SETTINGS,
  DEFAULT_TILT_OFFSETS,
  loadCalibrationProfile,
} from '../features/calibration/calibration'
import { useCamera } from '../features/camera/useCamera'
import { FingerDiagram } from '../features/gestures/FingerDiagram'
import { GestureStabilizer } from '../features/gestures/GestureStabilizer'
import {
  combinePerformanceGesture,
  rightHandBrightness,
  rightHandExpression,
} from '../features/gestures/classifyRightHand'
import { gestureDefinitions } from '../features/gestures/gesturePatterns'
import {
  EMPTY_HANDS_FRAME,
  type FingerPattern,
  type HandsFrameAnalysis,
  type PerformanceGesture,
  type RightHandVoicing,
} from '../features/gestures/gesture.types'
import { useHandTracking } from '../features/hand-tracking/useHandTracking'
import { buildChord } from '../features/music/chords'
import {
  AutomaticLessonAdvancer,
  automaticLessonFeedback,
  matchesTutorialChord,
  tutorialChordKey,
} from '../features/songs/automaticLesson'
import { getTutorialChord, getTutorialSong, type TutorialChord } from '../features/songs/songLibrary'
import { SynthEngine } from '../features/synth/SynthEngine'

const LOST_GESTURE_HOLD_MS = 500
const GESTURE_START_DELAY_MS = 60
const GESTURE_CHANGE_DELAY_MS = 24

type PracticeStage = 'idle' | 'active' | 'complete'

const rightHandPatterns: Record<RightHandVoicing, { label: string; pattern: FingerPattern }> = {
  root: { label: '1 finger · root position', pattern: [false, true, false, false, false] },
  'first-inversion': { label: '2 fingers · first inversion', pattern: [false, true, true, false, false] },
  seventh: { label: '3 fingers · seventh chord', pattern: [false, true, true, true, false] },
  'color-seventh': { label: '4 fingers · color seventh', pattern: [false, true, true, true, true] },
}

function practicePrompt(chord: TutorialChord): string {
  const voicing = rightHandPatterns[chord.voicing ?? 'root'].label
  return `Show degree ${chord.degree} with your left hand and ${voicing} with your right.`
}

export function SongTutorialPage() {
  const { songId } = useParams()
  const song = getTutorialSong(songId)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const synthRef = useRef(new SynthEngine())
  const stabilizerRef = useRef(new GestureStabilizer<PerformanceGesture>({
    startDelayMs: GESTURE_START_DELAY_MS,
    changeDelayMs: GESTURE_CHANGE_DELAY_MS,
    releaseDelayMs: LOST_GESTURE_HOLD_MS,
  }))
  const lessonAdvancerRef = useRef(new AutomaticLessonAdvancer())
  const activeAudioKeyRef = useRef<string | null>(null)
  const activeCueIndexRef = useRef(0)
  const practiceStageRef = useRef<PracticeStage>('idle')
  const songRef = useRef(song)
  const lastUiUpdateRef = useRef(0)
  const [activeCueIndex, setActiveCueIndex] = useState(0)
  const [practiceStage, setPracticeStage] = useState<PracticeStage>('idle')
  const [lessonMatchProgress, setLessonMatchProgress] = useState(0)
  const [practiceFeedback, setPracticeFeedback] = useState('Start the camera when you are ready to play the progression.')
  const [frame, setFrame] = useState<HandsFrameAnalysis>(EMPTY_HANDS_FRAME)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [calibrationProfile] = useState(loadCalibrationProfile)
  const tiltSensitivity = useMemo(() => {
    const stored = window.localStorage.getItem('gesture-synth:tilt-sensitivity-v2')
    const saved = stored == null ? 78 : Number(stored)
    return Number.isFinite(saved) && saved >= 0 && saved <= 100 ? saved : 78
  }, [])
  const tiltThreshold = useMemo(() => 2 + (100 - tiltSensitivity) * 0.12, [tiltSensitivity])
  const tiltOffsets = calibrationProfile?.tiltOffsets ?? DEFAULT_TILT_OFFSETS
  const thumbThresholds = calibrationProfile?.thumbThresholds ?? DEFAULT_THUMB_SETTINGS
  const { status: cameraStatus, error: cameraError, start: startCamera, stop: stopCamera } = useCamera(videoRef)

  songRef.current = song

  const handleAnalysis = useCallback((nextFrame: HandsFrameAnalysis, timestamp: number) => {
    if (practiceStageRef.current !== 'active') return

    const performance = combinePerformanceGesture(nextFrame.left, nextFrame.right)
    const stable = stabilizerRef.current.update(performance, timestamp)
    const nextAudioKey = stable?.key ?? null

    synthRef.current.setVolume(0.42 * rightHandExpression(nextFrame.right))
    synthRef.current.setBrightness(rightHandBrightness(nextFrame.right))

    if (nextAudioKey !== activeAudioKeyRef.current) {
      activeAudioKeyRef.current = nextAudioKey
      if (stable) {
        synthRef.current.play(buildChord(
          stable.left.degree,
          stable.left.quality,
          stable.right.voicing,
          stable.right.octaveShift,
        ))
      } else {
        synthRef.current.release()
      }
    }

    const currentSong = songRef.current
    if (!currentSong) return
    const cueIndex = activeCueIndexRef.current
    const targetCue = currentSong.cues[cueIndex]
    const targetChord = getTutorialChord(currentSong, targetCue.chordId)
    const result = lessonAdvancerRef.current.update(matchesTutorialChord(performance, targetChord), timestamp)

    if (timestamp - lastUiUpdateRef.current > 75) {
      lastUiUpdateRef.current = timestamp
      setFrame(nextFrame)
      setLessonMatchProgress(result.progress)
      setPracticeFeedback(result.waitingForRelease
        ? 'Release or change the gesture before the repeated chord.'
        : automaticLessonFeedback(nextFrame, targetChord))
    }

    if (!result.completed) return

    if (cueIndex >= currentSong.cues.length - 1) {
      practiceStageRef.current = 'complete'
      setPracticeStage('complete')
      setLessonMatchProgress(1)
      setPracticeFeedback('Progression complete. Every chord was recognized in sequence.')
      lessonAdvancerRef.current.reset()
      stabilizerRef.current.reset()
      activeAudioKeyRef.current = null
      synthRef.current.release()
      return
    }

    const nextCueIndex = cueIndex + 1
    const nextCue = currentSong.cues[nextCueIndex]
    const nextChord = getTutorialChord(currentSong, nextCue.chordId)
    activeCueIndexRef.current = nextCueIndex
    setActiveCueIndex(nextCueIndex)
    setLessonMatchProgress(0)
    lessonAdvancerRef.current.advance(tutorialChordKey(targetChord) === tutorialChordKey(nextChord))
    setPracticeFeedback(
      tutorialChordKey(targetChord) === tutorialChordKey(nextChord)
        ? 'Release once, then remake the same chord for the next phrase.'
        : practicePrompt(nextChord),
    )
  }, [])

  const tracker = useHandTracking({
    videoRef,
    canvasRef,
    enabled: practiceStage === 'active' && cameraStatus === 'ready',
    tiltThreshold,
    tiltOffsets,
    thumbThresholds,
    onAnalysis: handleAnalysis,
  })

  const resetRecognition = useCallback(() => {
    lessonAdvancerRef.current.reset()
    stabilizerRef.current.reset()
    activeAudioKeyRef.current = null
    synthRef.current.release()
    setLessonMatchProgress(0)
    setFrame(EMPTY_HANDS_FRAME)
  }, [])

  const stopLivePractice = useCallback(() => {
    practiceStageRef.current = 'idle'
    setPracticeStage('idle')
    stopCamera()
    resetRecognition()
    setPracticeFeedback('Start the camera when you are ready to play the progression.')
  }, [resetRecognition, stopCamera])

  const beginLivePractice = useCallback(async () => {
    const currentSong = songRef.current
    if (!currentSong) return

    setAudioError(null)
    activeCueIndexRef.current = 0
    setActiveCueIndex(0)
    resetRecognition()
    lessonAdvancerRef.current.reset()
    synthRef.current.setPreset(currentSong.preset)
    try {
      await synthRef.current.start()
    } catch {
      setAudioError('Audio could not start. Check this site’s sound permissions.')
    }
    practiceStageRef.current = 'active'
    setPracticeStage('active')
    setPracticeFeedback(practicePrompt(getTutorialChord(currentSong, currentSong.cues[0].chordId)))
    await startCamera()
  }, [resetRecognition, startCamera])

  const replayLivePractice = useCallback(() => {
    const currentSong = songRef.current
    if (!currentSong) return
    activeCueIndexRef.current = 0
    setActiveCueIndex(0)
    resetRecognition()
    practiceStageRef.current = 'active'
    setPracticeStage('active')
    setPracticeFeedback(practicePrompt(getTutorialChord(currentSong, currentSong.cues[0].chordId)))
  }, [resetRecognition])

  const selectCue = useCallback((index: number) => {
    const currentSong = songRef.current
    if (!currentSong) return
    const safeIndex = Math.max(0, Math.min(currentSong.cues.length - 1, index))
    activeCueIndexRef.current = safeIndex
    setActiveCueIndex(safeIndex)
    lessonAdvancerRef.current.reset()
    setLessonMatchProgress(0)
    setPracticeFeedback(practicePrompt(getTutorialChord(currentSong, currentSong.cues[safeIndex].chordId)))
    if (practiceStageRef.current === 'complete') {
      practiceStageRef.current = 'active'
      setPracticeStage('active')
    }
  }, [])

  useEffect(() => {
    activeCueIndexRef.current = 0
    setActiveCueIndex(0)
    practiceStageRef.current = 'idle'
    setPracticeStage('idle')
    stopCamera()
    resetRecognition()
    setPracticeFeedback('Start the camera when you are ready to play the progression.')
  }, [resetRecognition, songId, stopCamera])

  useEffect(() => () => synthRef.current.dispose(), [])

  const lessonChords = useMemo(() => {
    if (!song) return []
    return song.chords.map((chord) => {
      const gesture = gestureDefinitions.find((definition) => definition.degree === chord.degree)
      if (!gesture) throw new Error(`Unknown gesture degree: ${chord.degree}`)
      const voicing = chord.voicing ?? 'root'
      return {
        ...chord,
        gesture,
        voicing,
        rightHand: rightHandPatterns[voicing],
        notes: buildChord(chord.degree, chord.quality, voicing).notes,
      }
    })
  }, [song])

  if (!song) return <Navigate to="/songs" replace />

  const activeCue = song.cues[activeCueIndex]
  const activeChord = getTutorialChord(song, activeCue.chordId)
  const activeLessonChord = lessonChords.find((chord) => chord.id === activeChord.id)
  if (!activeLessonChord) return <Navigate to="/songs" replace />

  const previousCue = () => selectCue(activeCueIndex - 1)
  const nextCue = () => selectCue(activeCueIndex + 1)
  const progress = ((activeCueIndex + 1) / song.cues.length) * 100
  const practiceError = cameraError ?? tracker.error
  const practiceStatus = practiceStage === 'complete'
    ? 'Complete'
    : cameraStatus === 'ready' && tracker.status === 'ready'
      ? 'Listening'
      : cameraStatus === 'requesting' || tracker.status === 'loading'
        ? 'Starting…'
        : practiceStage === 'active'
          ? 'Waiting'
          : 'Off'

  return (
    <div className={`content-page song-tutorial-page ${song.accent}`}>
      <header className="tutorial-hero">
        <Link className="tutorial-back" to="/songs">← Tutorial pack</Link>
        <div className="tutorial-hero-grid">
          <div>
            <p className="eyebrow"><span /> Guided song · {song.artist}</p>
            <h1>{song.title}</h1>
            <p className="tutorial-arrangement">{song.arrangementLabel}</p>
          </div>
          <dl className="tutorial-meta">
            <div><dt>Preset</dt><dd>{song.presetLabel}</dd></div>
            <div><dt>Level</dt><dd>{song.level}</dd></div>
            <div><dt>Changes</dt><dd>{song.cues.length} cues</dd></div>
          </dl>
        </div>
      </header>

      <section className="tutorial-section chord-vocabulary-section">
        <header>
          <div><small>01 · Prepare</small><h2>Chords used</h2></div>
          <p>Keep both signs visible. The left hand chooses the chord; the right hand holds its voicing.</p>
        </header>
        <div className="tutorial-chord-grid">
          {lessonChords.map((chord) => (
            <article className="tutorial-chord-card" key={chord.id}>
              <div className="tutorial-chord-name"><span>{chord.degree}</span><div><small>{chord.quality} · {chord.rightHand.label}</small><h3>{chord.name}</h3></div></div>
              <div className="two-hand-shape">
                <div><FingerDiagram hand="Left" pattern={chord.gesture.pattern} size="studio" /><small>Left · {chord.gesture.hint}</small></div>
                <span aria-hidden="true">+</span>
                <div><FingerDiagram hand="Right" pattern={chord.rightHand.pattern} accent="violet" size="studio" /><small>Right · {chord.rightHand.label}</small></div>
              </div>
              <p><strong>Tilt {chord.quality === 'major' ? 'inward' : 'outward'}</strong> · {chord.notes.join(' · ')}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="tutorial-section cue-player-section">
        <header>
          <div><small>02 · Practice</small><h2>Follow the changes</h2></div>
          <p>{song.copyMode === 'lyrics' ? 'Change signs on the highlighted lyric phrase.' : 'Change signs on beat one of each highlighted count.'}</p>
        </header>

        <div className={`song-practice-live ${practiceStage}`}>
          <div className="song-practice-camera">
            <video ref={videoRef} muted playsInline />
            <canvas ref={canvasRef} />
            <div className="song-practice-camera-bar">
              <span className={practiceStatus === 'Listening' ? 'listening' : ''}><i />{practiceStatus}</span>
              <small>{frame.handCount}/2 hands</small>
            </div>

            {practiceStage === 'idle' && (
              <div className="song-practice-start">
                <span aria-hidden="true">◎</span>
                <small>Camera-guided lesson</small>
                <h3>Play it with your hands.</h3>
                <p>The lesson recognizes each exact two-hand chord, waits for a steady hold, then advances to the next cue.</p>
                <button type="button" className="button button-primary" onClick={() => void beginLivePractice()}>Start live practice →</button>
                <em>Camera processing stays on this device.</em>
              </div>
            )}

            {practiceError && practiceStage === 'active' && (
              <div className="song-practice-error">
                <strong>Practice needs attention</strong>
                <p>{practiceError}</p>
                {cameraStatus !== 'ready' && <button type="button" onClick={() => void startCamera()}>Try camera again</button>}
              </div>
            )}
          </div>

          <div className="song-practice-coach" aria-live="polite">
            {practiceStage === 'complete' ? (
              <div className="song-practice-complete">
                <span aria-hidden="true">✓</span>
                <small>Lesson complete</small>
                <h3>Progression recognized.</h3>
                <p>You played all {song.cues.length} changes in order with the {song.presetLabel} preset.</p>
                <div>
                  <button type="button" className="button button-primary" onClick={replayLivePractice}>Practice again</button>
                  <button type="button" className="button button-ghost" onClick={stopLivePractice}>Close camera</button>
                </div>
              </div>
            ) : (
              <>
                <div className="song-practice-coach-head">
                  <div><small>Live recognition</small><strong>{practiceStage === 'active' ? `Cue ${activeCueIndex + 1} of ${song.cues.length}` : 'Ready when you are'}</strong></div>
                  {practiceStage === 'active' && <button type="button" onClick={stopLivePractice}>Stop</button>}
                </div>
                <div className="song-practice-target">
                  <div>
                    <FingerDiagram hand="Left" pattern={activeLessonChord.gesture.pattern} size="studio" />
                    <span>+</span>
                    <FingerDiagram hand="Right" pattern={activeLessonChord.rightHand.pattern} accent="violet" size="studio" />
                  </div>
                  <small>Target chord</small>
                  <h3>{activeChord.name}</h3>
                  <p>{practiceFeedback}</p>
                  {audioError && <em className="song-practice-audio-warning">{audioError} You can continue silently.</em>}
                </div>
                <div className="song-practice-hold">
                  <span>Hold to confirm</span>
                  <i><b style={{ width: `${Math.round(lessonMatchProgress * 100)}%` }} /></i>
                  <strong>{Math.round(lessonMatchProgress * 100)}%</strong>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="cue-player">
          <div className="cue-now">
            <div className="cue-progress-label"><span>Change {String(activeCueIndex + 1).padStart(2, '0')} / {String(song.cues.length).padStart(2, '0')}</span><strong>{Math.round(progress)}%</strong></div>
            <div className="cue-progress"><i style={{ width: `${progress}%` }} /></div>
            <div className="current-gesture">
              <div className="current-gesture-diagrams">
                <FingerDiagram hand="Left" pattern={activeLessonChord.gesture.pattern} />
                <span>+</span>
                <FingerDiagram hand="Right" pattern={activeLessonChord.rightHand.pattern} accent="violet" />
              </div>
              <div>
                <small>Make this gesture now</small>
                <h2>{activeChord.name}</h2>
                <p>Left degree {activeChord.degree} · tilt {activeChord.quality === 'major' ? 'inward' : 'outward'} · {activeLessonChord.rightHand.label}</p>
              </div>
            </div>
            <div className="current-cue-copy">
              <small>{activeCue.section} · {activeCue.timing}</small>
              <p><mark>{activeCue.text}</mark></p>
            </div>
            <div className="cue-controls">
              <button type="button" onClick={previousCue} disabled={activeCueIndex === 0}>← Previous</button>
              <button type="button" className="next-cue" onClick={nextCue} disabled={activeCueIndex === song.cues.length - 1}>Next change →</button>
            </div>
          </div>

          <div className="cue-timeline" aria-label="Song gesture timeline">
            {song.cues.map((cue, index) => {
              const chord = getTutorialChord(song, cue.chordId)
              return (
                <button
                  type="button"
                  className={`${index === activeCueIndex ? 'active' : ''} ${practiceStage !== 'idle' && index < activeCueIndex ? 'completed' : ''}`.trim()}
                  aria-pressed={index === activeCueIndex}
                  onClick={() => selectCue(index)}
                  key={cue.id}
                >
                  <span className="cue-step">{practiceStage !== 'idle' && index < activeCueIndex ? '✓' : String(index + 1).padStart(2, '0')}</span>
                  <span className="cue-timeline-copy"><small>{cue.section} · {cue.timing}</small><strong>{cue.text}</strong></span>
                  <span className="cue-chord-badge"><b>{chord.degree}</b>{chord.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <aside className="tutorial-rights-note">
        <span>{song.copyMode === 'lyrics' ? 'Public-domain lesson' : 'Instrumental cue guide'}</span>
        <p>{song.rightsNote}</p>
      </aside>

      <div className="lesson-callout tutorial-callout">
        <div><small>Know the progression?</small><h2>Take it into the studio.</h2></div>
        <Link className="button button-primary" to="/play">Open studio →</Link>
      </div>
    </div>
  )
}
