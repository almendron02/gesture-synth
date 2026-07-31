import { getTutorialSong, type TutorialSong } from '../songs/songLibrary'

export const SITE_URL = 'https://synth.formawebsite.com'
export const SITE_NAME = 'Gesture Synth'
export const SOCIAL_IMAGE_URL = `${SITE_URL}/social-card.png`

export interface RouteSeoMetadata {
  title: string
  description: string
  canonicalPath: string
  pageName: string
  schemaType: 'WebPage' | 'CollectionPage' | 'LearningResource'
  robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' | 'noindex, follow'
  breadcrumbs: readonly { name: string; path: string }[]
  song?: TutorialSong
}

const indexableRobots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' as const

const staticPages: Record<string, RouteSeoMetadata> = {
  '/': {
    title: 'Play Chords With Hand Gestures | Gesture Synth',
    description: 'Play expressive chords with two-hand gestures and a webcam. Learn seven chord signs, shape their voicing, and practice guided synth songs.',
    canonicalPath: '/',
    pageName: 'Gesture Synth',
    schemaType: 'WebPage',
    robots: indexableRobots,
    breadcrumbs: [],
  },
  '/play': {
    title: 'Hand Gesture MIDI Controller | Gesture Synth',
    description: 'Play a webcam-controlled synth or send live gesture chords, expression, and brightness through Web MIDI to a DAW or external instrument.',
    canonicalPath: '/play',
    pageName: 'Gesture Synth Studio',
    schemaType: 'WebPage',
    robots: indexableRobots,
    breadcrumbs: [{ name: 'Studio', path: '/play' }],
  },
  '/learn': {
    title: 'Hand Gesture Chord Guide | Gesture Synth',
    description: 'Learn the seven left-hand chord signs and the right-hand gestures for inversion, sevenths, octave, volume, and filter brightness.',
    canonicalPath: '/learn',
    pageName: 'Hand Gesture Chord Guide',
    schemaType: 'LearningResource',
    robots: indexableRobots,
    breadcrumbs: [{ name: 'Learn', path: '/learn' }],
  },
  '/guide': {
    title: 'Recording and MIDI Guide | Gesture Synth',
    description: 'Learn how to record gesture loops, add overdub layers, and connect Gesture Synth to a DAW or external instrument with Web MIDI.',
    canonicalPath: '/guide',
    pageName: 'Gesture Synth Recording and MIDI Guide',
    schemaType: 'LearningResource',
    robots: indexableRobots,
    breadcrumbs: [{ name: 'Guide', path: '/guide' }],
  },
  '/compose': {
    title: 'Online Piano Roll and Gesture Composer | Gesture Synth',
    description: 'Compose music in a browser piano roll with draggable notes, laptop-keyboard recording, layered tracks, and editable hand-gesture performances.',
    canonicalPath: '/compose',
    pageName: 'Gesture Synth Composer',
    schemaType: 'WebPage',
    robots: indexableRobots,
    breadcrumbs: [{ name: 'Compose', path: '/compose' }],
  },
  '/songs': {
    title: 'Guided Synth Song Tutorials | Gesture Synth',
    description: 'Practice hand gestures through guided synth arrangements with chord diagrams, presets, difficulty levels, and precisely timed changes.',
    canonicalPath: '/songs',
    pageName: 'Guided Song Tutorials',
    schemaType: 'CollectionPage',
    robots: indexableRobots,
    breadcrumbs: [{ name: 'Songs', path: '/songs' }],
  },
}

function normalizePath(pathname: string): string {
  if (pathname === '/') return pathname
  return pathname.replace(/\/+$/, '') || '/'
}

function songMetadata(song: TutorialSong): RouteSeoMetadata {
  const chordCount = song.chords.length
  const canonicalPath = `/songs/${song.id}`
  return {
    title: `${song.title} Gesture Tutorial | ${SITE_NAME}`,
    description: `Learn a ${chordCount}-chord ${song.title} gesture arrangement with the ${song.presetLabel} preset. Follow hand diagrams and timed changes at ${song.level.toLowerCase()} level.`,
    canonicalPath,
    pageName: `${song.title} Gesture Tutorial`,
    schemaType: 'LearningResource',
    robots: indexableRobots,
    breadcrumbs: [
      { name: 'Songs', path: '/songs' },
      { name: song.title, path: canonicalPath },
    ],
    song,
  }
}

export function getRouteSeo(pathname: string): RouteSeoMetadata {
  const normalizedPath = normalizePath(pathname)
  const staticMetadata = staticPages[normalizedPath]
  if (staticMetadata) return staticMetadata

  const songMatch = normalizedPath.match(/^\/songs\/([^/]+)$/)
  const song = songMatch ? getTutorialSong(decodeURIComponent(songMatch[1])) : null
  if (song) return songMetadata(song)

  return {
    ...staticPages['/'],
    title: `Page Not Found | ${SITE_NAME}`,
    canonicalPath: normalizedPath,
    pageName: 'Page Not Found',
    robots: 'noindex, follow',
  }
}

export function absoluteUrl(path: string): string {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`
}

export function buildStructuredData(metadata: RouteSeoMetadata): object {
  const canonicalUrl = absoluteUrl(metadata.canonicalPath)
  const page: Record<string, unknown> = {
    '@type': metadata.schemaType,
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: metadata.pageName,
    description: metadata.description,
    inLanguage: 'en',
    isPartOf: { '@id': `${SITE_URL}/#website` },
  }

  if (metadata.schemaType === 'LearningResource') {
    page.learningResourceType = metadata.song
      ? 'Guided song practice'
      : metadata.canonicalPath === '/guide'
        ? 'Recording and MIDI guide'
        : 'Interactive gesture guide'
    page.isAccessibleForFree = true
    if (metadata.song) {
      page.educationalLevel = metadata.song.level
      page.teaches = metadata.song.chords.map((chord) => `${chord.name} hand gesture`)
      page.about = {
        '@type': 'MusicComposition',
        name: metadata.song.title,
      }
    }
  }

  const graph: object[] = [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: 'A two-hand browser instrument powered by computer vision and Web Audio.',
      inLanguage: 'en',
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#application`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: 'Play expressive chords in your browser with two-hand gestures and a webcam.',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript, WebRTC, Web Audio, and camera access',
      featureList: ['Two-hand chord control', 'Web MIDI output', 'Gesture looper', 'Piano-roll composer', 'Laptop keyboard instrument', 'Guided song practice'],
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    page,
  ]

  if (metadata.breadcrumbs.length > 0) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        ...metadata.breadcrumbs.map((crumb, index) => ({
          '@type': 'ListItem',
          position: index + 2,
          name: crumb.name,
          item: absoluteUrl(crumb.path),
        })),
      ],
    })
  }

  return { '@context': 'https://schema.org', '@graph': graph }
}
