import type { HandAnalysis, PerformanceGesture, RightHandModifier, RightHandVoicing } from './gesture.types'

const voicingByFingers: Record<string, { voicing: RightHandVoicing; label: string; fingerCount: 1 | 2 | 3 | 4 }> = {
  '1000': { voicing: 'root', label: 'Root position', fingerCount: 1 },
  '1100': { voicing: 'first-inversion', label: 'First inversion', fingerCount: 2 },
  '1110': { voicing: 'seventh', label: 'Major / minor 7th', fingerCount: 3 },
  '1111': { voicing: 'color-seventh', label: 'Dominant / diminished 7th', fingerCount: 4 },
}

function detectOctaveShift(analysis: HandAnalysis): -1 | 0 {
  return analysis.fingers[0] ? -1 : 0
}

export function classifyRightHand(analysis: HandAnalysis | null): RightHandModifier | null {
  if (!analysis || analysis.handedness !== 'Right') return null
  // The thumb is an octave control, so only the four melodic fingers select voicing.
  const melodicPattern = analysis.pattern.slice(1)
  const definition = voicingByFingers[melodicPattern]
  if (!definition) return null
  const octaveShift = detectOctaveShift(analysis)
  return {
    ...definition,
    octaveShift,
    pattern: analysis.pattern,
    key: `${definition.voicing}-octave-${octaveShift}`,
  }
}

export function combinePerformanceGesture(
  left: HandAnalysis | null,
  right: HandAnalysis | null,
): PerformanceGesture | null {
  if (!left?.candidate) return null
  const rightModifier = classifyRightHand(right)
  if (!rightModifier) return null
  return {
    left: left.candidate,
    right: rightModifier,
    key: `${left.candidate.key}-${rightModifier.key}`,
  }
}

export function rightHandExpression(analysis: HandAnalysis | null): number {
  const palm = analysis?.landmarks?.[9]
  if (!palm) return 0.65
  return Math.max(0.2, Math.min(1, (0.86 - palm.y) / 0.62))
}

export function rightHandBrightness(analysis: HandAnalysis | null): number {
  if (!analysis) return 0.55
  return Math.max(0, Math.min(1, (analysis.rollAngle + 45) / 90))
}
