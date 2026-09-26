import { useEffect, useRef, useState } from 'react'
import { BookOpen, FileText, Sparkles } from 'lucide-react'
import api from '../api/api'
import { useAuth } from '../context/authContextValue'
import { moduleLabel } from './lectureDisplay'
import {
  SUMMARY_TYPES,
  SUMMARY_TYPE_DETAILS,
  buildSummaryPayload,
  changeSummaryModule,
  createSummaryGenerationController,
  formatSummarySource,
  summaryErrorMessage,
} from './summary'

function SourceIds({ sourceIds }) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) return null
  return <span className="summary-source-ids">{sourceIds.join(', ')}</span>
}

export default function SummaryPage() {
  const { token } = useAuth()
  const [modules, setModules] = useState([])
  const [lectures, setLectures] = useState([])
  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [selectedLectureId, setSelectedLectureId] = useState('')
  const [summaryType, setSummaryType] = useState('standard')
  const [scopeLoading, setScopeLoading] = useState(true)
  const [scopeError, setScopeError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [summary, setSummary] = useState(null)
  const generationActiveRef = useRef(false)
  const [generationController] = useState(createSummaryGenerationController)

  useEffect(() => {
    let active = true
    api.modules.list(token).then((data) => {
      if (!Array.isArray(data)) throw new Error('The server returned an invalid module list.')
      if (active) setModules(data)
    }).catch((error) => { if (active) setScopeError(error.message || 'Unable to load modules.') })
    return () => { active = false }
  }, [token])

  useEffect(() => {
    let active = true
    api.lectures.list(selectedModuleId || null, token).then((data) => {
      if (!Array.isArray(data)) throw new Error('The server returned an invalid lecture list.')
      if (active) setLectures(data)
    }).catch((error) => {
      if (active) {
        setLectures([])
        setScopeError(error.message || 'Unable to load lectures.')
      }
    }).finally(() => { if (active) setScopeLoading(false) })
    return () => { active = false }
  }, [selectedModuleId, token])

  function handleModuleChange(moduleId) {
    const next = changeSummaryModule(moduleId)
    setSelectedModuleId(next.selectedModuleId)
    setSelectedLectureId(next.selectedLectureId)
    setLectures([])
    setScopeLoading(true)
    setScopeError('')
  }

  async function handleGenerate() {
    if (generationActiveRef.current) return
    let payload
    try {
      payload = buildSummaryPayload({ moduleId: selectedModuleId, lectureId: selectedLectureId, summaryType })
    } catch (error) {
      setGenerationError(error.message)
      return
    }
    generationActiveRef.current = true
    setGenerating(true)
    setGenerationError('')
    try {
      const result = await generationController.generate({ payload, token, request: api.summaries.generate })
      if (result.started) setSummary(result.response)
    } catch (error) {
      setGenerationError(summaryErrorMessage(error))
    } finally {
      generationActiveRef.current = false
      setGenerating(false)
    }
  }

  return (
    <div className="summary-page stagger-children">
      <div className="page-header summary-page-header">
        <h1>Study Summary Generator</h1>
        <p>Create a grounded summary from your uploaded study materials.</p>
      </div>

      <section className="summary-controls" aria-label="Summary options">
        {scopeError && <div className="auth-error summary-alert" role="alert">{scopeError}</div>}
        {generationError && <div className="auth-error summary-alert" role="alert">{generationError}</div>}
        <div className="summary-scope-grid">
          <div className="input-group">
            <label htmlFor="summary-module">Module</label>
            <select id="summary-module" className="input" value={selectedModuleId} onChange={(event) => handleModuleChange(event.target.value)} disabled={generating}>
              <option value="">All modules</option>
              {modules.map((module) => <option key={module.id} value={module.id}>{moduleLabel(module)}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label htmlFor="summary-lecture">Lecture</label>
            <select id="summary-lecture" className="input" value={selectedLectureId} onChange={(event) => setSelectedLectureId(event.target.value)} disabled={generating || scopeLoading}>
              <option value="">All lectures</option>
              {lectures.map((lecture) => <option key={lecture.id} value={lecture.id}>{lecture.title}</option>)}
            </select>
            {scopeLoading && <span className="summary-field-note" role="status">Loading lectures...</span>}
          </div>
        </div>

        <fieldset className="summary-fieldset" disabled={generating}>
          <legend>Summary type</legend>
          <div className="summary-type-grid">
            {SUMMARY_TYPES.map((type) => (
              <button key={type} type="button" className={`summary-type-option ${summaryType === type ? 'selected' : ''}`} onClick={() => setSummaryType(type)} aria-pressed={summaryType === type}>
                <span>{type}</span><small>{SUMMARY_TYPE_DETAILS[type]}</small>
              </button>
            ))}
          </div>
        </fieldset>
        {generating && <div className="summary-generating" role="status"><Sparkles size={16} className="animate-spin" /> Generating summary from your study materials...</div>}
        <button type="button" className="btn btn-primary summary-generate-button" onClick={handleGenerate} disabled={generating}>
          <Sparkles size={17} /> {generating ? 'Generating...' : 'Generate Summary'}
        </button>
      </section>

      {summary && (
        <article className="summary-result">
          <header className="summary-result-header">
            <div><span className="summary-eyebrow">{summary.summary_type} Summary</span><h2>{summary.title}</h2></div>
            <BookOpen size={24} />
          </header>
          <section className="summary-section"><h3>Overview</h3><p className="summary-overview">{summary.overview}</p></section>
          <section className="summary-section">
            <h3>Key Points</h3>
            <ul className="summary-points">{summary.key_points.map((point, index) => <li key={`${index}-${point.text}`}><span>{point.text}</span><SourceIds sourceIds={point.source_ids} /></li>)}</ul>
          </section>
          {summary.important_terms.length > 0 && <section className="summary-section"><h3>Important Terms</h3><dl className="summary-terms">{summary.important_terms.map((item, index) => <div key={`${index}-${item.term}`}><dt>{item.term}<SourceIds sourceIds={item.source_ids} /></dt><dd>{item.definition}</dd></div>)}</dl></section>}
          {summary.concept_relationships.length > 0 && <section className="summary-section"><h3>Concept Relationships</h3><ul className="summary-points">{summary.concept_relationships.map((item, index) => <li key={`${index}-${item.text}`}><span>{item.text}</span><SourceIds sourceIds={item.source_ids} /></li>)}</ul></section>}
          {summary.sources.length > 0 && <section className="summary-section"><h3>Sources</h3><div className="summary-sources">{summary.sources.map((source) => <div className="summary-source" key={`${source.source_id}-${source.chunk_id}`}><FileText size={14} /><span>{formatSummarySource(source)}</span></div>)}</div></section>}
        </article>
      )}
    </div>
  )
}
