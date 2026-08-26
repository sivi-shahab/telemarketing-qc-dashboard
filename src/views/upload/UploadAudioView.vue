<template>
  <SidebarLayout title="STT Dashboard">
  <div class="stt-dashboard">
    <!-- Header Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Jobs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value processing">{{ stats.processing }}</div>
        <div class="stat-label">Processing</div>
      </div>
      <div class="stat-card">
        <div class="stat-value success">{{ stats.completed }}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value error">{{ stats.failed }}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.successRate }}%</div>
        <div class="stat-label">Success Rate</div>
      </div>
    </div>

    <!-- Upload Section -->
    <div class="upload-section">
      <div class="section-title">📤 Upload Audio untuk STT</div>
      <div class="upload-container">
        <!-- Drop Zone -->
        <div
          class="drop-zone"
          :class="{ dragging: isDragging, 'has-file': selectedFiles.length }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
          @click="openFilePicker"
        >
          <input
            ref="fileInput"
            type="file"
            accept="audio/*"
            multiple
            class="hidden-input"
            @change="handleFileSelect"
          />
          <div v-if="!selectedFiles.length" class="drop-placeholder">
            <span class="drop-icon">🎧</span>
            <p>Drag &amp; drop file audio di sini</p>
            <p class="drop-hint">atau klik untuk browse</p>
          </div>
          <div v-else class="file-list">
            <div v-for="(f, i) in selectedFiles" :key="`${f.name}-${i}`" class="file-row">
              <span class="file-icon">🎵</span>
              <span class="file-name">{{ f.name }}</span>
              <span class="file-size">{{ formatSize(f.size) }}</span>
              <button class="remove-btn" @click.stop="removeFile(i)">✕</button>
            </div>
          </div>
        </div>

        <!-- Options -->
        <div class="upload-options">
          <div class="option-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="diarization" />
              <span>Enable Diarization (Pisahkan per Speaker)</span>
            </label>
          </div>
          <div class="option-group">
            <label for="stt-language">Bahasa</label>
            <select id="stt-language" v-model="language" class="select-input">
              <option value="id">🇮🇩 Indonesia</option>
              <option value="en">🇺🇸 English</option>
            </select>
          </div>
        </div>

        <!-- Campaign dropdown -->
        <div class="field">
          <label>Campaign <span class="required">*</span></label>
          <select v-model="campaign" class="select-input">
            <option value="" disabled>Pilih campaign...</option>
            <option v-for="c in campaigns" :key="c.id" :value="c.name">{{ c.name }}</option>
          </select>
          <span v-if="!campaigns.length" class="field-hint">
            <template v-if="campaignScoped">
              Tidak ada campaign aktif dalam cakupan role Anda.
            </template>
            <template v-else>
              Belum ada campaign. Upload dulu di <RouterLink to="/upload/campaign">Upload Campaign</RouterLink>.
            </template>
          </span>
        </div>

        <!-- Upload Button -->
        <button
          class="btn-upload"
          :disabled="!selectedFiles.length || !campaign || uploading"
          @click="uploadFiles"
        >
          <span v-if="uploading" class="spinner"></span>
          {{ uploading ? 'Mengirim...' : '📤 Start Analysis' }}
        </button>

        <!-- Error Messages -->
        <div v-if="uploadError" class="error-msg">{{ uploadError }}</div>
        <div v-if="formatError" class="error-msg">{{ formatError }}</div>
      </div>
    </div>

    <!-- Live Monitor Section -->
    <div class="monitor-section">
      <div class="section-title">🔄 Live Monitor</div>
      <div class="filter-bar">
        <select v-model="filterStatus" class="filter-select">
          <option value="">Semua Status</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <button class="btn-refresh" @click="refreshNow" :disabled="refreshing">
          <span v-if="refreshing" class="spinner-small"></span>
          {{ refreshing ? 'Refreshing...' : '🔄 Refresh' }}
        </button>
        <button class="btn-clear" @click="clearAll">🗑️ Clear All</button>
      </div>

      <!-- Jobs Table -->
      <div class="table-container">
        <table class="jobs-table">
          <thead>
            <tr>
              <th>File Name</th>
              <th>Job ID</th>
              <th>Status</th>
              <th>Diarization</th>
              <th>Language</th>
              <th>Created At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredJobs.length === 0">
              <td colspan="7" class="empty-row">Tidak ada data</td>
            </tr>
            <tr
              v-for="job in filteredJobs"
              :key="job.job_id"
              class="job-row"
              @click="selectJobDetail(job)"
            >
              <td class="file-cell">
                <div class="file-info">
                  <span class="file-icon">🎵</span>
                  <span class="file-name">{{ job.audio_name }}</span>
                </div>
              </td>
              <td class="job-id-cell">
                <code class="job-id">{{ truncateId(job.job_id) }}</code>
              </td>
              <td class="status-cell">
                <span
                  class="status-badge"
                  :class="`badge-${job.status}`"
                  :title="job.status === 'failed' ? job.error_message : ''"
                >
                  <span v-if="isProcessing(job.status)" class="spinner-tiny"></span>
                  {{ job.status }}
                </span>
              </td>
              <td class="diarization-cell">
                {{ job.diarization ? '✓ Yes' : '✗ No' }}
              </td>
              <td class="language-cell">
                {{ job.language === 'id' ? '🇮🇩 ID' : '🇺🇸 EN' }}
              </td>
              <td class="date-cell">
                {{ formatDate(job.created_at) }}
              </td>
              <td class="action-cell" @click.stop>
                <div class="action-buttons">
                  <button
                    class="btn-download"
                    :disabled="job.status !== 'completed'"
                    @click="downloadPDF(job.job_id, job.audio_name)"
                    title="Download PDF Transkrip"
                  >
                    📥 PDF
                  </button>
                  <RouterLink
                    v-if="job.result_id"
                    :to="`/upload/result?result_id=${encodeURIComponent(job.result_id)}`"
                    class="btn-result-link"
                    title="Lihat di Get Result"
                  >
                    🔍 Result
                  </RouterLink>
                  <span
                    v-else-if="job.status === 'completed'"
                    class="result-waiting"
                    title="Menunggu evaluasi AI Score selesai diproses"
                  >
                    ⏳ Menyiapkan...
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalJobs > pageSize" class="pagination">
        <button
          :disabled="currentPage === 1"
          @click="currentPage--"
          class="page-btn"
        >
          ← Previous
        </button>
        <span class="page-info">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button
          :disabled="currentPage >= totalPages"
          @click="currentPage++"
          class="page-btn"
        >
          Next →
        </button>
      </div>
    </div>

    <!-- Diarization & Details Section -->
    <div v-if="selectedJobDetail" class="detail-section">
      <div class="detail-header">
        <div class="section-title">📋 Job Details &amp; Diarization</div>
        <button class="btn-close" @click="selectedJobDetail = null">✕</button>
      </div>

      <div class="detail-content">
        <!-- Job Info -->
        <div class="detail-card">
          <div class="card-title">Job Information</div>
          <div class="info-grid">
            <div class="info-row">
              <span class="info-label">File Name:</span>
              <span class="info-value">{{ selectedJobDetail.audio_name }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Job ID:</span>
              <code class="info-code">{{ selectedJobDetail.job_id }}</code>
            </div>
            <div v-if="selectedJobDetail.result_id" class="info-row">
              <span class="info-label">Result ID:</span>
              <code class="info-code">{{ selectedJobDetail.result_id }}</code>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="status-badge" :class="`badge-${selectedJobDetail.status}`">
                {{ selectedJobDetail.status }}
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">Language:</span>
              <span>{{ selectedJobDetail.language === 'id' ? 'Indonesia' : 'English' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Diarization:</span>
              <span>{{ selectedJobDetail.diarization ? '✓ Enabled' : '✗ Disabled' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Created:</span>
              <span>{{ formatDateTime(selectedJobDetail.created_at) }}</span>
            </div>
          </div>
          <div v-if="selectedJobDetail.status === 'completed'" class="detail-actions">
            <button class="btn-download" @click="downloadPDF(selectedJobDetail.job_id, selectedJobDetail.audio_name)">
              📥 Download PDF
            </button>
            <RouterLink
              v-if="selectedJobDetail.result_id"
              :to="`/upload/result?result_id=${encodeURIComponent(selectedJobDetail.result_id)}`"
              class="btn-result-link"
            >
              🔍 Lihat di Get Result
            </RouterLink>
            <span v-else class="result-waiting">
              ⏳ Menunggu evaluasi AI Score selesai diproses...
            </span>
          </div>
        </div>

        <!-- Diarization Results (if available) -->
        <div v-if="selectedJobDetail.diarization && selectedJobDetail.status === 'completed'" class="detail-card">
          <div class="card-title">👥 Diarization Results</div>
          <div class="diarization-content">
            <div v-if="diarizationData.length === 0" class="empty-detail">
              Tidak ada data diarization
            </div>
            <div v-else class="speakers-list">
              <div v-for="(speaker, idx) in diarizationData" :key="idx" class="speaker-block">
                <div class="speaker-header">
                  <span class="speaker-label">{{ speaker.label }}</span>
                  <span class="speaker-duration">{{ speaker.duration }}</span>
                </div>
                <p class="speaker-text">{{ speaker.text }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Jobs History -->
    <div class="history-section">
      <div class="section-title">📜 All Jobs History</div>
      <div class="history-stats">
        <span>Total: {{ allJobs.length }}</span>
        <span>Today: {{ todayJobs }}</span>
        <span>This Week: {{ weekJobs }}</span>
      </div>
    </div>
  </div>
  </SidebarLayout>
</template>

<script setup>
import SidebarLayout from '../../components/SidebarLayout.vue'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { RouterLink } from 'vue-router'
import apiClient from '../../api/client.js'
import { campaignObjectsInScope, isCampaignScoped } from '../../utils/campaignScope.js'

// Constants
const AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.opus', '.wma', '.webm', '.amr']
const POLLING_INTERVAL = 5000 // 5 seconds
const STORAGE_KEY = 'stt_jobs_history'

// API Base & Key
// [FIX CORS] Default SEBELUMNYA 'http://10.158.32.26:8000' -- absolute URL ke
// IP:port langsung, browser anggap ini origin BEDA dari
// https://call-qc.bankmega.local, kena CORS preflight block (server STT
// tidak kirim Access-Control-Allow-Origin). Nginx SUDAH proxy port 8000
// sebagai prefix /api-a/ (lihat komentar di nginx.conf: "VITE_API_BASE=/api-a"
// -- ini memang desain yang direncanakan, cuma env var-nya belum ter-set
// dengan benar). Ganti default ke path RELATIF /api-a supaya request jadi
// same-origin -- CORS tidak berlaku sama sekali untuk same-origin request.
const apiBase = import.meta.env.VITE_API_BASE || '/api-a'

// [FIX CORS] Sama seperti apiBase -- nginx SUDAH punya location /api/download
// dan /api/view-streams/ yang proxy ke port 8010 TANPA perlu prefix tambahan
// (proxy_pass TANPA trailing slash -> path asli diteruskan utuh). Default
// SEBELUMNYA 'http://10.158.32.26:8010' bikin request PDF juga kena CORS.
// String kosong '' -> path jadi relatif ke origin saat ini (same-origin).
const pdfBase = import.meta.env.VITE_PDF_API_BASE || ''
// KEAMANAN: fallback key literal DIHAPUS (key yang sama juga sempat hardcoded di
// TranscriptsView.vue dan sudah bocor ke git -> harus di-rotate). Ingat semua
// VITE_* di-inline ke bundle, jadi key ini tetap terbaca di DevTools; solusi
// sebenarnya adalah proxy /api/downloads lewat backend yang ikut auth session.
const pdfApiKey = import.meta.env.VITE_PDF_API_KEY || ''

// State - Upload
// [FIX] Merge menyisakan DUA nama untuk daftar file yang sama: template memakai
// `files`, script memakai `selectedFiles` (yang tidak pernah dideklarasikan ->
// ReferenceError saat memilih file). Disatukan jadi `selectedFiles`.
const fileInput = ref(null)
const selectedFiles = ref([])
const campaigns = ref([])
const campaignScoped = computed(() => isCampaignScoped())
const campaign = ref('')
// [FIX] `diarization` dan `language` dipakai template + uploadFiles() tapi
// deklarasinya hilang saat merge.
const diarization = ref(false)
const language = ref('id')
const isDragging = ref(false)
const uploading = ref(false)
const uploadError = ref('')
const formatError = ref('')

// State - Jobs
const allJobs = ref([])
const filterStatus = ref('')
const currentPage = ref(1)
const pageSize = 10
const selectedJobDetail = ref(null)

// State - Polling & UI
const pollingActive = ref(false)
const refreshing = ref(false)
const diarizationData = ref([])
let pollTimer = null

// Computed - Stats
const stats = computed(() => {
  const total = allJobs.value.length
  const processing = allJobs.value.filter(j => ['accepted', 'pending', 'processing'].includes(j.status)).length
  const completed = allJobs.value.filter(j => j.status === 'completed').length
  const failed = allJobs.value.filter(j => j.status === 'failed').length
  const successRate = total === 0 ? 0 : Math.round((completed / total) * 100)

  return { total, processing, completed, failed, successRate }
})

// Computed - Filtered Jobs
// [FIX] `.sort()` sebelumnya dijalankan langsung pada array hasil filter yang,
// saat filterStatus kosong, ADALAH allJobs.value itu sendiri -- computed yang
// memutasi sumbernya sendiri. Disalin dulu dengan slice().
const matchingJobs = computed(() => {
  const list = filterStatus.value
    ? allJobs.value.filter(j => j.status === filterStatus.value)
    : allJobs.value
  return list.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
})

const filteredJobs = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return matchingJobs.value.slice(start, start + pageSize)
})

const totalJobs = computed(() => matchingJobs.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalJobs.value / pageSize)))

// Jangan terjebak di halaman kosong saat filter mempersempit daftar.
watch(totalPages, (tp) => {
  if (currentPage.value > tp) currentPage.value = tp
})

// Computed - History Stats
const todayJobs = computed(() => {
  const today = new Date().toDateString()
  return allJobs.value.filter(j => new Date(j.created_at).toDateString() === today).length
})

const weekJobs = computed(() => {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return allJobs.value.filter(j => new Date(j.created_at) >= weekAgo).length
})

// Helper: ambil Authorization header yang sama seperti dipakai apiClient
// (request fetch() manual di bawah tidak otomatis kena axios interceptor)
function authHeaders(extra = {}) {
  const token = localStorage.getItem('access_token')
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  }
}

function isAudio(name) {
  const lower = (name || '').toLowerCase()
  return AUDIO_EXTS.some(ext => lower.endsWith(ext))
}

function addFiles(fileList) {
  const incoming = Array.from(fileList)
  const bad = incoming.find(f => !isAudio(f.name))
  if (bad) {
    formatError.value = `File '${bad.name}' bukan audio. Hanya file audio yang diterima.`
    return
  }
  formatError.value = ''
  selectedFiles.value.push(...incoming)
}

function removeFile(i) {
  selectedFiles.value.splice(i, 1)
}

// Functions - File Events
function openFilePicker() {
  fileInput.value?.click()
}

function handleFileSelect(e) {
  if (e.target.files?.length) addFiles(e.target.files)
  if (fileInput.value) fileInput.value.value = ''
}

function handleDrop(e) {
  isDragging.value = false
  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
}

// Functions - Upload
async function uploadFiles() {
  if (!selectedFiles.value.length) return
  if (!campaign.value) {
    uploadError.value = 'Pilih campaign terlebih dahulu.'
    return
  }

  uploading.value = true
  uploadError.value = ''

  try {
    for (const file of selectedFiles.value) {
      const form = new FormData()
      form.append('audio_file', file)
      form.append('enable_diarization', diarization.value ? '1' : '0')
      form.append('language', language.value)
      // [FIX] Dropdown Campaign wajib diisi di layar ini, tapi nilainya tidak
      // pernah ikut terkirim setelah merge -- backend diam-diam jatuh ke
      // DEFAULT_UPLOAD_TRANSCRIPT_CAMPAIGN, jadi tiket masuk ke campaign yang
      // salah. Sekarang dikirim eksplisit.
      form.append('campaign', campaign.value)

      // [FIX] apiClient (axios) punya baseURL bawaan '/api-b' (App B) --
      // dipakai bareng apiBase ('/api-a') bikin numpuk jadi
      // '/api-b/api-a/...' (404). Endpoint ini App A (port 8000), BUKAN
      // App B -- pakai fetch() polos (tanpa baseURL apa pun), sama pola
      // seperti pollOneJob() di bawah yang sudah benar.
      const res = await fetch(`${apiBase}/api/v1/speech/stt/save_dashboard`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      })
      const resData = res.ok ? await res.json() : null
      if (!res.ok) {
        throw new Error((resData && resData.detail) || `Upload gagal (HTTP ${res.status})`)
      }

      if (resData?.job_id) {
        allJobs.value.unshift({
          job_id: resData.job_id,
          // Diisi dari main_backend_result_id (bukan result_id) setelah
          // /upload_transcript (cabang evaluasi LLM) selesai diproses.
          // Lihat applyStatusUpdate() — result_id polos dari
          // /webhook/register_stt_result TIDAK dipakai di sini karena
          // itu transkrip plain tanpa skor/evaluasi.
          result_id: null,
          audio_name: file.name,
          campaign: campaign.value,
          status: 'processing',
          diarization: diarization.value,
          language: language.value,
          created_at: new Date().toISOString()
        })
      }
    }

    selectedFiles.value = []
    currentPage.value = 1
    startPolling()
  } catch (e) {
    uploadError.value = e.message || 'Upload gagal. Coba lagi.'
  } finally {
    uploading.value = false
  }
}

