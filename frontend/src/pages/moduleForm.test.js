import assert from 'node:assert/strict'
import test from 'node:test'
import { buildModulePayload, getModuleFormValues } from './moduleForm.js'

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

test('editing can clear optional fields using normalized empty strings', () => {
  assert.deepEqual(
    buildModulePayload(
      { title: 'Machine Learning', code: ' ', description: '' },
      { emptyOptionalValue: '' },
    ),
    { title: 'Machine Learning', code: '', description: '' },
  )
})

test('edit form values are prefilled from the selected backend module', () => {
  assert.deepEqual(
    getModuleFormValues({
      id: 'module-1',
      title: 'Machine Learning',
      code: 'IT3091',
      description: 'Machine Learning module',
    }),
    {
      title: 'Machine Learning',
      code: 'IT3091',
      description: 'Machine Learning module',
    },
  )
})

test('nullable backend edit fields prefill as empty form values', () => {
  assert.deepEqual(
    getModuleFormValues({ title: 'Machine Learning', code: null, description: null }),
    { title: 'Machine Learning', code: '', description: '' },
  )
})
