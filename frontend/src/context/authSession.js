export const AUTH_STORAGE_KEYS = {
  accessToken: 'studymate_token',
  refreshToken: 'studymate_refresh_token',
  user: 'studymate_user',
}

export function withAvatar(user) {
  if (!user) return null

  const avatar = user.name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return { ...user, avatar: avatar || 'ST' }
}

export function clearStoredSession(storage = localStorage) {
  Object.values(AUTH_STORAGE_KEYS).forEach((key) => storage.removeItem(key))
}

export function storeSession(session, storage = localStorage) {
  const { accessToken, refreshToken, user } = session
  storage.setItem(AUTH_STORAGE_KEYS.accessToken, accessToken)
  if (refreshToken) {
    storage.setItem(AUTH_STORAGE_KEYS.refreshToken, refreshToken)
  } else {
    storage.removeItem(AUTH_STORAGE_KEYS.refreshToken)
  }
  storage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(user))
  return session
}

function requireAuthPayload(payload) {
  if (!payload?.access_token || !payload?.refresh_token || !payload?.user) {
    throw new Error('The authentication server returned an incomplete session.')
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    user: withAvatar(payload.user),
  }
}

export async function establishSession(authRequest, storage = localStorage) {
  const session = requireAuthPayload(await authRequest)
  return storeSession(session, storage)
}

export async function restoreSession(authApi, storage = localStorage) {
  const accessToken = storage.getItem(AUTH_STORAGE_KEYS.accessToken)
  const refreshToken = storage.getItem(AUTH_STORAGE_KEYS.refreshToken)

  if (!accessToken) {
    clearStoredSession(storage)
    return null
  }

  try {
    const user = withAvatar(await authApi.me(accessToken))
    return storeSession({ accessToken, refreshToken: refreshToken || '', user }, storage)
  } catch (error) {
    if (error.status !== 401 || !refreshToken) {
      clearStoredSession(storage)
      return null
    }
  }

  try {
    const refreshed = await authApi.refresh(refreshToken)
    if (!refreshed?.access_token || !refreshed?.refresh_token) {
      throw new Error('The authentication server returned incomplete refreshed tokens.')
    }

    const user = withAvatar(await authApi.me(refreshed.access_token))
    return storeSession(
      {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        user,
      },
      storage,
    )
  } catch {
    clearStoredSession(storage)
    return null
  }
}
