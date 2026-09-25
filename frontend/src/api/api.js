const env = import.meta.env || {}
const BASE_URL = env.VITE_API_BASE_URL || env.VITE_API_URL || 'http://localhost:8000/api/v1'

async function request(endpoint, options = {}) {
  const { token, headers = {}, ...customConfig } = options
  const isFormData = typeof FormData !== 'undefined' && customConfig.body instanceof FormData
  const config = {
    ...customConfig,
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  }

  const url = `${BASE_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`
  const response = await fetch(url, config)

  if (!response.ok) {
    let errorDetail = 'Request failed'
    try {
      const errorData = await response.json()
      errorDetail = errorData.detail || errorDetail
    } catch {
      errorDetail = response.statusText || errorDetail
    }
    const error = new Error(errorDetail)
    error.status = response.status
    throw error
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

const api = {
  baseUrl: BASE_URL,

  auth: {
    register: (userData) =>
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    login: (credentials) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    refresh: (refreshToken) =>
      request('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      }),
    me: (token) =>
      request('/auth/me', {
        method: 'GET',
        token,
      }),
  },

  modules: {
    list: (token) =>
      request('/modules', {
        method: 'GET',
        token,
      }),
    create: (moduleData, token) =>
      request('/modules', {
        method: 'POST',
        body: JSON.stringify(moduleData),
        token,
      }),
    get: (id, token) =>
      request(`/modules/${id}`, {
        method: 'GET',
        token,
      }),
    update: (id, moduleData, token) =>
      request(`/modules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(moduleData),
        token,
      }),
    delete: (id, token) =>
      request(`/modules/${id}`, {
        method: 'DELETE',
        token,
      }),
  },

  lectures: {
    list: (moduleId, token) => {
      const query = moduleId ? `?module_id=${encodeURIComponent(moduleId)}` : ''
      return request(`/lectures${query}`, {
        method: 'GET',
        token,
      })
    },
    create: (lectureData, token) =>
      request('/lectures', {
        method: 'POST',
        body: JSON.stringify(lectureData),
        token,
      }),
    upload: (file, moduleId, title, token) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('module_id', moduleId)
      if (title) formData.append('title', title)

      return request('/lectures/upload', {
        method: 'POST',
        body: formData,
        token,
      })
    },
    get: (id, token) =>
      request(`/lectures/${id}`, {
        method: 'GET',
        token,
      }),
    delete: (id, token) =>
      request(`/lectures/${id}`, {
        method: 'DELETE',
        token,
      }),
  },

  rag: {
    chat: (payload, token) =>
      request('/rag/chat', {
        method: 'POST',
        body: JSON.stringify(payload),
        token,
      }),
  },

  quiz: {
    generate: (payload, token) =>
      request('/quiz/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
        token,
      }),
  },
}

export default api
