import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  UploadCloud,
  MessageSquare,
  HelpCircle,
  GraduationCap,
  LogOut,
  X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/modules', label: 'Modules', icon: BookOpen },
    { to: '/lectures', label: 'Lecture Upload', icon: UploadCloud },
    { to: '/chat', label: 'AI Chat', icon: MessageSquare },
    { to: '/quiz', label: 'Quiz', icon: HelpCircle },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} aria-label="Sidebar navigation">
        <div className="sidebar-header" style={{ justifyContent: 'space-between' }}>
          <NavLink to="/dashboard" className="sidebar-brand" onClick={onClose}>
            <div className="sidebar-brand-icon">
              <GraduationCap size={22} />
            </div>
            <div>
              <span className="sidebar-brand-name">AI StudyMate</span>
              <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.04em' }}>
                RAG ASSISTANT
              </div>
            </div>
          </NavLink>
          {onClose && (
            <button
              type="button"
              className="navbar-toggle"
              onClick={onClose}
              style={{ display: isOpen ? 'flex' : 'none' }}
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Study Workspace</div>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <Icon className="sidebar-link-icon" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          {user ? (
            <div className="sidebar-user" onClick={handleLogout} title="Click to log out">
              <div className="avatar avatar-md avatar-primary">
                {user.avatar || 'ST'}
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name truncate">{user.name}</div>
                <div className="sidebar-user-email truncate">{user.email}</div>
              </div>
              <LogOut size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
          ) : (
            <NavLink to="/login" className="btn btn-primary btn-sm" style={{ width: '100%' }}>
              Sign In
            </NavLink>
          )}
        </div>
      </aside>
    </>
  )
}
