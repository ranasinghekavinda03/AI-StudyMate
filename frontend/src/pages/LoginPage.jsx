import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Please enter both email and password.')
      return
    }
    try {
      setLoading(true)
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <div className="auth-logo-icon">
                <GraduationCap size={26} />
              </div>
              <span className="auth-logo-text">AI StudyMate</span>
            </div>
            <h1>Welcome back</h1>
            <p>Enter your credentials to access your study materials</p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="email">Email address</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  className="input"
                  placeholder="student@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="password">Password</label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault()
                    alert('Password reset link has been sent to your email (demo).')
                  }}
                  style={{ fontSize: 'var(--text-xs)', color: 'var(--primary)' }}
                >
                  Forgot password?
                </a>
              </div>
              <div className="input-with-icon input-with-toggle">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="input-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <ArrowRight size={18} />}
            </button>

          </form>

          <div className="auth-footer">
            Don't have an account?{' '}
            <Link to="/register" style={{ fontWeight: 600 }}>
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
