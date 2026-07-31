import { Link } from 'react-router-dom'

const recordingSteps = [
  {
    title: 'Choose the loop settings',
    description: 'Pick the speed, length, and timing grid before recording. These settings stay the same for every layer in the session.',
  },
  {
    title: 'Record the first take',
    description: 'Press New take. After the four-count, make your gestures. The recording stops by itself when the chosen number of bars is complete.',
  },
  {
    title: 'Add another layer',
    description: 'Press Overdub. Your saved loop plays while a new layer records, so you can add harmony without losing the first performance.',
  },
  {
    title: 'Shape the session',
    description: 'Mute a layer to compare ideas, delete one you do not like, or use Undo layer to remove the newest overdub.',
  },
] as const

const recordingTerms = [
  { term: 'BPM', meaning: 'How fast the loop moves.' },
  { term: 'Bars', meaning: 'How long the loop lasts before repeating.' },
  { term: 'Quantize', meaning: 'Moves changes onto a clean timing grid.' },
  { term: 'Overdub', meaning: 'Records a new layer while the others play.' },
] as const

const midiSteps = [
  {
    title: 'Create a route',
    description: 'Use an IAC bus on Mac, a loopMIDI port on Windows, or connect a physical MIDI instrument.',
  },
  {
    title: 'Prepare the music track',
    description: 'In your DAW, create a software-instrument or MIDI track. Choose that same port as the track input and arm the track.',
  },
  {
    title: 'Connect Gesture Synth',
    description: 'Open MIDI Bridge in the studio, press Connect MIDI, choose the output, and match the MIDI channel used by your track.',
  },
  {
    title: 'Perform and record',
    description: 'Your gestures now play the DAW instrument. Press record in the DAW when you want to capture editable MIDI notes.',
  },
] as const

const midiMappings = [
  { gesture: 'Complete two-hand chord', message: 'Notes on and off', result: 'Plays the selected chord' },
  { gesture: 'Right-hand height', message: 'CC11 · Expression', result: 'Controls dynamics' },
  { gesture: 'Right-hand rotation', message: 'CC74 · Brightness', result: 'Controls filter or tone' },
  { gesture: 'Panic button', message: 'All notes off', result: 'Stops any stuck notes' },
] as const

