import type { FingerPattern, Handedness } from './gesture.types'

const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const

interface FingerDiagramProps {
  hand: Handedness
  pattern: FingerPattern
  accent?: 'lime' | 'violet'
  size?: 'lesson' | 'studio'
}

export function FingerDiagram({ hand, pattern, accent = 'lime', size = 'lesson' }: FingerDiagramProps) {
  const extendedFingers = fingerNames.filter((_, index) => pattern[index])
  const description = extendedFingers.length
    ? `${extendedFingers.join(', ')} extended`
    : 'all fingers closed'

  return (
    <div
      className={`finger-diagram ${hand === 'Left' ? 'left-hand-diagram' : 'right-hand-diagram'} ${accent}-hand-diagram ${size}-hand-diagram`}
      aria-label={`${hand} hand: ${description}`}
      role="img"
    >
      {pattern.map((extended, fingerIndex) => (
        <i key={fingerNames[fingerIndex]} className={extended ? 'extended' : ''} />
      ))}
      <span />
    </div>
  )
}
