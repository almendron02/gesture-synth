export interface ChordTransition {
  entering: string[]
  leaving: string[]
  sustained: string[]
}

export function planChordTransition(previousNotes: readonly string[], nextNotes: readonly string[]): ChordTransition {
  const previous = new Set(previousNotes)
  const next = new Set(nextNotes)

  return {
    entering: nextNotes.filter((note) => !previous.has(note)),
    leaving: previousNotes.filter((note) => !next.has(note)),
    sustained: nextNotes.filter((note) => previous.has(note)),
  }
}
