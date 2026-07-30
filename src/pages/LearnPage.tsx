import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FingerDiagram } from '../features/gestures/FingerDiagram'
import { gestureDefinitions } from '../features/gestures/gesturePatterns'
import type { FingerPattern, Handedness } from '../features/gestures/gesture.types'

const rightHandLessons: readonly {
  number: string
  fingers: string
  title: string
  description: string
  pattern: FingerPattern
  notes: readonly string[]
}[] = [
  {
    number: '01',
    fingers: 'One finger',
    title: 'Root position',
    description: 'Keep the root at the bottom for the clearest form of the chord.',
    pattern: [false, true, false, false, false],
    notes: ['C3', 'E3', 'G3'],
  },
  {
    number: '02',
    fingers: 'Two fingers',
    title: 'First inversion',
    description: 'Move the root to the top for a smoother, lighter bass line.',
    pattern: [false, true, true, false, false],
    notes: ['E3', 'G3', 'C4'],
  },
  {
    number: '03',
    fingers: 'Three fingers',
    title: 'Seventh chord',
    description: 'Add a major or minor seventh based on the left-hand quality.',
    pattern: [false, true, true, true, false],
    notes: ['C3', 'E3', 'G3', 'B3'],
  },
  {
    number: '04',
    fingers: 'Four fingers',
    title: 'Color seventh',
    description: 'Add dominant-seven color in major or diminished-seven tension in minor.',
    pattern: [false, true, true, true, true],
    notes: ['C3', 'E3', 'G3', 'B♭3'],
  },
  {
    number: '05',
    fingers: 'Thumb out + any sign',
    title: 'One octave down',
    description: 'Extend your thumb alongside any valid voicing sign to lower the entire chord by twelve semitones.',
    pattern: [true, true, false, false, false],
    notes: ['C2', 'E2', 'G2'],
  },
] as const

export function LearnPage() {
  const [activeHand, setActiveHand] = useState<Handedness>('Left')

  return (
    <div className="content-page">
      <header className="page-intro">
        <p className="eyebrow"><span /> Two-hand gesture guide</p>
        <h1>Two hands.<br /><em>One instrument.</em></h1>
        <p>Start with your left hand to choose the chord and its major or minor quality. Keep that sign live while your right hand reshapes the notes.</p>
      </header>
      <div className="hand-lesson-tabs" role="tablist" aria-label="Choose a hand to learn">
        <button
          type="button"
          role="tab"
          id="left-hand-tab"
          aria-controls="left-hand-panel"
          aria-selected={activeHand === 'Left'}
          className={`hand-lesson-tab left-hand-tab ${activeHand === 'Left' ? 'active' : ''}`}
          onClick={() => setActiveHand('Left')}
        >
          <small>01 · Chord selector</small>
          <strong>Left hand</strong>
          <span>Seven signs choose the chord and major or minor quality.</span>
        </button>
        <button
          type="button"
          role="tab"
          id="right-hand-tab"
          aria-controls="right-hand-panel"
          aria-selected={activeHand === 'Right'}
          className={`hand-lesson-tab right-hand-tab ${activeHand === 'Right' ? 'active' : ''}`}
          onClick={() => setActiveHand('Right')}
        >
          <small>02 · Chord shaper</small>
          <strong>Right hand</strong>
          <span>Voicing, octave, volume, and brightness live here.</span>
        </button>
      </div>

      {activeHand === 'Left' ? (
        <section
          className="left-hand-lessons"
          id="left-hand-panel"
          role="tabpanel"
          aria-labelledby="left-hand-tab"
        >
          <header className="learn-section-heading">
            <div><p className="eyebrow"><span /> Left hand · chord selector</p><h2>Make the chord.</h2></div>
            <p>These diagrams show your <strong>left palm facing the camera</strong>—the thumb is on the right. Tilt slightly inward for major or outward for minor.</p>
          </header>
          <div className="gesture-library">
            {gestureDefinitions.map((gesture, index) => (
              <article className="gesture-card" key={gesture.degree}>
                <div className="gesture-card-number">{String(index + 1).padStart(2, '0')}</div>
                <FingerDiagram hand="Left" pattern={gesture.pattern} />
                <div><small>Left hand · Degree {gesture.degree}</small><h2>{gesture.name}</h2><p>{gesture.hint}</p></div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section
          className="right-hand-lessons"
          id="right-hand-panel"
          role="tabpanel"
          aria-labelledby="right-hand-tab"
        >
          <header>
            <div><p className="eyebrow"><span /> Right hand · chord shaper</p><p>Keep the left-hand chord sign visible, then use your right hand to rearrange or extend its notes. The examples below use C major.</p></div>
            <h2>Shape the chord<br /><em>while it is alive.</em></h2>
          </header>
          <div className="right-hand-grid">
            {rightHandLessons.map((lesson) => (
              <article key={lesson.number}>
                <small>{lesson.number} · Right hand · {lesson.fingers}</small>
                <div className="right-lesson-visual">
                  <FingerDiagram hand="Right" pattern={lesson.pattern} accent="violet" />
                  <span className="shape-arrow" aria-hidden="true">→</span>
                  <div className="note-shape" aria-label={`Example notes: ${lesson.notes.join(', ')}`}>
                    {lesson.notes.map((note, noteIndex) => <i key={`${note}-${noteIndex}`}>{note}</i>)}
                  </div>
                </div>
                <h3>{lesson.title}</h3>
                <p>{lesson.description}</p>
              </article>
            ))}
          </div>
          <footer><span>↕ Right-hand height controls volume</span><span>↻ Right-hand tilt controls brightness</span><span>Thumb out lowers the chord by one octave</span></footer>
        </section>
      )}
      <div className="lesson-callout">
        <div><small>Ready?</small><h2>Try your first chord.</h2></div>
        <Link className="button button-primary" to="/play">Open studio →</Link>
      </div>
    </div>
  )
}
