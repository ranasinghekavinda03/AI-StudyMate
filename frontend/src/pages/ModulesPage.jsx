import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, HelpCircle, Layers, MessageSquare, Search, UploadCloud } from 'lucide-react'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'

export default function ModulesPage() {
  const { token } = useAuth()
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let active = true

    async function loadModules() {
      setLoading(true)
      setError('')

      try {
        const data = await api.modules.list(token)
        if (!active) return
        if (!Array.isArray(data)) {
          throw new Error('The server returned an invalid module list.')
        }
        setModules(data)
      } catch (requestError) {
        if (!active) return
        setModules([])
        setError(requestError.message || 'Unable to load modules. Please try again.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadModules()
    return () => {
      active = false
    }
  }, [token])

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredModules = modules.filter((module) =>
    [module.title, module.code, module.description].some((value) =>
      (value || '').toLowerCase().includes(normalizedSearch),
    ),
  )

  return (
    <div className="stagger-children">
      <div className="page-header">
        <div className="page-header-actions">
          <div>
            <h1>Study Modules</h1>
            <p>Browse your academic courses and their uploaded lecture collections.</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '38px' }}
            placeholder="Search modules by code, title, or topic..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            disabled={loading}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <span className="badge badge-neutral" style={{ padding: '8px 14px', fontSize: 'var(--text-sm)' }}>
            Total Modules: {modules.length}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="empty-state card" role="status" aria-live="polite">
          <div className="animate-spin module-loading-spinner" />
          <div className="empty-state-title">Loading your modules...</div>
          <div className="empty-state-desc">Retrieving your study workspace from the server.</div>
        </div>
      ) : error ? (
        <div className="empty-state card" role="alert">
          <div className="empty-state-icon module-error-icon">
            <Layers size={32} />
          </div>
          <div className="empty-state-title">Unable to load modules</div>
          <div className="empty-state-desc">{error}</div>
        </div>
      ) : modules.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">
            <Layers size={32} />
          </div>
          <div className="empty-state-title">No modules yet</div>
          <div className="empty-state-desc">Create your first module to organize your study materials.</div>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">
            <Search size={32} />
          </div>
          <div className="empty-state-title">No matching modules</div>
          <div className="empty-state-desc">Try a different title, course code, or topic.</div>
        </div>
      ) : (
        <div className="grid-2">
          {filteredModules.map((module) => (
            <div key={module.id} className="module-card">
              <div className="module-card-header">
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                  <div className="module-card-icon module-card-icon-real">
                    <BookOpen size={22} />
                  </div>
                  <div>
                    <span className="badge badge-primary" style={{ marginBottom: '4px' }}>
                      {module.code || 'No course code'}
                    </span>
                    <h3 className="module-card-title">{module.title}</h3>
                  </div>
                </div>
              </div>

              <p className="module-card-desc">
                {module.description || 'No description has been added for this module.'}
              </p>

              <div className="module-card-meta">
                <BookOpen size={15} />
                <span>{module.lectures_count ?? 0} Lectures</span>
              </div>

              <div className="divider" />

              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'space-between' }}>
                <Link to="/lectures" className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                  <UploadCloud size={14} />
                  Lectures
                </Link>
                <Link to="/chat" className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                  <MessageSquare size={14} />
                  AI Chat
                </Link>
                <Link to="/quiz" className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                  <HelpCircle size={14} />
                  Quiz
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
