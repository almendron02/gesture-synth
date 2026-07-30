import { NavLink } from 'react-router-dom'

const navItems = [
  ['Play', '/play'],
  ['Learn', '/learn'],
  ['Songs', '/songs'],
] as const

export function AppHeader() {
  return (
    <header className="app-header">
      <NavLink className="brand" to="/" aria-label="Gesture Synth home">
        <span className="brand-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>Gesture Synth</span>
      </NavLink>
      <nav aria-label="Primary navigation">
        {navItems.map(([label, path]) => (
          <NavLink key={path} to={path} className={({ isActive }) => (isActive ? 'active' : '')}>
            {label}
          </NavLink>
        ))}
      </nav>
      <NavLink className="header-cta" to="/play">
        Open studio <ArrowIcon />
      </NavLink>
    </header>
  )
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  )
}
