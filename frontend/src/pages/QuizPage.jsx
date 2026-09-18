import { useState } from 'react'
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  BookOpen,
  Award,
  Clock
} from 'lucide-react'

const MOCK_QUESTIONS = {
  easy: [
    {
      id: 'q1',
      question: 'What does the abbreviation "RAG" stand for in modern AI systems?',
      options: [
        'Recursive Auto-regressive Generation',
        'Retrieval-Augmented Generation',
        'Randomized Attribute Gradient',
        'Residual Attention Gate',
      ],
      correctIndex: 1,
      explanation: 'RAG stands for Retrieval-Augmented Generation, combining pre-trained parametric memory with external document vector retrieval.',
      citation: 'System Architecture — Section 1',
    },
    {
      id: 'q2',
      question: 'Which distance metric is most commonly used in pgvector similarity search?',
      options: [
        'Manhattan Distance',
        'Hamming Distance',
        'Cosine Distance',
        'Chebyshev Distance',
      ],
      correctIndex: 2,
      explanation: 'Cosine similarity/distance is standard for high-dimensional semantic text embeddings.',
      citation: 'The RAG Pipeline — Section 6',
    },
    {
      id: 'q3',
      question: 'In AI StudyMate, what is the primary role of document chunking?',
      options: [
        'Compressing file sizes for disk storage',
        'Splitting long text into manageable token windows with overlap for embeddings',
        'Translating PDF fonts into HTML',
        'Encrypting student notes for GDPR compliance',
      ],
      correctIndex: 1,
      explanation: 'Chunking divides text into ~500-800 token segments with overlap so context is not truncated mid-sentence.',
      citation: 'The RAG Pipeline — Section 6',
    },
  ],
  medium: [
    {
      id: 'q1',
      question: 'In A* search, what is the key condition required for tree search to guarantee finding the optimal path?',
      options: [
        'The heuristic must be consistent (monotonic)',
        'The heuristic must be admissible (never overestimates)',
        'The branching factor must be finite and constant',
        'All edge weights must be strictly equal to 1',
      ],
      correctIndex: 1,
      explanation: 'For tree search, admissibility alone guarantees optimality. For graph search, consistency is required to avoid reopening nodes.',
      citation: 'Lec04_Heuristic_Search_A_Star.pdf — Page 14',
    },
    {
      id: 'q2',
      question: 'Why is overlap included when chunking documents in a RAG ingestion pipeline?',
      options: [
        'To double the database storage requirements',
        'To prevent semantically connected concepts from being severed across boundary splits',
        'To avoid duplicate primary keys in PostgreSQL',
        'To accelerate the GPU matrix multiplication speed',
      ],
      correctIndex: 1,
      explanation: '50-100 token overlap ensures boundary sentences preserve complete semantic context in both adjacent vector chunks.',
      citation: 'RAG Pipeline Step-by-step — Page 3',
    },
    {
      id: 'q3',
      question: 'What is the primary function of Early Stopping in neural network training?',
      options: [
        'To prevent vanishing gradient by reducing learning rate',
        'To halt training once validation loss starts increasing, avoiding overfitting',
        'To restart weights initialization with Xavier distribution',
        'To prune dead ReLU neurons',
      ],
      correctIndex: 1,
      explanation: 'Early stopping acts as a regularization technique by monitoring validation performance and stopping when generalization plateaus.',
      citation: 'Lec03_Deep_Neural_Networks.docx — Page 18',
    },
  ],
  hard: [
    {
      id: 'q1',
      question: 'If a heuristic $h(n)$ satisfies the triangle inequality $h(n) \\le c(n, a, n\') + h(n\')$, which statement is mathematically TRUE?',
      options: [
        'The heuristic may be inadmissible if negative costs exist',
        'The heuristic is guaranteed to be both consistent and admissible',
        'The heuristic guarantees greedy best-first search will find the global optimum',
        'The heuristic requires exponential space complexity',
      ],
      correctIndex: 1,
      explanation: 'Consistency implies admissibility via induction over path cost (assuming non-negative step costs).',
      citation: 'Lec04_Heuristic_Search_A_Star.pdf — Page 16',
    },
    {
      id: 'q2',
      question: 'In Bayesian Inference, which term in Bayes Theorem acts as the normalizing constant?',
      options: [
        'The Prior probability $P(\\theta)$',
        'The Likelihood $P(D | \\theta)$',
        'The Marginal Evidence $P(D) = \\int P(D | \\theta) P(\\theta) d\\theta$',
        'The Posterior distribution $P(\\theta | D)$',
      ],
      correctIndex: 2,
      explanation: 'The denominator is the marginal probability of data $P(D)$, ensuring the posterior integrates to 1.',
      citation: 'Lec02_Bayesian_Inference.pdf — Page 9',
    },
  ],
}