// Functions - Download
// KOREKSI: PDF di port 8010 disimpan dengan nama {customer_id}_{timestamp},
// yaitu STEM dari nama file audio ASLI yang diupload (original_filename),
// BUKAN job_id (UUID dari STT service). Backend (speech_routes.py) pakai
// Path(original_filename).stem untuk build URL upload ke 8010 — jadi
// frontend harus pakai identifier yang SAMA saat download.
function pdfIdentifierFromAudioName(audioName) {
  return (audioName || '').replace(/\.[^/.]+$/, '')
}

async function downloadPDF(jobId, displayName) {
  const pdfId = pdfIdentifierFromAudioName(displayName)
  if (!pdfId) {
    alert('Nama file audio tidak ditemukan, tidak bisa download PDF.')
    return
  }
  try {
    // Endpoint JAMAK "downloads" (bukan "download") -- streaming, backend
    // ambil file dari S3/MinIO di server lalu kirim byte PDF langsung ke
    // browser. TIDAK pernah redirect browser ke MinIO/CDN langsung, jadi
    // TIDAK kena bug "malformed Host header" di location /voice-to-text-dm/.
    const res = await fetch(`${pdfBase}/api/downloads/${encodeURIComponent(pdfId)}`, {
      method: 'GET',
      headers: pdfApiKey ? { 'X-API-Key': pdfApiKey } : {}
    })
    if (!res.ok) throw new Error('PDF belum siap. Tunggu hingga status COMPLETED.')
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pdfId}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (e) {
    alert(e.message)
  }
}

