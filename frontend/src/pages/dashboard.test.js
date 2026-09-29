import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { dashboardSetLabel, normalizeDashboard, reviewPercent } from './dashboard.js'

function dashboard(overrides = {}) {
  return {
    stats: {
      modules: 2,
      lectures: 4,
      document_chunks: 20,
      flashcard_sets: 3,
      flashcards: 12,
      known_cards: 5,
      review_again_cards: 3,
      unreviewed_cards: 4,
      total_flashcard_reviews: 18,
      ...overrides,
    },
    recent_lectures: [{ id: 'lecture-1', title: 'Vectors', module_id: 'module-1', module_title: 'Math', file_type: 'pdf', created_at: '2026-09-29T10:00:00' }],
    recent_flashcard_sets: [{ id: 'set-1', title: 'Vectors', difficulty: 'medium', card_count: 10, created_at: '2026-09-29T11:00:00' }],
  }
}

test('real dashboard response preserves stats, review counts, and recent records', () => {
  const result = normalizeDashboard(dashboard())
  assert.equal(result.stats.modules, 2)
  assert.equal(result.stats.total_flashcard_reviews, 18)
  assert.equal(result.recent_lectures[0].module_title, 'Math')
  assert.equal(result.recent_flashcard_sets[0].card_count, 10)
})

test('empty account dashboard accepts zeros and empty recent arrays', () => {
  const empty = dashboard(Object.fromEntries(Object.keys(dashboard().stats).map((key) => [key, 0])))
  empty.recent_lectures = []
  empty.recent_flashcard_sets = []
  assert.equal(normalizeDashboard(empty).stats.flashcards, 0)
  assert.deepEqual(empty.recent_lectures, [])
})

test('review percentages are display-only and handle empty totals', () => {
  assert.equal(reviewPercent(5, 12), 42)
  assert.equal(reviewPercent(0, 0), 0)
  assert.equal(dashboardSetLabel({ title: null }), 'All study materials')
})

test('dashboard page uses backend data with loading, error, and empty states only', async () => {
  const source = await readFile(path.resolve(import.meta.dirname, 'DashboardPage.jsx'), 'utf8')
  assert.match(source, /api\.dashboard\.get\(token\)/)
  assert.match(source, /Loading your dashboard\.\.\./)
  assert.match(source, /Unable to load your dashboard/)
  assert.match(source, /No lectures uploaded yet\./)
  assert.match(source, /No saved flashcard sets yet\./)
  for (const demo of ['84%', '12 Days', 'Neural Networks & Backprop', 'A* Heuristics', 'Math.random']) assert.equal(source.includes(demo), false)
  assert.equal(source.includes('dangerouslySetInnerHTML'), false)
})