export default function QuizPage() {
  const [phase, setPhase] = useState('setup') // 'setup' | 'taking' | 'results'
  const [selectedModule, setSelectedModule] = useState('CS 401: Artificial Intelligence')
  const [difficulty, setDifficulty] = useState('medium') // 'easy' | 'medium' | 'hard'
  const [questionCount, setQuestionCount] = useState(3)

  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState({}) // { [qIndex]: optionIndex }
  const [isSubmitted, setIsSubmitted] = useState(false)

  const startQuiz = () => {
    const pool = MOCK_QUESTIONS[difficulty] || MOCK_QUESTIONS.medium
    setQuestions(pool.slice(0, questionCount))
    setCurrentIndex(0)
    setSelectedAnswers({})
    setIsSubmitted(false)
    setPhase('taking')
  }

  const handleSelectOption = (optionIndex) => {
    if (isSubmitted) return
    setSelectedAnswers({
      ...selectedAnswers,
      [currentIndex]: optionIndex,
    })
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      finishQuiz()
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const finishQuiz = () => {
    setIsSubmitted(true)
    setPhase('results')
  }

  const calculateScore = () => {
    let correct = 0
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        correct++
      }
    })
    return {
      correct,
      total: questions.length,
      percentage: Math.round((correct / questions.length) * 100),
    }
  }

  const currentQ = questions[currentIndex]
  const progressPercent = questions.length
    ? ((currentIndex + 1) / questions.length) * 100
    : 0

  const getDifficultyBadge = (diff) => {
    if (diff === 'easy') return <span className="badge badge-accent">Easy</span>
    if (diff === 'medium') return <span className="badge badge-warning">Medium</span>
    return <span className="badge badge-danger">Hard</span>
  }

  return (
    <div className="stagger-children">
      {/* ---------- SETUP PHASE ---------- */}
      {phase === 'setup' && (
        <div className="quiz-setup">
          <div className="page-header" style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <h1>Interactive Quiz Generator</h1>
            <p>Generate targeted multiple-choice quizzes grounded directly in your uploaded notes.</p>
          </div>

          <div className="quiz-setup-card">
            <div className="input-group" style={{ marginBottom: 'var(--space-5)' }}>
              <label htmlFor="quizModule">Select Source Module / Lecture</label>
              <select
                id="quizModule"
                className="input"
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
              >
                <option value="CS 401: Artificial Intelligence">CS 401: Artificial Intelligence (Lec 01 & 04)</option>
                <option value="CS 480: Machine Learning">CS 480: Machine Learning (Lec 03)</option>
                <option value="STAT 350: Applied Probability">STAT 350: Applied Probability (Lec 02)</option>
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: 'var(--space-5)' }}>
              <label>Select Difficulty Tier</label>
              <div className="quiz-option-grid">
                <div
                  className={`quiz-option easy ${difficulty === 'easy' ? 'selected' : ''}`}
                  onClick={() => setDifficulty('easy')}
                >
                  🟢 Easy
                  <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.8 }}>Recall & Definitions</div>
                </div>
                <div
                  className={`quiz-option medium ${difficulty === 'medium' ? 'selected' : ''}`}
                  onClick={() => setDifficulty('medium')}
                >
                  🟡 Medium
                  <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.8 }}>Conceptual & Applied</div>
                </div>
                <div
                  className={`quiz-option hard ${difficulty === 'hard' ? 'selected' : ''}`}
                  onClick={() => setDifficulty('hard')}
                >
                  🔴 Hard
                  <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.8 }}>Mathematical & Proofs</div>
                </div>
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 'var(--space-8)' }}>
              <label>Number of Questions: {questionCount}</label>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                {[3, 5, 10].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={`btn ${questionCount === count ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{ flex: 1 }}
                    onClick={() => setQuestionCount(count)}
                  >
                    {count} Questions
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={startQuiz}
            >
              <Sparkles size={18} />
              Generate AI Quiz
            </button>
          </div>
        </div>
      )}

      {/* ---------- TAKING PHASE ---------- */}
      {phase === 'taking' && currentQ && (
        <div className="quiz-container">
          {/* Top Teal Progress Bar */}
          <div className="quiz-progress-bar">
            <div
              className="quiz-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="card">
            {/* Header: Question counter & difficulty badge */}
            <div className="quiz-question-header">
              <span className="quiz-question-number">
                Question {currentIndex + 1} of {questions.length}
              </span>
              {getDifficultyBadge(difficulty)}
            </div>

            {/* Question Text */}
            <h2 className="quiz-question-text">{currentQ.question}</h2>

            {/* Answer Options */}
            <div className="quiz-answers">
              {currentQ.options.map((opt, optIdx) => {
                const letter = String.fromCharCode(65 + optIdx)
                const isSelected = selectedAnswers[currentIndex] === optIdx
                return (
                  <div
                    key={optIdx}
                    className={`quiz-answer ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectOption(optIdx)}
                  >
                    <div className="quiz-answer-letter">{letter}</div>
                    <div style={{ flex: 1 }}>{opt}</div>
                  </div>
                )
              })}
            </div>

            {/* Actions */}
            <div className="quiz-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePrev}
                disabled={currentIndex === 0}
              >
                <ArrowLeft size={16} /> Previous
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNext}
                disabled={selectedAnswers[currentIndex] === undefined}
              >
                {currentIndex === questions.length - 1 ? 'Submit Quiz' : 'Next Question'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- RESULTS PHASE ---------- */}
      {phase === 'results' && (
        <div className="quiz-results">
          <div className="card" style={{ padding: 'var(--space-8)' }}>
            <Award size={48} style={{ color: 'var(--accent)', margin: '0 auto' }} />
            <div className="quiz-results-score">
              {calculateScore().percentage}%
            </div>
            <div className="quiz-results-label">
              You answered {calculateScore().correct} out of {calculateScore().total} questions correctly
            </div>

            <div className="quiz-results-breakdown">
              <div className="quiz-results-stat">
                <div className="quiz-results-stat-value" style={{ color: 'var(--success)' }}>
                  {calculateScore().correct}
                </div>
                <div className="quiz-results-stat-label">Correct</div>
              </div>
              <div className="quiz-results-stat">
                <div className="quiz-results-stat-value" style={{ color: 'var(--danger)' }}>
                  {calculateScore().total - calculateScore().correct}
                </div>
                <div className="quiz-results-stat-label">Incorrect</div>
              </div>
              <div className="quiz-results-stat">
                <div className="quiz-results-stat-value" style={{ color: 'var(--primary)' }}>
                  {difficulty.toUpperCase()}
                </div>
                <div className="quiz-results-stat-label">Difficulty</div>
              </div>
            </div>

            {/* Explanations with Citations */}
            <div style={{ textAlign: 'left', marginTop: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>Review & Explanations</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {questions.map((q, idx) => {
                  const userAnswer = selectedAnswers[idx]
                  const isCorrect = userAnswer === q.correctIndex
                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg)',
                        borderLeft: `4px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                        {isCorrect ? (
                          <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                        ) : (
                          <XCircle size={18} style={{ color: 'var(--danger)' }} />
                        )}
                        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                          {idx + 1}. {q.question}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                        Your answer: <strong>{q.options[userAnswer] ?? 'None'}</strong> | Correct: <strong>{q.options[q.correctIndex]}</strong>
                      </div>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {q.explanation}
                      </p>
                      <div className="chat-citation" style={{ marginTop: 'var(--space-2)' }}>
                        <BookOpen size={12} style={{ color: 'var(--accent)' }} />
                        <span>Source: <strong>{q.citation}</strong></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setPhase('setup')}
              >
                <RotateCcw size={16} /> Try Another Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