// Functions - Polling
// Catatan: job yang sudah "completed" (audio selesai ditranskrip) masih perlu
// terus di-poll selama result_id belum muncul — forward ke backend utama
// (yang memicu evaluasi AI Score lewat /upload_transcript) berjalan async
// setelah STT selesai.
function needsPolling(job) {
  return ['accepted', 'pending', 'processing'].includes(job.status) ||
    (job.status === 'completed' && !job.result_id)
}

function isProcessing(status) {
  return ['accepted', 'pending', 'processing'].includes(status)
}

// [FIX] Sebelumnya field ini dibaca dari `data.result_id`, yaitu hasil
// cabang register_result_to_main_backend (/webhook/register_stt_result) —
// endpoint itu didesain KHUSUS untuk transkrip plain TANPA evaluasi LLM
// scorecard (lihat docstring register_result_to_main_backend di
// speech_routes.py). Akibatnya tombol "Lihat di Get Result" bisa
// mengarah ke result yang TIDAK punya AI Score sama sekali.
//
// Field yang BENAR untuk dipakai adalah `main_backend_result_id`, yaitu
// result_id yang di-generate oleh /upload_transcript — endpoint itulah
// yang men-trigger pipeline evaluasi LLM penuh (scorecard, skor,
// passing grade, dst) lewat Celery task process_transcript.
function applyStatusUpdate(jobId, data) {
  const idx = allJobs.value.findIndex(j => j.job_id === jobId)
  if (idx === -1) return
  allJobs.value[idx].status = data.status
  if (data.error_message) allJobs.value[idx].error_message = data.error_message
  if (data.main_backend_result_id) {
    allJobs.value[idx].result_id = data.main_backend_result_id
  }
}

