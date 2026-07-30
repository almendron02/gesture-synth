import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { FingerDiagram } from '../features/gestures/FingerDiagram'
import { gestureDefinitions } from '../features/gestures/gesturePatterns'
import type { FingerPattern, RightHandVoicing } from '../features/gestures/gesture.types'
import { buildChord } from '../features/music/chords'
import { getTutorialChord, getTutorialSong } from '../features/songs/songLibrary'

const rightHandPatterns: Record<RightHandVoicing, { label: string; pattern: FingerPattern }> = {
  root: { label: '1 finger · root position', pattern: [false, true, false, false, false] },
  'first-inversion': { label: '2 fingers · first inversion', pattern: [false, true, true, false, false] },
  seventh: { label: '3 fingers · seventh chord', pattern: [false, true, true, true, false] },
  'color-seventh': { label: '4 fingers · color seventh', pattern: [false, true, true, true, true] },
}

export function SongTutorialPage() {
  const { songId } = useParams()
  const song = getTutorialSong(songId)
  const [activeCueIndex, setActiveCueIndex] = useState(0)

  useEffect(() => {
    setActiveCueIndex(0)
  }, [songId])

  const lessonChords = useMemo(() => {
    if (!song) return []
    return song.chords.map((chord) => {
      const gesture = gestureDefinitions.find((definition) => definition.degree === chord.degree)
      if (!gesture) throw new Error(`Unknown gesture degree: ${chord.degree}`)
      const voicing = chord.voicing ?? 'root'
      return {
        ...chord,
        gesture,
        voicing,
        rightHand: rightHandPatterns[voicing],
        notes: buildChord(chord.degree, chord.quality, voicing).notes,
      }
    })
  }, [song])

  if (!song) return <Navigate to="/songs" replace />

  const activeCue = song.cues[activeCueIndex]
  const activeChord = getTutorialChord(song, activeCue.chordId)
  const activeLessonChord = lessonChords.find((chord) => chord.id === activeChord.id)
  if (!activeLessonChord) return <Navigate to="/songs" replace />

  const previousCue = () => setActiveCueIndex((index) => Math.max(0, index - 1))
  const nextCue = () => setActiveCueIndex((index) => Math.min(song.cues.length - 1, index + 1))
  const progress = ((activeCueIndex + 1) / song.cues.length) * 100

  return (
    <div className={`content-page song-tutorial-page ${song.accent}`}>
      <header className="tutorial-hero">
        <Link className="tutorial-back" to="/songs">← Tutorial pack</Link>
        <div className="tutorial-hero-grid">
          <div>
            <p className="eyebrow"><span /> Guided song · {song.artist}</p>
            <h1>{song.title}</h1>
            <p className="tutorial-arrangement">{song.arrangementLabel}</p>
          </div>
          <dl className="tutorial-meta">
            <div><dt>Preset</dt><dd>{song.presetLabel}</dd></div>
            <div><dt>Level</dt><dd>{song.level}</dd></div>
            <div><dt>Changes</dt><dd>{song.cues.length} cues</dd></div>
          </dl>
        </div>
      </header>

      <section className="tutorial-section chord-vocabulary-section">
        <header>
          <div><small>01 · Prepare</small><h2>Chords used</h2></div>
          <p>Keep both signs visible. The left hand chooses the chord; the right hand holds its voicing.</p>
        </header>
        <div className="tutorial-chord-grid">
          {lessonChords.map((chord) => (
            <article className="tutorial-chord-card" key={chord.id}>
              <div className="tutorial-chord-name"><span>{chord.degree}</span><div><small>{chord.quality} · {chord.rightHand.label}</small><h3>{chord.name}</h3></div></div>
              <div className="two-hand-shape">
                <div><FingerDiagram hand="Left" pattern={chord.gesture.pattern} size="studio" /><small>Left · {chord.gesture.hint}</small></div>
                <span aria-hidden="true">+</span>
                <div><FingerDiagram hand="Right" pattern={chord.rightHand.pattern} accent="violet" size="studio" /><small>Right · {chord.rightHand.label}</small></div>
              </div>
              <p><strong>Tilt {chord.quality === 'major' ? 'inward' : 'outward'}</strong> · {chord.notes.join(' · ')}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="tutorial-section cue-player-section">
        <header>
          <div><small>02 · Practice</small><h2>Follow the changes</h2></div>
          <p>{song.copyMode === 'lyrics' ? 'Change signs on the highlighted lyric phrase.' : 'Change signs on beat one of each highlighted count.'}</p>
        </header>

        <div className="cue-player">
          <div className="cue-now">
            <div className="cue-progress-label"><span>Change {String(activeCueIndex + 1).padStart(2, '0')} / {String(song.cues.length).padStart(2, '0')}</span><strong>{Math.round(progress)}%</strong></div>
            <div className="cue-progress"><i style={{ width: `${progress}%` }} /></div>
            <div className="current-gesture">
              <div className="current-gesture-diagrams">
                <FingerDiagram hand="Left" pattern={activeLessonChord.gesture.pattern} />
                <span>+</span>
                <FingerDiagram hand="Right" pattern={activeLessonChord.rightHand.pattern} accent="violet" />
              </div>
              <div>
                <small>Make this gesture now</small>
                <h2>{activeChord.name}</h2>
                <p>Left degree {activeChord.degree} · tilt {activeChord.quality === 'major' ? 'inward' : 'outward'} · {activeLessonChord.rightHand.label}</p>
              </div>
            </div>
            <div className="current-cue-copy">
              <small>{activeCue.section} · {activeCue.timing}</small>
              <p><mark>{activeCue.text}</mark></p>
            </div>
            <div className="cue-controls">
              <button type="button" onClick={previousCue} disabled={activeCueIndex === 0}>← Previous</button>
              <button type="button" className="next-cue" onClick={nextCue} disabled={activeCueIndex === song.cues.length - 1}>Next change →</button>
            </div>
          </div>

          <div className="cue-timeline" aria-label="Song gesture timeline">
            {song.cues.map((cue, index) => {
              const chord = getTutorialChord(song, cue.chordId)
              return (
                <button
                  type="button"
                  className={index === activeCueIndex ? 'active' : ''}
                  aria-pressed={index === activeCueIndex}
                  onClick={() => setActiveCueIndex(index)}
                  key={cue.id}
                >
                  <span className="cue-step">{String(index + 1).padStart(2, '0')}</span>
                  <span className="cue-timeline-copy"><small>{cue.section} · {cue.timing}</small><strong>{cue.text}</strong></span>
                  <span className="cue-chord-badge"><b>{chord.degree}</b>{chord.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <aside className="tutorial-rights-note">
        <span>{song.copyMode === 'lyrics' ? 'Public-domain lesson' : 'Instrumental cue guide'}</span>
        <p>{song.rightsNote}</p>
      </aside>

      <div className="lesson-callout tutorial-callout">
        <div><small>Know the progression?</small><h2>Take it into the studio.</h2></div>
        <Link className="button button-primary" to="/play">Open studio →</Link>
      </div>
    </div>
  )
}
