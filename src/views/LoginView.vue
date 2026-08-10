<template>
  <div class="login-page">
    <div class="login-card">
      <img :src="logoFull" class="login-logo-img" alt="Bank Mega" />
      <h1>Telemarketing QC System</h1>
      <p class="subtitle">Masuk untuk melanjutkan</p>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="field">
          <label>Username</label>
          <input
            v-model="username"
            type="text"
            placeholder="Masukkan username"
            autocomplete="username"
            required
          />
        </div>

        <div class="field">
          <label>Password</label>
          <input
            v-model="password"
            type="password"
            placeholder="Masukkan password"
            autocomplete="current-password"
            required
          />
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <button type="submit" class="btn-login" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? 'Memproses...' : 'Login' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import logoFull from '../assets/brand/bank-mega-logo.png'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await authStore.login(username.value, password.value)
    router.push('/dashboard/stats')
  } catch (e) {
    if (e.response?.status === 401) {
      error.value = 'Username atau password salah.'
    } else {
      error.value = 'Gagal terhubung ke server. Coba lagi.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #FAFBFC 0%, #FDF3D2 100%);
}

.login-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px 36px;
  width: 100%;
  max-width: 380px;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.08);
  text-align: center;
}

.login-logo-img { height: 56px; width: auto; margin-bottom: 16px; }

h1 { font-size: 20px; font-weight: 700; color: var(--text); }

.subtitle { color: var(--text-muted); font-size: 13px; margin: 4px 0 28px; }

.login-form { text-align: left; }

.field { margin-bottom: 16px; }

label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 6px;
}

input {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text);
  transition: border-color 0.2s;
  outline: none;
}

input:focus { border-color: var(--blue); }

.error-msg {
  background: var(--red-bg);
  color: var(--red);
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 16px;
}

.btn-login {
  width: 100%;
  padding: 11px;
  background: var(--mega-gradient);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  transition: filter 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-login:hover:not(:disabled) { filter: brightness(0.94); }
.btn-login:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
