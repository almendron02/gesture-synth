import { FingerDiagram } from '../gestures/FingerDiagram'
import { liveTutorialSteps } from './liveTutorial'

interface LiveTutorialCoachProps {
  stepIndex: number
  matchProgress: number
  feedback: string
  complete: boolean
  onExit: () => void
  onRestart: () => void
}

export function LiveTutorialCoach({
  stepIndex,
  matchProgress,
  feedback,
  complete,
  onExit,
  onRestart,
}: LiveTutorialCoachProps) {
  const step = liveTutorialSteps[Math.min(stepIndex, liveTutorialSteps.length - 1)]

  return (
    <section className={`live-tutorial-coach ${complete ? 'is-complete' : ''}`} aria-live="polite" aria-label="Live gesture tutorial">
      <header>
        <div>
          <small>{complete ? 'Tutorial complete' : `Live tutorial · ${String(stepIndex + 1).padStart(2, '0')} / ${String(liveTutorialSteps.length).padStart(2, '0')}`}</small>
          <strong>{complete ? 'First chord mastered' : step.label}</strong>
        </div>
        <button type="button" onClick={onExit} aria-label="Exit live tutorial">×</button>
      </header>

      {complete ? (
        <div className="live-tutorial-complete">
          <span aria-hidden="true">✓</span>
          <div>
            <h2>You’re playing the instrument.</h2>
            <p>You chose I major, shaped its voicing, and moved it down an octave—all through live gestures.</p>
          </div>
          <div>
            <button className="ghost-button" type="button" onClick={onRestart}>Practice again</button>
            <button className="button button-primary" type="button" onClick={onExit}>Free play <span>→</span></button>
          </div>
        </div>
      ) : (
        <>
          <div className="live-tutorial-body">
            <div className="live-tutorial-target">
              <div><small>Left</small><FingerDiagram hand="Left" pattern={step.leftPattern} /></div>
              <span aria-hidden="true">+</span>
              {step.rightPattern ? (
                <div><small>Right</small><FingerDiagram hand="Right" pattern={step.rightPattern} accent="violet" /></div>
              ) : (
                <div className="free-hand"><small>Right</small><strong>Free</strong></div>
              )}
            </div>
            <div className="live-tutorial-copy">
              <h2>{step.title}</h2>
              <p>{step.instruction}</p>
              <strong className={matchProgress > 0 ? 'matching' : ''}><i /> {feedback}</strong>
            </div>
          </div>
          <div className="live-tutorial-hold">
            <span>Hold to continue</span>
            <i><b style={{ width: `${Math.round(matchProgress * 100)}%` }} /></i>
            <strong>{Math.round(matchProgress * 100)}%</strong>
          </div>
        </>
      )}
    </section>
  )
}
