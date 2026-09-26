export const FLASHCARD_DIFFICULTIES = ['easy', 'medium', 'hard']
export const FLASHCARD_COUNTS = [5, 10, 15, 20, 30]

export const FLASHCARD_DIFFICULTY_DETAILS = {
  easy: 'Definitions and direct facts',
  medium: 'Comparisons and applied understanding',
  hard: 'Reasoning and scenario-based recall',
}

export function buildFlashcardPayload({
  moduleId = '', lectureId = '', flashcardCount = 10, difficulty = 'medium',
} = {}) {
  if (!FLASHCARD_DIFFICULTIES.includes(difficulty)) throw new Error('Choose a valid difficulty.')
  const count = Number(flashcardCount)
  if (!Number.isInteger(count) || count < 1 || count > 30) throw new Error('Choose a valid flashcard count.')
  return {
    module_id: moduleId || null,
    lecture_id: lectureId || null,
    flashcard_count: count,
    difficulty,
  }
}

export function changeFlashcardModule(moduleId) {
  return { selectedModuleId: moduleId, selectedLectureId: '' }
}

export function flashcardErrorMessage(error) {
  if (error?.status === 422) {
    return 'Not enough study material is available to generate flashcards. Upload more material, choose another module or lecture, or request fewer cards.'
  }
  if (error?.status === 502) return 'The flashcard service is temporarily unavailable.'
  return error?.message || 'Unable to generate flashcards right now. Please try again.'
}

export function normalizeFlashcardResponse(response) {
  if (
    !response
    || typeof response.flashcard_set_id !== 'string'
    || !FLASHCARD_DIFFICULTIES.includes(response.difficulty)
    || !Array.isArray(response.flashcards)
    || response.flashcards.length === 0
  ) throw new Error('The server returned an invalid flashcard response.')
  for (const card of response.flashcards) {
    if (
      typeof card?.id !== 'string'
      || typeof card.front !== 'string'
      || typeof card.back !== 'string'
      || !Array.isArray(card.sources)
    ) throw new Error('The server returned an invalid flashcard response.')
  }
  return response
}

export function formatFlashcardSource(source) {
  const parts = [source?.source_id, source?.lecture_title]
  if (source?.page_number != null) parts.push(`Page ${source.page_number}`)
  return parts.filter(Boolean).join(' · ')
}

export function revealCard(revealedCards, cardId) {
  return { ...revealedCards, [cardId]: true }
}

export function moveCard(currentIndex, direction, cardCount) {
  const nextIndex = currentIndex + direction
  return Math.max(0, Math.min(nextIndex, Math.max(0, cardCount - 1)))
}

export function resetFlashcardReview() {
  return { flashcards: [], currentIndex: 0, revealedCards: {} }
}

export function createFlashcardGenerationController() {
  let inFlight = false
  return {
    async generate({ payload, token, request }) {
      if (inFlight) return { started: false }
      inFlight = true
      try {
        const response = await request(payload, token)
        return { started: true, response: normalizeFlashcardResponse(response) }
      } finally {
        inFlight = false
      }
    },
  }
}
