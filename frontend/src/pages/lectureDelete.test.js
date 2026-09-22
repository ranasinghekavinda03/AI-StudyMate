import assert from 'node:assert/strict'
import test from 'node:test'
import { deleteLectureAndReload } from './lectureDelete.js'

test('successful 204 lecture deletion reloads lectures', async () => {
  const calls = []

  await deleteLectureAndReload({
    lectureId: 'lecture-1',
    token: 'access-token',
    deleteRequest: async (id, token) => {
      calls.push(['delete', id, token])
      return null
    },
    reloadLectures: async () => calls.push(['reload']),
  })

  assert.deepEqual(calls, [
    ['delete', 'lecture-1', 'access-token'],
    ['reload'],
  ])
})

test('failed lecture deletion does not reload the list', async () => {
  let reloadCalled = false
  const backendError = new Error('Lecture not found.')

  await assert.rejects(
    deleteLectureAndReload({
      lectureId: 'missing-lecture',
      token: 'access-token',
      deleteRequest: async () => { throw backendError },
      reloadLectures: async () => { reloadCalled = true },
    }),
    backendError,
  )
  assert.equal(reloadCalled, false)
})

test('lecture deletion requires an explicitly selected lecture', async () => {
  await assert.rejects(
    deleteLectureAndReload({
      lectureId: '',
      token: 'access-token',
      deleteRequest: async () => assert.fail('delete should not be called'),
      reloadLectures: async () => assert.fail('reload should not be called'),
    }),
    /must be selected/,
  )
})
