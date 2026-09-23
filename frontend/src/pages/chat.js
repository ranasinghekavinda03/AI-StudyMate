export const CHAT_TOP_K = 5

export function canSubmitChat(question, sending) {
  return !sending && Boolean(question.trim())
}

export function buildChatPayload({ question, moduleId, lectureId }) {
  const trimmedQuestion = question.trim()
  if (!trimmedQuestion) {
    throw new Error('Enter a question about your study materials.')
  }
  return {
    question: trimmedQuestion,
    module_id: moduleId || null,
    lecture_id: lectureId || null,
    top_k: CHAT_TOP_K,
  }
}

export function createChatMessage(role, content, citations = []) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    citations,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }
}

export function formatCitationLabel(citation) {
  const parts = [citation.source_id, citation.lecture_title]
  if (citation.page_number != null) parts.push(`Page ${citation.page_number}`)
  return parts.filter(Boolean).join(' · ')
}

export async function submitChatQuestion({
  question,
  moduleId,
  lectureId,
  token,
  chatRequest,
  onUserMessage,
  onAssistantMessage,
}) {
  const payload = buildChatPayload({ question, moduleId, lectureId })
  onUserMessage(createChatMessage('user', payload.question))
  const response = await chatRequest(payload, token)
  if (!response || typeof response.answer !== 'string' || !Array.isArray(response.citations)) {
    throw new Error('The server returned an invalid chat response.')
  }
  const assistantMessage = createChatMessage('assistant', response.answer, response.citations)
  onAssistantMessage(assistantMessage)
  return { payload, assistantMessage }
}