// [FIX] Kalau job_id sudah tidak ditemukan di server (404) — entah karena
// TTL job_storage di STT service kadaluarsa (2 jam) atau service di-restart
// (job_storage in-memory, hilang total saat restart) — job HARUS ditandai
// failed di sini. Tanpa ini, status job tetap "processing" selamanya,
// needsPolling() terus return true, dan setInterval retry tanpa henti
// (inilah penyebab ratusan request 404 berulang yang terlihat di console).
function markJobExpired(jobId) {
  const idx = allJobs.value.findIndex(j => j.job_id === jobId)
  if (idx === -1) return
  allJobs.value[idx].status = 'failed'
  allJobs.value[idx].error_message = 'Job kadaluarsa atau STT service di-restart. Silakan upload ulang.'
}

async function pollOneJob(job) {
  try {
    const res = await fetch(`${apiBase}/api/v1/speech/stt/status/${job.job_id}`, { headers: authHeaders() })
    if (res.ok) {
      const data = await res.json()
      applyStatusUpdate(job.job_id, data)
    } else if (res.status === 404) {
      markJobExpired(job.job_id)
    }
    // status lain (500, dll) sengaja dibiarkan retry di interval berikutnya
  } catch (e) {
    console.error(`Polling error for ${job.job_id}:`, e)
  }
}

