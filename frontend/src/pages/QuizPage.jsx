import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react'
import api from '../api/api'
import { useAuth } from '../context/authContextValue'
import { moduleLabel } from './lectureDisplay'
import {
  QUIZ_DIFFICULTIES,
  QUIZ_QUESTION_COUNTS,
  buildQuizPayload,
  calculateQuizScore,
  changeQuizModule,
  createQuizGenerationController,
  formatQuizSource,
  isAnswerCorrect,
  quizErrorMessage,
  resetQuizState,
  selectSingleAnswer,
} from './quiz'

const DIFFICULTY_DETAILS = {
  easy: 'Recall & Definitions',
  medium: 'Conceptual & Applied',
  hard: 'Advanced Reasoning',
}

function DifficultyBadge({ difficulty }) {
  const badgeClass = difficulty === 'easy'
    ? 'badge-accent'
    : difficulty === 'medium' ? 'badge-warning' : 'badge-danger'
  return <span className={`badge ${badgeClass}`}>{difficulty}</span>
}

function SourceList({ sources, label = 'Question sources' }) {
  if (!sources.length) return null
  return (
    <div className="quiz-sources" aria-label={label}>
      {sources.map((source) => (
        <div className="quiz-source-card" key={`${source.source_id}-${source.chunk_id}`}>
          <BookOpen size={14} />
          <span>{formatQuizSource(source)}</span>
        </div>
      ))}
    </div>
  )
}

