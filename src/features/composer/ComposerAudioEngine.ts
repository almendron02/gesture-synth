import type { Chord } from '../music/chords'
import { SynthEngine } from '../synth/SynthEngine'
import type { Composition, ComposerTrack } from './composer.types'
import { totalBeats } from './composition'

function noteStateChord(notes: readonly string[]): Chord {
  return {
    name: notes.join(' · '),
    notes: [...notes],
    degree: 'I',
    quality: 'major',
    voicing: 'root',
    voicingLabel: 'Composer notes',
    octaveShift: 0,
  }
}

function activeNotesAt(track: ComposerTrack, beat: number): string[] {
  return [...new Set(track.notes
    .filter((note) => note.startBeat <= beat + 0.0001 && note.startBeat + note.durationBeats > beat + 0.0001)
    .map((note) => note.pitch))]
}

export class ComposerAudioEngine {
  private trackEngines = new Map<string, SynthEngine>()
  private previewEngine = new SynthEngine()
  private metronomeEngine = new SynthEngine()
  private previewNotes = new Set<string>()
  private timerIds: number[] = []
  private playing = false

  async prepare(composition: Composition): Promise<void> {
    await Promise.all(composition.tracks.map(async (track) => {
      const engine = this.getTrackEngine(track)
      engine.setPreset(track.preset)
      engine.setVolume(0.3)
      await engine.start()
    }))
    this.previewEngine.setVolume(0.32)
    await this.previewEngine.start()
    this.metronomeEngine.setPreset('original')
    this.metronomeEngine.setVolume(0.24)
    await this.metronomeEngine.start()
  }

  play(composition: Composition): void {
    this.stop()
    this.playing = true
    const cycleMs = totalBeats(composition) * 60_000 / composition.bpm
    const audibleTracks = composition.tracks.filter((track) => !track.muted)
    const soloTracks = audibleTracks.filter((track) => track.solo)
    const tracks = soloTracks.length ? soloTracks : audibleTracks

    const scheduleCycle = () => {
      if (!this.playing) return
      this.timerIds = []
      tracks.forEach((track) => {
        const engine = this.getTrackEngine(track)
        const boundaries = [...new Set(track.notes.flatMap((note) => [note.startBeat, note.startBeat + note.durationBeats]))]
          .filter((beat) => beat >= 0 && beat <= totalBeats(composition))
          .sort((a, b) => a - b)
        boundaries.forEach((beat) => {
          const timerId = window.setTimeout(() => {
            if (!this.playing) return
            const notes = activeNotesAt(track, beat)
            if (notes.length) {
              const sounding = track.notes.find((note) => notes.includes(note.pitch))
              engine.setVolume(Math.max(0.08, (sounding?.velocity ?? 0.75) * 0.38))
              engine.setBrightness(sounding?.brightness ?? 0.55)
              engine.play(noteStateChord(notes))
            } else {
              engine.release()
            }
          }, beat * 60_000 / composition.bpm)
          this.timerIds.push(timerId)
        })
      })
      this.timerIds.push(window.setTimeout(scheduleCycle, cycleMs))
    }

    scheduleCycle()
  }

  async previewStart(pitch: string, preset: ComposerTrack['preset']): Promise<void> {
    this.previewEngine.setPreset(preset)
    await this.previewEngine.start()
    this.previewNotes.add(pitch)
    this.previewEngine.play(noteStateChord([...this.previewNotes]))
  }

  previewEnd(pitch: string): void {
    this.previewNotes.delete(pitch)
    if (this.previewNotes.size) this.previewEngine.play(noteStateChord([...this.previewNotes]))
    else this.previewEngine.release()
  }

  metronomeClick(accent = false): void {
    this.metronomeEngine.setVolume(accent ? 0.3 : 0.2)
    this.metronomeEngine.play(noteStateChord([accent ? 'C6' : 'G5']))
    this.timerIds.push(window.setTimeout(() => this.metronomeEngine.release(), 75))
  }

  stop(): void {
    this.playing = false
    this.timerIds.forEach((timerId) => window.clearTimeout(timerId))
    this.timerIds = []
    this.trackEngines.forEach((engine) => engine.release())
    this.metronomeEngine.release()
  }

  dispose(): void {
    this.stop()
    this.trackEngines.forEach((engine) => engine.dispose())
    this.trackEngines.clear()
    this.previewEngine.dispose()
    this.metronomeEngine.dispose()
    this.previewNotes.clear()
  }

  private getTrackEngine(track: ComposerTrack): SynthEngine {
    const existing = this.trackEngines.get(track.id)
    if (existing) return existing
    const engine = new SynthEngine()
    this.trackEngines.set(track.id, engine)
    return engine
  }
}
