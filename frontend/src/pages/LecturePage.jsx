import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, FileText, Filter, HelpCircle, MessageSquare, UploadCloud } from 'lucide-react'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import { filterLecturesByModule, moduleLabel } from './lectureDisplay'

function formatUploadDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export default function LecturePage() {
  const { token } = useAuth()
  const [lectures, setLectures] = useState([])
  const [lecturesLoading, setLecturesLoading] = useState(true)
  const [lecturesError, setLecturesError] = useState('')
  const [modules, setModules] = useState([])
  const [modulesLoading, setModulesLoading] = useState(true)
  const [modulesError, setModulesError] = useState('')
  const [selectedModule, setSelectedModule] = useState('')
  const [filterModule, setFilterModule] = useState('all')

  useEffect(() => {
    let active = true

    async function loadLectures() {
      try {
        const data = await api.lectures.list(null, token)
        if (!active) return
        if (!Array.isArray(data)) throw new Error('The server returned an invalid lecture list.')
        setLectures(data)
        setLecturesError('')
      } catch (requestError) {
        if (!active) return
        setLectures([])
        setLecturesError(requestError.message || 'Unable to load lectures. Please try again.')
      } finally {
        if (active) setLecturesLoading(false)
      }
    }

    async function loadModules() {
      try {
        const data = await api.modules.list(token)
        if (!active) return
        if (!Array.isArray(data)) throw new Error('The server returned an invalid module list.')
        setModules(data)
        setModulesError('')
      } catch (requestError) {
        if (!active) return
        setModules([])
        setModulesError(requestError.message || 'Unable to load modules. Please try again.')
      } finally {
        if (active) setModulesLoading(false)
      }
    }

    // These effects synchronize the page with authenticated backend resources.
    // oxlint-disable-next-line react/set-state-in-effect
    loadLectures()
    // oxlint-disable-next-line react/set-state-in-effect
    loadModules()

    return () => {
      active = false
    }
  }, [token])

  const modulesById = useMemo(
    () => new Map(modules.map((module) => [module.id, module])),
    [modules],
  )

  const filteredLectures = filterLecturesByModule(lectures, filterModule)

  const noModules = !modulesLoading && !modulesError && modules.length === 0

  return (
    <div className="stagger-children">
      <div className="page-header">
        <div className="page-header-actions">
          <div>
            <h1>Lecture Upload & Document Library</h1>
            <p>Browse the lecture documents stored in your authenticated study workspace.</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <label htmlFor="lectureModule" style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              Assign to Module:
            </label>
            <select
              id="lectureModule"
              className="input"
              style={{ width: 'auto', minWidth: '220px', padding: '6px 12px' }}
              value={selectedModule}
              onChange={(event) => setSelectedModule(event.target.value)}
              disabled={modulesLoading || Boolean(modulesError) || noModules}
            >
              <option value="">Select a module</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {moduleLabel(module)}
                </option>
              ))}
            </select>
          </div>
          <span className="badge badge-neutral">Upload integration coming next</span>
        </div>

        {modulesLoading && <div className="lecture-inline-status">Loading modules...</div>}
        {modulesError && <div className="auth-error lecture-inline-status" role="alert">{modulesError}</div>}
        {noModules && (
          <div className="lecture-inline-status">
            You do not have any modules yet. Create a module before uploading a lecture.
          </div>
        )}

        <div className="upload-zone upload-zone-disabled" aria-disabled="true">
          <div className="upload-zone-icon">
            <UploadCloud size={30} />
          </div>
          <div className="upload-zone-title">Document upload is not enabled yet</div>
          <div className="upload-zone-desc">
            Select a real module above. File upload will be connected in the next implementation step.
          </div>
          <div className="upload-zone-formats">
            <span className="badge badge-neutral">PDF</span>
            <span className="badge badge-neutral">DOCX</span>
            <span className="badge badge-neutral">TXT</span>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <h3>Uploaded Lectures ({filteredLectures.length})</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              className="input"
              style={{ width: 'auto', padding: '4px 10px', fontSize: 'var(--text-xs)' }}
              value={filterModule}
              onChange={(event) => setFilterModule(event.target.value)}
              disabled={modulesLoading || Boolean(modulesError) || modules.length === 0}
              aria-label="Filter lectures by module"
            >
              <option value="all">All Modules</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {moduleLabel(module)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ padding: 'var(--space-4)' }}>
          {lecturesLoading ? (
            <div className="empty-state" role="status" aria-live="polite">
              <div className="animate-spin module-loading-spinner" />
              <div className="empty-state-title">Loading your lectures...</div>
              <div className="empty-state-desc">Retrieving documents from the server.</div>
            </div>
          ) : lecturesError ? (
            <div className="empty-state" role="alert">
              <div className="empty-state-icon module-error-icon">
                <FileText size={32} />
              </div>
              <div className="empty-state-title">Unable to load lectures</div>
              <div className="empty-state-desc">{lecturesError}</div>
            </div>
          ) : lectures.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <FileText size={32} />
              </div>
              <div className="empty-state-title">No lectures yet</div>
              <div className="empty-state-desc">Upload your first study document when upload is enabled.</div>
            </div>
          ) : filteredLectures.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <FileText size={32} />
              </div>
              <div className="empty-state-title">No lectures in this module</div>
              <div className="empty-state-desc">Choose another module or view all modules.</div>
            </div>
          ) : (
            <div className="lecture-list">
              {filteredLectures.map((lecture) => {
                const module = modulesById.get(lecture.module_id)
                const fileType = (lecture.file_type || 'file').toUpperCase()
                return (
                  <div key={lecture.id} className="lecture-item">
                    <div
                      className="lecture-item-icon"
                      style={{
                        background: fileType === 'PDF' ? 'var(--danger-light)' : 'var(--primary-light)',
                        color: fileType === 'PDF' ? 'var(--danger)' : 'var(--primary)',
                      }}
                    >
                      <FileText size={22} />
                    </div>

                    <div className="lecture-item-info">
                      <div className="lecture-item-title">{lecture.title}</div>
                      <div className="lecture-item-meta">
                        <span className="badge badge-primary">
                          {module ? moduleLabel(module) : 'Unknown module'}
                        </span>
                        <span>{fileType}</span>
                        <span>•</span>
                        <span>{lecture.page_count ?? 0} pages</span>
                        <span>•</span>
                        <span className="badge badge-accent">
                          <CheckCircle2 size={12} /> {lecture.chunks_count ?? 0} chunks indexed
                        </span>
                        <span>•</span>
                        <span>Uploaded {formatUploadDate(lecture.created_at)}</span>
                      </div>
                    </div>

                    <div className="lecture-item-actions">
                      <Link to="/chat" className="btn btn-ghost btn-sm" title="Chat with this lecture">
                        <MessageSquare size={16} />
                        <span>Chat</span>
                      </Link>
                      <Link to="/quiz" className="btn btn-ghost btn-sm" title="Generate quiz from this lecture">
                        <HelpCircle size={16} />
                        <span>Quiz</span>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
