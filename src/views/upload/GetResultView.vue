<template>
  <SidebarLayout title="Get Result">
    <div class="result-page">
      <div class="result-card">
        <h2 class="card-title">Cek Hasil Evaluasi</h2>

        <!-- Input -->
        <div class="input-row">
          <input
            v-model="resultId"
            type="text"
            class="text-input"
            placeholder="Masukkan Result ID (UUID)..."
            @keyup.enter="fetchResult"
          />
          <button class="btn-fetch" :disabled="!resultId.trim() || fetching" @click="fetchResult">
            <span v-if="fetching" class="spinner spinner-blue"></span>
            {{ fetching ? 'Memuat...' : 'Get Result' }}
          </button>
        </div>

        <div v-if="fetchError" class="error-msg">{{ fetchError }}</div>

        <!-- Status display -->
        <template v-if="currentResult">
          <div class="status-bar">
            <span class="status-label">Status:</span>
            <span :class="['status-badge', statusClass(currentResult.status)]">
              {{ currentResult.status }}
            </span>
            <span v-if="polling" class="polling-hint">
              <span class="spinner spinner-sm"></span> Auto-refresh tiap 10 dtk...
            </span>
            <button v-if="polling" class="btn-stop" @click="stopPoll">Stop</button>
          </div>

          <!-- Processing / Pending -->
          <div v-if="['pending', 'processing'].includes(currentResult.status)" class="pending-box">
            <span class="spinner spinner-blue"></span>
            <div>
              <div class="pending-title">Sedang diproses...</div>
              <div class="pending-sub">Halaman ini akan otomatis diperbarui setiap 10 detik.</div>
            </div>
          </div>

          <!-- Failed -->
          <div v-else-if="currentResult.status === 'failed'" class="failed-box">
            <div class="failed-title">✗ Job gagal</div>
            <div v-if="currentResult.error" class="failed-error">{{ currentResult.error }}</div>
          </div>

          <!-- Done -->
          <template v-else-if="currentResult.status === 'done' && currentResult.result">
            <EvaluationView :result="currentResult.result" />
          </template>
        </template>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref, onUnmounted, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SidebarLayout from '../../components/SidebarLayout.vue'
import EvaluationView from '../../components/EvaluationView.vue'
import apiClient from '../../api/client.js'

const route = useRoute()
const router = useRouter()

const resultId = ref('')
const fetching = ref(false)
const fetchError = ref('')
const currentResult = ref(null)
const polling = ref(false)
let pollTimer = null

function statusClass(status) {
  return {
    pending: 'badge-gray',
    processing: 'badge-blue',
    done: 'badge-green',
    failed: 'badge-red',
  }[status] || 'badge-gray'
}

function stopPoll() {
  polling.value = false
  clearInterval(pollTimer)
  pollTimer = null
}

async function fetchResult() {
  const id = resultId.value.trim()
  if (!id) return
  fetching.value = true
  fetchError.value = ''
  stopPoll()
  try {
    const res = await apiClient.get(`/result/${id}`)
    currentResult.value = res.data

    if (['pending', 'processing'].includes(res.data.status)) {
      polling.value = true
      pollTimer = setInterval(async () => {
        try {
          const r = await apiClient.get(`/result/${id}`)
          currentResult.value = r.data
          if (['done', 'failed'].includes(r.data.status)) stopPoll()
        } catch { stopPoll() }
      }, 10000)
    }
  } catch (e) {
    if (e.response?.status === 404) {
      fetchError.value = 'Result ID tidak ditemukan.'
    } else {
      fetchError.value = 'Gagal mengambil data. Coba lagi.'
    }
    currentResult.value = null
  } finally {
    fetching.value = false
  }
}

// Auto-fill & auto-fetch ketika halaman dibuka dengan query param
// ?result_id=... (misalnya dari link "Lihat di Get Result" di STT Dashboard).
onMounted(() => {
  const queryId = route.query.result_id
  if (queryId && typeof queryId === 'string') {
    resultId.value = queryId
    fetchResult()
    // Bersihkan query dari URL setelah dipakai, supaya refresh manual
    // tidak auto-fetch ulang ID lama.
    router.replace({ query: {} })
  }
})

onUnmounted(stopPoll)
</script>

<style scoped>
.result-page { display: flex; justify-content: center; }

.result-card {
  background: #fff; border: 1px solid var(--border); border-radius: 16px;
  padding: 32px 36px; width: 100%; max-width: 900px;
  display: flex; flex-direction: column; gap: 20px;
}

.card-title { font-size: 17px; font-weight: 700; }

.input-row { display: flex; gap: 10px; }

.text-input {
  flex: 1; padding: 10px 14px; border: 1.5px solid var(--border);
  border-radius: 8px; font-size: 14px; outline: none;
  transition: border-color 0.2s; font-family: monospace;
}
.text-input:focus { border-color: var(--blue); }

.btn-fetch {
  padding: 10px 20px; background: var(--blue); color: #fff; border: none;
  border-radius: 8px; font-size: 14px; font-weight: 700; white-space: nowrap;
  display: flex; align-items: center; gap: 8px; transition: background 0.2s;
}
.btn-fetch:hover:not(:disabled) { background: #2563eb; }
.btn-fetch:disabled { opacity: 0.5; cursor: not-allowed; }

.error-msg {
  background: var(--red-bg); color: var(--red); border: 1px solid #fecaca;
  border-radius: 8px; padding: 10px 14px; font-size: 13px;
}

.status-bar {
  display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  background: #f8fafc; border-radius: 8px; font-size: 13px;
}
.status-label { font-weight: 600; }

.status-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.badge-gray { background: #f1f5f9; color: var(--text-muted); }
.badge-blue { background: var(--blue-bg); color: var(--blue); }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-red { background: var(--red-bg); color: var(--red); }

.polling-hint { display: flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: 12px; }

.btn-stop {
  background: none; border: 1px solid var(--border); border-radius: 6px;
  padding: 3px 10px; font-size: 12px; color: var(--text-muted); margin-left: 4px;
}
.btn-stop:hover { background: #f1f5f9; }

.pending-box {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 20px 24px; background: var(--blue-bg); border-radius: 10px;
}
.pending-title { font-weight: 700; font-size: 14px; color: var(--blue); }
.pending-sub { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

.failed-box { padding: 20px 24px; background: var(--red-bg); border-radius: 10px; }
.failed-title { font-weight: 700; font-size: 14px; color: var(--red); }
.failed-error { font-size: 13px; color: var(--text); margin-top: 6px; }

.spinner {
  width: 16px; height: 16px; border: 2px solid #e2e8f0;
  border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
}
.spinner-blue { border-top-color: var(--blue); }
.spinner-sm { width: 12px; height: 12px; border-width: 2px; border-top-color: var(--blue); }
@keyframes spin { to { transform: rotate(360deg); } }
</style>