function stopPolling() {
  if (!pollTimer) return
  clearInterval(pollTimer)
  pollTimer = null
  pollingActive.value = false
}

function startPolling() {
  if (pollingActive.value) return
  if (!allJobs.value.some(needsPolling)) return
  pollingActive.value = true

  // [FIX] handle interval disimpan di scope komponen supaya bisa dibersihkan
  // saat unmount — sebelumnya interval terus jalan setelah halaman ditinggalkan.
  pollTimer = setInterval(async () => {
    const activeJobs = allJobs.value.filter(needsPolling)

    if (activeJobs.length === 0) {
      stopPolling()
      return
    }

    for (const job of activeJobs) {
      await pollOneJob(job)
    }
  }, POLLING_INTERVAL)
}

async function refreshNow() {
  refreshing.value = true
  try {
    const activeJobs = allJobs.value.filter(needsPolling)
    for (const job of activeJobs) {
      await pollOneJob(job)
    }
  } catch (e) {
    console.error('Refresh error:', e)
  } finally {
    refreshing.value = false
  }
}

// Functions - Details
// [FIX] `selectJobDetail` tidak pernah terpanggil dari template setelah merge,
// jadi panel "Job Details" mustahil terbuka. Sekarang tersambung ke klik baris.
function selectJobDetail(job) {
  selectedJobDetail.value = job
  diarizationData.value = Array.isArray(job.diarization_segments) ? job.diarization_segments : []
}

