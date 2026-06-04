import type { User } from 'firebase/auth'
import { ArrowLeft, ChevronRight, LogIn, LogOut, Moon, UserCircle } from 'lucide-react'
import type { ThemeName } from '../../types'
import type { AccountMenuView, ThemeGroup } from './accountMenuConfig'

function getUserInitial(user: User): string | null {
  const source = user.displayName || user.email
  return source ? source.trim().charAt(0).toUpperCase() : null
}

export function AccountAvatar({ user, size = 20 }: { user: User | null; size?: number }) {
  const initial = user ? getUserInitial(user) : null
  if (user?.photoURL) {
    return <img src={user.photoURL} alt="" />
  }
  if (initial) {
    return <span className="avatar-initial">{initial}</span>
  }
  return <UserCircle size={size} />
}

export function AccountButton({
  user,
  isOpen,
  onClick,
}: {
  user: User | null
  isOpen: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="avatar-button"
      onClick={onClick}
      aria-label="Account menu"
      aria-haspopup="menu"
      aria-expanded={isOpen}
    >
      <AccountAvatar user={user} />
    </button>
  )
}

export function AccountMenu({
  user,
  view,
  theme,
  themeGroups,
  selectedThemeLabel,
  isConfirmingSignOut,
  onViewChange,
  onSelectTheme,
  onSignIn,
  onRequestSignOut,
  onCancelSignOut,
  onConfirmSignOut,
}: {
  user: User | null
  view: AccountMenuView
  theme: ThemeName
  themeGroups: ThemeGroup[]
  selectedThemeLabel: string
  isConfirmingSignOut: boolean
  onViewChange: (view: AccountMenuView) => void
  onSelectTheme: (theme: ThemeName) => void
  onSignIn: () => void
  onRequestSignOut: () => void
  onCancelSignOut: () => void
  onConfirmSignOut: () => void
}) {
  const menuRole = isConfirmingSignOut ? 'dialog' : 'menu'

  return (
    <section className="account-menu" role={menuRole} aria-label="Account">
      {view === 'theme' ? (
        <div className="account-menu-panel account-menu-panel-theme">
          <button
            type="button"
            className="account-menu-action account-menu-back"
            onClick={() => onViewChange('main')}
            aria-label="Back to account menu"
          >
            <ArrowLeft size={16} />
            Theme
          </button>
          <div className="account-menu-divider" />
          {themeGroups.map((group) => (
            <div key={group.label} className="account-theme-group">
              <p className="account-theme-group-label">{group.label}</p>
              {group.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={option.value === theme}
                  className={option.value === theme ? 'account-menu-action account-theme-option active' : 'account-menu-action account-theme-option'}
                  onClick={() => onSelectTheme(option.value)}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="account-menu-panel account-menu-panel-main">
          {user ? (
            <>
              <div className="account-menu-profile">
                <span className="account-menu-avatar" aria-hidden="true">
                  <AccountAvatar user={user} size={28} />
                </span>
                <span className="account-menu-identity">
                  <strong>{user.displayName || 'Signed in user'}</strong>
                  <small>{user.email || 'No email available'}</small>
                </span>
              </div>
              <div className="account-menu-divider" />
            </>
          ) : null}
          <button type="button" className="account-menu-action account-theme-entry" onClick={() => onViewChange('theme')} role="menuitem">
            <Moon size={16} />
            <span>Theme</span>
            <span className="account-menu-action-value">{selectedThemeLabel}</span>
            <ChevronRight size={16} />
          </button>
          <div className="account-menu-divider" />
          {isConfirmingSignOut ? (
            <div className="account-confirm">
              <strong>Sign out?</strong>
              <div className="account-confirm-actions">
                <button type="button" className="secondary-button compact" onClick={onCancelSignOut} aria-label="Cancel sign out">
                  Cancel
                </button>
                <button type="button" className="primary-button compact" onClick={onConfirmSignOut} aria-label="Confirm sign out">
                  Confirm
                </button>
              </div>
            </div>
          ) : user ? (
            <button type="button" className="account-menu-action" onClick={onRequestSignOut} role="menuitem">
              <LogOut size={16} />
              Sign out
            </button>
          ) : (
            <button type="button" className="account-menu-action" onClick={onSignIn} role="menuitem">
              <LogIn size={16} />
              Sign in
            </button>
          )}
        </div>
      )}
    </section>
  )
}
