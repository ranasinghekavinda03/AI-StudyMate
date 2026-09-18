import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Plus,
  Search,
  MessageSquare,
  UploadCloud,
  HelpCircle,
  MoreVertical,
  X,
  Sparkles,
  Layers
} from 'lucide-react'

const INITIAL_MODULES = [
  {
    id: 'mod_1',
    code: 'CS 401',
    title: 'Artificial Intelligence',
    description: 'Heuristic search algorithms (A*, IDA*), knowledge representation, game playing, and constraint satisfaction problems.',
    lecturesCount: 8,
    quizzesCount: 14,
    progress: 75,
    icon: '🤖',
    color: '#4F46E5',
  },
  {
    id: 'mod_2',
    code: 'CS 480',
    title: 'Machine Learning & Deep Learning',
    description: 'Supervised & unsupervised learning, gradient descent, neural networks, backpropagation, SVMs, and CNNs.',
    lecturesCount: 12,
    quizzesCount: 22,
    progress: 60,
    icon: '🧠',
    color: '#14B8A6',
  },
  {
    id: 'mod_3',
    code: 'STAT 350',
    title: 'Applied Probability & Statistics',
    description: 'Bayesian probability, random variables, hypothesis testing, Markov chains, and Poisson distributions.',
    lecturesCount: 6,
    quizzesCount: 9,
    progress: 40,
    icon: '📊',
    color: '#F59E0B',
  },
  {
    id: 'mod_4',
    code: 'CS 210',
    title: 'Data Structures & Algorithms',
    description: 'Binary search trees, balanced AVL/Red-Black trees, graph representations, dynamic programming, and amortized analysis.',
    lecturesCount: 10,
    quizzesCount: 18,
    progress: 88,
    icon: '⚡',
    color: '#10B981',
  },
]

export default function ModulesPage() {
  const [modules, setModules] = useState(INITIAL_MODULES)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const filteredModules = modules.filter(
    (m) =>
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateModule = (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    const newModule = {
      id: 'mod_' + Date.now(),
      code: newCode.trim() || 'MOD ' + (modules.length + 1) * 100,
      title: newTitle.trim(),
      description: newDesc.trim() || 'Uploaded course study materials and notes.',
      lecturesCount: 0,
      quizzesCount: 0,
      progress: 0,
      icon: '📚',
      color: '#4F46E5',
    }

    setModules([newModule, ...modules])
    setNewTitle('')
    setNewCode('')
    setNewDesc('')
    setIsModalOpen(false)
  }

  return (
    <div className="stagger-children">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-actions">
          <div>
            <h1>Study Modules</h1>
            <p>Manage your academic courses, organize uploaded lectures, and test your knowledge.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={18} />
            Create Module
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '38px' }}
            placeholder="Search modules by code, title, or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <span className="badge badge-neutral" style={{ padding: '8px 14px', fontSize: 'var(--text-sm)' }}>
            Total Modules: {modules.length}
          </span>
        </div>
      </div>

      {/* Modules Grid */}
      {filteredModules.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">
            <Layers size={32} />
          </div>
          <div className="empty-state-title">No modules found</div>
          <div className="empty-state-desc">
            Try adjusting your search criteria or create your first study module.
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={16} /> Create Module
          </button>
        </div>
      ) : (
        <div className="grid-2">
          {filteredModules.map((mod) => (
            <div key={mod.id} className="module-card">
              <div className="module-card-header">
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                  <div
                    className="module-card-icon"
                    style={{ background: `${mod.color}15`, color: mod.color }}
                  >
                    {mod.icon}
                  </div>
                  <div>
                    <span className="badge badge-primary" style={{ marginBottom: '4px' }}>
                      {mod.code}
                    </span>
                    <h3 className="module-card-title">{mod.title}</h3>
                  </div>
                </div>
              </div>

              <p className="module-card-desc">{mod.description}</p>

              {/* Progress */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)', color: 'var(--text-muted)' }}>
                  <span>Study Completion</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{mod.progress}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${mod.progress}%` }} />
                </div>
              </div>

              {/* Metadata */}
              <div className="module-card-meta">
                <span>{mod.lecturesCount} Lectures</span>
                <span>•</span>
                <span>{mod.quizzesCount} Questions Generated</span>
              </div>

              <div className="divider" />

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'space-between' }}>
                <Link
                  to="/lectures"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                >
                  <UploadCloud size={14} />
                  Lectures
                </Link>
                <Link
                  to="/chat"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                >
                  <MessageSquare size={14} />
                  AI Chat
                </Link>
                <Link
                  to="/quiz"
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                >
                  <HelpCircle size={14} />
                  Quiz
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Module Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Module</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <form className="modal-form" onSubmit={handleCreateModule}>
              <div className="input-group">
                <label htmlFor="modCode">Course Code</label>
                <input
                  id="modCode"
                  type="text"
                  className="input"
                  placeholder="e.g. CS 401"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label htmlFor="modTitle">Module Title</label>
                <input
                  id="modTitle"
                  type="text"
                  className="input"
                  placeholder="e.g. Artificial Intelligence"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="modDesc">Description</label>
                <textarea
                  id="modDesc"
                  className="input"
                  rows={3}
                  placeholder="Briefly describe what this module covers..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
