import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import {
  FLASHCARD_COUNTS,
  FLASHCARD_DIFFICULTIES,
  buildFlashcardPayload,
  changeFlashcardModule,
  createFlashcardGenerationController,
  flashcardErrorMessage,
  formatFlashcardSource,
  moveCard,
  normalizeFlashcardResponse,
  resetFlashcardReview,
  revealCard,
} from './flashcards.js'

function cards(count = 5) {
  return Array.from({ length: count }, (_, index) => ({
    id: `card-${index + 1}`,
    front: `Prompt ${index + 1}`,
    back: `Backend answer ${index + 1}`,
    sources: [{ source_id: 'S1', chunk_id: `chunk-${index + 1}`, lecture_title: 'Lecture One', page_number: 8 }],
  }))
}

function response(count = 5) {
  return { flashcard_set_id: 'set-1', difficulty: 'medium', flashcards: cards(count) }
}

test('default payload uses all scopes, ten cards, and medium difficulty', () => {
  assert.deepEqual(buildFlashcardPayload(), {
    module_id: null, lecture_id: null, flashcard_count: 10, difficulty: 'medium',
  })
})

test('selected real module and lecture IDs are sent exactly', () => {
  assert.deepEqual(buildFlashcardPayload({ moduleId: 'module-1', lectureId: 'lecture-2' }), {
    module_id: 'module-1', lecture_id: 'lecture-2', flashcard_count: 10, difficulty: 'medium',
  })
})

test('changing a module clears an incompatible lecture selection', () => {
  assert.deepEqual(changeFlashcardModule('module-2'), { selectedModuleId: 'module-2', selectedLectureId: '' })
})

test('easy, medium, and hard map exactly', () => {
  for (const difficulty of FLASHCARD_DIFFICULTIES) {
    assert.equal(buildFlashcardPayload({ difficulty }).difficulty, difficulty)
  }
  assert.throws(() => buildFlashcardPayload({ difficulty: 'expert' }), /valid difficulty/)
})

test('all offered card counts are valid and invalid counts are rejected', () => {
  for (const flashcardCount of FLASHCARD_COUNTS) {
    assert.equal(buildFlashcardPayload({ flashcardCount }).flashcard_count, flashcardCount)
  }
  for (const flashcardCount of [0, 31, 2.5]) {
    assert.throws(() => buildFlashcardPayload({ flashcardCount }), /valid flashcard count/)
  }
})

test('successful five-card response stores all backend cards without replacement data', () => {
  const result = normalizeFlashcardResponse(response())
  assert.equal(result.flashcards.length, 5)
  assert.equal(result.flashcards[4].back, 'Backend answer 5')
})

test('answer begins hidden and reveal state is preserved per card', () => {
  let revealed = {}
  assert.equal(Boolean(revealed['card-1']), false)
  revealed = revealCard(revealed, 'card-1')
  assert.equal(revealed['card-1'], true)
  assert.equal(Boolean(revealed['card-2']), false)
})

test('previous and next navigation stays inside deck bounds', () => {
  assert.equal(moveCard(0, -1, 5), 0)
  assert.equal(moveCard(0, 1, 5), 1)
  assert.equal(moveCard(1, 1, 5), 2)
  assert.equal(moveCard(4, 1, 5), 4)
})

test('PDF source shows real page and null page never fabricates Page 1', () => {
  assert.equal(formatFlashcardSource(cards(1)[0].sources[0]), 'S1 · Lecture One · Page 8')
  const nullPage = formatFlashcardSource({ source_id: 'S2', lecture_title: 'Text Notes', page_number: null })
  assert.equal(nullPage, 'S2 · Text Notes')
  assert.equal(nullPage.includes('Page 1'), false)
})

test('422 and 502 errors remain safe and create no cards', () => {
  assert.match(flashcardErrorMessage({ status: 422 }), /Not enough study material/)
  assert.match(flashcardErrorMessage({ status: 422 }), /request fewer cards/)
  assert.equal(flashcardErrorMessage({ status: 502, message: 'Gemini internals' }), 'The flashcard service is temporarily unavailable.')
  assert.deepEqual(resetFlashcardReview().flashcards, [])
})

test('duplicate submission starts only one authenticated request', async () => {
  let release
  let calls = 0
  let capturedToken
  const pending = new Promise((resolve) => { release = resolve })
  const controller = createFlashcardGenerationController()
  const args = { payload: buildFlashcardPayload({ flashcardCount: 5 }), token: 'access-token', request: async (_payload, token) => {
    calls += 1; capturedToken = token; await pending; return response()
  } }
  const first = controller.generate(args)
  assert.deepEqual(await controller.generate(args), { started: false })
  assert.equal(calls, 1)
  assert.equal(capturedToken, 'access-token')
  release()
  assert.equal((await first).response.flashcards.length, 5)
})

test('generate another set clears deck, position, and reveals', () => {
  assert.deepEqual(resetFlashcardReview(), { flashcards: [], currentIndex: 0, revealedCards: {} })
})

test('page safely renders loading, reveal, navigation, completion, and disabled controls', async () => {
  const source = await readFile(path.resolve(import.meta.dirname, 'FlashcardsPage.jsx'), 'utf8')
  assert.equal(source.includes('dangerouslySetInnerHTML'), false)
  assert.match(source, /Generating flashcards from your study materials\.\.\./)
  assert.match(source, /Show Answer/)
  assert.match(source, /Previous/)
  assert.match(source, /Next/)
  assert.match(source, /Card \{currentIndex \+ 1\} of \{flashcards\.length\}/)
  assert.match(source, /Flashcard Review Complete/)
  assert.match(source, /Generate Another Set/)
  assert.match(source, /disabled=\{generating\}/)
})
