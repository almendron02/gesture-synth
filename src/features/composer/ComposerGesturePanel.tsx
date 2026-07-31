import type { RefObject } from 'react'
import type { CameraStatus } from '../camera/useCamera'
import type { HandsFrameAnalysis, PerformanceGesture } from '../gestures/gesture.types'
import type { TrackerStatus } from '../hand-tracking/useHandTracking'
import type { Chord } from '../music/chords'

interface ComposerGesturePanelProps {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  enabled: boolean
  cameraStatus: CameraStatus
  trackerStatus: TrackerStatus
  frame: HandsFrameAnalysis
  activeGesture: PerformanceGesture | null
  activeChord: Chord | null
  expression: number
  brightness: number
  trackName: string
  countInBeat: number | null
  recording: boolean
  calibrated: boolean
  canUndo: boolean
  error: string | null
  onEnable: () => void
  onDisable: () => void
  onRecord: () => void
  onUndo: () => void
}

function statusCopy(enabled: boolean, cameraStatus: CameraStatus, trackerStatus: TrackerStatus): string {
  if (!enabled) return 'Camera off'
  if (cameraStatus === 'requesting') return 'Waiting for permission'
  if (trackerStatus === 'loading') return 'Loading hand model'
  if (trackerStatus === 'ready') return 'Gesture input ready'
  return 'Preparing input'
}

export function ComposerGesturePanel({
  videoRef,
  canvasRef,
  enabled,
  cameraStatus,
  trackerStatus,
  frame,
  activeGesture,
  activeChord,
  expression,
  brightness,
  trackName,
  countInBeat,
  recording,
  calibrated,
  canUndo,
  error,
  onEnable,
  onDisable,
  onRecord,
  onUndo,
}: ComposerGesturePanelProps) {
  const ready = enabled && trackerStatus === 'ready'
  return (
    <section className={`composer-gesture-panel ${recording ? 'recording' : ''}`} aria-labelledby="gesture-take-title">
      <header>
        <div><p className="eyebrow"><span /> Live input · gesture take</p><h2 id="gesture-take-title">Perform into the timeline.</h2></div>
        <p>Existing tracks play during the count-in. Your stable hand chords are captured as editable notes on <strong>{trackName}</strong>.</p>
      </header>
      <div className="composer-gesture-body">
        <div className="composer-camera-monitor">
          <video ref={videoRef} muted playsInline aria-label="Composer mirrored camera view" />
          <canvas ref={canvasRef} aria-hidden="true" />
          <div className="composer-camera-grid" aria-hidden="true" />
          <div className="composer-camera-status"><span className={ready ? 'ready' : ''}><i /> {statusCopy(enabled, cameraStatus, trackerStatus)}</span><small>{frame.handCount}/2 hands</small></div>
          {!enabled && (
            <div className="composer-camera-start">
              <span>✦</span><strong>Enable gesture input</strong><p>Camera frames stay on this device.</p>
              <button type="button" className="button button-primary" onClick={onEnable}>Enable camera →</button>
            </div>
          )}
          {enabled && countInBeat != null && <div className="composer-count-in"><small>Gesture take starts in</small><strong>{countInBeat}</strong><span>Ready both hands</span></div>}
          {enabled && recording && <div className="composer-recording-state"><span><i /> Recording take</span><strong>{activeChord?.name ?? 'Waiting for a complete sign'}</strong></div>}
          {enabled && !recording && countInBeat == null && activeChord && <div className="composer-live-chord"><small>{activeChord.voicingLabel}</small><strong>{activeGesture?.left.degree}</strong><span>{activeChord.name}</span></div>}
        </div>

        <aside className="composer-gesture-console">
          <div className="gesture-console-state">
            <small>Armed destination</small><strong><i /> {trackName}</strong><span>{calibrated ? 'Personal hand calibration active' : 'Studio defaults · calibrate in Play for better accuracy'}</span>
          </div>
          <div className="gesture-console-readout">
            <span><small>Left hand</small><strong>{frame.left?.candidate ? `${frame.left.candidate.degree} · ${frame.left.candidate.quality}` : 'No chord sign'}</strong></span>
            <span><small>Right hand</small><strong>{activeGesture?.right.label ?? 'No voicing sign'}</strong></span>
          </div>
          <div className="gesture-console-automation">
            <label><span>Expression · hand height</span><strong>{Math.round(expression * 100)}</strong><i><b style={{ width: `${expression * 100}%` }} /></i></label>
            <label><span>Brightness · rotation</span><strong>{Math.round(brightness * 100)}</strong><i><b style={{ width: `${brightness * 100}%` }} /></i></label>
          </div>
          {error && <p className="composer-gesture-error" role="alert">{error}</p>}
          <div className="gesture-console-actions">
            <button type="button" className="gesture-record-button" disabled={!ready} onClick={onRecord}><i /> {countInBeat != null ? 'Cancel count-in' : recording ? 'Finish take' : 'Record gesture take'}</button>
            <button type="button" disabled={!canUndo || recording || countInBeat != null} onClick={onUndo}>↶ Undo take</button>
            {enabled && <button type="button" disabled={recording || countInBeat != null} onClick={onDisable}>Camera off</button>}
          </div>
        </aside>
      </div>
    </section>
  )
}
