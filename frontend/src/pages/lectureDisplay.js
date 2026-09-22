export function moduleLabel(module) {
  return module.code ? `${module.code} — ${module.title}` : module.title
}

export function filterLecturesByModule(lectures, moduleId) {
  if (moduleId === 'all') return lectures
  return lectures.filter((lecture) => lecture.module_id === moduleId)
}
