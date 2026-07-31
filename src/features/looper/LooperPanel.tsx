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
  maxLayers: number
  onBpmChange: (bpm: number) => void
  onBarsChange: (bars: number) => void
  onQuantizationChange: (quantization: LoopQuantization) => void
  onRecord: () => void
  onOverdub: () => void
  onCancelRecording: () => void
  onPlay: () => void
  onStopPlayback: () => void
  onToggleLayerMute: (layerId: string) => void
  onRemoveLayer: (layerId: string) => void
  onUndoLayer: () => void
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

function isCapturing(mode: LooperMode): boolean {
  return mode === 'count-in' || mode === 'recording' || mode === 'overdub-count-in' || mode === 'overdubbing'
}

function modeCopy(mode: LooperMode, activeChord: Chord | null): string {
  if (mode === 'count-in') return 'Get both hands ready for a new take'
  if (mode === 'overdub-count-in') return 'Get ready to add the next layer'
  if (mode === 'recording') return activeChord ? `Capturing ${activeChord.name}` : 'Waiting for a complete chord'
  if (mode === 'overdubbing') return activeChord ? `Layering ${activeChord.name}` : 'Base loop live · waiting for your chord'
  if (mode === 'playing') return 'All unmuted layers are playing'
  return 'Ready for a new take or overdub'
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
  maxLayers,
  onBpmChange,
  onBarsChange,
  onQuantizationChange,
  onRecord,
  onOverdub,
  onCancelRecording,
  onPlay,
  onStopPlayback,
  onToggleLayerMute,
  onRemoveLayer,
  onUndoLayer,
  onClear,
}: LooperPanelProps) {
  const transportBusy = mode !== 'idle'
  const recordingTake = isCapturing(mode)
  const countIn = mode === 'count-in' || mode === 'overdub-count-in'
  const overdubbing = mode === 'overdub-count-in' || mode === 'overdubbing'
  const settingsLocked = transportBusy || Boolean(loop)
  const events = loop?.layers.flatMap((layer) => layer.events) ?? []
  const uniqueChords = new Set(events.map((event) => `${event.chord.degree}-${event.chord.quality}`)).size
  const totalBeats = loop ? loop.bars * 4 : bars * 4
  const layerLimitReached = (loop?.layers.length ?? 0) >= maxLayers

  return (
    <section className={`performance-looper ${mode}`} aria-labelledby="looper-title">
      <header className="looper-header">
        <div>
          <p className="eyebrow"><span /> Creation tool · layered session</p>
          <h2 id="looper-title">Performance looper</h2>
        </div>
        <p>Build a progression, then overdub up to {maxLayers} synchronized gesture layers. Mute or remove any layer without losing the rest of the session.</p>
      </header>

      <div className="looper-workspace">
        <aside className="looper-settings">
          <div className="looper-setting">
            <label htmlFor="loop-tempo">Session tempo</label>
            <div className="tempo-value"><input id="loop-tempo" aria-label="Loop tempo" type="number" min="40" max="220" value={loop?.bpm ?? bpm} disabled={settingsLocked} onChange={(event) => onBpmChange(Number(event.target.value))} /><span>BPM</span></div>
            <input aria-label="Loop tempo slider" type="range" min="60" max="180" value={loop?.bpm ?? bpm} disabled={settingsLocked} onChange={(event) => onBpmChange(Number(event.target.value))} />
          </div>

          <fieldset className="looper-setting">
            <legend>Loop length</legend>
            <div className="looper-segments">
              {barOptions.map((option) => <button type="button" aria-pressed={(loop?.bars ?? bars) === option} disabled={settingsLocked} className={(loop?.bars ?? bars) === option ? 'active' : ''} onClick={() => onBarsChange(option)} key={option}>{option}</button>)}
            </div>
            <small>{loop ? 'Locked across every layer' : `${bars} ${bars === 1 ? 'bar' : 'bars'} · automatic stop`}</small>
          </fieldset>

          <fieldset className="looper-setting">
            <legend>Quantize</legend>
            <div className="looper-segments quantize-segments">
              {quantizationOptions.map((option) => <button type="button" aria-pressed={(loop?.quantization ?? quantization) === option.id} disabled={settingsLocked} className={(loop?.quantization ?? quantization) === option.id ? 'active' : ''} onClick={() => onQuantizationChange(option.id)} key={option.id}>{option.label}</button>)}
            </div>
            <small>{loop ? `${loop.quantization} grid · clear the session to change` : quantization === 'off' ? 'Keep the original timing' : `Snap changes to the ${quantization} grid`}</small>
          </fieldset>
        </aside>

        <div className="looper-take">
          <div className="looper-transport">
            <div className="looper-status" aria-live="polite">
              <span className={`transport-light ${mode}`} />
              <div><small>{mode === 'idle' ? 'Transport ready' : mode.replaceAll('-', ' ')}</small><strong>{modeCopy(mode, activeChord)}</strong></div>
            </div>
            <div className="looper-buttons">
              {recordingTake ? (
                <button type="button" className="looper-control cancel-take" onClick={onCancelRecording}><i>■</i> Cancel</button>
              ) : (
                <button type="button" className="looper-control record-take" disabled={!canRecord} onClick={onRecord}><i /> New take</button>
              )}
              <button type="button" className="looper-control overdub-take" disabled={!loop || !canRecord || recordingTake || layerLimitReached} onClick={onOverdub}>＋ Overdub</button>
              <button type="button" className="looper-control play-take" disabled={!loop || recordingTake} onClick={mode === 'playing' ? onStopPlayback : onPlay}>{mode === 'playing' ? 'Ⅱ Pause' : '▶ Play'}</button>
              <button type="button" className="looper-control undo-take" disabled={!loop || loop.layers.length < 2 || recordingTake} onClick={onUndoLayer}>↶ Undo layer</button>
              <button type="button" className="looper-control clear-take" disabled={!loop || recordingTake} onClick={onClear}>Clear</button>
            </div>
          </div>

          <div className="loop-timeline layered" aria-label="Recorded chord layers">
            <div className="loop-ruler layered-ruler" aria-hidden="true">
              {Array.from({ length: totalBeats }, (_, index) => <i className={index % 4 === 0 ? 'bar-start' : ''} style={{ left: `${(index / totalBeats) * 100}%` }} key={index} />)}
            </div>

            {loop ? (
              <div className={`loop-layers ${mode === 'recording' ? 'replacing' : ''}`}>
                {loop.layers.map((layer, layerIndex) => (
                  <div className={`loop-layer ${layer.muted ? 'muted' : ''}`} key={layer.id}>
                    <div className="loop-layer-meta">
                      <span>{String(layerIndex + 1).padStart(2, '0')}</span>
                      <div><small>Gesture layer</small><strong>{layer.name}</strong></div>
                      <button type="button" aria-label={`${layer.muted ? 'Unmute' : 'Mute'} ${layer.name}`} aria-pressed={layer.muted} onClick={() => onToggleLayerMute(layer.id)}>{layer.muted ? 'Muted' : 'Mute'}</button>
                      <button type="button" aria-label={`Delete ${layer.name}`} onClick={() => onRemoveLayer(layer.id)}>×</button>
                    </div>
                    <div className="loop-layer-events">
                      {layer.events.map((event) => (
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="loop-empty">
                <span>●</span>
                <div><strong>No session recorded yet</strong><p>Enable the studio, record a base take, then add synchronized overdub layers.</p></div>
              </div>
            )}

            {recordingTake && (
              <div className={`new-take-overlay ${overdubbing ? 'overdub' : ''}`}>
                <span>{countIn ? countInBeat : overdubbing ? `L${(loop?.layers.length ?? 0) + 1}` : 'REC'}</span>
                <strong>{countIn ? `${overdubbing ? 'Overdub' : 'Recording'} starts on the next bar` : overdubbing ? 'Base loop playing · new layer recording' : `${bars}-bar take in progress`}</strong>
              </div>
            )}
            {(mode === 'playing' || mode === 'recording' || mode === 'overdubbing') && (
              <div className="loop-playhead-track"><i className="loop-playhead" style={{ left: `${transportProgress * 100}%` }} /></div>
            )}
          </div>

          <footer className="looper-footer">
            <div>
              <span><small>Length</small><strong>{loop ? formatDuration(loop.durationMs) : formatDuration(bars * 4 * 60_000 / bpm)}</strong></span>
              <span><small>Layers</small><strong>{loop?.layers.length ?? 0}/{maxLayers}</strong></span>
              <span><small>Events</small><strong>{events.length}</strong></span>
              <span><small>Chords</small><strong>{uniqueChords}</strong></span>
            </div>
            <p>{audioError ?? (!canRecord ? 'Enable the camera studio to record or overdub.' : layerLimitReached ? 'Four layers captured. Remove one to record another.' : 'Every overdub uses the same tempo, length, and quantization grid.')}</p>
          </footer>
        </div>
      </div>
    </section>
  )
}
