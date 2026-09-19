import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/api'

const AuthContext = createContext(null)

const MOCK_USER = {
  id: 'usr_1',
  name: 'Alex Johnson',
  email: 'alex.johnson@university.edu',
  role: 'student',
  avatar: 'AJ',
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('studymate_token') || null)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('studymate_user')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return null
      }
    }
    // Default demo user logged in so user immediately sees rich screens if they want,
    // but login/register pages still function cleanly.
    return MOCK_USER
  })

  useEffect(() => {
    if (user) {
      localStorage.setItem('studymate_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('studymate_user')
    }
  }, [user])

  useEffect(() => {
    if (token) {
      localStorage.setItem('studymate_token', token)
    } else {
      localStorage.removeItem('studymate_token')
    }
  }, [token])

  const login = async (email, password) => {
    try {
      // Attempt backend login
      const data = await api.auth.login({ email, password })
      if (data && data.access_token && data.user) {
        const loggedUser = {
          ...data.user,
          avatar: data.user.name.slice(0, 2).toUpperCase(),
        }
        setToken(data.access_token)
        setUser(loggedUser)
        return loggedUser
      }
    } catch (err) {
      // If server explicitly returned 400/401/etc., rethrow error so UI can display it
      if (err.status && err.status >= 400 && err.status < 500) {
        throw err
      }
      // If server is offline/unreachable, gracefully fall back to local mock
      console.warn('Backend unavailable, using local mock auth fallback:', err.message)
    }

    // Mock fallback
    await new Promise((resolve) => setTimeout(resolve, 300))
    const loggedInUser = {
      id: 'usr_' + Date.now(),
      name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      email,
      role: 'student',
      avatar: email.slice(0, 2).toUpperCase(),
    }
    setUser(loggedInUser)
    return loggedInUser
  }

  const register = async (name, email, password) => {
    try {
      // Attempt backend register
      const data = await api.auth.register({ name, email, password, role: 'student' })
      if (data && data.access_token && data.user) {
        const initials = name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
        const loggedUser = {
          ...data.user,
          avatar: initials || 'ST',
        }
        setToken(data.access_token)
        setUser(loggedUser)
        return loggedUser
      }
    } catch (err) {
      if (err.status && err.status >= 400 && err.status < 500) {
        throw err
      }
      console.warn('Backend unavailable, using local mock register fallback:', err.message)
    }

    // Mock fallback
    await new Promise((resolve) => setTimeout(resolve, 300))
    const initials = name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    const newUser = {
      id: 'usr_' + Date.now(),
      name,
      email,
      role: 'student',
      avatar: initials || 'ST',
    }
    setUser(newUser)
    return newUser
  }

  const logout = () => {
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
