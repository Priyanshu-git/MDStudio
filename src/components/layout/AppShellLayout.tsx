import type { ReactNode } from 'react'

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
  return (
    <main className={shellClassName ? `app-shell ${shellClassName}` : 'app-shell'}>
      <header className="topbar">
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
