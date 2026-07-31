import type { Chord } from '../music/chords'
import type { GestureLoop, LooperMode, LoopQuantization } from './looper.types'

interface LooperPanelProps {
  loop: GestureLoop | null
  mode: LooperMode
  bpm: number
  bars: number
  quantization: LoopQuantization
  countInBeat: number | null
  transportProgress: number
  activeChord: Chord | null
  audioError: string | null
  canRecord: boolean
  onBpmChange: (bpm: number) => void
  onBarsChange: (bars: number) => void
  onQuantizationChange: (quantization: LoopQuantization) => void
  onRecord: () => void
  onCancelRecording: () => void
  onPlay: () => void
  onStopPlayback: () => void
  onClear: () => void
}

const barOptions = [1, 2, 4, 8]
const quantizationOptions: readonly { id: LoopQuantization; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: '1/4', label: '1/4' },
  { id: '1/8', label: '1/8' },
  { id: '1/16', label: '1/16' },
]

function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, durationMs / 1000)
  return `${seconds.toFixed(seconds >= 10 ? 1 : 2)}s`
}

function modeCopy(mode: LooperMode, activeChord: Chord | null): string {
  if (mode === 'count-in') return 'Get both hands ready'
  if (mode === 'recording') return activeChord ? `Capturing ${activeChord.name}` : 'Waiting for a complete chord'
  if (mode === 'playing') return 'Loop playback is live'
  return 'Ready for a new take'
}

export function LooperPanel({
  loop,
  mode,
  bpm,
  bars,
  quantization,
  countInBeat,
  transportProgress,
  activeChord,
  audioError,
  canRecord,
  onBpmChange,
  onBarsChange,
  onQuantizationChange,
  onRecord,
  onCancelRecording,
  onPlay,
  onStopPlayback,
  onClear,
}: LooperPanelProps) {
  const transportBusy = mode !== 'idle'
  const recordingTake = mode === 'count-in' || mode === 'recording'
  const uniqueChords = loop ? new Set(loop.events.map((event) => `${event.chord.degree}-${event.chord.quality}`)).size : 0
  const totalBeats = loop ? loop.bars * 4 : bars * 4

  return (
    <section className={`performance-looper ${mode}`} aria-labelledby="looper-title">
      <header className="looper-header">
        <div>
          <p className="eyebrow"><span /> Creation tool · local session</p>
          <h2 id="looper-title">Performance looper</h2>
        </div>
        <p>Capture the chord, voicing, octave, dynamics, and tone from your live gestures—then hear the take repeat automatically.</p>
      </header>

      <div className="looper-workspace">
        <aside className="looper-settings">
          <div className="looper-setting">
            <label htmlFor="loop-tempo">Tempo</label>
            <div className="tempo-value"><input id="loop-tempo" aria-label="Loop tempo" type="number" min="40" max="220" value={bpm} disabled={transportBusy} onChange={(event) => onBpmChange(Number(event.target.value))} /><span>BPM</span></div>
            <input aria-label="Loop tempo slider" type="range" min="60" max="180" value={bpm} disabled={transportBusy} onChange={(event) => onBpmChange(Number(event.target.value))} />
          </div>

          <fieldset className="looper-setting">
            <legend>Loop length</legend>
            <div className="looper-segments">
              {barOptions.map((option) => <button type="button" aria-pressed={bars === option} disabled={transportBusy} className={bars === option ? 'active' : ''} onClick={() => onBarsChange(option)} key={option}>{option}</button>)}
            </div>
            <small>{bars} {bars === 1 ? 'bar' : 'bars'} · automatic stop</small>
          </fieldset>

          <fieldset className="looper-setting">
            <legend>Quantize</legend>
            <div className="looper-segments quantize-segments">
              {quantizationOptions.map((option) => <button type="button" aria-pressed={quantization === option.id} disabled={transportBusy} className={quantization === option.id ? 'active' : ''} onClick={() => onQuantizationChange(option.id)} key={option.id}>{option.label}</button>)}
            </div>
            <small>{quantization === 'off' ? 'Keep the original timing' : `Snap changes to the ${quantization} grid`}</small>
          </fieldset>
        </aside>

        <div className="looper-take">
          <div className="looper-transport">
            <div className="looper-status" aria-live="polite">
              <span className={`transport-light ${mode}`} />
              <div><small>{mode === 'idle' ? 'Transport ready' : mode.replace('-', ' ')}</small><strong>{modeCopy(mode, activeChord)}</strong></div>
            </div>
            <div className="looper-buttons">
              {recordingTake ? (
                <button type="button" className="looper-control cancel-take" onClick={onCancelRecording}><i>■</i> Cancel take</button>
              ) : (
                <button type="button" className="looper-control record-take" disabled={!canRecord || mode === 'playing'} onClick={onRecord}><i /> Record</button>
              )}
              <button type="button" className="looper-control play-take" disabled={!loop || recordingTake} onClick={mode === 'playing' ? onStopPlayback : onPlay}>{mode === 'playing' ? 'Ⅱ Pause' : '▶ Play'}</button>
              <button type="button" className="looper-control clear-take" disabled={!loop || recordingTake} onClick={onClear}>Clear</button>
            </div>
          </div>

          <div className="loop-timeline" aria-label="Recorded chord timeline">
            <div className="loop-ruler" aria-hidden="true">
              {Array.from({ length: totalBeats }, (_, index) => <i className={index % 4 === 0 ? 'bar-start' : ''} style={{ left: `${(index / totalBeats) * 100}%` }} key={index} />)}
            </div>

            {loop ? (
              <div className={`loop-events ${recordingTake ? 'replacing' : ''}`}>
                {loop.events.map((event) => (
                  <div
                    className="loop-event"
                    data-quality={event.chord.quality}
                    style={{
                      left: `${(event.startMs / loop.durationMs) * 100}%`,
                      width: `${Math.max(1.3, (event.durationMs / loop.durationMs) * 100)}%`,
                    }}
                    title={`${event.chord.name} · ${event.chord.voicingLabel}`}
                    key={event.id}
                  >
                    <b>{event.chord.degree}</b>
                    <span>{event.chord.name}</span>
                    <small>{event.chord.voicingLabel}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="loop-empty">
                <span>●</span>
                <div><strong>No take recorded yet</strong><p>Enable the studio, press Record, and use the four-beat count-in to raise both hands.</p></div>
              </div>
            )}

            {recordingTake && <div className="new-take-overlay"><span>{mode === 'count-in' ? countInBeat : 'REC'}</span><strong>{mode === 'count-in' ? 'Recording starts on the next bar' : `${bars}-bar take in progress`}</strong></div>}
            {(mode === 'playing' || mode === 'recording') && <i className="loop-playhead" style={{ left: `${transportProgress * 100}%` }} />}
          </div>

          <footer className="looper-footer">
            <div>
              <span><small>Length</small><strong>{loop ? formatDuration(loop.durationMs) : formatDuration(bars * 4 * 60_000 / bpm)}</strong></span>
              <span><small>Events</small><strong>{loop?.events.length ?? 0}</strong></span>
              <span><small>Chords</small><strong>{uniqueChords}</strong></span>
              <span><small>Storage</small><strong>{loop ? 'Saved locally' : 'Empty'}</strong></span>
            </div>
            <p>{audioError ?? (!canRecord ? 'Enable the camera studio to record a gesture take.' : 'The take begins and ends automatically, so both hands stay available.')}</p>
          </footer>
        </div>
      </div>
    </section>
  )
}
