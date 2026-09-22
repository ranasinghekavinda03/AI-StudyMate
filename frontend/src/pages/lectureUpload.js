export const MAX_LECTURE_FILE_SIZE = 25 * 1024 * 1024
export const SUPPORTED_LECTURE_EXTENSIONS = ['.pdf', '.docx', '.txt']

export function validateLectureUpload({ moduleId, file, title }) {
  if (!moduleId) {
    throw new Error('Select a module before uploading a document.')
  }
  if (!file) {
    throw new Error('Select a PDF, DOCX, or TXT file to upload.')
  }

  const filename = file.name || ''
  const extension = filename.includes('.')
    ? filename.slice(filename.lastIndexOf('.')).toLowerCase()
    : ''
  if (!SUPPORTED_LECTURE_EXTENSIONS.includes(extension)) {
    throw new Error('Unsupported file type. Select a PDF, DOCX, or TXT file.')
  }
  if (file.size > MAX_LECTURE_FILE_SIZE) {
    throw new Error('File exceeds the 25 MB upload limit.')
  }

  return { title: title.trim() }
}
