export const DASHBOARD_STAT_KEYS = [
  'modules',
  'lectures',
  'document_chunks',
  'flashcard_sets',
  'flashcards',
  'known_cards',
  'review_again_cards',
  'unreviewed_cards',
  'total_flashcard_reviews',
]

export function normalizeDashboard(response) {
  if (!response?.stats || !Array.isArray(response.recent_lectures) || !Array.isArray(response.recent_flashcard_sets)) {
    throw new Error('The server returned an invalid dashboard response.')
  }
  for (const key of DASHBOARD_STAT_KEYS) {
    if (!Number.isInteger(response.stats[key]) || response.stats[key] < 0) {
      throw new Error('The server returned an invalid dashboard response.')
    }
  }
  return response
}

export function formatDashboardDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString()
}

export function reviewPercent(count, total) {
  if (!total) return 0
  return Math.round((count / total) * 100)
}

export function dashboardSetLabel(set) {
  return set?.title || 'All study materials'
}
