import type { ChordQuality, Degree, RightHandVoicing } from '../gestures/gesture.types'
import type { SoundPreset } from '../synth/soundPresets'

export type SongAccent = 'lime' | 'violet' | 'orange'
export type TutorialCopyMode = 'lyrics' | 'counted-cues'

export interface TutorialChord {
  id: string
  name: string
  degree: Degree
  quality: ChordQuality
  voicing?: RightHandVoicing
}

export interface TutorialCue {
  id: string
  section: string
  timing: string
  chordId: string
  text: string
}

export interface TutorialSong {
  id: string
  title: string
  artist: string
  level: string
  preset: SoundPreset
  presetLabel: string
  accent: SongAccent
  artwork?: string
  copyMode: TutorialCopyMode
  arrangementLabel: string
  rightsNote: string
  chords: readonly TutorialChord[]
  cues: readonly TutorialCue[]
}

export const tutorialSongs: readonly TutorialSong[] = [
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    artist: 'Traditional hymn · John Newton',
    level: 'Beginner',
    preset: 'choir',
    presetLabel: 'Choir',
    accent: 'violet',
    copyMode: 'lyrics',
    arrangementLabel: 'Public-domain lyric lesson · Key of C',
    rightsNote: 'Words and music are public domain. This first lesson uses verse one.',
    chords: [
      { id: 'c-major', name: 'C major', degree: 'I', quality: 'major' },
      { id: 'f-major', name: 'F major', degree: 'IV', quality: 'major' },
      { id: 'g-major', name: 'G major', degree: 'V', quality: 'major' },
    ],
    cues: [
      { id: 'ag-01', section: 'Verse 1 · line 1', timing: 'Start', chordId: 'c-major', text: 'Amazing grace! How' },
      { id: 'ag-02', section: 'Verse 1 · line 1', timing: 'Change', chordId: 'f-major', text: 'sweet the' },
      { id: 'ag-03', section: 'Verse 1 · line 1', timing: 'Resolve', chordId: 'c-major', text: 'sound' },
      { id: 'ag-04', section: 'Verse 1 · line 2', timing: 'Change', chordId: 'g-major', text: 'That saved a wretch like' },
      { id: 'ag-05', section: 'Verse 1 · line 2', timing: 'Resolve', chordId: 'c-major', text: 'me!' },
      { id: 'ag-06', section: 'Verse 1 · line 3', timing: 'Hold', chordId: 'c-major', text: 'I once was lost, but' },
      { id: 'ag-07', section: 'Verse 1 · line 3', timing: 'Change', chordId: 'f-major', text: 'now am' },
      { id: 'ag-08', section: 'Verse 1 · line 3', timing: 'Resolve', chordId: 'c-major', text: 'found;' },
      { id: 'ag-09', section: 'Verse 1 · line 4', timing: 'Change', chordId: 'g-major', text: 'Was blind, but now I' },
      { id: 'ag-10', section: 'Verse 1 · line 4', timing: 'Finish', chordId: 'c-major', text: 'see.' },
    ],
  },
  {
    id: 'midnight-city',
    title: 'Midnight City',
    artist: 'M83',
    level: 'Beginner–Intermediate',
    preset: 'dream-pad',
    presetLabel: 'Dream Pad',
    accent: 'orange',
    artwork: '/song-art/midnight-city.png',
    copyMode: 'counted-cues',
    arrangementLabel: 'Four-chord instrumental study · Original key center',
    rightsNote: 'This lesson uses beat and section cues. Licensed lyrics are not included.',
    chords: [
      { id: 'g-major', name: 'G major', degree: 'V', quality: 'major' },
      { id: 'b-minor', name: 'B minor', degree: 'VII', quality: 'minor' },
      { id: 'a-major', name: 'A major', degree: 'VI', quality: 'major' },
      { id: 'e-minor', name: 'E minor', degree: 'III', quality: 'minor' },
    ],
    cues: [
      { id: 'mc-01', section: 'Intro · loop 1', timing: 'Bar 1 · 1 2 3 4', chordId: 'g-major', text: 'Pulse begins — hold for four beats' },
      { id: 'mc-02', section: 'Intro · loop 1', timing: 'Bar 2 · 1 2 3 4', chordId: 'b-minor', text: 'Second chord — keep the same hand height' },
      { id: 'mc-03', section: 'Intro · loop 1', timing: 'Bar 3 · 1 2 3 4', chordId: 'a-major', text: 'Lift — rotate inward for major' },
      { id: 'mc-04', section: 'Intro · loop 1', timing: 'Bar 4 · 1 2 3 4', chordId: 'e-minor', text: 'Release the loop — rotate outward' },
      { id: 'mc-05', section: 'Verse · loop 2', timing: 'Bar 1 · 1 2 3 4', chordId: 'g-major', text: 'Repeat under the verse entry' },
      { id: 'mc-06', section: 'Verse · loop 2', timing: 'Bar 2 · 1 2 3 4', chordId: 'b-minor', text: 'Change cleanly on beat one' },
      { id: 'mc-07', section: 'Verse · loop 2', timing: 'Bar 3 · 1 2 3 4', chordId: 'a-major', text: 'Keep the pad wide and even' },
      { id: 'mc-08', section: 'Verse · loop 2', timing: 'Bar 4 · 1 2 3 4', chordId: 'e-minor', text: 'Resolve, then restart the loop' },
    ],
  },
  {
    id: 'enjoy-the-silence',
    title: 'Enjoy the Silence',
    artist: 'Depeche Mode',
    level: 'Intermediate',
    preset: 'original',
    presetLabel: 'Original',
    accent: 'lime',
    artwork: '/song-art/enjoy-the-silence.png',
    copyMode: 'counted-cues',
    arrangementLabel: 'Transposed four-chord gesture study',
    rightsNote: 'This is a simplified practice arrangement with section cues; licensed lyrics are not included.',
    chords: [
      { id: 'a-minor', name: 'A minor', degree: 'VI', quality: 'minor' },
      { id: 'c-major', name: 'C major', degree: 'I', quality: 'major' },
      { id: 'f-major', name: 'F major', degree: 'IV', quality: 'major' },
      { id: 'd-minor', name: 'D minor', degree: 'II', quality: 'minor' },
    ],
    cues: [
      { id: 'es-01', section: 'Intro', timing: 'Bar 1 · beat 1', chordId: 'a-minor', text: 'Dark pulse — hold the rock sign outward' },
      { id: 'es-02', section: 'Intro', timing: 'Bar 2 · beat 1', chordId: 'c-major', text: 'Open the harmony — index inward' },
      { id: 'es-03', section: 'Intro', timing: 'Bar 3 · beat 1', chordId: 'f-major', text: 'Four fingers — keep the change quiet' },
      { id: 'es-04', section: 'Intro', timing: 'Bar 4 · beat 1', chordId: 'd-minor', text: 'Two fingers outward — complete the loop' },
      { id: 'es-05', section: 'Verse', timing: 'Phrase 1 · beat 1', chordId: 'a-minor', text: 'Return as the vocal phrase enters' },
      { id: 'es-06', section: 'Verse', timing: 'Phrase 2 · beat 1', chordId: 'c-major', text: 'Change at the next lyric phrase' },
      { id: 'es-07', section: 'Chorus', timing: 'Lift · beat 1', chordId: 'f-major', text: 'Hold through the chorus lift' },
      { id: 'es-08', section: 'Chorus', timing: 'Turnaround · beat 1', chordId: 'd-minor', text: 'Resolve before the progression repeats' },
    ],
  },
  {
    id: 'everything-in-its-right-place',
    title: 'Everything in Its Right Place',
    artist: 'Radiohead',
    level: 'Advanced',
    preset: 'choir',
    presetLabel: 'Choir',
    accent: 'violet',
    artwork: '/song-art/everything-in-its-right-place.png',
    copyMode: 'counted-cues',
    arrangementLabel: 'Extended-chord gesture study · Right hand required',
    rightsNote: 'This advanced lesson is a playable gesture study with section cues; licensed lyrics are not included.',
    chords: [
      { id: 'c-major', name: 'C major 7', degree: 'I', quality: 'major', voicing: 'seventh' },
      { id: 'd-minor', name: 'D minor 7', degree: 'II', quality: 'minor', voicing: 'seventh' },
      { id: 'e-minor', name: 'E minor 7', degree: 'III', quality: 'minor', voicing: 'seventh' },
      { id: 'f-major', name: 'F dominant 7', degree: 'IV', quality: 'major', voicing: 'color-seventh' },
    ],
    cues: [
      { id: 'rp-01', section: 'Opening figure', timing: 'Count 1 · hold', chordId: 'c-major', text: 'Three right-hand fingers add the major seventh' },
      { id: 'rp-02', section: 'Opening figure', timing: 'Count 2 · change', chordId: 'd-minor', text: 'Two left fingers outward; keep three on the right' },
      { id: 'rp-03', section: 'Opening figure', timing: 'Count 3 · change', chordId: 'e-minor', text: 'Three left fingers outward; sustain the voicing' },
      { id: 'rp-04', section: 'Opening figure', timing: 'Count 4 · tension', chordId: 'f-major', text: 'Four left and four right fingers for dominant color' },
      { id: 'rp-05', section: 'Vocal entry', timing: 'Phrase 1', chordId: 'c-major', text: 'Return to the tonal center under the entry' },
      { id: 'rp-06', section: 'Vocal entry', timing: 'Phrase 2', chordId: 'd-minor', text: 'Move on the next repeated phrase' },
      { id: 'rp-07', section: 'Turnaround', timing: 'Count 3', chordId: 'e-minor', text: 'Keep the seventh alive through the turn' },
      { id: 'rp-08', section: 'Turnaround', timing: 'Count 4', chordId: 'f-major', text: 'Add color, then merge back to the first chord' },
    ],
  },
] as const

export function getTutorialSong(songId: string | undefined): TutorialSong | null {
  return tutorialSongs.find((song) => song.id === songId) ?? null
}

export function getTutorialChord(song: TutorialSong, chordId: string): TutorialChord {
  const chord = song.chords.find((candidate) => candidate.id === chordId)
  if (!chord) throw new Error(`Unknown tutorial chord: ${chordId}`)
  return chord
}
