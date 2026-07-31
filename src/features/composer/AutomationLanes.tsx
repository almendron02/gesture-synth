import { totalBeats } from './composition'
import type { Composition, ComposerTrack } from './composer.types'

interface AutomationLanesProps {
  composition: Composition
  track: ComposerTrack
}

export function AutomationLanes({ composition, track }: AutomationLanesProps) {
  const beats = totalBeats(composition)
  const segments = [...new Map(track.notes.map((note) => [
    `${note.takeId ?? note.id}-${note.startBeat}-${note.durationBeats}`,
    note,
  ])).values()]

  return (
    <div className="composer-automation" aria-label={`${track.name} gesture automation`}>
      {(['expression', 'brightness'] as const).map((parameter) => (
        <div className={`automation-lane ${parameter}`} key={parameter}>
          <span><small>{parameter}</small><strong>{parameter === 'expression' ? 'Height' : 'Rotation'}</strong></span>
          <div>
            {segments.map((note) => (
              <i
                style={{
                  left: `${note.startBeat / beats * 100}%`,
                  width: `${note.durationBeats / beats * 100}%`,
                  height: `${Math.max(8, note[parameter] * 100)}%`,
                  opacity: Math.max(0.28, note[parameter]),
                }}
                title={`${parameter}: ${Math.round(note[parameter] * 100)}`}
                key={`${parameter}-${note.id}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
