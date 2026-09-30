import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, LogOut, BookOpen } from 'lucide-react'
import { useAuth } from '../context/authContextValue'

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/modules': 'Study Modules',
  '/lectures': 'Lecture Upload & Library',
  '/chat': 'AI Study Chat',
  '/quiz': 'Interactive Quiz Generator',
  '/summaries': 'Study Summaries',
  '/flashcards': 'Study Flashcards',
}

export default function Navbar({ onToggleSidebar }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const currentTitle = pageTitles[location.pathname] || 'AI StudyMate'

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    setDropdownOpen(false)
    logout()
    navigate('/login')
  }

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button
          type="button"
          className="navbar-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="navbar-title">{currentTitle}</h1>
      </div>

      <div className="navbar-spacer" />

      <div className="navbar-right">
        {user ? (
          <div className="dropdown" ref={dropdownRef}>
            <button
              type="button"
              className="navbar-user"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
              aria-haspopup="menu"
              aria-controls="navbar-profile-menu"
            >
              <div className="avatar avatar-sm avatar-primary">
                {user.avatar || 'ST'}
              </div>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                {user.name.split(' ')[0]}
              </span>
            </button>

            <div id="navbar-profile-menu" className={`dropdown-menu ${dropdownOpen ? 'open' : ''}`}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }} className="truncate">
                  {user.email}
                </div>
              </div>
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setDropdownOpen(false)
                  navigate('/modules')
                }}
              >
                <BookOpen size={16} />
                My Modules
              </button>
              <div className="dropdown-divider" />
              <button
                type="button"
                className="dropdown-item"
                onClick={handleLogout}
                style={{ color: 'var(--danger)' }}
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/login')}
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  )
}
