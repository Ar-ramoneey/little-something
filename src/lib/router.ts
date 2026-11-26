import { useEffect, useState } from 'react'

export function currentPath(): string {
  const path = window.location.pathname
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

export function isAdminArea(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/')
}

export function isAdminLogin(path: string): boolean {
  return path === '/admin/login'
}

export function isAdminResponses(path: string): boolean {
  return path === '/admin/responses'
}

export function navigate(to: string, replace = false): void {
  if (replace) {
    window.history.replaceState(null, '', to)
  } else {
    window.history.pushState(null, '', to)
  }
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function usePathname(): string {
  const [path, setPath] = useState(currentPath())

  useEffect(() => {
    const handlePopState = () => setPath(currentPath())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return path
}
