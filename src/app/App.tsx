import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { RouteSeo } from '../features/seo/SeoHead'
import { HomePage } from '../pages/HomePage'

const LearnPage = lazy(() => import('../pages/LearnPage').then((module) => ({ default: module.LearnPage })))
const GuidePage = lazy(() => import('../pages/GuidePage').then((module) => ({ default: module.GuidePage })))
const ComposerPage = lazy(() => import('../pages/ComposerPage').then((module) => ({ default: module.ComposerPage })))
const PlayPage = lazy(() => import('../pages/PlayPage').then((module) => ({ default: module.PlayPage })))
const SongsPage = lazy(() => import('../pages/SongsPage').then((module) => ({ default: module.SongsPage })))
const SongTutorialPage = lazy(() => import('../pages/SongTutorialPage').then((module) => ({ default: module.SongTutorialPage })))

export default function App() {
  return (
    <div className="app-shell">
      <RouteSeo />
      <AppHeader />
      <main>
        <Suspense fallback={<div className="route-loader"><i /> Loading instrument</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/play" element={<PlayPage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route path="/compose" element={<ComposerPage />} />
            <Route path="/songs" element={<SongsPage />} />
            <Route path="/songs/:songId" element={<SongTutorialPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
