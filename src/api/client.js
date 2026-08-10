import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://10.158.32.26:4000',
  timeout: 30000,
})

let _isRefreshing = false
let _refreshQueue = []

function processQueue(error, token) {
  _refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  _refreshQueue = []
}

apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config

    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url === '/auth/refresh' ||
      original.url === '/auth/login'
    ) {
      return Promise.reject(error)
    }

    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      _forceLogout()
      return Promise.reject(error)
    }

    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _refreshQueue.push({ resolve, reject })
      }).then(token => {
        original.headers.Authorization = `Bearer ${token}`
        return apiClient(original)
      })
    }

    original._retry = true
    _isRefreshing = true

    try {
      const res = await axios.post(
        `${apiClient.defaults.baseURL}/auth/refresh`,
        { refresh_token: refreshToken }
      )
      const newToken = res.data.access_token
      localStorage.setItem('access_token', newToken)
      processQueue(null, newToken)
      original.headers.Authorization = `Bearer ${newToken}`
      return apiClient(original)
    } catch (refreshErr) {
      processQueue(refreshErr, null)
      _forceLogout()
      return Promise.reject(refreshErr)
    } finally {
      _isRefreshing = false
    }
  }
)

function _forceLogout() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
  window.location.href = `${import.meta.env.BASE_URL}login`
}

export default apiClient
