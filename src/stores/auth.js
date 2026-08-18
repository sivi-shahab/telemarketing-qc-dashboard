import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://10.158.32.26:4000'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref(localStorage.getItem('access_token') || null)
  const refreshToken = ref(localStorage.getItem('refresh_token') || null)
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  const isLoggedIn = computed(() => !!accessToken.value)

  // Capability yang dikirim /auth/me. Menu & guard router membacanya, bukan lagi
  // daftar nama role yang di-hardcode — itulah yang membuat role buatan operator
  // (menu Manage Role) langsung berfungsi tanpa mengubah kode frontend.
  const permissions = computed(() => user.value?.permissions || [])
  const campaigns = computed(() => user.value?.campaigns || [])
  // Cakupan tiket: all | qc_assigned | qc_support_own | sales_am | sales_tl | sales_agent
  const dataScope = computed(() => user.value?.data_scope || 'all')

  /** Apakah user punya capability ini. */
  function can(permission) {
    return (user.value?.permissions || []).includes(permission)
  }

  /** Punya SALAH SATU dari capability berikut. */
  function canAny(...list) {
    const mine = user.value?.permissions || []
    return list.some(p => mine.includes(p))
  }

  /** Ambil ulang profil + capability. Dipanggil saat aplikasi dimuat supaya
   *  perubahan permission dari Manage Role terasa tanpa harus login ulang. */
  async function reloadMe() {
    if (!accessToken.value) return null
    const res = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken.value}` },
    })
    user.value = res.data
    localStorage.setItem('user', JSON.stringify(user.value))
    return user.value
  }

  async function login(username, password) {
    const params = new URLSearchParams()
    params.append('username', username)
    params.append('password', password)

    const res = await axios.post(`${BASE_URL}/auth/login`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    accessToken.value = res.data.access_token
    refreshToken.value = res.data.refresh_token
    localStorage.setItem('access_token', accessToken.value)
    localStorage.setItem('refresh_token', refreshToken.value)

    // Fetch user info
    const meRes = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken.value}` },
    })
    user.value = meRes.data
    localStorage.setItem('user', JSON.stringify(user.value))
  }

  function logout() {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
  }

  async function refreshAccessToken() {
    const res = await axios.post(`${BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken.value,
    })
    accessToken.value = res.data.access_token
    localStorage.setItem('access_token', accessToken.value)
    return accessToken.value
  }

  return {
    accessToken, refreshToken, user, isLoggedIn, permissions, campaigns, dataScope,
    can, canAny, reloadMe, login, logout, refreshAccessToken,
  }
})
