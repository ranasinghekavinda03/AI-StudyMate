import assert from 'node:assert/strict'
import test from 'node:test'
import { buildModulePayload } from './moduleForm.js'

test('module creation payload trims backend fields', () => {
  assert.deepEqual(
    buildModulePayload({
      title: '  Machine Learning  ',
      code: '  IT3091 ',
      description: ' Machine Learning module ',
    }),
    {
      title: 'Machine Learning',
      code: 'IT3091',
      description: 'Machine Learning module',
    },
  )
})

test('module title is required before an API request can be made', () => {
  assert.throws(
    () => buildModulePayload({ title: '   ', code: 'IT3091', description: 'Description' }),
    /Module title is required/,
  )
})

test('optional blank code and description are sent as null', () => {
  assert.deepEqual(
    buildModulePayload({ title: 'Machine Learning', code: ' ', description: '' }),
    { title: 'Machine Learning', code: null, description: null },
  )
})
