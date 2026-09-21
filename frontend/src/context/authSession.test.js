import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AUTH_STORAGE_KEYS,
  clearStoredSession,
  establishSession,
  restoreSession,
} from './authSession.js'

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial))
  }

  getItem(key) {
    return this.values.get(key) ?? null
  }

  setItem(key, value) {
    this.values.set(key, String(value))
  }

  removeItem(key) {
    this.values.delete(key)
  }
}

const backendUser = {
  id: 'user-1',
  name: 'Test Student',
  email: 'student@example.com',
  role: 'student',
  created_at: '2026-09-21T00:00:00Z',
}

test('A: successful backend login stores the complete real session', async () => {
  const storage = new MemoryStorage()
  const session = await establishSession(
    Promise.resolve({
      user: backendUser,
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      token_type: 'bearer',
    }),
    storage,
  )

  assert.equal(session.accessToken, 'access-1')
  assert.equal(session.refreshToken, 'refresh-1')
  assert.equal(session.user.id, backendUser.id)
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.accessToken), 'access-1')
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.refreshToken), 'refresh-1')
  assert.equal(JSON.parse(storage.getItem(AUTH_STORAGE_KEYS.user)).id, backendUser.id)
})

test('B: browser restoration verifies the stored access token through auth/me', async () => {
  const storage = new MemoryStorage({
    [AUTH_STORAGE_KEYS.accessToken]: 'access-1',
    [AUTH_STORAGE_KEYS.refreshToken]: 'refresh-1',
    [AUTH_STORAGE_KEYS.user]: JSON.stringify({ id: 'untrusted-cache' }),
  })
  const calls = []
  const session = await restoreSession(
    {
      me: async (token) => {
        calls.push(token)
        return backendUser
      },
      refresh: async () => assert.fail('refresh should not be called'),
    },
    storage,
  )

  assert.deepEqual(calls, ['access-1'])
  assert.equal(session.user.id, backendUser.id)
  assert.equal(JSON.parse(storage.getItem(AUTH_STORAGE_KEYS.user)).id, backendUser.id)
})

test('C: failed backend login does not create a mock or stored session', async () => {
  const storage = new MemoryStorage()
  const error = Object.assign(new Error('Incorrect email or password.'), { status: 401 })

  await assert.rejects(establishSession(Promise.reject(error), storage), /Incorrect email or password/)
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.accessToken), null)
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.refreshToken), null)
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.user), null)
})

test('D: logout storage cleanup removes access token, refresh token, and user', () => {
  const storage = new MemoryStorage({
    [AUTH_STORAGE_KEYS.accessToken]: 'access-1',
    [AUTH_STORAGE_KEYS.refreshToken]: 'refresh-1',
    [AUTH_STORAGE_KEYS.user]: JSON.stringify(backendUser),
  })

  clearStoredSession(storage)
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.accessToken), null)
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.refreshToken), null)
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.user), null)
})

test('E: an expired access token refreshes tokens and retries auth/me', async () => {
  const storage = new MemoryStorage({
    [AUTH_STORAGE_KEYS.accessToken]: 'expired-access',
    [AUTH_STORAGE_KEYS.refreshToken]: 'refresh-1',
  })
  const meCalls = []
  const session = await restoreSession(
    {
      me: async (token) => {
        meCalls.push(token)
        if (token === 'expired-access') {
          throw Object.assign(new Error('Expired'), { status: 401 })
        }
        return backendUser
      },
      refresh: async (token) => {
        assert.equal(token, 'refresh-1')
        return { access_token: 'access-2', refresh_token: 'refresh-2', token_type: 'bearer' }
      },
    },
    storage,
  )

  assert.deepEqual(meCalls, ['expired-access', 'access-2'])
  assert.equal(session.accessToken, 'access-2')
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.accessToken), 'access-2')
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.refreshToken), 'refresh-2')
})

test('E: a failed refresh clears every stored session value', async () => {
  const storage = new MemoryStorage({
    [AUTH_STORAGE_KEYS.accessToken]: 'expired-access',
    [AUTH_STORAGE_KEYS.refreshToken]: 'invalid-refresh',
    [AUTH_STORAGE_KEYS.user]: JSON.stringify(backendUser),
  })
  const session = await restoreSession(
    {
      me: async () => {
        throw Object.assign(new Error('Expired'), { status: 401 })
      },
      refresh: async () => {
        throw Object.assign(new Error('Invalid refresh token'), { status: 401 })
      },
    },
    storage,
  )

  assert.equal(session, null)
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.accessToken), null)
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.refreshToken), null)
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.user), null)
})
