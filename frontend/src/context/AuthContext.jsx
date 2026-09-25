import { useEffect, useState } from 'react'
import api from '../api/api'
import { clearStoredSession, establishSession, restoreSession } from './authSession'
import { AuthContext } from './authContextValue'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [refreshToken, setRefreshToken] = useState(null)
  const [user, setUser] = useState(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  const applySession = (session) => {
    setToken(session.accessToken)
    setRefreshToken(session.refreshToken)
    setUser(session.user)
  }

  const clearSession = () => {
    clearStoredSession()
    setToken(null)
    setRefreshToken(null)
    setUser(null)
  }

  useEffect(() => {
    let active = true

    async function checkExistingSession() {
      const session = await restoreSession(api.auth)
      if (!active) return

      if (session) {
        applySession(session)
      } else {
        setToken(null)
        setRefreshToken(null)
        setUser(null)
      }
      setIsCheckingAuth(false)
    }

    checkExistingSession()
    return () => {
      active = false
    }
  }, [])

  const login = async (email, password) => {
    const session = await establishSession(api.auth.login({ email, password }))
    applySession(session)
    return session.user
  }

  const register = async (name, email, password) => {
    const session = await establishSession(
      api.auth.register({ name, email, password, role: 'student' }),
    )
    applySession(session)
    return session.user
  }

  const logout = () => {
    clearSession()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        isAuthenticated: Boolean(user && token),
        isCheckingAuth,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
