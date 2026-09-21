export function buildModulePayload({ title, code, description }, { emptyOptionalValue = null } = {}) {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) {
    throw new Error('Module title is required.')
  }

  return {
    title: trimmedTitle,
    code: code.trim() || emptyOptionalValue,
    description: description.trim() || emptyOptionalValue,
  }
}

export function getModuleFormValues(module) {
  return {
    title: module.title || '',
    code: module.code || '',
    description: module.description || '',
  }
}
