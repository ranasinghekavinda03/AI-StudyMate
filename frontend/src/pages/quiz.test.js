import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import {
  buildQuizPayload,
  calculateQuizScore,
  changeQuizModule,
  createQuizGenerationController,
  formatQuizSource,
  isAnswerCorrect,
  quizErrorMessage,
  resetQuizState,
  selectSingleAnswer,
  validateQuizResponse,
} from './quiz.js'

function question(id, correctIndex = 1, pageNumber = null) {
  return {
    id,
    question_text: `Question ${id}`,
    options: ['A', 'B', 'C', 'D'],
    correct_answers: [correctIndex],
    explanation: `Explanation ${id}`,
    sources: [{
      source_id: 'S1', chunk_id: `chunk-${id}`, lecture_id: 'lecture-1',
      lecture_title: 'Lecture One', module_id: 'module-1', page_number: pageNumber, chunk_index: 0,
    }],
  }
}

test('selected scope, difficulty, and question count create the exact backend payload', () => {
  assert.deepEqual(
    buildQuizPayload({ moduleId: 'module-1', lectureId: 'lecture-2', difficulty: 'hard', questionCount: 10 }),
    { module_id: 'module-1', lecture_id: 'lecture-2', difficulty: 'hard', question_count: 10 },
  )
})

test('all-scope defaults send null module and lecture IDs with medium and five questions', () => {
  assert.deepEqual(
    buildQuizPayload({ moduleId: '', lectureId: '', difficulty: 'medium', questionCount: 5 }),
    { module_id: null, lecture_id: null, difficulty: 'medium', question_count: 5 },
  )
})

test('invalid difficulty and question counts are rejected before a request', () => {
  assert.throws(() => buildQuizPayload({ moduleId: '', lectureId: '', difficulty: 'extreme', questionCount: 5 }), /valid difficulty/)
  assert.throws(() => buildQuizPayload({ moduleId: '', lectureId: '', difficulty: 'easy', questionCount: 4 }), /valid number/)
})

test('changing a module clears an incompatible lecture selection', () => {
  assert.deepEqual(changeQuizModule('module-2'), { selectedModuleId: 'module-2', selectedLectureId: '' })
})

test('generation accepts all three backend questions and authenticates the request argument', async () => {
  const response = { quiz_id: 'quiz-1', difficulty: 'medium', questions: [question('1'), question('2'), question('3')] }
  let captured
  const result = await createQuizGenerationController().generate({
    payload: { module_id: null, lecture_id: null, difficulty: 'medium', question_count: 3 },
    token: 'access-token',
    request: async (payload, token) => {
      captured = { payload, token }
      return response
    },
  })
  assert.equal(result.started, true)
  assert.equal(result.response.questions.length, 3)
  assert.equal(captured.token, 'access-token')
  assert.equal(captured.payload.question_count, 3)
})

test('an in-flight generation prevents a duplicate backend request', async () => {
  let release
  let calls = 0
  const pending = new Promise((resolve) => { release = resolve })
  const controller = createQuizGenerationController()
  const args = {
    payload: {}, token: 'token', request: async () => {
      calls += 1
      await pending
      return { quiz_id: 'quiz-1', questions: [question('1')] }
    },
  }
  const first = controller.generate(args)
  const duplicate = await controller.generate(args)
  assert.deepEqual(duplicate, { started: false })
  assert.equal(calls, 1)
  release()
  assert.equal((await first).started, true)
})

test('answer selection keeps exactly one selection per question and navigation state persists', () => {
  let answers = selectSingleAnswer({}, 0, 1)
  answers = selectSingleAnswer(answers, 0, 3)
  answers = selectSingleAnswer(answers, 1, 2)
  assert.deepEqual(answers, { 0: 3, 1: 2 })
  assert.equal(answers[0], 3)
})

test('zero-based correct and incorrect answers are evaluated accurately', () => {
  const item = question('1', 1)
  assert.equal(isAnswerCorrect(item, 1), true)
  assert.equal(isAnswerCorrect(item, 0), false)
  assert.equal(item.explanation, 'Explanation 1')
  assert.equal(item.options[item.correct_answers[0]], 'B')
})

test('source labels include real PDF pages and omit null pages', () => {
  assert.equal(formatQuizSource(question('1', 1, 18).sources[0]), 'S1 · Lecture One · Page 18')
  assert.equal(formatQuizSource(question('2', 1, null).sources[0]), 'S1 · Lecture One')
})

test('score reports four out of five and 80 percent', () => {
  const questions = [question('1', 0), question('2', 1), question('3', 2), question('4', 3), question('5', 0)]
  assert.deepEqual(calculateQuizScore(questions, { 0: 0, 1: 1, 2: 2, 3: 3, 4: 2 }), {
    correct: 4, incorrect: 1, total: 5, percentage: 80,
  })
})

test('422 and 502 responses produce safe actionable messages without fake quiz data', () => {
  assert.match(quizErrorMessage({ status: 422 }), /Not enough study material/)
  assert.match(quizErrorMessage({ status: 422 }), /request fewer questions/)
  assert.equal(quizErrorMessage({ status: 502 }), 'The quiz service is temporarily unavailable.')
})

test('reset clears generated quiz state', () => {
  assert.deepEqual(resetQuizState(), {
    questions: [], selectedAnswers: {}, checkedAnswers: {}, currentIndex: 0,
  })
})

test('invalid backend data is not accepted as a generated quiz', () => {
  assert.throws(() => validateQuizResponse({ quiz_id: 'quiz-1', questions: [{ question_text: 'Fake' }] }), /invalid quiz response/)
})

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await sourceFiles(fullPath))
    else if (/\.(js|jsx|css|html|env)$/.test(entry.name)) files.push(fullPath)
  }
  return files
}

test('frontend source contains no Gemini key or provider credential', async () => {
  const files = await sourceFiles(path.resolve(import.meta.dirname, '..'))
  const credentialName = ['LLM', 'API', 'KEY'].join('_')
  for (const file of files) {
    const content = await readFile(file, 'utf8')
    assert.equal(/AIza[0-9A-Za-z_-]{20,}/.test(content), false, `possible API key in ${file}`)
    assert.equal(content.includes(credentialName), false, `backend credential name in ${file}`)
  }
})
