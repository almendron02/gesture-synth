import { Link } from 'react-router-dom'
import { ArrowIcon } from '../components/AppHeader'

export function HomePage() {
  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow"><span /> A camera-powered instrument</p>
          <h1>Make chords out of <em>thin air.</em></h1>
          <p className="hero-lede">
            Pair seven left-hand chord signs with expressive right-hand voicings. No keys, no controller—just your hands and a camera.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/play">Start playing <ArrowIcon /></Link>
            <Link className="text-link" to="/learn">See how gestures work <span>↗</span></Link>
          </div>
          <div className="trust-row">
            <div><strong>07</strong><span>exact chord signs</span></div>
            <div><strong>&lt; 1s</strong><span>to make sound</span></div>
            <div><strong>Local</strong><span>camera processing</span></div>
          </div>
        </div>
        <div className="hero-instrument" aria-label="Abstract hand gesture visualization">
          <div className="hero-grid" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hand-constellation">
            <span className="joint wrist" />
            <span className="joint palm-a" />
            <span className="joint palm-b" />
            <span className="joint finger-a" />
            <span className="joint finger-b" />
            <span className="joint finger-c" />
            <span className="joint finger-d" />
            <i className="bone bone-one" />
            <i className="bone bone-two" />
            <i className="bone bone-three" />
            <i className="bone bone-four" />
            <i className="bone bone-five" />
            <i className="bone bone-six" />
          </div>
          <div className="chord-chip"><span>VI</span><div><strong>A minor</strong><small>A · C · E</small></div></div>
          <div className="live-chip"><i /> LIVE GESTURE</div>
          <div className="waveform" aria-hidden="true">
            {[12, 22, 32, 16, 42, 56, 28, 38, 20, 12, 30, 46, 24, 14].map((height, index) => (
              <i key={index} style={{ height }} />
            ))}
          </div>
        </div>
      </section>

      <section className="principle-strip" aria-label="How it works">
        <p>One gesture, one chord</p>
        <span>01</span><p>Show an exact sign</p>
        <span>02</span><p>Tilt for major or minor</p>
        <span>03</span><p>Move or close to release</p>
      </section>

      <section className="manifesto-section">
        <p className="eyebrow"><span /> Built to feel musical</p>
        <h2>Silence is the canvas.<br />Your gesture is the note.</h2>
        <p>Gesture Synth listens only when your sign is clear. There are no accidental latches and no hidden sustain—sound lives exactly as long as the gesture does.</p>
      </section>
    </div>
  )
}