function clearAll() {
  if (confirm('Hapus semua history?')) {
    stopPolling()
    allJobs.value = []
    selectedJobDetail.value = null
    localStorage.removeItem(STORAGE_KEY)
  }
}

// Functions - Formatting
function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// [FIX] truncateId / formatDate / formatDateTime dipakai template tapi
// definisinya hilang saat merge.
function truncateId(id) {
  const s = String(id || '')
  return s.length > 12 ? `${s.slice(0, 8)}…${s.slice(-4)}` : (s || '—')
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta' })
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Jakarta' })
}

// Campaign aktif yang boleh diunggah login ini: campaign di luar cakupan role tidak
// ditawarkan (tiketnya tidak akan bisa dibuka sendiri sesudah diunggah).
onMounted(async () => {
  // [FIX] history disimpan ke localStorage oleh watch() di bawah, tapi tidak
  // pernah dibaca kembali -- daftar job selalu kosong setelah refresh halaman.
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (Array.isArray(saved)) allJobs.value = saved
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }

  try {
    const res = await apiClient.get('/list_campaigns')
    campaigns.value = campaignObjectsInScope(
      (res.data.campaigns || []).filter(c => c.is_active)
    )
  } catch {
    campaigns.value = []
  }

  startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
})

// Watch & persist
watch(
  allJobs,
  (newJobs) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newJobs))
    } catch (e) {
      console.warn('Gagal menyimpan history job:', e)
    }
  },
  { deep: true }
)
</script>

