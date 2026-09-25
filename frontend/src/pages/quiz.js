export const QUIZ_DIFFICULTIES = ['easy', 'medium', 'hard']
export const QUIZ_QUESTION_COUNTS = [3, 5, 10, 15, 20]

export function buildQuizPayload({ moduleId, lectureId, difficulty, questionCount }) {
  if (!QUIZ_DIFFICULTIES.includes(difficulty)) {
    throw new Error('Choose a valid difficulty.')
  }
  const normalizedCount = Number(questionCount)
  if (!QUIZ_QUESTION_COUNTS.includes(normalizedCount)) {
    throw new Error('Choose a valid number of questions.')
  }
  return {
    module_id: moduleId || null,
    lecture_id: lectureId || null,
    difficulty,
    question_count: normalizedCount,
  }
}

export function changeQuizModule(moduleId) {
  return { selectedModuleId: moduleId, selectedLectureId: '' }
}

export function validateQuizResponse(response) {
  if (!response || typeof response.quiz_id !== 'string' || !Array.isArray(response.questions)) {
    throw new Error('The server returned an invalid quiz response.')
  }
  for (const question of response.questions) {
    if (
      typeof question?.question_text !== 'string'
      || !Array.isArray(question.options)
      || question.options.length !== 4
      || !Array.isArray(question.correct_answers)
      || question.correct_answers.length !== 1
      || !Number.isInteger(question.correct_answers[0])
      || question.correct_answers[0] < 0
      || question.correct_answers[0] > 3
      || typeof question.explanation !== 'string'
      || !Array.isArray(question.sources)
    ) {
      throw new Error('The server returned an invalid quiz response.')
    }
  }
  return response
}

export function quizErrorMessage(error) {
  if (error?.status === 422) {
    return 'Not enough study material is available to generate this quiz. Upload more lecture content, choose another module or lecture, or request fewer questions.'
  }
  if (error?.status === 502) {
    return 'The quiz service is temporarily unavailable.'
  }
  return error?.message || 'Unable to generate a quiz right now. Please try again later.'
}

export function formatQuizSource(source) {
  const parts = [source?.source_id, source?.lecture_title]
  if (source?.page_number != null) parts.push(`Page ${source.page_number}`)
  return parts.filter(Boolean).join(' · ')
}

export function isAnswerCorrect(question, selectedIndex) {
  return selectedIndex === question.correct_answers[0]
}

export function calculateQuizScore(questions, selectedAnswers) {
  const correct = questions.reduce(
    (total, question, index) => total + (isAnswerCorrect(question, selectedAnswers[index]) ? 1 : 0),
    0,
  )
  const total = questions.length
  return {
    correct,
    incorrect: total - correct,
    total,
    percentage: total ? Math.round((correct / total) * 100) : 0,
  }
}

export function selectSingleAnswer(selectedAnswers, questionIndex, optionIndex) {
  return { ...selectedAnswers, [questionIndex]: optionIndex }
}

export function resetQuizState() {
  return {
    questions: [],
    selectedAnswers: {},
    checkedAnswers: {},
    currentIndex: 0,
  }
}

export function createQuizGenerationController() {
  let inFlight = false
  return {
    async generate({ payload, token, request }) {
      if (inFlight) return { started: false }
      inFlight = true
      try {
        const response = await request(payload, token)
        return { started: true, response: validateQuizResponse(response) }
      } finally {
        inFlight = false
      }
    },
  }
}
