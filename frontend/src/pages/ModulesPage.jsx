import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BookOpen, HelpCircle, Layers, MessageSquare, Pencil, Plus, Search, Trash2, UploadCloud, X } from 'lucide-react'
import api from '../api/api'
import { useAuth } from '../context/authContextValue'
import { buildModulePayload, getModuleFormValues } from './moduleForm'
import { deleteModuleAndReload } from './moduleDelete'

export default function ModulesPage() {
  const { token } = useAuth()
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedModule, setSelectedModule] = useState(null)
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [moduleToDelete, setModuleToDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const mutationInFlight = useRef(false)
  const deleteInFlight = useRef(false)

  const loadModules = useCallback(async () => {
    try {
      const data = await api.modules.list(token)
      if (!Array.isArray(data)) {
        throw new Error('The server returned an invalid module list.')
      }
      setModules(data)
      setError('')
      return true
    } catch (requestError) {
      setModules([])
      setError(requestError.message || 'Unable to load modules. Please try again.')
      return false
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    // The module list is an external API resource and must be synchronized on mount/token change.
    // oxlint-disable-next-line react/set-state-in-effect
    loadModules()
  }, [loadModules])

  const openCreateModal = () => {
    setSelectedModule(null)
    setTitle('')
    setCode('')
    setDescription('')
    setFormError('')
    setSuccessMessage('')
    setIsModalOpen(true)
  }

  const openEditModal = (module) => {
    const values = getModuleFormValues(module)
    setSelectedModule(module)
    setTitle(values.title)
    setCode(values.code)
    setDescription(values.description)
    setFormError('')
    setSuccessMessage('')
    setIsModalOpen(true)
  }

  const closeModuleModal = () => {
    if (saving) return
    setFormError('')
    setSelectedModule(null)
    setIsModalOpen(false)
  }

  const handleModuleSubmit = async (event) => {
    event.preventDefault()
    if (mutationInFlight.current) return

    setFormError('')
    let payload
    try {
      payload = buildModulePayload(
        { title, code, description },
        selectedModule ? { emptyOptionalValue: '' } : undefined,
      )
    } catch (validationError) {
      setFormError(validationError.message)
      return
    }

    mutationInFlight.current = true
    setSaving(true)
    try {
      if (selectedModule) {
        await api.modules.update(selectedModule.id, payload, token)
      } else {
        await api.modules.create(payload, token)
      }
      const successAction = selectedModule ? 'updated' : 'created'
      setTitle('')
      setCode('')
      setDescription('')
      setSelectedModule(null)
      setIsModalOpen(false)
      setSuccessMessage(`Module “${payload.title}” was ${successAction} successfully.`)
      await loadModules()
    } catch (requestError) {
      const action = selectedModule ? 'update' : 'create'
      setFormError(requestError.message || `Unable to ${action} the module. Please try again.`)
    } finally {
      mutationInFlight.current = false
      setSaving(false)
    }
  }

  const openDeleteConfirmation = (module) => {
    setModuleToDelete(module)
    setDeleteError('')
    setSuccessMessage('')
  }

  const closeDeleteConfirmation = () => {
    if (deleting) return
    setModuleToDelete(null)
    setDeleteError('')
  }

  const confirmModuleDeletion = async () => {
    if (!moduleToDelete || deleteInFlight.current) return

    const moduleBeingDeleted = moduleToDelete
    deleteInFlight.current = true
    setDeleting(true)
    setDeleteError('')

    try {
      await deleteModuleAndReload({
        moduleId: moduleBeingDeleted.id,
        token,
        deleteRequest: api.modules.delete,
        reloadModules: loadModules,
      })
      setModuleToDelete(null)
      setSuccessMessage(`Module “${moduleBeingDeleted.title}” was deleted successfully.`)
    } catch (requestError) {
      setDeleteError(requestError.message || 'Unable to delete the module. Please try again.')
    } finally {
      deleteInFlight.current = false
      setDeleting(false)
    }
  }

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
          <button type="button" className="btn btn-primary" onClick={openCreateModal} disabled={loading || saving}>
            <Plus size={18} />
            Create Module
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="module-success-message" role="status">
          {successMessage}
        </div>
      )}

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
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreateModal}>
            <Plus size={16} /> Create Module
          </button>
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
                <div className="module-card-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm module-edit-button"
                    onClick={() => openEditModal(module)}
                    aria-label={`Edit ${module.title}`}
                  >
                    <Pencil size={15} />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm module-delete-button"
                    onClick={() => openDeleteConfirmation(module)}
                    aria-label={`Delete ${module.title}`}
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
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

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModuleModal}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="module-form-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 id="module-form-title">{selectedModule ? 'Edit Module' : 'Create New Module'}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeModuleModal}
                aria-label="Close module form"
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleModuleSubmit}>
              {formError && <div className="auth-error" role="alert">{formError}</div>}

              <div className="input-group">
                <label htmlFor="moduleTitle">Module Title</label>
                <input
                  id="moduleTitle"
                  type="text"
                  className="input"
                  placeholder="e.g. Machine Learning"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={saving}
                  autoFocus
                />
              </div>

              <div className="input-group">
                <label htmlFor="moduleCode">Course Code <span className="optional-label">Optional</span></label>
                <input
                  id="moduleCode"
                  type="text"
                  className="input"
                  placeholder="e.g. IT3091"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="input-group">
                <label htmlFor="moduleDescription">Description <span className="optional-label">Optional</span></label>
                <textarea
                  id="moduleDescription"
                  className="input"
                  rows={3}
                  placeholder="Briefly describe what this module covers..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModuleModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (selectedModule ? 'Updating...' : 'Creating...') : (selectedModule ? 'Update Module' : 'Create Module')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {moduleToDelete && (
        <div className="modal-overlay" onClick={closeDeleteConfirmation}>
          <div
            className="modal delete-confirmation-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-module-title"
            aria-describedby="delete-module-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="delete-confirmation-heading">
                <span className="delete-confirmation-icon">
                  <AlertTriangle size={22} />
                </span>
                <h2 id="delete-module-title">Delete module?</h2>
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

            <p id="delete-module-description" className="delete-confirmation-text">
              Are you sure you want to delete <strong>{moduleToDelete.title}</strong>? Its associated
              records will also be removed. This action cannot be undone.
            </p>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeDeleteConfirmation} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmModuleDeletion} disabled={deleting}>
                <Trash2 size={16} />
                {deleting ? 'Deleting...' : 'Delete Module'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
