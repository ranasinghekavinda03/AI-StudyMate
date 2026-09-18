import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const MOCK_USER = {
  id: 'usr_1',
  name: 'Alex Johnson',
  email: 'alex.johnson@university.edu',
  role: 'student',
  avatar: 'AJ',
}

export function AuthProvider({ children }) {
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

  const login = async (email, password) => {
    // Mock login delay
    await new Promise((resolve) => setTimeout(resolve, 400))
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
    await new Promise((resolve) => setTimeout(resolve, 400))
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
  }

  return (
    <AuthContext.Provider
      value={{
        user,
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
