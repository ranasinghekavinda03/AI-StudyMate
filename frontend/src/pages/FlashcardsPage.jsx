import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, FileText, Layers3, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import api from '../api/api'
import { useAuth } from '../context/authContextValue'
import { moduleLabel } from './lectureDisplay'
import {
  FLASHCARD_COUNTS,
  FLASHCARD_DIFFICULTIES,
  FLASHCARD_DIFFICULTY_DETAILS,
  DUE_REVIEW_LIMIT,
  applyDueReview,
  buildFlashcardPayload,
  changeFlashcardModule,
  applyReviewResponse,
  countReviewStatuses,
  createCardReviewController,
  createDueReviewSession,
  createFlashcardGenerationController,
  flashcardErrorMessage,
  formatSavedSetDate,
  formatFlashcardSource,
  moveCard,
  normalizeDueResponse,
  normalizeSavedSet,
  normalizeSavedSets,
  resetFlashcardReview,
  remainingDueTotal,
  reviewStatusLabel,
  revealCard,
  savedFlashcardErrorMessage,
  savedSetLabel,
} from './flashcards'

function DueReviewMode({ token }) {
  const [cards, setCards] = useState([])
  const [dueTotal, setDueTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [session, setSession] = useState(createDueReviewSession)
  const [sessionBaseline, setSessionBaseline] = useState(0)
  const sessionCountRef = useRef(0)
  const [reviewController] = useState(createCardReviewController)
  const activeRef = useRef(false)

  const loadDue = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = normalizeDueResponse(await api.flashcards.getDue(DUE_REVIEW_LIMIT, token))
      setCards(response.cards)
      setDueTotal(response.total)
      setSessionBaseline(sessionCountRef.current)
      setRevealed(false)
      setReviewError('')
    } catch (loadError) {
      setError(savedFlashcardErrorMessage(loadError, 'Unable to load due flashcards. Please try again.'))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    let active = true
    api.flashcards.getDue(DUE_REVIEW_LIMIT, token).then(normalizeDueResponse).then((response) => {
      if (!active) return
      setCards(response.cards)
      setDueTotal(response.total)
      setSessionBaseline(sessionCountRef.current)
    }).catch((loadError) => {
      if (active) setError(savedFlashcardErrorMessage(loadError, 'Unable to load due flashcards. Please try again.'))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  const currentCard = cards[0]
  const reviewedThisSession = session.known + session.review_again
  const currentDueTotal = remainingDueTotal(dueTotal, reviewedThisSession - sessionBaseline)
  const reviewComplete = !loading && !error && cards.length === 0 && reviewedThisSession > 0
  const moreCardsDue = reviewComplete && currentDueTotal > 0

  async function reviewCard(status) {
    if (!currentCard || saving || activeRef.current) return
    activeRef.current = true
    setSaving(true)
    setReviewError('')
    try {
      const result = await reviewController.review({ cardId: currentCard.id, status, token, request: api.flashcards.review })
      if (!result.started) return
      const next = applyDueReview(cards, session, currentCard.id, status, result.response)
      setCards(next.cards)
      setSession(next.session)
      sessionCountRef.current += 1
      setRevealed(false)
    } catch (reviewFailure) {
      setReviewError(savedFlashcardErrorMessage(reviewFailure, 'Unable to save this review. Please try again.'))
    } finally {
      activeRef.current = false
      setSaving(false)
    }
  }

  if (loading) return <section className="flashcards-due-state" aria-label="Due flashcards"><div className="flashcards-due-loading" role="status"><Clock3 size={22} />Loading due flashcards...</div></section>
  if (error) return <section className="flashcards-due-state" aria-label="Due flashcards"><div className="auth-error flashcards-alert" role="alert">{error}</div><button type="button" className="btn btn-primary" onClick={loadDue}>Retry</button></section>

  if (!currentCard) {
    if (!reviewComplete) return <section className="flashcards-due-state flashcards-due-empty" aria-label="Due flashcards"><CheckCircle2 size={36} /><h2>0 cards due</h2><p>You're all caught up! No flashcards are due right now.</p></section>
    return (
      <section className="flashcards-due-state flashcards-due-complete" aria-label="Due review complete">
        <CheckCircle2 size={36} />
        <h2>Review complete</h2>
        <div className="flashcards-session-summary"><span>Known: <strong>{session.known}</strong></span><span>Review Again: <strong>{session.review_again}</strong></span><span>Reviewed this session: <strong>{reviewedThisSession}</strong></span></div>
        {moreCardsDue ? <><p>More cards are still due.</p><button type="button" className="btn btn-primary" onClick={loadDue}>Load Next Reviews</button></> : <p>You're all caught up for now.</p>}
      </section>
    )
  }

  return (
    <section className="flashcards-review flashcards-due-review" aria-label="Due flashcard review">
      <div className="flashcards-due-summary"><div><span className="flashcard-side-label">Due for Review</span><h2>{currentDueTotal} {currentDueTotal === 1 ? 'card' : 'cards'} due</h2></div><span className="badge badge-accent">{cards.length} loaded</span></div>
      {reviewError && <div className="auth-error flashcards-alert" role="alert">{reviewError}</div>}
      <article className="flashcard-card">
        <div className="flashcards-due-card-meta"><span>{currentCard.set_title || 'Saved flashcard set'}</span>{currentCard.review_count > 0 && <span>Reviews: {currentCard.review_count}</span>}</div>
        <span className="flashcard-side-label">Prompt</span>
        <h2>{currentCard.front}</h2>
        {!revealed ? <button type="button" className="btn btn-primary flashcard-reveal-button" onClick={() => setRevealed(true)}>Show Answer</button> : (
          <div className="flashcard-answer" role="status">
            <span className="flashcard-side-label">Answer</span>
            <p>{currentCard.back}</p>
            {currentCard.sources.length > 0 && <div className="flashcard-sources" aria-label="Card sources">{currentCard.sources.map((source) => <div className="flashcard-source" key={source.source_id}><FileText size={14} /><span>{formatFlashcardSource(source)}</span></div>)}</div>}
            <div className="flashcard-review-actions">
              <button type="button" className="btn btn-secondary" onClick={() => reviewCard('review_again')} disabled={saving}>Review Again</button>
              <button type="button" className="btn btn-primary" onClick={() => reviewCard('known')} disabled={saving}>I Know This</button>
            </div>
            {saving && <span className="flashcards-field-note" role="status">Saving...</span>}
          </div>
        )}
      </article>
      {reviewedThisSession > 0 && <div className="flashcards-due-progress" aria-label="Session review counts"><span>Known {session.known}</span><span>Review Again {session.review_again}</span><span>{reviewedThisSession} reviewed</span></div>}
    </section>
  )
}

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
  const [savedSets, setSavedSets] = useState([])
  const [savedSetsLoading, setSavedSetsLoading] = useState(true)
  const [savedSetsError, setSavedSetsError] = useState('')
  const [openingSetId, setOpeningSetId] = useState('')
  const [deletingSetId, setDeletingSetId] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [currentSetId, setCurrentSetId] = useState('')
  const [flashcards, setFlashcards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealedCards, setRevealedCards] = useState({})
  const [reviewSavingCardId, setReviewSavingCardId] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [pageMode, setPageMode] = useState('due')
  const generationActiveRef = useRef(false)
  const [generationController] = useState(createFlashcardGenerationController)
  const [reviewController] = useState(createCardReviewController)

  const loadSavedSets = useCallback(async () => {
    setSavedSetsLoading(true)
    setSavedSetsError('')
    try {
      setSavedSets(normalizeSavedSets(await api.flashcards.listSets(token)))
    } catch (error) {
      setSavedSetsError(savedFlashcardErrorMessage(error, 'Unable to load saved flashcard sets.'))
    } finally {
      setSavedSetsLoading(false)
    }
  }, [token])

  useEffect(() => {
    let active = true
    api.flashcards.listSets(token).then((data) => {
      if (active) setSavedSets(normalizeSavedSets(data))
    }).catch((error) => {
      if (active) setSavedSetsError(savedFlashcardErrorMessage(error, 'Unable to load saved flashcard sets.'))
    }).finally(() => { if (active) setSavedSetsLoading(false) })
    return () => { active = false }
  }, [token])

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
        setCurrentSetId(result.response.flashcard_set_id)
        setDifficulty(result.response.difficulty)
        setCurrentIndex(0)
        setRevealedCards({})
        await loadSavedSets()
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
    setCurrentSetId('')
    setCurrentIndex(reset.currentIndex)
    setRevealedCards(reset.revealedCards)
    setGenerationError('')
    setReviewError('')
  }

  async function openSavedSet(setId) {
    if (openingSetId) return
    setOpeningSetId(setId)
    setSavedSetsError('')
    try {
      const deck = normalizeSavedSet(await api.flashcards.getSet(setId, token))
      setCurrentSetId(deck.id)
      setDifficulty(deck.difficulty)
      setFlashcards(deck.flashcards)
      setCurrentIndex(0)
      setRevealedCards({})
      setReviewError('')
    } catch (error) {
      setSavedSetsError(savedFlashcardErrorMessage(error, 'Unable to open this saved flashcard set.'))
    } finally {
      setOpeningSetId('')
    }
  }

  async function updateReviewStatus(status) {
    if (!currentCard || reviewSavingCardId === currentCard.id) return
    const cardId = currentCard.id
    setReviewSavingCardId(cardId)
    setReviewError('')
    try {
      const result = await reviewController.review({ cardId, status, token, request: api.flashcards.review })
      if (result.started) setFlashcards((cards) => applyReviewResponse(cards, cardId, result.response))
    } catch (error) {
      setReviewError(savedFlashcardErrorMessage(error, 'Unable to save this review status. Please try again.'))
    } finally {
      setReviewSavingCardId('')
    }
  }

  async function deleteSavedSet(setId) {
    if (deletingSetId || !globalThis.confirm('Delete this saved flashcard set?')) return
    setDeletingSetId(setId)
    setDeleteError('')
    try {
      await api.flashcards.deleteSet(setId, token)
      setSavedSets((sets) => sets.filter((set) => set.id !== setId))
      if (currentSetId === setId) resetReview()
    } catch (error) {
      setDeleteError(savedFlashcardErrorMessage(error, 'Unable to delete this saved flashcard set.'))
    } finally {
      setDeletingSetId('')
    }
  }

  const currentCard = flashcards[currentIndex]
  const answerRevealed = currentCard ? Boolean(revealedCards[currentCard.id]) : false
  const reviewComplete = Boolean(currentCard && currentIndex === flashcards.length - 1 && answerRevealed)
  const reviewCounts = countReviewStatuses(flashcards)

  return (
    <div className="flashcards-page stagger-children">
      <div className="page-header flashcards-page-header">
        <h1>Flashcards</h1>
        <p>Review cards when they are due or work with your saved sets.</p>
      </div>

      <div className="flashcards-mode-switch" aria-label="Flashcard mode">
        <button type="button" className={pageMode === 'due' ? 'active' : ''} aria-pressed={pageMode === 'due'} onClick={() => setPageMode('due')}><Clock3 size={17} />Due for Review</button>
        <button type="button" className={pageMode === 'library' ? 'active' : ''} aria-pressed={pageMode === 'library'} onClick={() => setPageMode('library')}><Layers3 size={17} />Saved Sets &amp; Generator</button>
      </div>

      {pageMode === 'due' ? <DueReviewMode token={token} /> : <>

      <section className="flashcards-saved" aria-label="Saved flashcard sets">
        <div className="flashcards-saved-header"><div><h2>Saved Sets</h2><p>Reopen a persisted deck and continue reviewing.</p></div></div>
        {savedSetsError && <div className="auth-error flashcards-alert" role="alert">{savedSetsError}</div>}
        {deleteError && <div className="auth-error flashcards-alert" role="alert">{deleteError}</div>}
        {savedSetsLoading ? <p className="flashcards-saved-empty" role="status">Loading saved flashcard sets...</p> : savedSets.length === 0 ? <p className="flashcards-saved-empty">No saved flashcard sets yet.</p> : (
          <div className="flashcards-saved-list">
            {savedSets.map((set) => (
              <div className={`flashcards-saved-item ${currentSetId === set.id ? 'active' : ''}`} key={set.id}>
                <button type="button" className="flashcards-saved-open" onClick={() => openSavedSet(set.id)} disabled={Boolean(openingSetId || deletingSetId)}>
                  <strong>{savedSetLabel(set)}</strong>
                  <span>{set.card_count} cards · {set.difficulty} · {formatSavedSetDate(set.created_at)}</span>
                </button>
                <button type="button" className="btn btn-ghost btn-sm flashcards-saved-delete" aria-label={`Delete ${savedSetLabel(set)}`} onClick={() => deleteSavedSet(set.id)} disabled={Boolean(deletingSetId || openingSetId)}><Trash2 size={15} />{deletingSetId === set.id ? 'Deleting...' : 'Delete'}</button>
              </div>
            ))}
          </div>
        )}
      </section>

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
          <div className="flashcards-review-header"><span>Card {currentIndex + 1} of {flashcards.length}</span><div className="flashcards-review-badges"><span className="badge">{reviewStatusLabel(currentCard.review_status)}</span><span className="badge badge-accent">{difficulty}</span></div></div>
          {reviewError && <div className="auth-error flashcards-alert" role="alert">{reviewError}</div>}
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
                <div className="flashcard-review-status">Status: <strong>{reviewStatusLabel(currentCard.review_status)}</strong>{currentCard.review_count > 0 && <span> · Reviewed {currentCard.review_count} {currentCard.review_count === 1 ? 'time' : 'times'}</span>}</div>
                <div className="flashcard-review-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => updateReviewStatus('review_again')} disabled={reviewSavingCardId === currentCard.id}>Review Again</button>
                  <button type="button" className="btn btn-primary" onClick={() => updateReviewStatus('known')} disabled={reviewSavingCardId === currentCard.id}>I Know This</button>
                </div>
                {reviewSavingCardId === currentCard.id && <span className="flashcards-field-note" role="status">Saving...</span>}
              </div>
            )}
          </article>
          <div className="flashcards-navigation">
            <button type="button" className="btn btn-secondary" onClick={() => setCurrentIndex((index) => moveCard(index, -1, flashcards.length))} disabled={currentIndex === 0}><ArrowLeft size={16} /> Previous</button>
            <button type="button" className="btn btn-primary" onClick={() => setCurrentIndex((index) => moveCard(index, 1, flashcards.length))} disabled={currentIndex === flashcards.length - 1}>Next <ArrowRight size={16} /></button>
          </div>
          {reviewComplete && <div className="flashcards-complete" role="status"><CheckCircle2 size={28} /><div><h3>Flashcard Review Complete</h3><p>Known: {reviewCounts.known} · Review Again: {reviewCounts.review_again} · Unreviewed: {reviewCounts.unreviewed}</p></div></div>}
          <button type="button" className="btn btn-ghost flashcards-reset-button" onClick={resetReview}><RotateCcw size={16} /> Generate Another Set</button>
        </section>
      )}
      </>}
    </div>
  )
}
