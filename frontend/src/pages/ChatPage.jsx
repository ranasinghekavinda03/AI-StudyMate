import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, FileText, Info, Send, Sparkles } from 'lucide-react'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import { moduleLabel } from './lectureDisplay'
import { canSubmitChat, formatCitationLabel, submitChatQuestion } from './chat'

const PROMPT_SUGGESTIONS = [
  'Explain early stopping',
  'What does this lecture say about overfitting?',
]

export default function ChatPage() {
  const { user, token } = useAuth()
  const [modules, setModules] = useState([])
  const [lectures, setLectures] = useState([])
  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [selectedLectureId, setSelectedLectureId] = useState('')
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [contextLoading, setContextLoading] = useState(true)
  const [contextError, setContextError] = useState('')
  const sendInFlight = useRef(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    let active = true
    async function loadModules() {
      try {
        const data = await api.modules.list(token)
        if (!Array.isArray(data)) throw new Error('The server returned an invalid module list.')
        if (active) setModules(data)
      } catch (requestError) {
        if (active) setContextError(requestError.message || 'Unable to load modules.')
      }
    }
    loadModules()
    return () => { active = false }
  }, [token])

  useEffect(() => {
    let active = true
    async function loadLectures() {
      try {
        const data = await api.lectures.list(selectedModuleId || null, token)
        if (!Array.isArray(data)) throw new Error('The server returned an invalid lecture list.')
        if (active) setLectures(data)
      } catch (requestError) {
        if (active) {
          setLectures([])
          setContextError(requestError.message || 'Unable to load lectures.')
        }
      } finally {
        if (active) setContextLoading(false)
      }
    }
    loadLectures()
    return () => { active = false }
  }, [selectedModuleId, token])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending, error])

  const selectedLecture = useMemo(
    () => lectures.find((lecture) => lecture.id === selectedLectureId) || null,
    [lectures, selectedLectureId],
  )

  function handleModuleChange(moduleId) {
    setSelectedModuleId(moduleId)
    setSelectedLectureId('')
    setLectures([])
    setContextLoading(true)
    setContextError('')
  }

  async function handleSendMessage(textToSend) {
    if (sendInFlight.current) return
    const question = typeof textToSend === 'string' ? textToSend : inputText
    if (!canSubmitChat(question, sending)) return

    sendInFlight.current = true
    setSending(true)
    setError('')
    try {
      await submitChatQuestion({
        question,
        moduleId: selectedModuleId,
        lectureId: selectedLectureId,
        token,
        chatRequest: api.rag.chat,
        onUserMessage: (message) => setMessages((current) => [...current, message]),
        onAssistantMessage: (message) => setMessages((current) => [...current, message]),
      })
      setInputText('')
    } catch (requestError) {
      setError(requestError.message || 'Unable to answer right now. Please try again.')
    } finally {
      sendInFlight.current = false
      setSending(false)
    }
  }

  const initials = user?.name
    ? user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    : 'ME'

  return (
    <div className="stagger-children">
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="page-header-actions">
          <div>
            <h1>RAG-Powered AI Study Chat</h1>
            <p>Ask questions grounded in your uploaded study materials and inspect the supporting sources.</p>
          </div>
          <div className="badge badge-accent"><Sparkles size={14} /> Grounded answers</div>
        </div>
      </div>

      <div className="chat-layout">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <div className="chat-context-heading">Active Knowledge Context</div>
            <label className="chat-filter-label" htmlFor="chat-module">Module</label>
            <select
              id="chat-module"
              className="chat-filter-select"
              value={selectedModuleId}
              onChange={(event) => handleModuleChange(event.target.value)}
              disabled={sending}
            >
              <option value="">All modules</option>
              {modules.map((module) => <option key={module.id} value={module.id}>{moduleLabel(module)}</option>)}
            </select>
          </div>

          <div className="chat-sidebar-list" aria-label="Lecture filter">
            <button
              type="button"
              className={`chat-sidebar-item ${selectedLectureId === '' ? 'active' : ''}`}
              onClick={() => setSelectedLectureId('')}
              disabled={sending}
            >
              <span className="chat-sidebar-item-icon"><BookOpen size={18} /></span>
              <span className="chat-sidebar-item-info">
                <span className="chat-sidebar-item-title">All lectures</span>
                <span className="chat-sidebar-item-module">Search the selected module scope</span>
              </span>
            </button>
            {contextLoading ? (
              <div className="chat-context-status">Loading lectures...</div>
            ) : contextError ? (
              <div className="chat-context-status chat-context-error" role="alert">{contextError}</div>
            ) : lectures.length === 0 ? (
              <div className="chat-context-status">No uploaded lectures in this scope.</div>
            ) : lectures.map((lecture) => (
              <button
                type="button"
                key={lecture.id}
                className={`chat-sidebar-item ${selectedLectureId === lecture.id ? 'active' : ''}`}
                onClick={() => setSelectedLectureId(lecture.id)}
                disabled={sending}
              >
                <span className="chat-sidebar-item-icon"><FileText size={18} /></span>
                <span className="chat-sidebar-item-info">
                  <span className="chat-sidebar-item-title">{lecture.title}</span>
                  <span className="chat-sidebar-item-module">{lecture.file_type?.toUpperCase() || 'FILE'} · {lecture.chunks_count ?? 0} chunks</span>
                </span>
              </button>
            ))}
          </div>

          <div className="chat-sidebar-note">
            <Info size={14} />
            <span>PDF sources show real pages. TXT and DOCX sources do not invent page numbers.</span>
          </div>
        </aside>

        <section className="chat-main">
          <div className="chat-messages" aria-live="polite">
            {messages.length === 0 && !sending && (
              <div className="chat-empty-state">
                <div className="empty-state-icon"><BookOpen size={24} /></div>
                <div className="empty-state-title">Ask about your uploaded lecture materials</div>
                <div className="empty-state-desc">Answers are generated independently from the context selected on the left.</div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`chat-message ${message.role === 'assistant' ? 'ai' : 'user'}`}>
                <div className="chat-message-avatar">
                  <div className={`avatar avatar-sm ${message.role === 'assistant' ? 'avatar-accent' : 'avatar-primary'}`}>
                    {message.role === 'assistant' ? 'AI' : initials}
                  </div>
                </div>
                <div className="chat-message-body">
                  <div className="chat-message-content" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
                  {message.citations.length > 0 && (
                    <div className="chat-citations" aria-label="Answer sources">
                      {message.citations.map((citation) => (
                        <details className="chat-source-card" key={`${message.id}-${citation.source_id}`}>
                          <summary><BookOpen size={13} /> {formatCitationLabel(citation)}</summary>
                          <p>{citation.excerpt}</p>
                        </details>
                      ))}
                    </div>
                  )}
                  <span className="chat-message-time">{message.time}</span>
                </div>
              </div>
            ))}

            {sending && (
              <div className="chat-message ai" role="status">
                <div className="avatar avatar-sm avatar-accent">AI</div>
                <div className="chat-message-content animate-pulse chat-thinking">
                  <Sparkles size={16} className="animate-spin" /> Searching your study materials...
                </div>
              </div>
            )}
            {error && <div className="auth-error chat-error" role="alert">{error}</div>}
            <div ref={messagesEndRef} />
          </div>

          {messages.length === 0 && (
            <div className="chat-suggestions">
              {PROMPT_SUGGESTIONS.map((prompt) => (
                <button key={prompt} type="button" className="btn btn-secondary btn-sm" onClick={() => handleSendMessage(prompt)} disabled={sending}>
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div className="chat-input-bar">
            <div className="chat-input-wrapper">
              <textarea
                className="chat-input"
                rows={1}
                aria-label="Study question"
                placeholder={selectedLecture ? `Ask about ${selectedLecture.title}...` : 'Ask about your uploaded study materials...'}
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSendMessage()
                  }
                }}
                disabled={sending}
              />
            </div>
            <button type="button" className="chat-send-btn" onClick={() => handleSendMessage()} disabled={!canSubmitChat(inputText, sending)} aria-label="Send message">
              <Send size={18} />
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
