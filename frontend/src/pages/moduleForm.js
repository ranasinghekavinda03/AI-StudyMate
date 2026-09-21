export function buildModulePayload({ title, code, description }) {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) {
    throw new Error('Module title is required.')
  }

  return {
    title: trimmedTitle,
    code: code.trim() || null,
    description: description.trim() || null,
  }
}