export function GuidePage() {
  return (
    <div className="content-page guide-page">
      <header className="guide-hero">
        <div>
          <p className="eyebrow"><span /> Studio documentation</p>
          <h1>Recording &amp;<br /><em>MIDI guide.</em></h1>
        </div>
        <div className="guide-hero-copy">
          <p>A simple guide to saving musical ideas inside Gesture Synth and using your hands to play instruments in a DAW.</p>
          <nav aria-label="Guide sections">
            <a href="#recording">Recording</a>
            <a href="#midi">MIDI</a>
            <a href="#quick-start">Quick start</a>
          </nav>
        </div>
      </header>

      <section className="guide-basics" aria-labelledby="guide-basics-title">
        <header>
          <small>Start here</small>
          <h2 id="guide-basics-title">Two tools.<br />Two different jobs.</h2>
        </header>
        <article className="guide-definition recording-definition">
          <span aria-hidden="true">●</span>
          <small>Recording</small>
          <h3>Remember and repeat.</h3>
          <p>Recording saves the chords you perform, including their timing, loudness, and brightness. The loop then repeats that performance for you.</p>
          <strong>Use it to build ideas inside Gesture Synth.</strong>
        </article>
        <article className="guide-definition midi-definition">
          <span aria-hidden="true">↗</span>
          <small>MIDI</small>
          <h3>Control another instrument.</h3>
          <p>MIDI is not sound. It is a stream of musical instructions—what notes to play, when to stop, and how expressive they should be.</p>
          <strong>Use it to play and record in music software.</strong>
        </article>
      </section>

      <section className="guide-chapter" id="recording" aria-labelledby="recording-title">
        <header className="guide-chapter-heading">
          <span>01</span>
          <div>
            <p className="eyebrow"><span /> Performance looper</p>
            <h2 id="recording-title">How recording works.</h2>
            <p>Think of the looper as a musical circle. You perform for a fixed amount of time, then the performance starts again from the beginning.</p>
          </div>
        </header>

        <div className="guide-steps">
          {recordingSteps.map((step, index) => (
            <article key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><h3>{step.title}</h3><p>{step.description}</p></div>
            </article>
          ))}
        </div>

        <div className="guide-loop-example" aria-label="Example of a two-layer four-bar loop">
          <header><span>Example session</span><strong>100 BPM · 4 bars · 1/8 grid</strong></header>
          <div>
            <small>Layer 1</small>
            <i className="lime" style={{ width: '23%' }}>C</i>
            <i className="lime" style={{ width: '23%' }}>Am</i>
            <i className="lime" style={{ width: '23%' }}>F</i>
            <i className="lime" style={{ width: '23%' }}>G</i>
          </div>
          <div>
            <small>Layer 2</small>
            <i className="violet empty" style={{ width: '23%' }}>Rest</i>
            <i className="violet" style={{ width: '48%' }}>Harmony</i>
            <i className="violet" style={{ width: '23%' }}>Color</i>
          </div>
          <footer><span>Every layer begins and repeats at the same point.</span><strong>↻</strong></footer>
        </div>

        <div className="guide-terms" aria-label="Recording terms">
          {recordingTerms.map((item) => <article key={item.term}><strong>{item.term}</strong><p>{item.meaning}</p></article>)}
        </div>

        <aside className="guide-why">
          <div><small>Why it is useful</small><h3>You can become your own band.</h3></div>
          <p>Start with a chord progression, add a higher harmony, mute layers to test arrangements, and keep a useful idea playing while you improvise over it.</p>
        </aside>
      </section>

      <section className="guide-chapter midi-chapter" id="midi" aria-labelledby="midi-guide-title">
        <header className="guide-chapter-heading">
          <span>02</span>
          <div>
            <p className="eyebrow"><span /> External instruments</p>
            <h2 id="midi-guide-title">How MIDI works.</h2>
            <p>Gesture Synth sends instructions to a MIDI destination. That destination can be a DAW track, a software instrument, or a hardware synthesizer.</p>
          </div>
        </header>

        <div className="midi-guide-flow" aria-label="MIDI signal flow">
          <div><small>01</small><strong>Your hands</strong><span>Gesture</span></div>
          <i>→</i>
          <div><small>02</small><strong>Gesture Synth</strong><span>MIDI instructions</span></div>
          <i>→</i>
          <div><small>03</small><strong>DAW or synth</strong><span>The actual sound</span></div>
        </div>

        <div className="guide-note">
          <strong>The important idea</strong>
          <p>Changing the sound in your DAW does not change the gestures. The same hand performance can play a piano, bass, choir, drum rack, or any other instrument that accepts MIDI.</p>
        </div>

        <div className="guide-steps midi-steps">
          {midiSteps.map((step, index) => (
            <article key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><h3>{step.title}</h3><p>{step.description}</p></div>
            </article>
          ))}
        </div>

        <section className="midi-route-help" aria-labelledby="midi-route-title">
          <header><small>Choose your destination</small><h3 id="midi-route-title">Where should MIDI go?</h3></header>
          <div>
            <article>
              <small>macOS</small>
              <h4>IAC Driver</h4>
              <p>Open Audio MIDI Setup, choose Window → Show MIDI Studio, open IAC Driver, and turn on “Device is online.”</p>
              <a href="https://support.apple.com/guide/audio-midi-setup/transfer-midi-information-between-apps-ams1013/mac" target="_blank" rel="noreferrer">Apple setup guide ↗</a>
            </article>
            <article>
              <small>Windows</small>
              <h4>loopMIDI</h4>
              <p>Create a virtual port in loopMIDI and leave the app running. Choose that port in both Gesture Synth and your DAW.</p>
              <a href="https://www.tobias-erichsen.de/software/loopmidi.html" target="_blank" rel="noreferrer">Official loopMIDI page ↗</a>
            </article>
            <article>
              <small>Hardware</small>
              <h4>MIDI device</h4>
              <p>Connect the device by USB or through a MIDI interface. If it appears in MIDI Bridge, select it as the output.</p>
              <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API" target="_blank" rel="noreferrer">About Web MIDI ↗</a>
            </article>
          </div>
        </section>

        <div className="midi-mapping-guide" aria-label="Gesture to MIDI mapping">
          <header><span>Gesture</span><span>MIDI message</span><span>What you hear</span></header>
          {midiMappings.map((mapping) => (
            <div key={mapping.gesture}><strong>{mapping.gesture}</strong><code>{mapping.message}</code><span>{mapping.result}</span></div>
          ))}
        </div>

        <aside className="guide-why midi-why">
          <div><small>Why it is useful</small><h3>Your hands become a controller.</h3></div>
          <p>You can record editable notes into Ableton, Logic, FL Studio, or another DAW, then change the instrument, move notes, fix timing, or continue arranging after the performance.</p>
        </aside>
      </section>

      <section className="guide-quick-start" id="quick-start" aria-labelledby="quick-start-title">
        <header><p className="eyebrow"><span /> Quick start</p><h2 id="quick-start-title">Choose what you want to do.</h2></header>
        <div>
          <article>
            <small>Stay inside Gesture Synth</small>
            <h3>Build a loop.</h3>
            <ol>
              <li>Enable the camera studio.</li>
              <li>Choose BPM, bars, and quantize.</li>
              <li>Record a new take.</li>
              <li>Add overdub layers.</li>
            </ol>
            <Link className="button button-primary" to="/play">Open the looper →</Link>
          </article>
          <article>
            <small>Use music software</small>
            <h3>Control a DAW.</h3>
            <ol>
              <li>Create or connect a MIDI port.</li>
              <li>Choose it in MIDI Bridge.</li>
              <li>Match the DAW track channel.</li>
              <li>Arm the track and perform.</li>
            </ol>
            <Link className="button button-primary" to="/play">Open MIDI Bridge →</Link>
          </article>
          <article>
            <small>Edit the performance</small>
            <h3>Record into Composer.</h3>
            <ol>
              <li>Select a destination track.</li>
              <li>Choose Hands as the input.</li>
              <li>Enable the compact camera.</li>
              <li>Record after the four-count.</li>
            </ol>
            <Link className="button button-primary" to="/compose">Open Composer →</Link>
          </article>
        </div>
      </section>

      <section className="guide-browser-note">
        <span aria-hidden="true">i</span>
        <div><strong>Use a compatible desktop browser.</strong><p>Web MIDI needs HTTPS, browser permission, and browser support. Chrome or Edge desktop is the safest choice. Camera video and gesture processing stay on your device.</p></div>
      </section>
    </div>
  )
}
