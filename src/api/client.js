import axios from 'axios'
import { useAuthStore } from '../stores/auth.js'

// Store dipanggil lazy — modul ini ikut ter-import sebelum `app.use(createPinia())`
// jalan, jadi useAuthStore() hanya boleh disentuh saat interceptor benar-benar
// dieksekusi (selalu sesudah aplikasi mount).
const auth = () => useAuthStore()

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
  const token = auth().accessToken
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

    const refreshToken = auth().refreshToken
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
      // Refresh dijalankan store supaya token baru masuk ke ref DAN localStorage
      // sekaligus; menulis localStorage dari sini membuat ref store basi.
      const newToken = await auth().refreshAccessToken()
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
  auth().logout()
  window.location.href = `${import.meta.env.BASE_URL}login`
}

export default apiClient
