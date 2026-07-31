import type { MidiOutputDevice } from './MidiOutputEngine'
import type { MidiConnectionStatus } from './useMidiOutput'

interface MidiPanelProps {
  supported: boolean
  status: MidiConnectionStatus
  outputs: MidiOutputDevice[]
  outputId: string | null
  channel: number
  activeNoteCount: number
  error: string | null
  localMonitor: boolean
  onConnect: () => void
  onOutputChange: (outputId: string | null) => void
  onChannelChange: (channel: number) => void
  onLocalMonitorChange: () => void
  onPanic: () => void
}

function statusLabel(status: MidiConnectionStatus, activeNoteCount: number): string {
  if (status === 'unsupported') return 'Unavailable'
  if (status === 'requesting') return 'Connecting'
  if (status === 'ready') return activeNoteCount ? `${activeNoteCount} notes live` : 'Connected'
  if (status === 'error') return 'Needs attention'
  return 'Not connected'
}

export function MidiPanel({
  supported,
  status,
  outputs,
  outputId,
  channel,
  activeNoteCount,
  error,
  localMonitor,
  onConnect,
  onOutputChange,
  onChannelChange,
  onLocalMonitorChange,
  onPanic,
}: MidiPanelProps) {
  const connectedOutput = outputs.find((output) => output.id === outputId)

  return (
    <section className={`midi-panel ${status}`} aria-labelledby="midi-title">
      <header className="midi-header">
        <div>
          <p className="eyebrow"><span /> External instrument</p>
          <h2 id="midi-title">MIDI bridge</h2>
        </div>
        <p>Send live gesture chords into a DAW, software instrument, or hardware synth. Notes remain gated by the same exact two-hand signs.</p>
        <div className="midi-state" aria-live="polite"><i /><span>{statusLabel(status, activeNoteCount)}</span></div>
      </header>

      <div className="midi-body">
        <div className="midi-routing">
          <label>
            <span>Output</span>
            <select
              aria-label="MIDI output"
              value={outputId ?? ''}
              disabled={status === 'unsupported' || status === 'requesting' || !outputs.length}
              onChange={(event) => onOutputChange(event.target.value || null)}
            >
              {!outputs.length && <option value="">No output selected</option>}
              {outputs.map((output) => <option value={output.id} key={output.id}>{output.name}</option>)}
            </select>
          </label>

          <label>
            <span>Channel</span>
            <select aria-label="MIDI channel" value={channel} disabled={status === 'requesting'} onChange={(event) => onChannelChange(Number(event.target.value))}>
              {Array.from({ length: 16 }, (_, index) => <option value={index + 1} key={index + 1}>{String(index + 1).padStart(2, '0')}</option>)}
            </select>
          </label>

          <button className="midi-connect" type="button" disabled={!supported || status === 'requesting'} onClick={onConnect}>
            {status === 'requesting' ? 'Connecting…' : status === 'ready' ? 'Rescan devices' : 'Connect MIDI'}
          </button>
        </div>

        <div className="midi-mappings" aria-label="MIDI gesture mappings">
          <span><small>Hand chord</small><strong>Note on / off</strong></span>
          <span><small>Hand height</small><strong>CC11 · Expression</strong></span>
          <span><small>Right rotation</small><strong>CC74 · Brightness</strong></span>
        </div>

        <div className="midi-actions">
          <button type="button" aria-pressed={localMonitor} onClick={onLocalMonitorChange}>
            <span>Local monitor</span><strong>{localMonitor ? 'On' : 'Off'}</strong>
          </button>
          <button className="midi-panic" type="button" disabled={status !== 'ready'} onClick={onPanic}>
            <span>Safety</span><strong>Panic · all notes off</strong>
          </button>
        </div>
      </div>

      <footer className="midi-footer">
        <p>{error ?? (connectedOutput ? `${connectedOutput.manufacturer} · MIDI channel ${channel}` : supported ? 'For a DAW, select an IAC or loopMIDI virtual port and use it as the track input.' : 'Web MIDI requires a compatible desktop browser such as Chrome or Edge.')}</p>
        <small>Permission is requested only when you press Connect MIDI</small>
      </footer>
    </section>
  )
}
