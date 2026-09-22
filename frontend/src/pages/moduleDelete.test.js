import assert from 'node:assert/strict'
import test from 'node:test'
import { deleteModuleAndReload } from './moduleDelete.js'

test('successful 204 deletion reloads modules without parsing a response body', async () => {
  const calls = []

  await deleteModuleAndReload({
    moduleId: 'module-1',
    token: 'access-token',
    deleteRequest: async (id, token) => {
      calls.push(['delete', id, token])
      return null
    },
    reloadModules: async () => {
      calls.push(['reload'])
    },
  })

  assert.deepEqual(calls, [
    ['delete', 'module-1', 'access-token'],
    ['reload'],
  ])
})

test('failed deletion does not reload or hide the backend error', async () => {
  let reloadCalled = false
  const backendError = new Error('Module not found.')

  await assert.rejects(
    deleteModuleAndReload({
      moduleId: 'missing-module',
      token: 'access-token',
      deleteRequest: async () => {
        throw backendError
      },
      reloadModules: async () => {
        reloadCalled = true
      },
    }),
    backendError,
  )
  assert.equal(reloadCalled, false)
})

test('deletion requires an explicitly selected module', async () => {
  await assert.rejects(
    deleteModuleAndReload({
      moduleId: '',
      token: 'access-token',
      deleteRequest: async () => assert.fail('delete should not be called'),
      reloadModules: async () => assert.fail('reload should not be called'),
    }),
    /must be selected/,
  )
})
