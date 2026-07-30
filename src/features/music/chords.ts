import type { ChordQuality, Degree, RightHandVoicing } from '../gestures/gesture.types'

const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const roots: Record<Degree, number> = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 }

export interface Chord {
  name: string
  notes: string[]
  degree: Degree
  quality: ChordQuality
  voicing: RightHandVoicing
  voicingLabel: string
  octaveShift: number
}

const voicingLabels: Record<RightHandVoicing, string> = {
  root: 'Root position',
  'first-inversion': 'First inversion',
  seventh: 'Seventh chord',
  'color-seventh': 'Color seventh',
}

function noteAt(absoluteSemitone: number): string {
  const note = chromatic[((absoluteSemitone % chromatic.length) + chromatic.length) % chromatic.length]
  const octave = 3 + Math.floor(absoluteSemitone / chromatic.length)
  return `${note}${octave}`
}

export function buildChord(
  degree: Degree,
  quality: ChordQuality,
  voicing: RightHandVoicing = 'root',
  octaveShift: -1 | 0 | 1 = 0,
): Chord {
  const rootIndex = roots[degree]
  const third = quality === 'major' ? 4 : 3
  let intervals: number[]
  if (voicing === 'first-inversion') {
    intervals = [third, 7, 12]
  } else if (voicing === 'seventh') {
    intervals = quality === 'major' ? [0, 4, 7, 11] : [0, 3, 7, 10]
  } else if (voicing === 'color-seventh') {
    intervals = quality === 'major' ? [0, 4, 7, 10] : [0, 3, 6, 9]
  } else {
    intervals = [0, third, 7]
  }
  const octaveOffset = octaveShift * 12
  const notes = intervals.map((interval) => noteAt(rootIndex + interval + octaveOffset))

  const name = voicing === 'seventh'
    ? `${chromatic[rootIndex]} ${quality} 7`
    : voicing === 'color-seventh'
      ? `${chromatic[rootIndex]} ${quality === 'major' ? 'dominant' : 'diminished'} 7`
      : `${chromatic[rootIndex]} ${quality}`
  return {
    name,
    notes,
    degree,
    quality,
    voicing,
    voicingLabel: voicingLabels[voicing],
    octaveShift,
  }
}
