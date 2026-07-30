import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

export async function createHandLandmarker(): Promise<HandLandmarker> {
  const base = import.meta.env.BASE_URL
  const files = await FilesetResolver.forVisionTasks(`${base}wasm`)
  const options = {
    baseOptions: {
      modelAssetPath: `${base}models/hand_landmarker.task`,
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.58,
  } as const

  try {
    return await HandLandmarker.createFromOptions(files, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: 'GPU' },
    })
  } catch {
    return HandLandmarker.createFromOptions(files, options)
  }
}
