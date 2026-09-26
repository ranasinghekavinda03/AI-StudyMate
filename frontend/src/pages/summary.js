export const SUMMARY_TYPES = ['short', 'standard', 'detailed']

export const SUMMARY_TYPE_DETAILS = {
  short: 'Quick revision summary',
  standard: 'Balanced overview with key points and terms',
  detailed: 'More complete explanation with concept relationships',
}

export function buildSummaryPayload({ moduleId = '', lectureId = '', summaryType = 'standard' } = {}) {
  if (!SUMMARY_TYPES.includes(summaryType)) throw new Error('Choose a valid summary type.')
  return {
    module_id: moduleId || null,
    lecture_id: lectureId || null,
    summary_type: summaryType,
  }
}

export function changeSummaryModule(moduleId) {
  return { selectedModuleId: moduleId, selectedLectureId: '' }
}

export function summaryErrorMessage(error) {
  if (error?.status === 422) {
    return 'Not enough study material is available to generate a summary. Upload more lecture material or choose another lecture or module.'
  }
  if (error?.status === 502) return 'The summary service is temporarily unavailable.'
  return error?.message || 'Unable to generate a summary right now. Please try again.'
}

export function normalizeSummaryResponse(response) {
  if (
    !response
    || !SUMMARY_TYPES.includes(response.summary_type)
    || typeof response.title !== 'string'
    || typeof response.overview !== 'string'
    || !Array.isArray(response.key_points)
  ) throw new Error('The server returned an invalid summary response.')

  return {
    ...response,
    important_terms: Array.isArray(response.important_terms) ? response.important_terms : [],
    concept_relationships: Array.isArray(response.concept_relationships) ? response.concept_relationships : [],
    sources: Array.isArray(response.sources) ? response.sources : [],
  }
}

export function formatSummarySource(source) {
  const parts = [source?.source_id, source?.lecture_title]
  if (source?.page_number != null) parts.push(`Page ${source.page_number}`)
  return parts.filter(Boolean).join(' · ')
}

export function createSummaryGenerationController() {
  let inFlight = false
  return {
    async generate({ payload, token, request }) {
      if (inFlight) return { started: false }
      inFlight = true
      try {
        const response = await request(payload, token)
        return { started: true, response: normalizeSummaryResponse(response) }
      } finally {
        inFlight = false
      }
    },
  }
}
