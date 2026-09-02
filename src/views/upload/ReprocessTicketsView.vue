<template>
  <SidebarLayout title="Reprocess All Ticket">
    <div class="reprocess-page">
      <!-- Pemilihan campaign -->
      <div class="card">
        <h2 class="card-title">Proses Ulang Semua Tiket</h2>
        <p class="card-subtitle">
          Setiap <strong>unique ticket id</strong> pada campaign yang dicentang diproses ulang
          memakai konfigurasi campaign <strong>terbaru</strong> (prompt, scorecard, KB yang
          berlaku sekarang). Begitu satu tiket selesai, seluruh entry lamanya dihapus sehingga
          tersisa <strong>satu entry terbaru per unique id</strong>.
        </p>

        <div class="warn-box">
          <div class="warn-title">Sebelum menjalankan</div>
          <ul>
            <li><strong>Satu panggilan LLM per tiket</strong> — {{ selectedTickets }} tiket terpilih berarti {{ selectedTickets }} panggilan.</li>
            <li><strong>Banding error code, Manual Status, dan dokumen pendukung tidak ikut</strong> ke hasil baru; entry lama beserta semuanya dihapus setelah reproses berhasil.</li>
            <li>Tiket yang <strong>gagal</strong> diproses tidak disentuh — entry lamanya dipertahankan apa adanya.</li>
          </ul>
        </div>

        <div class="field">
          <label>Campaign <span class="required">*</span></label>
          <div v-if="loadingList" class="hint">Memuat daftar campaign...</div>
          <div v-else-if="!options.length" class="hint">Tidak ada campaign dalam cakupan Anda.</div>
          <div v-else class="campaign-list">
            <label
              v-for="c in options"
              :key="c.campaign"
              class="campaign-row"
              :class="{ disabled: !c.tickets }"
            >
              <input
                type="checkbox"
                :value="c.campaign"
                :disabled="!c.tickets || busy"
                v-model="selected"
              />
              <span class="campaign-name">{{ c.campaign }}</span>
              <span class="campaign-meta">
                <span class="badge badge-blue">{{ c.tickets }} tiket</span>
                <span v-if="c.obsolete" class="badge badge-amber">{{ c.obsolete }} entry lama</span>
                <span v-if="!c.tickets" class="badge badge-grey">kosong</span>
              </span>
            </label>
          </div>
        </div>

        <button class="btn-run" :disabled="!selected.length || busy" @click="start">
          <span v-if="starting" class="spinner"></span>
          {{ starting ? 'Menjalankan...' : `Reprocess ${selectedTickets} Tiket` }}
        </button>

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
      </div>

      <!-- Kemajuan job -->
      <div v-if="job" class="card">
        <div class="job-head">
          <h2 class="card-title">
            Job {{ job.status === 'running' ? 'berjalan' : job.status === 'cancelled' ? 'dibatalkan' : 'selesai' }}
          </h2>
          <button
            v-if="job.status === 'running'"
            class="btn-cancel"
            :disabled="cancelling"
            @click="cancel"
          >{{ cancelling ? 'Membatalkan...' : 'Batalkan' }}</button>
        </div>
        <p class="card-subtitle">
          Campaign: <strong>{{ (job.campaigns || []).join(', ') }}</strong> ·
          dijalankan oleh {{ job.created_by_username || '—' }} · {{ formatTime(job.created_at) }}
        </p>

        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
        <div class="counts">
          <span class="badge badge-green">selesai {{ job.counts.done }}</span>
          <span class="badge badge-blue">diproses {{ job.counts.processing }}</span>
          <span class="badge badge-grey">antre {{ job.counts.pending }}</span>
          <span v-if="job.counts.failed" class="badge badge-red">gagal {{ job.counts.failed }}</span>
          <span v-if="job.counts.skipped" class="badge badge-amber">dilewati {{ job.counts.skipped }}</span>
          <span class="counts-total">dari {{ job.total_tickets }} tiket</span>
        </div>

        <div class="table-wrap">
          <table class="items-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Campaign</th>
                <th>Status</th>
                <th>Entry lama dihapus</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in job.items" :key="it.id">
                <td class="mono">{{ it.ticket_id }}</td>
                <td>{{ it.campaign || '—' }}</td>
                <td><span class="badge" :class="statusClass(it.status)">{{ statusLabel(it.status) }}</span></td>
                <td>{{ it.deleted_old || 0 }}</td>
                <td class="err">{{ it.error_message || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'

const options = ref([])
const selected = ref([])
const loadingList = ref(true)
const starting = ref(false)
const cancelling = ref(false)
const errorMsg = ref('')
const job = ref(null)
let timer = null

// Selama sebuah job berjalan, layar ini tidak boleh memulai job kedua — server pun
// menolaknya dengan 409 (lihat api/routers/reprocess.py).
const busy = computed(() => starting.value || job.value?.status === 'running')

const selectedTickets = computed(() =>
  options.value
    .filter(c => selected.value.includes(c.campaign))
    .reduce((sum, c) => sum + c.tickets, 0)
)

const progressPct = computed(() => {
  const j = job.value
  if (!j || !j.total_tickets) return 0
  const c = j.counts
  return Math.round(((c.done + c.failed + c.skipped) / j.total_tickets) * 100)
})

const STATUS_LABEL = {
  pending: 'antre', processing: 'diproses', done: 'selesai',
  failed: 'gagal', skipped: 'dilewati',
}
const STATUS_CLASS = {
  pending: 'badge-grey', processing: 'badge-blue', done: 'badge-green',
  failed: 'badge-red', skipped: 'badge-amber',
}
const statusLabel = s => STATUS_LABEL[s] || s
const statusClass = s => STATUS_CLASS[s] || 'badge-grey'

function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('id-ID')
}

async function fetchPreview() {
  loadingList.value = true
  try {
    const res = await apiClient.get('/reprocess_preview')
    options.value = res.data.campaigns || []
    // Job yang masih berjalan disambung kembali setelah halaman di-refresh, supaya
    // Admin tidak merasa jobnya hilang lalu menjalankannya dua kali.
    if (res.data.running_job_id) await loadJob(res.data.running_job_id)
  } catch {
    errorMsg.value = 'Gagal memuat daftar campaign.'
  } finally {
    loadingList.value = false
  }
}

async function loadJob(jobId) {
  try {
    const res = await apiClient.get(`/reprocess_job/${jobId}`)
    job.value = res.data
    if (res.data.status === 'running') schedulePoll(jobId)
    else {
      stopPoll()
      await refreshOptions()
    }
  } catch {
    stopPoll()
  }
}

async function refreshOptions() {
  try {
    const res = await apiClient.get('/reprocess_preview')
    options.value = res.data.campaigns || []
  } catch { /* biarkan daftar lama tampil */ }
}

function schedulePoll(jobId) {
  stopPoll()
  timer = setTimeout(() => loadJob(jobId), 4000)
}

function stopPoll() {
  if (timer) clearTimeout(timer)
  timer = null
}

async function start() {
  if (!selected.value.length) return
  const n = selectedTickets.value
  if (!window.confirm(
    `Proses ulang ${n} tiket pada campaign: ${selected.value.join(', ')}?\n\n` +
    `Setiap tiket dievaluasi ulang lewat LLM, dan entry lamanya (termasuk banding, ` +
    `Manual Status, dan dokumen pendukung) dihapus setelah berhasil.`
  )) return
  errorMsg.value = ''
  starting.value = true
  try {
    const res = await apiClient.post('/reprocess_tickets', { campaigns: selected.value })
    job.value = res.data
    selected.value = []
    schedulePoll(res.data.job_id)
  } catch (e) {
    const detail = e.response?.data?.detail
    errorMsg.value = typeof detail === 'string' ? detail : 'Gagal menjalankan reproses.'
  } finally {
    starting.value = false
  }
}

async function cancel() {
  if (!job.value) return
  if (!window.confirm('Batalkan job? Tiket yang sedang diproses tetap diselesaikan.')) return
  cancelling.value = true
  try {
    const res = await apiClient.post(`/reprocess_job/${job.value.job_id}/cancel`)
    job.value = res.data
    if (res.data.status === 'running') schedulePoll(res.data.job_id)
  } catch {
    errorMsg.value = 'Gagal membatalkan job.'
  } finally {
    cancelling.value = false
  }
}

onMounted(fetchPreview)
onBeforeUnmount(stopPoll)
</script>

<style scoped>
.reprocess-page { display: flex; flex-direction: column; align-items: center; gap: 18px; }

.card {
  background: #fff; border: 1px solid var(--border); border-radius: 16px;
  padding: 28px 32px; width: 100%; max-width: 900px;
  display: flex; flex-direction: column; gap: 16px;
}

.card-title { font-size: 17px; font-weight: 700; }
.card-subtitle { font-size: 13px; color: var(--text-muted); margin-top: -8px; }

.warn-box {
  background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;
  padding: 12px 16px; font-size: 13px; color: #92400e;
}
.warn-title { font-weight: 700; margin-bottom: 4px; }
.warn-box ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; }

