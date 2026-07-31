import { useCallback, useEffect, useRef, useState } from 'react'
import { loadGestureLoop } from '../looper/loopStorage'
import type { SoundPreset } from '../synth/soundPresets'
import { ComposerAudioEngine } from './ComposerAudioEngine'
import {
  clampNote,
  createComposition,
  createEmptyTrack,
  createId,
  importGestureLoop,
  midiToPitch,
  quantizationBeats,
  totalBeats,
} from './composition'
import { loadComposition, saveComposition } from './composerStorage'
import type { Composition, ComposerNote } from './composer.types'

const keySemitones: Readonly<Record<string, number>> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
}

interface HeldKeyboardNote {
  pitch: string
  startedAtBeat: number | null
}

function eventTargetAcceptsText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function useComposer() {
  const [composition, setComposition] = useState<Composition>(() => loadComposition() ?? createComposition())
  const [selectedTrackId, setSelectedTrackId] = useState(() => composition.tracks[0].id)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [playheadBeat, setPlayheadBeat] = useState(0)
  const [keyboardOctave, setKeyboardOctave] = useState(4)
  const [audioError, setAudioError] = useState<string | null>(null)
  const audioRef = useRef(new ComposerAudioEngine())
  const animationFrameRef = useRef(0)
  const playbackStartedAtRef = useRef(0)
  const compositionRef = useRef(composition)
  const selectedTrackIdRef = useRef(selectedTrackId)
  const playheadBeatRef = useRef(playheadBeat)
  const isPlayingRef = useRef(isPlaying)
  const isRecordingRef = useRef(isRecording)
  const keyboardOctaveRef = useRef(keyboardOctave)
  const heldNotesRef = useRef(new Map<string, HeldKeyboardNote>())

  compositionRef.current = composition
  selectedTrackIdRef.current = selectedTrackId
  playheadBeatRef.current = playheadBeat
  isPlayingRef.current = isPlaying
  isRecordingRef.current = isRecording
  keyboardOctaveRef.current = keyboardOctave

  useEffect(() => saveComposition(composition), [composition])

  const mutateComposition = useCallback((update: (current: Composition) => Composition) => {
    setComposition((current) => ({ ...update(current), updatedAt: new Date().toISOString() }))
  }, [])

  const stop = useCallback(() => {
    audioRef.current.stop()
    cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = 0
    isPlayingRef.current = false
    isRecordingRef.current = false
    setIsPlaying(false)
    setIsRecording(false)
    playheadBeatRef.current = 0
    setPlayheadBeat(0)
  }, [])

  const animatePlayhead = useCallback(() => {
    const tick = () => {
      if (!isPlayingRef.current) return
      const current = compositionRef.current
      const beat = ((performance.now() - playbackStartedAtRef.current) / 60_000 * current.bpm) % totalBeats(current)
      playheadBeatRef.current = beat
      setPlayheadBeat(beat)
      animationFrameRef.current = requestAnimationFrame(tick)
    }
    cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = requestAnimationFrame(tick)
  }, [])

  const play = useCallback(async (recording = false) => {
    stop()
    try {
      const current = compositionRef.current
      await audioRef.current.prepare(current)
      playbackStartedAtRef.current = performance.now()
      isPlayingRef.current = true
      isRecordingRef.current = recording
      setIsPlaying(true)
      setIsRecording(recording)
      setAudioError(null)
      audioRef.current.play(current)
      animatePlayhead()
    } catch {
      setAudioError('Audio could not start. Check this site’s sound permission and try again.')
    }
  }, [animatePlayhead, stop])

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) stop()
    else void play(false)
  }, [play, stop])

  const toggleRecording = useCallback(() => {
    if (isRecordingRef.current) stop()
    else void play(true)
  }, [play, stop])

  const addNote = useCallback((pitch: string, startBeat: number, durationBeats?: number, source: ComposerNote['source'] = 'drawn') => {
    const trackId = selectedTrackIdRef.current
    let createdId = ''
    mutateComposition((current) => {
      const note = clampNote({
        id: createId('note'),
        pitch,
        startBeat,
        durationBeats: durationBeats ?? quantizationBeats(current.quantization) * 2,
        velocity: 0.78,
        expression: 0.72,
        brightness: 0.56,
        source,
      }, current)
      createdId = note.id
      return {
        ...current,
        tracks: current.tracks.map((track) => track.id === trackId
          ? { ...track, notes: [...track.notes, note].sort((a, b) => a.startBeat - b.startBeat) }
          : track),
      }
    })
    setSelectedNoteId(createdId)
  }, [mutateComposition])

  const updateNote = useCallback((noteId: string, patch: Partial<Pick<ComposerNote, 'pitch' | 'startBeat' | 'durationBeats' | 'velocity'>>) => {
    mutateComposition((current) => ({
      ...current,
      tracks: current.tracks.map((track) => ({
        ...track,
        notes: track.notes.map((note) => note.id === noteId ? clampNote({ ...note, ...patch }, current) : note),
      })),
    }))
  }, [mutateComposition])

  const deleteSelectedNote = useCallback(() => {
    if (!selectedNoteId) return
    mutateComposition((current) => ({
      ...current,
      tracks: current.tracks.map((track) => ({ ...track, notes: track.notes.filter((note) => note.id !== selectedNoteId) })),
    }))
    setSelectedNoteId(null)
  }, [mutateComposition, selectedNoteId])

  const duplicateSelectedNote = useCallback(() => {
    if (!selectedNoteId) return
    const current = compositionRef.current
    const sourceTrack = current.tracks.find((track) => track.notes.some((note) => note.id === selectedNoteId))
    const sourceNote = sourceTrack?.notes.find((note) => note.id === selectedNoteId)
    if (!sourceTrack || !sourceNote) return
    const duplicated = clampNote({
      ...sourceNote,
      id: createId('note'),
      startBeat: sourceNote.startBeat + sourceNote.durationBeats,
    }, current)
    mutateComposition((value) => ({
      ...value,
      tracks: value.tracks.map((track) => track.id === sourceTrack.id
        ? { ...track, notes: [...track.notes, duplicated].sort((a, b) => a.startBeat - b.startBeat) }
        : track),
    }))
    setSelectedNoteId(duplicated.id)
  }, [mutateComposition, selectedNoteId])

  const setBpm = useCallback((bpm: number) => mutateComposition((current) => ({ ...current, bpm: Math.max(40, Math.min(220, Math.round(bpm))) })), [mutateComposition])
  const setBars = useCallback((bars: number) => mutateComposition((current) => ({
    ...current,
    bars,
    tracks: current.tracks.map((track) => ({
      ...track,
      notes: track.notes.filter((note) => note.startBeat < bars * 4).map((note) => clampNote(note, { ...current, bars })),
    })),
  })), [mutateComposition])
  const setQuantization = useCallback((quantization: Composition['quantization']) => mutateComposition((current) => ({ ...current, quantization })), [mutateComposition])
  const setName = useCallback((name: string) => mutateComposition((current) => ({ ...current, name })), [mutateComposition])
  const setTrackPreset = useCallback((trackId: string, preset: SoundPreset) => mutateComposition((current) => ({
    ...current,
    tracks: current.tracks.map((track) => track.id === trackId ? { ...track, preset } : track),
  })), [mutateComposition])
  const toggleTrackMute = useCallback((trackId: string) => mutateComposition((current) => ({
    ...current,
    tracks: current.tracks.map((track) => track.id === trackId ? { ...track, muted: !track.muted } : track),
  })), [mutateComposition])
  const toggleTrackSolo = useCallback((trackId: string) => mutateComposition((current) => ({
    ...current,
    tracks: current.tracks.map((track) => track.id === trackId ? { ...track, solo: !track.solo } : track),
  })), [mutateComposition])
  const addTrack = useCallback(() => mutateComposition((current) => ({ ...current, tracks: [...current.tracks, createEmptyTrack(current.tracks.length)] })), [mutateComposition])

  const importStudioLoop = useCallback((): boolean => {
    const loop = loadGestureLoop()
    if (!loop) return false
    const next = importGestureLoop(compositionRef.current, loop)
    setComposition(next)
    setSelectedTrackId(next.tracks[0].id)
    setSelectedNoteId(null)
    return true
  }, [])

  useEffect(() => {
    const heldNotes = heldNotesRef.current
    const finishHeldNote = (code: string) => {
      const held = heldNotes.get(code)
      if (!held) return
      heldNotes.delete(code)
      audioRef.current.previewEnd(held.pitch)
      if (held.startedAtBeat != null) {
        const currentBeat = playheadBeatRef.current
        const loopBeats = totalBeats(compositionRef.current)
        const duration = currentBeat >= held.startedAtBeat
          ? currentBeat - held.startedAtBeat
          : loopBeats - held.startedAtBeat + currentBeat
        addNote(held.pitch, held.startedAtBeat, Math.max(duration, quantizationBeats(compositionRef.current.quantization)), 'keyboard')
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (eventTargetAcceptsText(event.target)) return
      if (event.code === 'Space') {
        event.preventDefault()
        if (!event.repeat) togglePlay()
        return
      }
      if (event.code === 'KeyR') {
        event.preventDefault()
        if (!event.repeat) toggleRecording()
        return
      }
      if (event.code === 'KeyZ' || event.code === 'KeyX') {
        event.preventDefault()
        if (!event.repeat) setKeyboardOctave((value) => Math.max(2, Math.min(6, value + (event.code === 'KeyX' ? 1 : -1))))
        return
      }
      const semitone = keySemitones[event.code]
      if (semitone == null || event.repeat || heldNotes.has(event.code)) return
      event.preventDefault()
      const pitch = midiToPitch((keyboardOctaveRef.current + 1) * 12 + semitone)
      const track = compositionRef.current.tracks.find((candidate) => candidate.id === selectedTrackIdRef.current)
      if (!track) return
      heldNotes.set(event.code, {
        pitch,
        startedAtBeat: isRecordingRef.current ? playheadBeatRef.current : null,
      })
      void audioRef.current.previewStart(pitch, track.preset)
    }

    const onKeyUp = (event: KeyboardEvent) => finishHeldNote(event.code)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      heldNotes.forEach((_, code) => finishHeldNote(code))
    }
  }, [addNote, togglePlay, toggleRecording])

  useEffect(() => () => {
    cancelAnimationFrame(animationFrameRef.current)
    audioRef.current.dispose()
  }, [])

  return {
    composition,
    selectedTrackId,
    selectedNoteId,
    isPlaying,
    isRecording,
    playheadBeat,
    keyboardOctave,
    audioError,
    hasStudioLoop: Boolean(loadGestureLoop()),
    setSelectedTrackId,
    setSelectedNoteId,
    setBpm,
    setBars,
    setQuantization,
    setName,
    setTrackPreset,
    toggleTrackMute,
    toggleTrackSolo,
    addTrack,
    addNote,
    updateNote,
    deleteSelectedNote,
    duplicateSelectedNote,
    importStudioLoop,
    togglePlay,
    toggleRecording,
    stop,
  }
}
