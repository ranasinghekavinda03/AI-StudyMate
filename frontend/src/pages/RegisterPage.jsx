import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap, Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register } = useAuth()
  const navigate = useNavigate()

  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', cls: '' }
    let score = 0
    if (pass.length >= 6) score++
    if (pass.length >= 10) score++
    if (/[A-Z]/.test(pass) && /[0-9]/.test(pass)) score++
    if (/[^A-Za-z0-9]/.test(pass)) score++

    if (score <= 1) return { score: 1, label: 'Weak', cls: 'weak' }
    if (score <= 2) return { score: 2, label: 'Medium', cls: 'medium' }
    return { score: 3, label: 'Strong', cls: 'strong' }
  }

  const strength = getPasswordStrength(password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    try {
      setLoading(true)
      await register(name, email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
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
            <h1>Create an account</h1>
            <p>Start learning smarter with AI-powered notes and quizzes</p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="name">Full name</label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input
                  id="name"
                  type="text"
                  className="input"
                  placeholder="Alex Johnson"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            </div>

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
              <label htmlFor="password">Password</label>
              <div className="input-with-icon input-with-toggle">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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
              {password && (
                <div>
                  <div className="password-strength">
                    <div
                      className={`password-strength-bar ${strength.score >= 1 ? `active ${strength.cls}` : ''}`}
                    />
                    <div
                      className={`password-strength-bar ${strength.score >= 2 ? `active ${strength.cls}` : ''}`}
                    />
                    <div
                      className={`password-strength-bar ${strength.score >= 3 ? `active ${strength.cls}` : ''}`}
                    />
                  </div>
                  <div className={`password-strength-text ${strength.cls}`}>
                    Strength: {strength.label}
                  </div>
                </div>
              )}
            </div>

            <div className="input-group">
              <label htmlFor="confirmPassword">Confirm password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account?{' '}
            <Link to="/login" style={{ fontWeight: 600 }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
