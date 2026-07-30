import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error'

export function useCamera(videoRef: RefObject<HTMLVideoElement | null>) {
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [videoRef])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable')
      setError('This browser does not support camera access.')
      return false
    }

    setStatus('requesting')
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 800 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStatus('ready')
      return true
    } catch (cameraError) {
      const name = cameraError instanceof DOMException ? cameraError.name : ''
      const denied = name === 'NotAllowedError' || name === 'SecurityError'
      setStatus(denied ? 'denied' : 'error')
      setError(denied
        ? 'Camera permission was blocked. Allow access in your browser settings and try again.'
        : 'The camera could not be started. Another app may be using it.')
      return false
    }
  }, [videoRef])

  useEffect(() => stop, [stop])

  return { status, error, start, stop }
}