<style scoped>
.stt-dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  background: #f8fafc;
  min-height: 100vh;
}

/* ============ STATS GRID ============ */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}

.stat-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.stat-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
}

.stat-value.processing {
  color: #2563eb;
}

.stat-value.success {
  color: #16a34a;
}

.stat-value.error {
  color: #dc2626;
}

.stat-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
}

/* ============ UPLOAD SECTION ============ */
.upload-section {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 16px;
}

.upload-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drop-zone {
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  padding: 32px;
  cursor: pointer;
  transition: all 0.2s;
  background: #f8fafc;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: #3b82f6;
  background: #dbeafe;
}

.drop-zone.has-file {
  border-color: #22c55e;
  background: #dcfce7;
}

.hidden-input {
  display: none;
}

.drop-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.drop-icon {
  font-size: 36px;
}

.drop-placeholder p {
  font-size: 14px;
  color: #334155;
}

.drop-hint {
  font-size: 12px;
  color: #94a3b8;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
}

.file-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.file-name {
  flex: 1;
  font-weight: 500;
  font-size: 13px;
  word-break: break-all;
}

.file-size {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
}

.remove-btn {
  background: #fee2e2;
  border: none;
  color: #dc2626;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.remove-btn:hover {
  background: #fecaca;
}

.upload-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.option-group label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 500;
}

.checkbox-label input {
  cursor: pointer;
}

/* Campaign field (wajib diisi sebelum upload). */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.required {
  color: #dc2626;
}

.field-hint {
  font-size: 12px;
  color: #64748b;
}

.select-input {
  padding: 8px 12px;
  border: 1.5px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  outline: none;
  transition: border-color 0.2s;
}

.select-input:focus {
  border-color: #3b82f6;
}

