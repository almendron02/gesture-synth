import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Handedness } from '../gestures/gesture.types'

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0))
}

export class LandmarkSmoother {
  private previous: Partial<Record<Handedness, NormalizedLandmark[]>> = {}

  smooth(handedness: Handedness, current: NormalizedLandmark[]): NormalizedLandmark[] {
    const previous = this.previous[handedness]
    if (!previous || previous.length !== current.length) {
      const initial = current.map((landmark) => ({ ...landmark }))
      this.previous[handedness] = initial
      return initial
    }

    const wristMovement = distance(previous[0], current[0])
    const alpha = Math.max(0.3, Math.min(0.78, 0.3 + wristMovement * 9))
    const smoothed = current.map((landmark, index) => ({
      ...landmark,
      x: previous[index].x + alpha * (landmark.x - previous[index].x),
      y: previous[index].y + alpha * (landmark.y - previous[index].y),
      z: (previous[index].z ?? 0) + alpha * ((landmark.z ?? 0) - (previous[index].z ?? 0)),
    }))
    this.previous[handedness] = smoothed
    return smoothed
  }

  reset(handedness?: Handedness): void {
    if (handedness) delete this.previous[handedness]
    else this.previous = {}
  }
}
