import assert from 'node:assert/strict'
import test from 'node:test'
import api from './api.js'

test('lecture upload sends authenticated FormData without a manual Content-Type header', async () => {
  const originalFetch = globalThis.fetch
  let captured
  globalThis.fetch = async (url, config) => {
    captured = { url, config }
    return {
      ok: true,
      status: 201,
      json: async () => ({ id: 'lecture-1', extracted_text: 'not retained by the page' }),
    }
  }

  try {
    const file = new Blob(['Study notes'], { type: 'text/plain' })
    await api.lectures.upload(file, 'module-1', 'Week One', 'access-token')

    assert.equal(captured.url, 'http://localhost:8000/api/v1/lectures/upload')
    assert.equal(captured.config.method, 'POST')
    assert.equal(captured.config.headers.Authorization, 'Bearer access-token')
    assert.equal('Content-Type' in captured.config.headers, false)
    assert.ok(captured.config.body instanceof FormData)
    assert.equal(captured.config.body.get('module_id'), 'module-1')
    assert.equal(captured.config.body.get('title'), 'Week One')
    assert.ok(captured.config.body.get('file') instanceof Blob)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('lecture delete handles an empty 204 response without parsing JSON', async () => {
  const originalFetch = globalThis.fetch
  let captured
  let jsonCalled = false
  globalThis.fetch = async (url, config) => {
    captured = { url, config }
    return {
      ok: true,
      status: 204,
      json: async () => {
        jsonCalled = true
        throw new Error('204 response must not be parsed')
      },
    }
  }

  try {
    const result = await api.lectures.delete('lecture-1', 'access-token')

    assert.equal(result, null)
    assert.equal(captured.url, 'http://localhost:8000/api/v1/lectures/lecture-1')
    assert.equal(captured.config.method, 'DELETE')
    assert.equal(captured.config.headers.Authorization, 'Bearer access-token')
    assert.equal(jsonCalled, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})
