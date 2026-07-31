import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { COMPOSER_PITCHES, quantizationBeats, snapBeat, totalBeats } from './composition'
import type { Composition, ComposerNote, ComposerTrack } from './composer.types'

const ROW_HEIGHT = 28

interface PianoRollProps {
  composition: Composition
  track: ComposerTrack
  selectedNoteId: string | null
  playheadBeat: number
  onAddNote: (pitch: string, startBeat: number) => void
  onSelectNote: (noteId: string | null) => void
  onUpdateNote: (noteId: string, patch: Partial<Pick<ComposerNote, 'pitch' | 'startBeat' | 'durationBeats'>>) => void
}

interface DragState {
  noteId: string
  mode: 'move' | 'resize'
  pointerX: number
  pointerY: number
  originalStart: number
  originalDuration: number
  originalPitchIndex: number
}

function isAccidental(pitch: string): boolean {
  return pitch.includes('#')
}

export function PianoRoll({
  composition,
  track,
  selectedNoteId,
  playheadBeat,
  onAddNote,
  onSelectNote,
  onUpdateNote,
}: PianoRollProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const beats = totalBeats(composition)

  useEffect(() => {
    const index = COMPOSER_PITCHES.indexOf('C5')
    if (scrollRef.current && index >= 0) scrollRef.current.scrollTop = Math.max(0, index * ROW_HEIGHT - 40)
  }, [])

  useEffect(() => {
    if (!drag) return
    const onPointerMove = (event: PointerEvent) => {
      const grid = gridRef.current
      if (!grid) return
      const rect = grid.getBoundingClientRect()
      const deltaBeat = (event.clientX - drag.pointerX) / rect.width * beats
      if (drag.mode === 'resize') {
        onUpdateNote(drag.noteId, {
          durationBeats: Math.max(quantizationBeats(composition.quantization), drag.originalDuration + deltaBeat),
        })
        return
      }
      const rowDelta = Math.round((event.clientY - drag.pointerY) / ROW_HEIGHT)
      const pitchIndex = Math.max(0, Math.min(COMPOSER_PITCHES.length - 1, drag.originalPitchIndex + rowDelta))
      onUpdateNote(drag.noteId, {
        startBeat: drag.originalStart + deltaBeat,
        pitch: COMPOSER_PITCHES[pitchIndex],
      })
    }
    const onPointerUp = () => setDrag(null)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [beats, composition.quantization, drag, onUpdateNote])

  const beginDrag = (event: ReactPointerEvent, note: ComposerNote, mode: DragState['mode']) => {
    event.preventDefault()
    event.stopPropagation()
    onSelectNote(note.id)
    setDrag({
      noteId: note.id,
      mode,
      pointerX: event.clientX,
      pointerY: event.clientY,
      originalStart: note.startBeat,
      originalDuration: note.durationBeats,
      originalPitchIndex: Math.max(0, COMPOSER_PITCHES.indexOf(note.pitch)),
    })
  }

  const addFromGrid = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || drag) return
    const rect = event.currentTarget.getBoundingClientRect()
    const beat = snapBeat((event.clientX - rect.left) / rect.width * beats, composition.quantization)
    const pitchIndex = Math.max(0, Math.min(COMPOSER_PITCHES.length - 1, Math.floor((event.clientY - rect.top) / ROW_HEIGHT)))
    onAddNote(COMPOSER_PITCHES[pitchIndex], beat)
  }

  return (
    <div className="composer-piano-scroll" ref={scrollRef}>
      <div className="composer-piano" style={{ height: COMPOSER_PITCHES.length * ROW_HEIGHT }}>
        <div className="piano-labels" aria-label="Piano notes">
          {COMPOSER_PITCHES.map((pitch) => (
            <div className={isAccidental(pitch) ? 'accidental' : ''} style={{ height: ROW_HEIGHT }} key={pitch}>
              <span>{pitch}</span>
            </div>
          ))}
        </div>
        <div
          className={`piano-grid ${track.color}`}
          style={{ height: COMPOSER_PITCHES.length * ROW_HEIGHT }}
          ref={gridRef}
          role="application"
          aria-label={`${track.name} piano roll. Click the grid to add a note.`}
          onPointerDown={addFromGrid}
          onPointerDownCapture={(event) => {
            if (event.target === event.currentTarget) onSelectNote(null)
          }}
        >
          {COMPOSER_PITCHES.map((pitch, index) => (
            <i className={`pitch-line ${isAccidental(pitch) ? 'accidental' : ''}`} style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }} key={pitch} />
          ))}
          {Array.from({ length: beats + 1 }, (_, beat) => (
            <i className={`beat-line ${beat % 4 === 0 ? 'bar-line' : ''}`} style={{ left: `${beat / beats * 100}%` }} key={beat} />
          ))}
          {track.notes.map((note) => {
            const pitchIndex = COMPOSER_PITCHES.indexOf(note.pitch)
            if (pitchIndex < 0) return null
            return (
              <button
                type="button"
                className={`composer-note ${selectedNoteId === note.id ? 'selected' : ''}`}
                data-source={note.source}
                style={{
                  left: `${note.startBeat / beats * 100}%`,
                  top: pitchIndex * ROW_HEIGHT + 3,
                  width: `${Math.max(0.35, note.durationBeats) / beats * 100}%`,
                  height: ROW_HEIGHT - 6,
                }}
                aria-label={`${note.pitch}, beat ${note.startBeat + 1}, ${note.durationBeats} beats, ${note.source}`}
                title={`${note.pitch} · ${note.durationBeats} beats · ${note.source}`}
                onPointerDown={(event) => beginDrag(event, note, 'move')}
                onClick={(event) => event.stopPropagation()}
                key={note.id}
              >
                <span>{note.pitch}</span>
                <i aria-hidden="true" onPointerDown={(event) => beginDrag(event, note, 'resize')} />
              </button>
            )
          })}
          <div className="composer-playhead" style={{ left: `${playheadBeat / beats * 100}%` }} aria-hidden="true"><i /></div>
        </div>
      </div>
    </div>
  )
}
