import { useEffect, useRef, useState, type ReactNode } from 'react'

type AppShellLayoutProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  shellClassName?: string
  children: ReactNode
}

export function AppShellLayout({
  title,
  subtitle,
  actions,
  shellClassName,
  children,
}: AppShellLayoutProps) {
  const [isTopbarHidden, setIsTopbarHidden] = useState(false)
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    lastScrollYRef.current = window.scrollY

    function handleScroll() {
      const currentScrollY = window.scrollY
      const delta = currentScrollY - lastScrollYRef.current

      if (currentScrollY <= 8) {
        setIsTopbarHidden(false)
      } else if (delta > 6) {
        setIsTopbarHidden(true)
      } else if (delta < -6) {
        setIsTopbarHidden(false)
      }

      lastScrollYRef.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <main className={shellClassName ? `app-shell ${shellClassName}` : 'app-shell'}>
      <header className={isTopbarHidden ? 'topbar topbar-hidden' : 'topbar'}>
        <div>
          <strong>{title}</strong>
          {subtitle ? <span className="topbar-subtitle">{subtitle}</span> : null}
        </div>
        {actions}
      </header>
      {children}
    </main>
  )
}
