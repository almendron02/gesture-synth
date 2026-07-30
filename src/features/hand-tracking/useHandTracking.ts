import { useEffect, useRef, useState, type RefObject } from 'react'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import { analyzeHand } from '../gestures/classifyHand'
import { classifyRightHand } from '../gestures/classifyRightHand'
import { EMPTY_HANDS_FRAME, type FingerPattern, type HandsFrameAnalysis, type Handedness } from '../gestures/gesture.types'
import { createHandLandmarker } from './createHandLandmarker'
import { clearOverlay, drawHandOverlay } from './drawHandOverlay'
import { LandmarkSmoother } from './LandmarkSmoother'

export type TrackerStatus = 'idle' | 'loading' | 'ready' | 'error'
const MIN_DETECTION_INTERVAL_MS = 24

interface UseHandTrackingOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  enabled: boolean
  tiltThreshold: number
  tiltOffset: number
  onAnalysis: (analysis: HandsFrameAnalysis, timestamp: number) => void
}

function normalizeHandedness(value: string | undefined): Handedness {
  return value?.toLowerCase() === 'left' ? 'Left' : 'Right'
}

export function useHandTracking({ videoRef, canvasRef, enabled, tiltThreshold, tiltOffset, onAnalysis }: UseHandTrackingOptions) {
  const callbackRef = useRef(onAnalysis)
  const tiltThresholdRef = useRef(tiltThreshold)
  const tiltOffsetRef = useRef(tiltOffset)
  const [status, setStatus] = useState<TrackerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  callbackRef.current = onAnalysis
  tiltThresholdRef.current = tiltThreshold
  tiltOffsetRef.current = tiltOffset

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      return
    }

    let cancelled = false
    let animationFrame = 0
    let landmarker: HandLandmarker | null = null
    let previousVideoTime = -1
    let previousDetectionAt = 0
    const landmarkSmoother = new LandmarkSmoother()
    const closedFingers: FingerPattern = [false, false, false, false, false]
    const previousFingers: Record<Handedness, FingerPattern> = { Left: closedFingers, Right: closedFingers }
    const lastSeenAt = { Left: 0, Right: 0 }

    async function initialize() {
      setStatus('loading')
      setError(null)
      try {
        landmarker = await createHandLandmarker()
        if (cancelled) {
          landmarker.close()
          return
        }
        setStatus('ready')
        animationFrame = requestAnimationFrame(processFrame)
      } catch (trackingError) {
        if (cancelled) return
        setStatus('error')
        setError(trackingError instanceof Error ? trackingError.message : 'Hand tracking could not start.')
      }
    }

    function processFrame(timestamp: number) {
      if (cancelled) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || !landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        animationFrame = requestAnimationFrame(processFrame)
        return
      }

      if (video.currentTime !== previousVideoTime && timestamp - previousDetectionAt >= MIN_DETECTION_INTERVAL_MS) {
        previousVideoTime = video.currentTime
        previousDetectionAt = timestamp
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }
        try {
          const result = landmarker.detectForVideo(video, timestamp)
          if (!result.landmarks.length) {
            clearOverlay(canvas)
            if (timestamp - lastSeenAt.Left > 250) landmarkSmoother.reset('Left')
            if (timestamp - lastSeenAt.Right > 250) landmarkSmoother.reset('Right')
            callbackRef.current(EMPTY_HANDS_FRAME, timestamp)
          } else {
            const analyses = result.landmarks.map((landmarks, index) => {
              const category = result.handedness[index]?.[0]
              const handedness = normalizeHandedness(category?.categoryName)
              if (timestamp - lastSeenAt[handedness] > 250) {
                landmarkSmoother.reset(handedness)
                previousFingers[handedness] = closedFingers
              }
              lastSeenAt[handedness] = timestamp
              const smoothedLandmarks = landmarkSmoother.smooth(handedness, landmarks)
              const analysis = analyzeHand(
                smoothedLandmarks,
                handedness,
                category?.score ?? 0,
                tiltThresholdRef.current,
                tiltOffsetRef.current,
                previousFingers[handedness],
              )
              previousFingers[handedness] = analysis.fingers
              return analysis
            })
            const left = analyses.find((analysis) => analysis.handedness === 'Left') ?? null
            const right = analyses.find((analysis) => analysis.handedness === 'Right') ?? null
            clearOverlay(canvas)
            analyses.forEach((analysis) => {
              const active = Boolean(analysis.candidate || classifyRightHand(analysis))
              drawHandOverlay(canvas, analysis.landmarks!, analysis.fingers, active)
            })
            callbackRef.current({ left, right, handCount: analyses.length }, timestamp)
          }
        } catch (frameError) {
          setError(frameError instanceof Error ? frameError.message : 'A tracking frame failed.')
        }
      }
      animationFrame = requestAnimationFrame(processFrame)
    }

    void initialize()
    const canvas = canvasRef.current
    return () => {
      cancelled = true
      cancelAnimationFrame(animationFrame)
      landmarker?.close()
      if (canvas) clearOverlay(canvas)
    }
  }, [canvasRef, enabled, videoRef])

  return { status, error }
}
