import { BookOpen, FileText, GraduationCap, Layers3, MessageSquare } from 'lucide-react'

export default function AuthVisual({ variant = 'login' }) {
  return (
    <aside className={`auth-visual auth-visual-${variant}`} aria-label="AI StudyMate introduction">
      <div className="auth-visual-overlay" />
      <div className="auth-visual-brand">
        <span className="auth-logo-icon"><GraduationCap size={25} /></span>
        <strong>AI StudyMate</strong>
      </div>
      <div className="auth-visual-copy">
        <span>YOUR MATERIALS. YOUR STUDY SPACE.</span>
        <h2>{variant === 'register' ? 'Start learning smarter.' : 'Study smarter with your own materials.'}</h2>
        <p>Turn lecture content into grounded answers, summaries, quizzes, flashcards, and focused review sessions.</p>
      </div>
      <div className="auth-visual-chips" aria-hidden="true">
        <span><MessageSquare size={14} />AI Chat</span>
        <span><FileText size={14} />Citations</span>
        <span><BookOpen size={14} />Summaries</span>
        <span><Layers3 size={14} />Flashcards</span>
      </div>
    </aside>
  )
}
