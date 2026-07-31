import { useMemo, useState } from 'react'
import { PianoRoll } from '../features/composer/PianoRoll'
import { totalBeats } from '../features/composer/composition'
import { useComposer } from '../features/composer/useComposer'
import { soundPresetDefinitions } from '../features/synth/soundPresets'

const keyboardKeys = [
  ['A', 'C'], ['W', 'C#'], ['S', 'D'], ['E', 'D#'], ['D', 'E'], ['F', 'F'],
  ['T', 'F#'], ['G', 'G'], ['Y', 'G#'], ['H', 'A'], ['U', 'A#'], ['J', 'B'], ['K', 'C'],
] as const

export function ComposerPage() {
  const composer = useComposer()
  const [notice, setNotice] = useState<string | null>(null)
  const selectedTrack = composer.composition.tracks.find((track) => track.id === composer.selectedTrackId)
    ?? composer.composition.tracks[0]
  const selectedNote = useMemo(() => composer.composition.tracks
    .flatMap((track) => track.notes)
    .find((note) => note.id === composer.selectedNoteId) ?? null, [composer.composition.tracks, composer.selectedNoteId])
  const beats = totalBeats(composer.composition)

  const handleImport = () => {
    const imported = composer.importStudioLoop()
    setNotice(imported ? 'Studio loop added as editable gesture tracks.' : 'Record a loop in the Studio first, then return here to import it.')
  }

  return (
    <div className="composer-page">
      <section className="composer-hero">
        <div>
          <p className="eyebrow"><span /> Composition workspace · foundation</p>
          <h1>Shape the performance.<br /><em>Finish the idea.</em></h1>
        </div>
        <p>Draw notes, play the laptop keyboard, and bring expressive gesture recordings into one editable timeline.</p>
      </section>

      <section className="composer-shell" aria-label="Composer workspace">
        <header className="composer-transport">
          <div className="composer-project-name">
            <small>Current project</small>
            <input aria-label="Composition name" value={composer.composition.name} onChange={(event) => composer.setName(event.target.value)} />
            <span>Saved automatically in this browser</span>
          </div>
          <div className="composer-play-controls">
            <button type="button" className={composer.isPlaying && !composer.isRecording ? 'active' : ''} onClick={composer.togglePlay} aria-label={composer.isPlaying ? 'Stop playback' : 'Play composition'}>{composer.isPlaying && !composer.isRecording ? '■' : '▶'}</button>
            <button type="button" className={`composer-record ${composer.isRecording ? 'active' : ''}`} onClick={composer.toggleRecording}><i /> {composer.isRecording ? 'Stop' : 'Record keys'}</button>
            <div><small>Position</small><strong>{Math.floor(composer.playheadBeat / 4) + 1}.{Math.floor(composer.playheadBeat % 4) + 1}</strong></div>
          </div>
          <div className="composer-session-settings">
            <label><span>Tempo</span><input type="number" min="40" max="220" value={composer.composition.bpm} disabled={composer.isPlaying} onChange={(event) => composer.setBpm(Number(event.target.value))} /><small>BPM</small></label>
            <label><span>Bars</span><select value={composer.composition.bars} disabled={composer.isPlaying} onChange={(event) => composer.setBars(Number(event.target.value))}><option value="4">4</option><option value="8">8</option><option value="16">16</option></select></label>
            <label><span>Grid</span><select value={composer.composition.quantization} onChange={(event) => composer.setQuantization(event.target.value as '1/4' | '1/8' | '1/16')}><option value="1/4">1/4</option><option value="1/8">1/8</option><option value="1/16">1/16</option></select></label>
          </div>
        </header>

        <div className="composer-workspace">
          <aside className="composer-tracks" aria-label="Composition tracks">
            <header><div><small>Tracks</small><strong>{composer.composition.tracks.length}</strong></div><button type="button" onClick={composer.addTrack}>＋ Add</button></header>
            {composer.composition.tracks.map((track, index) => (
              <article className={`${track.color} ${track.id === selectedTrack.id ? 'selected' : ''}`} onClick={() => { composer.setSelectedTrackId(track.id); composer.setSelectedNoteId(null) }} key={track.id}>
                <button type="button" className="track-select" aria-label={`Select ${track.name}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div><small>{track.notes.some((note) => note.source === 'gesture') ? 'Gesture track' : 'Instrument track'}</small><strong>{track.name}</strong><em>{track.notes.length} notes</em></div>
                </button>
                <div className="track-actions">
                  <button type="button" className={track.muted ? 'active' : ''} aria-label={`${track.muted ? 'Unmute' : 'Mute'} ${track.name}`} onClick={(event) => { event.stopPropagation(); composer.toggleTrackMute(track.id) }}>M</button>
                  <button type="button" className={track.solo ? 'active' : ''} aria-label={`${track.solo ? 'Unsolo' : 'Solo'} ${track.name}`} onClick={(event) => { event.stopPropagation(); composer.toggleTrackSolo(track.id) }}>S</button>
                </div>
              </article>
            ))}
            <button type="button" className="import-loop-button" disabled={!composer.hasStudioLoop} onClick={handleImport}><span>↳</span><div><strong>Import Studio loop</strong><small>{composer.hasStudioLoop ? 'Convert gestures into notes' : 'No saved loop yet'}</small></div></button>
          </aside>

          <div className="composer-editor">
            <header className="composer-editor-header">
              <div><small>Editing track</small><strong>{selectedTrack.name}</strong><span className={`track-color ${selectedTrack.color}`} /></div>
              <label><span>Sound</span><select value={selectedTrack.preset} onChange={(event) => composer.setTrackPreset(selectedTrack.id, event.target.value as typeof selectedTrack.preset)}>{soundPresetDefinitions.map((preset) => <option value={preset.id} key={preset.id}>{preset.label}</option>)}</select></label>
              <div className="note-tools">
                <button type="button" disabled={!selectedNote} onClick={composer.duplicateSelectedNote}>Duplicate</button>
                <button type="button" disabled={!selectedNote} onClick={composer.deleteSelectedNote}>Delete</button>
              </div>
            </header>

            <div className="composer-ruler" aria-hidden="true">
              <span />
              <div>{Array.from({ length: composer.composition.bars }, (_, index) => <i style={{ left: `${index * 4 / beats * 100}%` }} key={index}>{index + 1}</i>)}</div>
            </div>

            <PianoRoll
              composition={composer.composition}
              track={selectedTrack}
              selectedNoteId={composer.selectedNoteId}
              playheadBeat={composer.playheadBeat}
              onAddNote={composer.addNote}
              onSelectNote={composer.setSelectedNoteId}
              onUpdateNote={composer.updateNote}
            />

            <footer className="composer-inspector">
              {selectedNote ? (
                <>
                  <div><small>Selected note</small><strong>{selectedNote.pitch}</strong><span>{selectedNote.source}</span></div>
                  <label><span>Start beat</span><input type="number" min="0" max={beats} step="0.25" value={selectedNote.startBeat} onChange={(event) => composer.updateNote(selectedNote.id, { startBeat: Number(event.target.value) })} /></label>
                  <label><span>Duration</span><input type="number" min="0.25" max={beats} step="0.25" value={selectedNote.durationBeats} onChange={(event) => composer.updateNote(selectedNote.id, { durationBeats: Number(event.target.value) })} /></label>
                  <label><span>Velocity</span><input type="range" min="0.05" max="1" step="0.01" value={selectedNote.velocity} onChange={(event) => composer.updateNote(selectedNote.id, { velocity: Number(event.target.value) })} /></label>
                </>
              ) : (
                <div className="composer-empty-inspector"><span>＋</span><p><strong>Click the grid to add a note.</strong> Drag a note to move it. Use its right edge to resize it.</p></div>
              )}
            </footer>
          </div>
        </div>

        <section className="composer-keyboard-help" aria-labelledby="keyboard-title">
          <div><small>Laptop instrument</small><h2 id="keyboard-title">Play it before you draw it.</h2><p>Select a track, then use these keys. Press <kbd>Z</kbd> or <kbd>X</kbd> to change octave, <kbd>R</kbd> to record, and <kbd>Space</kbd> to play or stop.</p></div>
          <div className="laptop-keyboard" aria-label={`Laptop keyboard note map, octave ${composer.keyboardOctave}`}>
            {keyboardKeys.map(([key, note], index) => <span className={note.includes('#') ? 'black-key' : ''} key={`${key}-${index}`}><kbd>{key}</kbd><small>{note}{index === keyboardKeys.length - 1 ? composer.keyboardOctave + 1 : composer.keyboardOctave}</small></span>)}
          </div>
        </section>
        {(notice || composer.audioError) && <div className="composer-notice" role="status"><span>●</span>{composer.audioError ?? notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button></div>}
      </section>
    </div>
  )
}
