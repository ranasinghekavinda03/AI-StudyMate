import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, RotateCcw, Sparkles } from 'lucide-react'
import api from '../api/api'
import { useAuth } from '../context/authContextValue'
import { moduleLabel } from './lectureDisplay'
import {
  FLASHCARD_COUNTS,
  FLASHCARD_DIFFICULTIES,
  FLASHCARD_DIFFICULTY_DETAILS,
  buildFlashcardPayload,
  changeFlashcardModule,
  createFlashcardGenerationController,
  flashcardErrorMessage,
  formatFlashcardSource,
  moveCard,
  resetFlashcardReview,
  revealCard,
} from './flashcards'

export default function FlashcardsPage() {
  const { token } = useAuth()
  const [modules, setModules] = useState([])
  const [lectures, setLectures] = useState([])
  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [selectedLectureId, setSelectedLectureId] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [flashcardCount, setFlashcardCount] = useState(10)
  const [scopeLoading, setScopeLoading] = useState(true)
  const [scopeError, setScopeError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [flashcards, setFlashcards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealedCards, setRevealedCards] = useState({})
  const generationActiveRef = useRef(false)
  const [generationController] = useState(createFlashcardGenerationController)

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
    const next = changeFlashcardModule(moduleId)
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
      payload = buildFlashcardPayload({ moduleId: selectedModuleId, lectureId: selectedLectureId, flashcardCount, difficulty })
    } catch (error) {
      setGenerationError(error.message)
      return
    }
    generationActiveRef.current = true
    setGenerating(true)
    setGenerationError('')
    try {
      const result = await generationController.generate({ payload, token, request: api.flashcards.generate })
      if (result.started) {
        setFlashcards(result.response.flashcards)
        setCurrentIndex(0)
        setRevealedCards({})
      }
    } catch (error) {
      setGenerationError(flashcardErrorMessage(error))
    } finally {
      generationActiveRef.current = false
      setGenerating(false)
    }
  }

  function resetReview() {
    const reset = resetFlashcardReview()
    setFlashcards(reset.flashcards)
    setCurrentIndex(reset.currentIndex)
    setRevealedCards(reset.revealedCards)
    setGenerationError('')
  }

  const currentCard = flashcards[currentIndex]
  const answerRevealed = currentCard ? Boolean(revealedCards[currentCard.id]) : false
  const reviewComplete = Boolean(currentCard && currentIndex === flashcards.length - 1 && answerRevealed)

  return (
    <div className="flashcards-page stagger-children">
      <div className="page-header flashcards-page-header">
        <h1>Grounded Flashcard Generator</h1>
        <p>Create focused review cards from your uploaded study materials.</p>
      </div>

      {flashcards.length === 0 ? (
        <section className="flashcards-controls" aria-label="Flashcard options">
          {scopeError && <div className="auth-error flashcards-alert" role="alert">{scopeError}</div>}
          {generationError && <div className="auth-error flashcards-alert" role="alert">{generationError}</div>}
          <div className="flashcards-scope-grid">
            <div className="input-group">
              <label htmlFor="flashcards-module">Module</label>
              <select id="flashcards-module" className="input" value={selectedModuleId} onChange={(event) => handleModuleChange(event.target.value)} disabled={generating}>
                <option value="">All modules</option>
                {modules.map((module) => <option key={module.id} value={module.id}>{moduleLabel(module)}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label htmlFor="flashcards-lecture">Lecture</label>
              <select id="flashcards-lecture" className="input" value={selectedLectureId} onChange={(event) => setSelectedLectureId(event.target.value)} disabled={generating || scopeLoading}>
                <option value="">All lectures</option>
                {lectures.map((lecture) => <option key={lecture.id} value={lecture.id}>{lecture.title}</option>)}
              </select>
              {scopeLoading && <span className="flashcards-field-note" role="status">Loading lectures...</span>}
            </div>
          </div>

          <fieldset className="flashcards-fieldset" disabled={generating}>
            <legend>Difficulty</legend>
            <div className="flashcards-difficulty-grid">
              {FLASHCARD_DIFFICULTIES.map((value) => <button key={value} type="button" className={`flashcards-difficulty ${difficulty === value ? 'selected' : ''}`} onClick={() => setDifficulty(value)} aria-pressed={difficulty === value}><span>{value}</span><small>{FLASHCARD_DIFFICULTY_DETAILS[value]}</small></button>)}
            </div>
          </fieldset>

          <div className="input-group flashcards-count-field">
            <label htmlFor="flashcards-count">Number of cards</label>
            <select id="flashcards-count" className="input" value={flashcardCount} onChange={(event) => setFlashcardCount(Number(event.target.value))} disabled={generating}>
              {FLASHCARD_COUNTS.map((count) => <option key={count} value={count}>{count} cards</option>)}
            </select>
          </div>
          {generating && <div className="flashcards-generating" role="status"><Sparkles size={16} className="animate-spin" /> Generating flashcards from your study materials...</div>}
          <button type="button" className="btn btn-primary flashcards-generate-button" onClick={handleGenerate} disabled={generating}><Sparkles size={17} /> {generating ? 'Generating...' : 'Generate Flashcards'}</button>
        </section>
      ) : (
        <section className="flashcards-review" aria-label="Flashcard review">
          <div className="flashcards-review-header"><span>Card {currentIndex + 1} of {flashcards.length}</span><span className="badge badge-accent">{difficulty}</span></div>
          <article className="flashcard-card">
            <span className="flashcard-side-label">Prompt</span>
            <h2>{currentCard.front}</h2>
            {!answerRevealed ? (
              <button type="button" className="btn btn-primary flashcard-reveal-button" onClick={() => setRevealedCards((current) => revealCard(current, currentCard.id))}>Show Answer</button>
            ) : (
              <div className="flashcard-answer" role="status">
                <span className="flashcard-side-label">Answer</span>
                <p>{currentCard.back}</p>
                {currentCard.sources.length > 0 && <div className="flashcard-sources" aria-label="Card sources">{currentCard.sources.map((source) => <div className="flashcard-source" key={`${source.source_id}-${source.chunk_id}`}><FileText size={14} /><span>{formatFlashcardSource(source)}</span></div>)}</div>}
              </div>
            )}
          </article>
          <div className="flashcards-navigation">
            <button type="button" className="btn btn-secondary" onClick={() => setCurrentIndex((index) => moveCard(index, -1, flashcards.length))} disabled={currentIndex === 0}><ArrowLeft size={16} /> Previous</button>
            <button type="button" className="btn btn-primary" onClick={() => setCurrentIndex((index) => moveCard(index, 1, flashcards.length))} disabled={currentIndex === flashcards.length - 1}>Next <ArrowRight size={16} /></button>
          </div>
          {reviewComplete && <div className="flashcards-complete" role="status"><CheckCircle2 size={28} /><div><h3>Flashcard Review Complete</h3><p>You reached the end of this set.</p></div></div>}
          <button type="button" className="btn btn-ghost flashcards-reset-button" onClick={resetReview}><RotateCcw size={16} /> Generate Another Set</button>
        </section>
      )}
    </div>
  )
}
