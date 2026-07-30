import { describe, expect, it } from 'vitest'
import { getTutorialChord, getTutorialSong, tutorialSongs } from './songLibrary'

describe('tutorial song library', () => {
  it('uses unique song and cue ids', () => {
    expect(new Set(tutorialSongs.map((song) => song.id)).size).toBe(tutorialSongs.length)
    for (const song of tutorialSongs) {
      expect(new Set(song.cues.map((cue) => cue.id)).size).toBe(song.cues.length)
    }
  })

  it('maps every cue to a chord taught by that lesson', () => {
    for (const song of tutorialSongs) {
      for (const cue of song.cues) {
        expect(getTutorialChord(song, cue.chordId)).toBeDefined()
      }
    }
  })

  it('finds lessons by route id', () => {
    expect(getTutorialSong('amazing-grace')?.preset).toBe('choir')
    expect(getTutorialSong('missing-song')).toBeNull()
  })
})
