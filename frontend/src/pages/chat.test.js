import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import {
  buildChatPayload,
  canSubmitChat,
  formatCitationLabel,
  submitChatQuestion,
} from './chat.js'

test('chat payload trims the question and sends real filter IDs with top_k', () => {
  assert.deepEqual(
    buildChatPayload({ question: '  Explain early stopping  ', moduleId: 'module-1', lectureId: 'lecture-2' }),
    { question: 'Explain early stopping', module_id: 'module-1', lecture_id: 'lecture-2', top_k: 5 },
  )
  assert.deepEqual(
    buildChatPayload({ question: 'Question', moduleId: '', lectureId: '' }),
    { question: 'Question', module_id: null, lecture_id: null, top_k: 5 },
  )
})

test('blank questions and duplicate in-flight submissions are guarded', () => {
  assert.equal(canSubmitChat('   ', false), false)
  assert.equal(canSubmitChat('Question', true), false)
  assert.equal(canSubmitChat('Question', false), true)
  assert.throws(() => buildChatPayload({ question: '  ', moduleId: '', lectureId: '' }), /Enter a question/)
})

test('successful request keeps user and assistant messages with citations', async () => {
  const messages = []
  let captured
  const citation = { source_id: 'S1', lecture_title: 'ANN Lecture', page_number: 18, excerpt: 'Early stopping...' }
  await submitChatQuestion({
    question: 'Early stopping?', moduleId: 'module-1', lectureId: 'lecture-1', token: 'token',
    chatRequest: async (payload, token) => {
      captured = { payload, token }
      return { answer: 'Early stopping reduces overfitting [S1].', citations: [citation] }
    },
    onUserMessage: (message) => messages.push(message),
    onAssistantMessage: (message) => messages.push(message),
  })
  assert.equal(captured.token, 'token')
  assert.equal(captured.payload.module_id, 'module-1')
  assert.equal(captured.payload.lecture_id, 'lecture-1')
  assert.equal(messages[0].role, 'user')
  assert.equal(messages[0].content, 'Early stopping?')
  assert.equal(messages[1].role, 'assistant')
  assert.equal(messages[1].content, 'Early stopping reduces overfitting [S1].')
  assert.deepEqual(messages[1].citations, [citation])
})

test('PDF and nullable-page citation labels never invent pages', () => {
  assert.equal(formatCitationLabel({ source_id: 'S1', lecture_title: 'PDF Notes', page_number: 18 }), 'S1 · PDF Notes · Page 18')
  assert.equal(formatCitationLabel({ source_id: 'S2', lecture_title: 'TXT Notes', page_number: null }), 'S2 · TXT Notes')
  assert.equal(formatCitationLabel({ source_id: 'S3', lecture_title: 'DOCX Notes' }), 'S3 · DOCX Notes')
})

test('multiple and empty citation lists are preserved exactly', async () => {
  const assistantMessages = []
  for (const response of [
    { answer: 'Two sources [S1] [S2]', citations: [{ source_id: 'S1' }, { source_id: 'S2' }] },
    { answer: "I couldn't find enough information in your uploaded study material to answer that question.", citations: [] },
  ]) {
    await submitChatQuestion({
      question: 'Question', moduleId: '', lectureId: '', token: 'token',
      chatRequest: async () => response,
      onUserMessage: () => {},
      onAssistantMessage: (message) => assistantMessages.push(message),
    })
  }
  assert.deepEqual(assistantMessages[0].citations.map((item) => item.source_id), ['S1', 'S2'])
  assert.deepEqual(assistantMessages[1].citations, [])
  assert.match(assistantMessages[1].content, /couldn't find enough information/)
})

test('backend failure keeps the user message and creates no fake assistant answer', async () => {
  const messages = []
  await assert.rejects(
    submitChatQuestion({
      question: 'Keep this question', moduleId: '', lectureId: '', token: 'token',
      chatRequest: async () => { throw Object.assign(new Error('Answer service temporarily unavailable.'), { status: 502 }) },
      onUserMessage: (message) => messages.push(message),
      onAssistantMessage: (message) => messages.push(message),
    }),
    /temporarily unavailable/,
  )
  assert.equal(messages.length, 1)
  assert.equal(messages[0].role, 'user')
  assert.equal(messages[0].content, 'Keep this question')
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

test('frontend source contains no Gemini key or backend LLM credential', async () => {
  const root = path.resolve(import.meta.dirname, '..')
  const files = await sourceFiles(root)
  const backendCredentialName = ['LLM', 'API', 'KEY'].join('_')
  for (const file of files) {
    const content = await readFile(file, 'utf8')
    assert.equal(/AIza[0-9A-Za-z_-]{20,}/.test(content), false, `possible API key in ${file}`)
    assert.equal(content.includes(backendCredentialName), false, `backend credential name in ${file}`)
  }
})