export default function QuizPage() {
  const { token } = useAuth()
  const [phase, setPhase] = useState('setup')
  const [modules, setModules] = useState([])
  const [lectures, setLectures] = useState([])
  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [selectedLectureId, setSelectedLectureId] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [questionCount, setQuestionCount] = useState(5)
  const [scopeLoading, setScopeLoading] = useState(true)
  const [scopeError, setScopeError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState({})
  const [checkedAnswers, setCheckedAnswers] = useState({})
  const generationActiveRef = useRef(false)
  const [generationController] = useState(createQuizGenerationController)

  useEffect(() => {
    let active = true
    async function loadModules() {
      try {
        const data = await api.modules.list(token)
        if (!Array.isArray(data)) throw new Error('The server returned an invalid module list.')
        if (active) setModules(data)
      } catch (error) {
        if (active) setScopeError(error.message || 'Unable to load modules.')
      }
    }
    loadModules()
    return () => { active = false }
  }, [token])

  useEffect(() => {
    let active = true
    async function loadLectures() {
      setScopeLoading(true)
      try {
        const data = await api.lectures.list(selectedModuleId || null, token)
        if (!Array.isArray(data)) throw new Error('The server returned an invalid lecture list.')
        if (active) setLectures(data)
      } catch (error) {
        if (active) {
          setLectures([])
          setScopeError(error.message || 'Unable to load lectures.')
        }
      } finally {
        if (active) setScopeLoading(false)
      }
    }
    loadLectures()
    return () => { active = false }
  }, [selectedModuleId, token])

  const currentQuestion = questions[currentIndex]
  const currentSelection = selectedAnswers[currentIndex]
  const currentChecked = Boolean(checkedAnswers[currentIndex])
  const score = useMemo(
    () => calculateQuizScore(questions, selectedAnswers),
    [questions, selectedAnswers],
  )
  const progressPercent = questions.length ? ((currentIndex + 1) / questions.length) * 100 : 0

  function handleModuleChange(moduleId) {
    const nextSelection = changeQuizModule(moduleId)
    setSelectedModuleId(nextSelection.selectedModuleId)
    setSelectedLectureId(nextSelection.selectedLectureId)
    setLectures([])
    setScopeError('')
  }

  async function handleGenerate() {
    if (generationActiveRef.current) return
    let payload
    try {
      payload = buildQuizPayload({
        moduleId: selectedModuleId,
        lectureId: selectedLectureId,
        difficulty,
        questionCount,
      })
    } catch (error) {
      setGenerationError(error.message)
      return
    }

    generationActiveRef.current = true
    setGenerating(true)
    setGenerationError('')
    try {
      const result = await generationController.generate({
        payload,
        token,
        request: api.quiz.generate,
      })
      if (!result.started) return
      const response = result.response
      setQuestions(response.questions)
      setCurrentIndex(0)
      setSelectedAnswers({})
      setCheckedAnswers({})
      setPhase('taking')
    } catch (error) {
      setGenerationError(quizErrorMessage(error))
    } finally {
      generationActiveRef.current = false
      setGenerating(false)
    }
  }

  function handleSelectOption(optionIndex) {
    if (currentChecked) return
    setSelectedAnswers((answers) => selectSingleAnswer(answers, currentIndex, optionIndex))
  }

  function checkAnswer() {
    if (currentSelection === undefined) return
    setCheckedAnswers((answers) => ({ ...answers, [currentIndex]: true }))
  }

  function handleNext() {
    if (!currentChecked) return
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((index) => index + 1)
    } else {
      setPhase('results')
    }
  }

  function resetQuiz() {
    const reset = resetQuizState()
    setQuestions(reset.questions)
    setSelectedAnswers(reset.selectedAnswers)
    setCheckedAnswers(reset.checkedAnswers)
    setCurrentIndex(reset.currentIndex)
    setGenerationError('')
    setPhase('setup')
  }

  return (
    <div className="stagger-children">
      {phase === 'setup' && (
        <div className="quiz-setup">
          <div className="page-header quiz-page-header">
            <h1>Interactive Quiz Generator</h1>
            <p>Generate multiple-choice quizzes grounded directly in your uploaded notes.</p>
          </div>

          <div className="quiz-setup-card">
            {scopeError && <div className="auth-error quiz-alert" role="alert">{scopeError}</div>}
            {generationError && <div className="auth-error quiz-alert" role="alert">{generationError}</div>}

            <div className="quiz-scope-grid">
              <div className="input-group">
                <label htmlFor="quiz-module">Module</label>
                <select
                  id="quiz-module"
                  className="input"
                  value={selectedModuleId}
                  onChange={(event) => handleModuleChange(event.target.value)}
                  disabled={generating}
                >
                  <option value="">All modules</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>{moduleLabel(module)}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label htmlFor="quiz-lecture">Lecture</label>
                <select
                  id="quiz-lecture"
                  className="input"
                  value={selectedLectureId}
                  onChange={(event) => setSelectedLectureId(event.target.value)}
                  disabled={generating || scopeLoading}
                >
                  <option value="">All lectures</option>
                  {lectures.map((lecture) => (
                    <option key={lecture.id} value={lecture.id}>{lecture.title}</option>
                  ))}
                </select>
                {scopeLoading && <span className="quiz-field-note" role="status">Loading lectures...</span>}
              </div>
            </div>

            <fieldset className="quiz-fieldset" disabled={generating}>
              <legend>Difficulty</legend>
              <div className="quiz-option-grid">
                {QUIZ_DIFFICULTIES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`quiz-option ${value} ${difficulty === value ? 'selected' : ''}`}
                    onClick={() => setDifficulty(value)}
                    aria-pressed={difficulty === value}
                  >
                    <span className="quiz-option-title">{value}</span>
                    <span>{DIFFICULTY_DETAILS[value]}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="input-group quiz-count-field">
              <label htmlFor="quiz-question-count">Number of questions</label>
              <select
                id="quiz-question-count"
                className="input"
                value={questionCount}
                onChange={(event) => setQuestionCount(Number(event.target.value))}
                disabled={generating}
              >
                {QUIZ_QUESTION_COUNTS.map((count) => (
                  <option key={count} value={count}>{count} questions</option>
                ))}
              </select>
            </div>

            {generating && (
              <div className="quiz-generating" role="status">
                <Sparkles size={18} className="animate-spin" />
                Generating questions from your study materials...
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary btn-lg quiz-generate-button"
              onClick={handleGenerate}
              disabled={generating || scopeLoading}
            >
              <Sparkles size={18} />
              {generating ? 'Generating Quiz...' : 'Generate Quiz'}
            </button>
          </div>
        </div>
      )}

      {phase === 'taking' && currentQuestion && (
        <div className="quiz-container">
          <div className="quiz-progress-bar" aria-hidden="true">
            <div className="quiz-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="card quiz-question-card">
            <div className="quiz-question-header">
              <span className="quiz-question-number">Question {currentIndex + 1} of {questions.length}</span>
              <DifficultyBadge difficulty={difficulty} />
            </div>

            <h2 className="quiz-question-text">{currentQuestion.question_text}</h2>
            <div className="quiz-answers" role="radiogroup" aria-label={`Answers for question ${currentIndex + 1}`}>
              {currentQuestion.options.map((option, optionIndex) => {
                const selected = currentSelection === optionIndex
                const correct = currentChecked && currentQuestion.correct_answers[0] === optionIndex
                const incorrect = currentChecked && selected && !correct
                const classes = ['quiz-answer', selected ? 'selected' : '', correct ? 'correct' : '', incorrect ? 'incorrect' : ''].filter(Boolean).join(' ')
                return (
                  <button
                    key={optionIndex}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={classes}
                    onClick={() => handleSelectOption(optionIndex)}
                    disabled={currentChecked}
                  >
                    <span className="quiz-answer-letter">{String.fromCharCode(65 + optionIndex)}</span>
                    <span>{option}</span>
                  </button>
                )
              })}
            </div>

            {!currentChecked ? (
              <button
                type="button"
                className="btn btn-primary quiz-check-button"
                onClick={checkAnswer}
                disabled={currentSelection === undefined}
              >
                Check Answer
              </button>
            ) : (
              <div className={`quiz-feedback ${isAnswerCorrect(currentQuestion, currentSelection) ? 'correct' : 'incorrect'}`} role="status">
                <div className="quiz-feedback-title">
                  {isAnswerCorrect(currentQuestion, currentSelection)
                    ? <><CheckCircle2 size={20} /> Correct</>
                    : <><XCircle size={20} /> Incorrect</>}
                </div>
                {!isAnswerCorrect(currentQuestion, currentSelection) && (
                  <p>Correct answer: <strong>{currentQuestion.options[currentQuestion.correct_answers[0]]}</strong></p>
                )}
                <p><strong>Explanation:</strong> {currentQuestion.explanation}</p>
                <SourceList sources={currentQuestion.sources} />
              </div>
            )}

            <div className="quiz-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCurrentIndex((index) => index - 1)}
                disabled={currentIndex === 0}
              >
                <ArrowLeft size={16} /> Previous
              </button>
              <button type="button" className="btn btn-primary" onClick={handleNext} disabled={!currentChecked}>
                {currentIndex === questions.length - 1 ? 'Finish' : 'Next'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'results' && (
        <div className="quiz-results">
          <div className="card quiz-results-card">
            <Award size={48} className="quiz-award" />
            <h1>Quiz Complete</h1>
            <div className="quiz-results-score">{score.correct} / {score.total}</div>
            <div className="quiz-results-label">Accuracy: {score.percentage}%</div>

            <div className="quiz-results-breakdown">
              <div className="quiz-results-stat">
                <div className="quiz-results-stat-value quiz-correct-text">{score.correct}</div>
                <div className="quiz-results-stat-label">Correct</div>
              </div>
              <div className="quiz-results-stat">
                <div className="quiz-results-stat-value quiz-incorrect-text">{score.incorrect}</div>
                <div className="quiz-results-stat-label">Incorrect</div>
              </div>
            </div>

            <section className="quiz-review" aria-label="Quiz review">
              <h2>Review Questions</h2>
              {questions.map((question, index) => {
                const selectedIndex = selectedAnswers[index]
                const correct = isAnswerCorrect(question, selectedIndex)
                return (
                  <article className={`quiz-review-item ${correct ? 'correct' : 'incorrect'}`} key={question.id}>
                    <div className="quiz-review-heading">
                      {correct ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      <strong>{index + 1}. {question.question_text}</strong>
                    </div>
                    <p>Your answer: <strong>{question.options[selectedIndex]}</strong></p>
                    <p>Correct answer: <strong>{question.options[question.correct_answers[0]]}</strong></p>
                    <p><strong>Explanation:</strong> {question.explanation}</p>
                    <SourceList sources={question.sources} label={`Sources for question ${index + 1}`} />
                  </article>
                )
              })}
            </section>

            <button type="button" className="btn btn-primary" onClick={resetQuiz}>
              <RotateCcw size={16} /> Generate Another Quiz
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
