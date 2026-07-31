import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminProvider } from './context/AdminContext'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// SPA redirect restore for GitHub Pages with subdirectory support
;(function () {
  const l = window.location
  // Check if we have a redirect encoded in the URL (from 404.html)
  if (l.search[1] === '/' ) {
    const decoded = l.search.slice(1)
      .split('&').map(s => s.replace(/~and~/g, '&'))
      .join('?')
    window.history.replaceState(null, null, l.pathname.slice(0, -1) + decoded + l.hash)
    // Clear the session storage flag since we're done
    sessionStorage.removeItem('spa-redirect-attempted')
  } else {
    // Clear any leftover redirect flags
    sessionStorage.removeItem('spa-redirect-attempted')
  }
})()

// Update canonical URL dynamically based on current location
;(function() {
  const updateCanonicalURL = () => {
    const canonical = document.querySelector('link[rel="canonical"]')
    if (canonical) {
      const currentPath = window.location.pathname + window.location.search + window.location.hash
      canonical.href = `https://b1aoo.github.io${currentPath}`
    }
  }
  
  // Update on page load
  updateCanonicalURL()
  
  // Update on route changes
  window.addEventListener('popstate', updateCanonicalURL)
})()

// Auto-reload once when Vite chunks 404 after a deploy (stale asset hashes)
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('chunk-reload')) {
    sessionStorage.setItem('chunk-reload', '1')
    window.location.reload()
  } else {
    sessionStorage.removeItem('chunk-reload')
  }
})

// Recover once when lazy imports fail due to stale chunk URLs after deploy.
const CHUNK_RELOAD_KEY = 'chunk-reload'
const didAttemptChunkReload = () => sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1'
const attemptChunkReload = () => {
  if (didAttemptChunkReload()) {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY)
    return
  }
  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
  window.location.reload()
}

const isDynamicImportFetchError = (value) => {
  const message = String(value ?? '')
  return message.includes('Failed to fetch dynamically imported module')
    || message.includes('Importing a module script failed')
}

window.addEventListener('unhandledrejection', (event) => {
  if (isDynamicImportFetchError(event.reason?.message || event.reason)) {
    attemptChunkReload()
  }
})

window.addEventListener('error', (event) => {
  if (isDynamicImportFetchError(event.message)) {
    attemptChunkReload()
  }
})

// Earlier deployments registered a service worker that can retain obsolete
// hashed chunks after a release. This site now relies on GitHub Pages' cache
// headers, so retire any existing registration once and reload into fresh code.
if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then(async (registrations) => {
        if (registrations.length === 0) return false

        await Promise.all(registrations.map((registration) => registration.unregister()))
        return true
      })
      .then((removedLegacyWorker) => {
        const cleanupKey = 'team-site-service-worker-cleanup'
        if (removedLegacyWorker && !sessionStorage.getItem(cleanupKey)) {
          sessionStorage.setItem(cleanupKey, '1')
          window.location.reload()
        }
      })
      .catch((error) => {
        console.warn('旧版缓存清理失败：', error)
      })
  })
}

const rootElement = document.getElementById('root')
const app = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminProvider>
          <App />
        </AdminProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)

// If prerendered HTML exists and this is NOT a 404→SPA redirect, hydrate.
// Otherwise do a fresh render (e.g. dynamic routes like /player/:name).
if (rootElement.hasChildNodes() && !window.__SPA_REDIRECT) {
  hydrateRoot(rootElement, app)
} else {
  rootElement.innerHTML = ''
  createRoot(rootElement).render(app)
}
