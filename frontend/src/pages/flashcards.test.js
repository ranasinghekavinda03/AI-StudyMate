import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import {
  FLASHCARD_COUNTS,
  FLASHCARD_DIFFICULTIES,
  applyReviewResponse,
  buildFlashcardPayload,
  changeFlashcardModule,
  countReviewStatuses,
  createCardReviewController,
  createFlashcardGenerationController,
  flashcardErrorMessage,
  formatFlashcardSource,
  moveCard,
  normalizeFlashcardResponse,
  normalizeSavedSet,
  normalizeSavedSets,
  resetFlashcardReview,
  reviewStatusLabel,
  revealCard,
} from './flashcards.js'

function cards(count = 5) {
  return Array.from({ length: count }, (_, index) => ({
    id: `card-${index + 1}`,
    front: `Prompt ${index + 1}`,
    back: `Backend answer ${index + 1}`,
    review_status: index === 0 ? 'known' : 'unreviewed',
    reviewed_at: index === 0 ? '2026-09-29T10:00:00' : null,
    review_count: index === 0 ? 1 : 0,
    sources: [{ source_id: 'S1', chunk_id: `chunk-${index + 1}`, lecture_title: 'Lecture One', page_number: 8 }],
  }))
}

function response(count = 5) {
  return { flashcard_set_id: 'set-1', difficulty: 'medium', flashcards: cards(count) }
}

test('default payload uses all scopes, ten cards, and medium difficulty', () => {
  assert.deepEqual(buildFlashcardPayload(), { module_id: null, lecture_id: null, flashcard_count: 10, difficulty: 'medium' })
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
  for (const difficulty of FLASHCARD_DIFFICULTIES) assert.equal(buildFlashcardPayload({ difficulty }).difficulty, difficulty)
  assert.throws(() => buildFlashcardPayload({ difficulty: 'expert' }), /valid difficulty/)
})

test('all offered card counts are valid and invalid counts are rejected', () => {
  for (const flashcardCount of FLASHCARD_COUNTS) assert.equal(buildFlashcardPayload({ flashcardCount }).flashcard_count, flashcardCount)
  for (const flashcardCount of [0, 31, 2.5]) assert.throws(() => buildFlashcardPayload({ flashcardCount }), /valid flashcard count/)
})

test('successful response preserves backend set and card IDs with statuses', () => {
  const result = normalizeFlashcardResponse(response())
  assert.equal(result.flashcard_set_id, 'set-1')
  assert.equal(result.flashcards.length, 5)
  assert.equal(result.flashcards[0].id, 'card-1')
  assert.equal(result.flashcards[0].review_status, 'known')
})

test('saved lists and details preserve persisted review metadata after refresh-style loading', () => {
  const sets = normalizeSavedSets([{ id: 'set-1', difficulty: 'medium', card_count: 2, created_at: '2026-09-29T10:00:00', title: 'Week One' }])
  const detail = normalizeSavedSet({ id: 'set-1', difficulty: 'medium', flashcards: cards(2), created_at: '2026-09-29T10:00:00', updated_at: '2026-09-29T10:00:00' })
  assert.equal(sets[0].id, 'set-1')
  assert.equal(detail.flashcards[0].review_status, 'known')
  assert.equal(detail.flashcards[0].review_count, 1)
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
  assert.equal(moveCard(4, 1, 5), 4)
})

test('PDF and snapshot sources render without fabricating pages', () => {
  assert.equal(formatFlashcardSource(cards(1)[0].sources[0]), 'S1 · Lecture One · Page 8')
  assert.equal(formatFlashcardSource({ source_id: 'S2', chunk_id: null, lecture_id: null, lecture_title: 'Deleted Lecture Snapshot', page_number: null }), 'S2 · Deleted Lecture Snapshot')
})

test('confirmed review response updates only the matching real card', () => {
  const original = cards(2)
  const updated = applyReviewResponse(original, 'card-2', {
    id: 'card-2', review_status: 'review_again', reviewed_at: '2026-09-29T11:00:00', review_count: 1,
  })
  assert.equal(updated[0], original[0])
  assert.equal(updated[1].review_status, 'review_again')
  assert.equal(updated[1].review_count, 1)
})

test('review failure leaves previous confirmed state unchanged', async () => {
  const original = cards(1)
  const controller = createCardReviewController()
  await assert.rejects(controller.review({ cardId: 'card-1', status: 'review_again', token: 'token', request: async () => { throw new Error('failed') } }), /failed/)
  assert.equal(original[0].review_status, 'known')
  assert.equal(original[0].review_count, 1)
})

test('duplicate review submission is prevented while saving', async () => {
  let release
  let calls = 0
  const pending = new Promise((resolve) => { release = resolve })
  const controller = createCardReviewController()
  const args = { cardId: 'card-1', status: 'known', token: 'token', request: async () => { calls += 1; await pending; return { id: 'card-1' } } }
  const first = controller.review(args)
  assert.deepEqual(await controller.review(args), { started: false })
  assert.equal(calls, 1)
  release()
  await first
})

test('completion counts reflect confirmed statuses only', () => {
  const values = cards(3)
  values[1] = { ...values[1], review_status: 'review_again' }
  assert.deepEqual(countReviewStatuses(values), { known: 1, review_again: 1, unreviewed: 1 })
  assert.equal(reviewStatusLabel('known'), 'Known')
  assert.equal(reviewStatusLabel('review_again'), 'Review Again')
  assert.equal(reviewStatusLabel('unreviewed'), 'Unreviewed')
})

test('422 and 502 errors remain safe and create no cards', () => {
  assert.match(flashcardErrorMessage({ status: 422 }), /Not enough study material/)
  assert.equal(flashcardErrorMessage({ status: 502, message: 'provider internals' }), 'The flashcard service is temporarily unavailable.')
  assert.deepEqual(resetFlashcardReview().flashcards, [])
})

test('duplicate generation starts only one authenticated request', async () => {
  let release
  let calls = 0
  const pending = new Promise((resolve) => { release = resolve })
  const controller = createFlashcardGenerationController()
  const args = { payload: buildFlashcardPayload({ flashcardCount: 5 }), token: 'access-token', request: async () => { calls += 1; await pending; return response() } }
  const first = controller.generate(args)
  assert.deepEqual(await controller.generate(args), { started: false })
  assert.equal(calls, 1)
  release()
  assert.equal((await first).response.flashcards.length, 5)
})

test('generate another set clears deck, position, and reveals', () => {
  assert.deepEqual(resetFlashcardReview(), { flashcards: [], currentIndex: 0, revealedCards: {} })
})

test('page contains saved, review, confirmation, loading, and existing generation controls', async () => {
  const source = await readFile(path.resolve(import.meta.dirname, 'FlashcardsPage.jsx'), 'utf8')
  assert.equal(source.includes('dangerouslySetInnerHTML'), false)
  for (const expected of ['Generating flashcards from your study materials...', 'Show Answer', 'Previous', 'Next', 'Flashcard Review Complete', 'Generate Another Set', 'No saved flashcard sets yet.', 'I Know This', 'Review Again', 'Saving...']) assert.equal(source.includes(expected), true)
  assert.match(source, /globalThis\.confirm/)
  assert.match(source, /api\.flashcards\.listSets/)
  assert.match(source, /api\.flashcards\.getSet/)
  assert.match(source, /api\.flashcards\.deleteSet/)
  assert.match(source, /setCurrentSetId\(result\.response\.flashcard_set_id\)/)
  const answerIndex = source.indexOf('className="flashcard-answer"')
  assert.ok(source.indexOf('I Know This') > answerIndex)
})
