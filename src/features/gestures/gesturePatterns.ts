import type { Degree, FingerPattern, GestureDefinition } from './gesture.types'

export const gestureDefinitions: readonly GestureDefinition[] = [
  { degree: 'I', name: 'The One', pattern: [false, true, false, false, false], hint: 'Index finger only' },
  { degree: 'II', name: 'The Pair', pattern: [false, true, true, false, false], hint: 'Index and middle' },
  { degree: 'III', name: 'The Trio', pattern: [false, true, true, true, false], hint: 'Index, middle, and ring' },
  { degree: 'IV', name: 'The Four', pattern: [false, true, true, true, true], hint: 'Four fingers, thumb closed' },
  { degree: 'V', name: 'Open Palm', pattern: [true, true, true, true, true], hint: 'All five fingers open' },
  { degree: 'VI', name: 'Rock Sign', pattern: [false, true, false, false, true], hint: 'Index and pinky' },
  { degree: 'VII', name: 'Rock + Thumb', pattern: [true, true, false, false, true], hint: 'Thumb, index, and pinky' },
] as const

const degreeByPattern = new Map(gestureDefinitions.map((definition) => [
  patternToString(definition.pattern),
  definition.degree,
]))

export function patternToString(pattern: FingerPattern): string {
  return pattern.map((extended) => (extended ? '1' : '0')).join('')
}

export function degreeForPattern(pattern: FingerPattern): Degree | null {
  return degreeByPattern.get(patternToString(pattern)) ?? null
}
