import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { FingerPattern } from '../gestures/gesture.types'

const connections = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
] as const

const fingerLandmarks = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
]

export function clearOverlay(canvas: HTMLCanvasElement): void {
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
}

export function drawHandOverlay(
  canvas: HTMLCanvasElement,
  landmarks: NormalizedLandmark[],
  fingers: FingerPattern,
  active: boolean,
): void {
  const context = canvas.getContext('2d')
  if (!context) return

  const point = (index: number) => ({
    x: landmarks[index].x * canvas.width,
    y: landmarks[index].y * canvas.height,
  })

  context.save()
  context.lineWidth = Math.max(2, canvas.width / 430)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = active ? 'rgba(204, 255, 91, .72)' : 'rgba(255, 255, 255, .42)'
  context.shadowBlur = active ? 18 : 6
  context.shadowColor = active ? '#caff55' : 'rgba(255,255,255,.3)'
  for (const [from, to] of connections) {
    const start = point(from)
    const end = point(to)
    context.beginPath()
    context.moveTo(start.x, start.y)
    context.lineTo(end.x, end.y)
    context.stroke()
  }

  const extendedLandmarks = new Set<number>()
  fingers.forEach((extended, index) => {
    if (extended) fingerLandmarks[index].forEach((landmark) => extendedLandmarks.add(landmark))
  })

  landmarks.forEach((_, index) => {
    const current = point(index)
    const highlighted = extendedLandmarks.has(index)
    context.beginPath()
    context.arc(current.x, current.y, highlighted ? 5.5 : 3.2, 0, Math.PI * 2)
    context.fillStyle = highlighted ? '#caff55' : 'rgba(255,255,255,.92)'
    context.fill()
  })
  context.restore()
}
