import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  BookOpen,
  FileStack,
  FileText,
  HelpCircle,
  Layers3,
  MessageSquare,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import api from '../api/api'
import { useAuth } from '../context/authContextValue'
import {
  dashboardSetLabel,
  formatDashboardDate,
  normalizeDashboard,
  reviewPercent,
} from './dashboard'

export default function DashboardPage() {
  const { token, user } = useAuth()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.dashboard.get(token).then((response) => {
      if (active) setDashboard(normalizeDashboard(response))
    }).catch(() => {
      if (active) setError('Unable to load your dashboard. Please try again later.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  const stats = dashboard?.stats
  const statCards = stats ? [
    { id: 'modules', label: 'Modules', value: stats.modules, detail: 'Owned study modules', icon: BookOpen, colorCls: 'primary' },
    { id: 'lectures', label: 'Lectures', value: stats.lectures, detail: 'Uploaded lectures', icon: FileText, colorCls: 'accent' },
    { id: 'chunks', label: 'Study Chunks', value: stats.document_chunks, detail: 'Indexed document sections', icon: Layers3, colorCls: 'warning' },
    { id: 'flashcards', label: 'Saved Flashcards', value: stats.flashcards, detail: `${stats.flashcard_sets} saved ${stats.flashcard_sets === 1 ? 'set' : 'sets'}`, icon: FileStack, colorCls: 'primary' },
  ] : []

  return (
    <div className="stagger-children">
      <div className="page-header">
        <div className="page-header-actions">
          <div>
            <h1>Welcome back, {user ? user.name.split(' ')[0] : 'Student'}!</h1>
            <p>Here is an overview of your real StudyMate activity.</p>
          </div>
          <div className="dashboard-header-actions">
            <Link to="/lectures" className="btn btn-primary"><UploadCloud size={18} />Upload Lecture</Link>
            <Link to="/chat" className="btn btn-secondary"><Sparkles size={18} />Ask AI</Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="section-card dashboard-message" role="status">Loading your dashboard...</div>
      ) : error ? (
        <div className="auth-error dashboard-message" role="alert">{error}</div>
      ) : (
        <>
          <div className="stats-grid dashboard-stats-grid">
            {statCards.map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.id} className="stat-card">
                  <div className="stat-card-header"><div className={`stat-card-icon ${stat.colorCls}`}><Icon size={22} /></div><span className="badge badge-neutral">Overview</span></div>
                  <div className="stat-card-value">{stat.value}</div>
                  <div className="stat-card-label">{stat.label}</div>
                  <div className="stat-card-trend neutral">{stat.detail}</div>
                </div>
              )
            })}
          </div>

          <section className="section-card dashboard-review-card" aria-label="Flashcard review overview">
            <div className="section-card-header"><h3>Flashcard Review Overview</h3><span className="badge badge-neutral">{stats.total_flashcard_reviews} total reviews</span></div>
            <div className="dashboard-review-grid">
              {[
                ['Known', stats.known_cards, 'known'],
                ['Review Again', stats.review_again_cards, 'again'],
                ['Unreviewed', stats.unreviewed_cards, 'unreviewed'],
              ].map(([label, count, className]) => (
                <div className="dashboard-review-stat" key={label}>
                  <div><strong>{count}</strong><span>{label}</span></div>
                  <div className="progress-bar"><div className={`progress-bar-fill dashboard-progress-${className}`} style={{ width: `${reviewPercent(count, stats.flashcards)}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <div className="dashboard-quick-actions">
            <div className="dashboard-section-label">Quick Study Actions</div>
            <div className="quick-actions">
              <Link to="/lectures" className="quick-action"><div className="quick-action-icon dashboard-icon-primary"><UploadCloud size={24} /></div><span className="quick-action-label">Upload Lecture</span></Link>
              <Link to="/chat" className="quick-action"><div className="quick-action-icon dashboard-icon-accent"><MessageSquare size={24} /></div><span className="quick-action-label">RAG Study Chat</span></Link>
              <Link to="/quiz" className="quick-action"><div className="quick-action-icon dashboard-icon-warning"><HelpCircle size={24} /></div><span className="quick-action-label">Generate Quiz</span></Link>
              <Link to="/flashcards" className="quick-action"><div className="quick-action-icon dashboard-icon-primary"><FileStack size={24} /></div><span className="quick-action-label">Review Due Cards</span></Link>
            </div>
          </div>

          <div className="grid-2">
            <section className="section-card">
              <div className="section-card-header"><h3>Recent Lectures</h3><Link to="/lectures" className="dashboard-view-all">View All <ArrowUpRight size={14} /></Link></div>
              {dashboard.recent_lectures.length === 0 ? <p className="dashboard-empty">No lectures uploaded yet.</p> : (
                <div className="activity-list">
                  {dashboard.recent_lectures.map((lecture) => (
                    <div className="activity-item" key={lecture.id}>
                      <div className="activity-icon dashboard-icon-primary"><FileText size={18} /></div>
                      <div className="activity-info"><div className="activity-title">{lecture.title}</div><div className="activity-desc">{lecture.module_title} · {lecture.file_type.toUpperCase()}</div></div>
                      <div className="activity-time">{formatDashboardDate(lecture.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="section-card">
              <div className="section-card-header"><h3>Recent Flashcard Sets</h3><Link to="/flashcards" className="dashboard-view-all">View All <ArrowUpRight size={14} /></Link></div>
              {dashboard.recent_flashcard_sets.length === 0 ? <p className="dashboard-empty">No saved flashcard sets yet.</p> : (
                <div className="activity-list">
                  {dashboard.recent_flashcard_sets.map((set) => (
                    <div className="activity-item" key={set.id}>
                      <div className="activity-icon dashboard-icon-accent"><FileStack size={18} /></div>
                      <div className="activity-info"><div className="activity-title">{dashboardSetLabel(set)}</div><div className="activity-desc">{set.card_count} cards · {set.difficulty}</div></div>
                      <div className="activity-time">{formatDashboardDate(set.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