.field { display: flex; flex-direction: column; gap: 8px; }
label { font-size: 13px; font-weight: 600; }
.required { color: var(--red); }
.hint { font-size: 12px; color: var(--text-muted); }

.campaign-list {
  display: flex; flex-direction: column;
  border: 1px solid var(--border); border-radius: 10px; overflow: hidden;
}
.campaign-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  border-bottom: 1px solid var(--border); font-weight: 500; cursor: pointer;
}
.campaign-row:last-child { border-bottom: none; }
.campaign-row:hover { background: #f8fafc; }
.campaign-row.disabled { color: var(--text-muted); cursor: not-allowed; }
.campaign-name { flex: 1; font-size: 14px; }
.campaign-meta { display: flex; gap: 6px; }

.btn-run {
  padding: 12px; background: var(--blue); color: #fff; border: none; border-radius: 8px;
  font-size: 15px; font-weight: 700; display: flex; align-items: center;
  justify-content: center; gap: 8px; transition: opacity 0.2s;
}
.btn-run:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-cancel {
  padding: 7px 14px; background: #fff; color: var(--red); border: 1.5px solid #fecaca;
  border-radius: 8px; font-size: 13px; font-weight: 700;
}
.btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }

.error-msg {
  background: var(--red-bg); color: var(--red); border: 1px solid #fecaca;
  border-radius: 8px; padding: 10px 14px; font-size: 13px;
}

.job-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

.progress-bar {
  height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden;
}
.progress-fill { height: 100%; background: var(--blue); transition: width 0.4s ease; }

.counts { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.counts-total { font-size: 12px; color: var(--text-muted); }

.badge { font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.badge-blue { background: var(--blue-bg); color: var(--blue); }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-red { background: #fee2e2; color: var(--red); }
.badge-amber { background: #fef3c7; color: #b45309; }
.badge-grey { background: #f1f5f9; color: var(--text-muted); }

.table-wrap { max-height: 420px; overflow: auto; border: 1px solid var(--border); border-radius: 10px; }
.items-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.items-table th {
  position: sticky; top: 0; background: #f8fafc; text-align: left; font-weight: 700;
  padding: 9px 12px; border-bottom: 1px solid var(--border); font-size: 12px;
}
.items-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.err { color: var(--red); max-width: 320px; word-break: break-word; }

.spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
