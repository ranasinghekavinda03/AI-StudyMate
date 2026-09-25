import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/authContextValue'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isCheckingAuth } = useAuth()
  const location = useLocation()

  if (isCheckingAuth) {
    return (
      <div className="auth-layout" role="status" aria-live="polite">
        <div className="session-checking">
          <div className="animate-spin session-checking-spinner" />
          <span>Restoring your session...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
