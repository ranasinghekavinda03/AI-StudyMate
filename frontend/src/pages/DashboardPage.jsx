import { Link } from 'react-router-dom'
import {
  BookOpen,
  CheckCircle2,
  TrendingUp,
  UploadCloud,
  MessageSquare,
  HelpCircle,
  ArrowUpRight,
  Calendar,
  Sparkles
} from 'lucide-react'
import { useAuth } from '../context/authContextValue'

export default function DashboardPage() {
  const { user } = useAuth()

  const stats = [
    {
      id: 'modules',
      label: 'Modules in Progress',
      value: '4',
      trend: '+1 new this week',
      trendType: 'up',
      icon: BookOpen,
      colorCls: 'primary',
    },
    {
      id: 'accuracy',
      label: 'Quiz Accuracy %',
      value: '84%',
      trend: '+6% improvement',
      trendType: 'up',
      icon: TrendingUp,
      colorCls: 'accent',
    },
    {
      id: 'exam',
      label: 'Next Exam Countdown',
      value: '12 Days',
      trend: 'Machine Learning Midterm',
      trendType: 'neutral',
      icon: Calendar,
      colorCls: 'warning',
    },
  ]

  const recentActivities = [
    {
      id: '1',
      type: 'quiz',
      title: 'Completed Quiz: Neural Networks & Backprop',
      desc: 'Scored 9/10 (90%) • Difficulty: Medium',
      time: '2 hours ago',
      icon: CheckCircle2,
      color: 'var(--accent)',
      bg: 'var(--accent-light)',
    },
    {
      id: '2',
      type: 'chat',
      title: 'AI Chat session on "A* Heuristics"',
      desc: 'Cited Lecture 04: Artificial Intelligence — Page 14',
      time: '5 hours ago',
      icon: MessageSquare,
      color: 'var(--primary)',
      bg: 'var(--primary-light)',
    },
    {
      id: '3',
      type: 'upload',
      title: 'Uploaded: Support_Vector_Machines_Lec06.pdf',
      desc: 'Extracted 32 chunks • Indexed in pgvector',
      time: 'Yesterday',
      icon: UploadCloud,
      color: 'var(--warning)',
      bg: 'var(--warning-light)',
    },
    {
      id: '4',
      type: 'quiz',
      title: 'Completed Quiz: Bayesian Probability',
      desc: 'Scored 7/10 (70%) • Difficulty: Hard',
      time: '2 days ago',
      icon: CheckCircle2,
      color: 'var(--accent)',
      bg: 'var(--accent-light)',
    },
  ]

  const activeModules = [
    {
      id: '1',
      title: 'CS 401: Artificial Intelligence',
      lectures: 8,
      progress: 75,
      lastStudied: 'Today',
    },
    {
      id: '2',
      title: 'CS 480: Machine Learning',
      lectures: 12,
      progress: 60,
      lastStudied: 'Yesterday',
    },
    {
      id: '3',
      title: 'STAT 350: Applied Probability',
      lectures: 6,
      progress: 40,
      lastStudied: '3 days ago',
    },
  ]

  return (
    <div className="stagger-children">
      {/* Welcome Banner */}
      <div className="page-header">
        <div className="page-header-actions">
          <div>
            <h1>
              Welcome back, {user ? user.name.split(' ')[0] : 'Student'}! 👋
            </h1>
            <p>Here is an overview of your study progress and AI learning activity.</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Link to="/lectures" className="btn btn-primary">
              <UploadCloud size={18} />
              Upload Lecture
            </Link>
            <Link to="/chat" className="btn btn-secondary">
              <Sparkles size={18} style={{ color: 'var(--primary)' }} />
              Ask AI
            </Link>
          </div>
        </div>
      </div>

      {/* 3 Stat Cards from Documentation */}
      <div className="stats-grid">
        {stats.map((st) => {
          const Icon = st.icon
          return (
            <div key={st.id} className="stat-card">
              <div className="stat-card-header">
                <div className={`stat-card-icon ${st.colorCls}`}>
                  <Icon size={22} />
                </div>
                <span className="badge badge-neutral">Overview</span>
              </div>
              <div className="stat-card-value">{st.value}</div>
              <div className="stat-card-label">{st.label}</div>
              <div className={`stat-card-trend ${st.trendType}`}>
                {st.trend}
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions Grid */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Quick Study Actions
        </div>
        <div className="quick-actions">
          <Link to="/lectures" className="quick-action">
            <div className="quick-action-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <UploadCloud size={24} />
            </div>
            <span className="quick-action-label">Upload Lecture</span>
          </Link>
          <Link to="/chat" className="quick-action">
            <div className="quick-action-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              <MessageSquare size={24} />
            </div>
            <span className="quick-action-label">RAG Study Chat</span>
          </Link>
          <Link to="/quiz" className="quick-action">
            <div className="quick-action-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
              <HelpCircle size={24} />
            </div>
            <span className="quick-action-label">Generate Quiz</span>
          </Link>
          <Link to="/modules" className="quick-action">
            <div className="quick-action-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <BookOpen size={24} />
            </div>
            <span className="quick-action-label">Browse Modules</span>
          </Link>
        </div>
      </div>

      {/* 2-Column Section: Modules In Progress & Recent Activity */}
      <div className="grid-2">
        {/* Modules Progress */}
        <div className="section-card">
          <div className="section-card-header">
            <h3>Active Study Modules</h3>
            <Link to="/modules" style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
              View All <ArrowUpRight size={14} />
            </Link>
          </div>
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {activeModules.map((mod) => (
              <div key={mod.id} style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--bg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{mod.title}</span>
                  <span className="badge badge-accent">{mod.progress}%</span>
                </div>
                <div className="progress-bar" style={{ marginBottom: 'var(--space-2)' }}>
                  <div className="progress-bar-fill" style={{ width: `${mod.progress}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  <span>{mod.lectures} lectures uploaded</span>
                  <span>Studied {mod.lastStudied}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="section-card">
          <div className="section-card-header">
            <h3>Recent Learning Activity</h3>
            <span className="badge badge-neutral">Live feed</span>
          </div>
          <div className="activity-list">
            {recentActivities.map((act) => {
              const Icon = act.icon
              return (
                <div key={act.id} className="activity-item">
                  <div className="activity-icon" style={{ background: act.bg, color: act.color }}>
                    <Icon size={18} />
                  </div>
                  <div className="activity-info">
                    <div className="activity-title">{act.title}</div>
                    <div className="activity-desc">{act.desc}</div>
                  </div>
                  <div className="activity-time">{act.time}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