.btn-upload {
  padding: 12px 20px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-upload:hover:not(:disabled) {
  background: #2563eb;
}

.btn-upload:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-msg {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 12px;
  font-size: 13px;
  font-weight: 500;
}

/* ============ MONITOR SECTION ============ */
.monitor-section {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.filter-select {
  padding: 8px 12px;
  border: 1.5px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  outline: none;
}

.filter-select:focus {
  border-color: #3b82f6;
}

.btn-refresh,
.btn-clear {
  padding: 8px 16px;
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.btn-refresh:hover:not(:disabled),
.btn-clear:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.table-container {
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.jobs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.jobs-table thead {
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
}

.jobs-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #475569;
}

.jobs-table td {
  padding: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.job-row {
  cursor: pointer;
}

.jobs-table tbody tr:hover {
  background: #f8fafc;
}

.empty-row {
  text-align: center;
  color: #94a3b8;
  padding: 40px 12px !important;
}

.file-cell {
  min-width: 200px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-icon {
  font-size: 16px;
}

.file-name {
  word-break: break-word;
  max-width: 180px;
}

.job-id-cell {
  font-family: monospace;
  min-width: 150px;
}

.job-id {
  background: #f1f5f9;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.status-cell {
  min-width: 120px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
}

.badge-processing {
  background: #dbeafe;
  color: #0c4a6e;
}

.badge-completed {
  background: #dcfce7;
  color: #166534;
}

.badge-failed {
  background: #fee2e2;
  color: #991b1b;
}

.badge-accepted,
.badge-pending {
  background: #fef3c7;
  color: #92400e;
}

.diarization-cell,
.language-cell,
.date-cell {
  min-width: 100px;
  color: #64748b;
}

.action-cell {
  min-width: 140px;
}

.action-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.btn-download {
  padding: 6px 12px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-download:hover:not(:disabled) {
  background: #2563eb;
}

.btn-download:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-result-link {
  padding: 6px 12px;
  background: #f0fdf4;
  color: #16a34a;
  border: 1px solid #16a34a;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: background 0.2s;
  white-space: nowrap;
}

.btn-result-link:hover {
  background: #16a34a;
  color: #fff;
}

.result-waiting {
  font-size: 12px;
  color: #94a3b8;
  font-style: italic;
  display: inline-flex;
  align-items: center;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 12px;
}

.page-btn {
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 12px;
  color: #64748b;
}

/* ============ DETAIL SECTION ============ */
.detail-section {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e2e8f0;
}

.btn-close {
  background: #fee2e2;
  border: none;
  color: #dc2626;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
}

.btn-close:hover {
  background: #fecaca;
}

.detail-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.detail-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  background: #f8fafc;
}

.detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 12px;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e2e8f0;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-weight: 600;
  color: #64748b;
  font-size: 12px;
}

.info-value {
  color: #1e293b;
  font-size: 13px;
}

.info-code {
  background: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
}

.diarization-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.speakers-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.speaker-block {
  background: #fff;
  border-left: 4px solid #3b82f6;
  padding: 12px;
  border-radius: 6px;
}

.speaker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.speaker-label {
  font-weight: 700;
  color: #1e293b;
  font-size: 13px;
}

.speaker-duration {
  font-size: 11px;
  color: #64748b;
}

.speaker-text {
  font-size: 13px;
  color: #475569;
  line-height: 1.4;
  margin: 0;
}

.empty-detail {
  text-align: center;
  color: #94a3b8;
  padding: 20px;
}

/* ============ HISTORY SECTION ============ */
.history-section {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.history-stats {
  display: flex;
  gap: 24px;
  font-size: 13px;
  color: #64748b;
}

.history-stats span {
  display: flex;
  gap: 4px;
  font-weight: 600;
}

/* ============ ANIMATIONS ============ */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(59, 130, 246, 0.4);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner-tiny {
  width: 8px;
  height: 8px;
  border: 1.5px solid rgba(59, 130, 246, 0.4);
  border-top-color: #0c4a6e;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ============ RESPONSIVE ============ */
@media (max-width: 768px) {
  .stt-dashboard {
    padding: 16px;
    gap: 16px;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  }

  .upload-options {
    grid-template-columns: 1fr;
  }

  .detail-content {
    grid-template-columns: 1fr;
  }

  .jobs-table {
    font-size: 12px;
  }

  .jobs-table th,
  .jobs-table td {
    padding: 8px;
  }

  .filter-bar {
    flex-wrap: wrap;
  }

  .history-stats {
    flex-direction: column;
    gap: 8px;
  }
}
</style>