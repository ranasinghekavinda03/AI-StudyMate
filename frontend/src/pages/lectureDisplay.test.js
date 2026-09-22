import assert from 'node:assert/strict'
import test from 'node:test'
import { filterLecturesByModule, moduleLabel } from './lectureDisplay.js'

test('module selector labels use backend code and title', () => {
  assert.equal(
    moduleLabel({ id: 'module-1', code: 'IT3091', title: 'Machine Learning' }),
    'IT3091 — Machine Learning',
  )
  assert.equal(moduleLabel({ id: 'module-2', code: null, title: 'Research Methods' }), 'Research Methods')
})

test('lecture filtering uses real backend module IDs', () => {
  const lectures = [
    { id: 'lecture-1', module_id: 'module-1' },
    { id: 'lecture-2', module_id: 'module-2' },
  ]

  assert.equal(filterLecturesByModule(lectures, 'all'), lectures)
  assert.deepEqual(filterLecturesByModule(lectures, 'module-2'), [lectures[1]])
  assert.deepEqual(filterLecturesByModule(lectures, 'missing-module'), [])
})
