import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_LECTURE_FILE_SIZE, validateLectureUpload } from './lectureUpload.js'

const validFile = { name: 'lecture.PDF', size: 1024 }

test('lecture upload validation trims the optional title', () => {
  assert.deepEqual(
    validateLectureUpload({ moduleId: 'module-1', file: validFile, title: '  Week One  ' }),
    { title: 'Week One' },
  )
})

test('lecture upload requires a real module selection', () => {
  assert.throws(
    () => validateLectureUpload({ moduleId: '', file: validFile, title: '' }),
    /Select a module/,
  )
})

test('lecture upload requires a file', () => {
  assert.throws(
    () => validateLectureUpload({ moduleId: 'module-1', file: null, title: '' }),
    /Select a PDF, DOCX, or TXT file/,
  )
})

test('lecture upload rejects unsupported extensions', () => {
  assert.throws(
    () => validateLectureUpload({ moduleId: 'module-1', file: { name: 'image.png', size: 50 }, title: '' }),
    /Unsupported file type/,
  )
})

test('lecture upload rejects files larger than 25 MB', () => {
  assert.throws(
    () => validateLectureUpload({
      moduleId: 'module-1',
      file: { name: 'large.pdf', size: MAX_LECTURE_FILE_SIZE + 1 },
      title: '',
    }),
    /25 MB/,
  )
})
