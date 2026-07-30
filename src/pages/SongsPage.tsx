import { Link } from 'react-router-dom'
import { tutorialSongs } from '../features/songs/songLibrary'

export function SongsPage() {
  return (
    <div className="content-page songs-page">
      <header className="page-intro split-intro">
        <div><p className="eyebrow"><span /> First tutorial pack</p><h1>Guided songs.<br /><em>Practice the gestures.</em></h1></div>
        <p>Choose a lesson, learn its chord signs, then follow each gesture change beside the lyric phrase or instrumental count where it happens.</p>
      </header>
      <section className="song-list" aria-label="Song tutorials">
        {tutorialSongs.map((song, index) => (
          <Link className={`song-row ${song.accent}`} to={`/songs/${song.id}`} key={song.id}>
            <span className="song-index">0{index + 1}</span>
            <div className={`album-art ${song.artwork ? 'provided-artwork' : ''}`}>
              {song.artwork ? <img src={song.artwork} alt="" /> : <><i /><i /><i /></>}
            </div>
            <div className="song-title-block"><small>{song.artist}</small><h2>{song.title}</h2></div>
            <div className="song-meta"><span>Preset</span><strong>{song.presetLabel}</strong><span>Level</span><strong>{song.level}</strong></div>
            <span className="open-lesson">Open lesson <b aria-hidden="true">→</b></span>
          </Link>
        ))}
      </section>
      <div className="lesson-callout compact">
        <div><small>Free play is live</small><h2>Build your own progression.</h2></div>
        <Link className="button button-primary" to="/play">Start playing →</Link>
      </div>
    </div>
  )
}
