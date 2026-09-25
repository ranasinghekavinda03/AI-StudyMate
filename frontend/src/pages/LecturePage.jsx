import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FileText, Filter, HelpCircle, MessageSquare, Trash2, UploadCloud, X } from 'lucide-react'
import api from '../api/api'
import { useAuth } from '../context/authContextValue'
import { filterLecturesByModule, moduleLabel } from './lectureDisplay'
import { deleteLectureAndReload } from './lectureDelete'
import { validateLectureUpload } from './lectureUpload'

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
  const [selectedFile, setSelectedFile] = useState(null)
  const [lectureTitle, setLectureTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [lectureToDelete, setLectureToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteSuccess, setDeleteSuccess] = useState('')
  const uploadInFlight = useRef(false)
  const deleteInFlight = useRef(false)
  const fileInputRef = useRef(null)

  const loadLectures = useCallback(async (isActive = () => true) => {
    try {
      const data = await api.lectures.list(null, token)
      if (!isActive()) return false
      if (!Array.isArray(data)) throw new Error('The server returned an invalid lecture list.')
      setLectures(data)
      setLecturesError('')
      return true
    } catch (requestError) {
      if (!isActive()) return false
      setLectures([])
      setLecturesError(requestError.message || 'Unable to load lectures. Please try again.')
      return false
    } finally {
      if (isActive()) setLecturesLoading(false)
    }
  }, [token])

  useEffect(() => {
    let active = true

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
    loadLectures(() => active)
    // oxlint-disable-next-line react/set-state-in-effect
    loadModules()

    return () => {
      active = false
    }
  }, [loadLectures, token])

  const modulesById = useMemo(
    () => new Map(modules.map((module) => [module.id, module])),
    [modules],
  )

  const filteredLectures = filterLecturesByModule(lectures, filterModule)

  const noModules = !modulesLoading && !modulesError && modules.length === 0
  const uploadDisabled = uploading || modulesLoading || Boolean(modulesError) || noModules

  const chooseFile = (file) => {
    if (!file) return
    setSelectedFile(file)
    setUploadError('')
    setUploadSuccess('')
  }

  const handleUpload = async (event) => {
    event.preventDefault()
    if (uploadInFlight.current) return

    setUploadError('')
    setUploadSuccess('')
    let normalized
    try {
      normalized = validateLectureUpload({
        moduleId: selectedModule,
        file: selectedFile,
        title: lectureTitle,
      })
    } catch (validationError) {
      setUploadError(validationError.message)
      return
    }

    uploadInFlight.current = true
    setUploading(true)
    try {
      const uploaded = await api.lectures.upload(
        selectedFile,
        selectedModule,
        normalized.title,
        token,
      )
      setSelectedFile(null)
      setLectureTitle('')
      setSelectedModule('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setUploadSuccess(`Lecture “${uploaded.title}” was uploaded successfully.`)
      await loadLectures()
    } catch (requestError) {
      setUploadError(requestError.message || 'Unable to upload the lecture. Please try again.')
    } finally {
      uploadInFlight.current = false
      setUploading(false)
    }
  }

  const openDeleteConfirmation = (lecture) => {
    setLectureToDelete(lecture)
    setDeleteError('')
    setDeleteSuccess('')
  }

  const closeDeleteConfirmation = () => {
    if (deleting) return
    setLectureToDelete(null)
    setDeleteError('')
  }

  const confirmLectureDeletion = async () => {
    if (!lectureToDelete || deleteInFlight.current) return

    const lectureBeingDeleted = lectureToDelete
    deleteInFlight.current = true
    setDeleting(true)
    setDeleteError('')

    try {
      await deleteLectureAndReload({
        lectureId: lectureBeingDeleted.id,
        token,
        deleteRequest: api.lectures.delete,
        reloadLectures: loadLectures,
      })
      setLectureToDelete(null)
      setDeleteSuccess(`Lecture “${lectureBeingDeleted.title}” was deleted successfully.`)
    } catch (requestError) {
      setDeleteError(requestError.message || 'Unable to delete the lecture. Please try again.')
    } finally {
      deleteInFlight.current = false
      setDeleting(false)
    }
  }

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
          <span className="badge badge-accent">Secure document upload</span>
        </div>

        {modulesLoading && <div className="lecture-inline-status">Loading modules...</div>}
        {modulesError && <div className="auth-error lecture-inline-status" role="alert">{modulesError}</div>}
        {noModules && (
          <div className="lecture-inline-status">
            You do not have any modules yet. Create a module before uploading a lecture.
          </div>
        )}

        <form onSubmit={handleUpload}>
          {uploadSuccess && <div className="module-success-message" role="status">{uploadSuccess}</div>}
          {uploadError && <div className="auth-error lecture-upload-message" role="alert">{uploadError}</div>}

          <div className="input-group lecture-title-field">
            <label htmlFor="lectureTitle">Lecture Title <span className="optional-label">Optional</span></label>
            <input
              id="lectureTitle"
              type="text"
              className="input"
              placeholder="Defaults to the uploaded filename"
              value={lectureTitle}
              onChange={(event) => setLectureTitle(event.target.value)}
              disabled={uploadDisabled}
              maxLength={255}
            />
          </div>

          <div
            className={`upload-zone ${dragOver ? 'dragover' : ''} ${uploadDisabled ? 'upload-zone-disabled' : ''}`}
            role="button"
            tabIndex={uploadDisabled ? -1 : 0}
            aria-disabled={uploadDisabled}
            onClick={() => !uploadDisabled && fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (!uploadDisabled && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragOver={(event) => {
              event.preventDefault()
              if (!uploadDisabled) setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(false)
              if (!uploadDisabled) chooseFile(event.dataTransfer.files?.[0])
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              hidden
              disabled={uploadDisabled}
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <div className="upload-zone-icon">
              <UploadCloud size={30} />
            </div>
            <div className="upload-zone-title">
              {selectedFile ? selectedFile.name : 'Click to select or drag and drop a lecture file'}
            </div>
            <div className="upload-zone-desc">
              {selectedFile
                ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB selected`
                : 'PDF, DOCX, or TXT up to 25 MB'}
            </div>
            <div className="upload-zone-formats">
              <span className="badge badge-neutral">PDF</span>
              <span className="badge badge-neutral">DOCX</span>
              <span className="badge badge-neutral">TXT</span>
            </div>
          </div>

          <div className="lecture-upload-actions">
            <button type="submit" className="btn btn-primary" disabled={uploadDisabled}>
              <UploadCloud size={17} />
              {uploading ? 'Uploading & extracting...' : 'Upload Lecture'}
            </button>
          </div>
        </form>
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
          {deleteSuccess && <div className="module-success-message" role="status">{deleteSuccess}</div>}
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
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm lecture-delete-button"
                        onClick={() => openDeleteConfirmation(lecture)}
                        aria-label={`Delete ${lecture.title}`}
                      >
                        <Trash2 size={16} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {lectureToDelete && (
        <div className="modal-overlay" onClick={closeDeleteConfirmation}>
          <div
            className="modal delete-confirmation-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-lecture-title"
            aria-describedby="delete-lecture-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="delete-confirmation-heading">
                <span className="delete-confirmation-icon"><AlertTriangle size={22} /></span>
                <h2 id="delete-lecture-title">Delete lecture?</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeDeleteConfirmation}
                aria-label="Close delete confirmation"
                disabled={deleting}
              >
                <X size={20} />
              </button>
            </div>

            {deleteError && <div className="auth-error delete-confirmation-error" role="alert">{deleteError}</div>}

            <p id="delete-lecture-description" className="delete-confirmation-text">
              Are you sure you want to delete <strong>{lectureToDelete.title}</strong>?
              {' '}This action cannot be undone.
            </p>

            <div className="lecture-delete-details">
              <span className="badge badge-neutral">{(lectureToDelete.file_type || 'file').toUpperCase()}</span>
              <span>{modulesById.has(lectureToDelete.module_id) ? moduleLabel(modulesById.get(lectureToDelete.module_id)) : 'Unknown module'}</span>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeDeleteConfirmation} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmLectureDeletion} disabled={deleting}>
                <Trash2 size={16} />
                {deleting ? 'Deleting...' : 'Delete Lecture'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
