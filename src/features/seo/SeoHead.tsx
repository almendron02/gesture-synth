import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { absoluteUrl, buildStructuredData, getRouteSeo, SITE_NAME, SOCIAL_IMAGE_URL } from './routeSeo'

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!element) {
    element = document.createElement('link')
    element.rel = 'canonical'
    document.head.append(element)
  }
  element.href = href
}

export function RouteSeo() {
  const { pathname } = useLocation()
  const metadata = useMemo(() => getRouteSeo(pathname), [pathname])

  useEffect(() => {
    const canonicalUrl = absoluteUrl(metadata.canonicalPath)
    document.title = metadata.title
    setCanonical(canonicalUrl)

    setMeta('meta[name="description"]', 'name', 'description', metadata.description)
    setMeta('meta[name="robots"]', 'name', 'robots', metadata.robots)

    setMeta('meta[property="og:type"]', 'property', 'og:type', 'website')
    setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME)
    setMeta('meta[property="og:title"]', 'property', 'og:title', metadata.title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', metadata.description)
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl)
    setMeta('meta[property="og:image"]', 'property', 'og:image', SOCIAL_IMAGE_URL)

    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', metadata.title)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', metadata.description)
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', SOCIAL_IMAGE_URL)

    let structuredData = document.head.querySelector<HTMLScriptElement>('#route-structured-data')
    if (!structuredData) {
      structuredData = document.createElement('script')
      structuredData.id = 'route-structured-data'
      structuredData.type = 'application/ld+json'
      document.head.append(structuredData)
    }
    structuredData.textContent = JSON.stringify(buildStructuredData(metadata))
  }, [metadata])

  return null
}
