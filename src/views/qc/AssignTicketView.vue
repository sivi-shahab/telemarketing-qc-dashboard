<template>
  <SidebarLayout title="Assign Ticket">
    <div class="assign-page">
      <div class="card">
        <h2 class="card-title">Assign Ticket ke QC</h2>
        <p class="card-subtitle">
          Bagikan Ticket ID ke QC. Satu ticket hanya untuk satu QC — QC hanya bisa
          melihat &amp; mengajukan banding untuk ticket yang di-assign kepadanya.
        </p>

        <div class="toolbar">
          <input v-model.trim="search" class="text-input search" type="search" placeholder="Cari Ticket ID…" />
          <input v-model="loadDate" class="text-input filter" type="date" title="Kosongkan = data kemarin (H-1)" @change="loadAll" />
          <select v-model="assigneeFilter" class="text-input filter">
            <option value="">Semua</option>
            <option value="__none__">Belum di-assign</option>
            <option v-for="q in qcUsers" :key="q.username" :value="q.username">{{ q.name || q.username }}</option>
          </select>
          <span class="count">{{ filtered.length }} / {{ tickets.length }} ticket</span>
          <!-- Membagi SEMUA ticket yang belum punya QC, bukan hanya yang lolos
               filter di atas: filternya alat pandang, bukan pilihan pembagian. -->
          <button
            class="btn-auto"
            :disabled="loading || autoBusy || !unassigned.length || !qcUsers.length"
            :title="describeSplit(unassigned.length, qcUsers.length)"
            @click="autoAssign"
          >{{ autoBusy ? 'Membagi…' : `⚡ Assign Otomatis (${unassigned.length})` }}</button>
          <button class="btn-refresh" :disabled="loading" @click="loadAll">↻ Muat ulang</button>
        </div>

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        <div v-if="autoMsg" class="ok-msg">{{ autoMsg }}</div>

        <div class="table-wrap">
          <table class="assign-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Campaign</th>
                <th>Status</th>
                <th>QC ditugaskan</th>
                <th>Assign Date</th>
                <th>Approved At</th>
                <th class="col-action">Assign ke</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="7" class="empty">Memuat…</td></tr>
              <tr v-else-if="!filtered.length"><td colspan="7" class="empty">Tidak ada ticket yang cocok.</td></tr>
              <tr v-for="t in filtered" :key="t.id">
                <td class="mono">{{ t.id || '—' }}</td>
                <td>{{ t.contexts.join(', ') || '—' }}</td>
                <td><span class="pill">{{ t.status }}</span></td>
                <td>
                  <span v-if="t.assigned_qc" class="badge badge-yellow">{{ qcLabel(t.assigned_qc) }}</span>
                  <span v-else class="muted">— belum —</span>
                </td>
                <td class="cell-date">{{ t.assigned_at ? formatDate(t.assigned_at) : '—' }}</td>
                <!-- Approved At = kapan QC yang bersangkutan menandai ticket ini
                     sudah dicek manual (bukan approval AI Status). -->
                <td class="cell-date">
                  <template v-if="t.qc_checked_at">
                    <span class="approved-at">{{ formatDate(t.qc_checked_at) }}</span>
                    <span v-if="t.qc_checked_by" class="approved-by">{{ t.qc_checked_by }}</span>
                  </template>
                  <span v-else class="muted">— belum —</span>
                </td>
                <td class="col-action">
                  <select v-model="pick[t.id]" class="text-input pick">
                    <option value="">Pilih QC…</option>
                    <option v-for="q in qcUsers" :key="q.username" :value="q.username">{{ q.name || q.username }}</option>
                  </select>
                  <button class="btn-assign" :disabled="!pick[t.id] || busy === t.id" @click="assign(t)">
                    {{ busy === t.id ? '…' : 'Assign' }}
                  </button>
                  <button v-if="t.assigned_qc" class="btn-unassign" :disabled="busy === t.id" @click="unassign(t)">Lepas</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="note">Sumber: tickets-daily (H-1). Kosongkan tanggal untuk memakai data kemarin.</div>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'
import { groupTickets, joinLocalResults, describeSplit } from './assignTicketData.js'

// Baris tiket diambil lewat App B (`GET /tickets_daily`), bukan menembak App C
// langsung dari browser: permintaan langsung tidak melewati App B sehingga
// pembatasan campaign (`rbac.effective_campaigns_for`) tidak berlaku — login yang
// dibatasi ke campaign Collection tetap bisa meng-assign tiket ACT02/LOC26.
// Paginasi App C (maks 100/halaman) dan X-API-Key ikut pindah ke server.
// Sama seperti TranscriptsView.vue.

// Paginasi /list_results (App B) — masih dilakukan di sini, lihat fetchLocalResults.
const FETCH_LIMIT = 100
const MAX_FETCH_PAGES = 100

const tickets = ref([])
const qcUsers = ref([])
const loading = ref(true)
const errorMsg = ref('')
const search = ref('')
const assigneeFilter = ref('')
const loadDate = ref('')   // kosong -> tidak dikirim -> API pakai mode "yesterday"
const pick = ref({})       // ticket_id -> selected qc username
const busy = ref(null)     // ticket_id currently mutating
const autoBusy = ref(false)
const autoMsg = ref('')

let inFlight = null        // AbortController permintaan tickets-daily terakhir
let requestId = 0          // penanda anti balapan antar-permintaan

function qcLabel(username) {
  const q = qcUsers.value.find((u) => u.username === username)
  return q?.name || username
}

// Yang belum punya QC — dihitung dari SELURUH ticket yang dimuat, bukan dari
// `filtered`, karena tombol Assign Otomatis membagi semuanya.
const unassigned = computed(() => tickets.value.filter((t) => !t.assigned_qc))

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return tickets.value.filter((t) => {
    if (q && !String(t.id || '').toLowerCase().includes(q)) return false
    if (assigneeFilter.value === '__none__' && t.assigned_qc) return false
    if (assigneeFilter.value && assigneeFilter.value !== '__none__' && t.assigned_qc !== assigneeFilter.value) return false
    return true
  })
})

// Backend stores naive UTC; parse as UTC then render in WIB (Asia/Jakarta).
// Same helper as ResultsView — kept local to avoid a shared-util import here.
function formatDate(iso) {
  if (!iso) return '—'
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Date(s).toLocaleString('id-ID', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  })
}

// Baris tickets-daily DALAM CAKUPAN campaign login ini. Satu request: server yang
// memaginasi App C dan menyaringnya. Dibatalkan bila ada permintaan baru, dan
// hanya permintaan TERAKHIR yang boleh menulis ke state.
async function fetchTicketsDaily(signal) {
  const params = {}
  if (loadDate.value) params.load_date = loadDate.value
  const res = await apiClient.get('/tickets_daily', { params, signal })
  return res.data.items || []
}

// Data assignment lokal. Dipaginasi penuh: satu hari saja sudah >100 ticket,
// jadi sekali tembak limit=100 akan memotong data secara diam-diam.
async function fetchLocalResults() {
  const collected = []
  let p = 1
  while (p <= MAX_FETCH_PAGES) {
    const res = await apiClient.get('/list_results', { params: { page: p, limit: FETCH_LIMIT } })
    const items = res.data.items || []
    collected.push(...items)
    if (collected.length >= (res.data.total || 0) || items.length === 0) break
    p += 1
  }
  return collected
}

async function loadAll() {
  if (inFlight) inFlight.abort()
  const ctrl = new AbortController()
  inFlight = ctrl
  const myId = ++requestId

  loading.value = true
  errorMsg.value = ''
  try {
    const [daily, users] = await Promise.all([
      fetchTicketsDaily(ctrl.signal),
      apiClient.get('/qc_assignment/qc_users'),
    ])
    // Kegagalan /list_results TIDAK membatalkan tabel: assign hanya butuh ticket
    // id, jadi baris tetap tampil dengan kolom QC kosong.
    let local = []
    try {
      local = await fetchLocalResults()
    } catch {
      local = []
    }
    // Sumber kebenaran kolom QC. Wajib dibaca terpisah: /list_results hanya
    // memuat ticket yang sudah punya baris result, sehingga assignment untuk
    // ticket yang belum diproses tidak akan pernah ikut terbawa di sana.
    let assignments = []
    try {
      const res = await apiClient.get('/qc_assignments')
      assignments = res.data || []
    } catch {
      assignments = []
    }
    if (myId !== requestId) return
    tickets.value = joinLocalResults(groupTickets(daily), local, assignments)
    qcUsers.value = users.data || []
  } catch (e) {
    if (e.name === 'AbortError' || e.name === 'CanceledError') return
    if (myId !== requestId) return
    tickets.value = []
    errorMsg.value = e.response?.status === 403
      ? 'Akses hanya untuk Team Leader QC atau SPQ Head.'
      : (e.response?.data?.detail || e.message || 'Gagal memuat data.')
  } finally {
    if (myId === requestId) {
      loading.value = false
      inFlight = null
    }
  }
}

async function assign(t) {
  const username = pick.value[t.id]
  if (!username) return
  busy.value = t.id
  errorMsg.value = ''
  try {
    const form = new FormData()
    form.append('ticket_id', t.id)
    form.append('qc_username', username)
    const res = await apiClient.post('/qc_assignment', form)
    t.assigned_qc = username
    // Take assigned_at from the response — reassigning refreshes it server-side.
    t.assigned_at = res.data?.assigned_at
  } catch (e) {
    errorMsg.value = e.response?.data?.detail || 'Gagal assign ticket.'
  } finally {
    busy.value = null
  }
}

// Pembagiannya dihitung SERVER (POST /qc_assignment/auto), bukan di sini: satu
// transaksi untuk semuanya, dan daftar ticket dari browser diperiksa ulang di
// sana terhadap cakupan campaign login ini. Melakukannya di browser berarti
// ratusan POST /qc_assignment yang bisa putus di tengah dan meninggalkan
// pembagian timpang.
async function autoAssign() {
  const pending = unassigned.value
  if (!pending.length || !qcUsers.value.length) return
  if (!window.confirm(`${describeSplit(pending.length, qcUsers.value.length)}\n\nLanjutkan?`)) return

  autoBusy.value = true
  errorMsg.value = ''
  autoMsg.value = ''
  try {
    const form = new FormData()
    for (const t of pending) form.append('ticket_ids', t.id)
    const res = await apiClient.post('/qc_assignment/auto', form)

    // Baris diperbarui dari jawaban server, bukan dari tebakan pembagian di sini:
    // server bisa saja membuang sebagian ticket (di luar cakupan, atau keburu
    // di-assign orang lain) dan tabel harus menampilkan yang benar-benar terjadi.
    const byTicket = new Map()
    for (const [qc, ids] of Object.entries(res.data?.per_qc || {})) {
      for (const id of ids) byTicket.set(id, qc)
    }
    for (const t of tickets.value) {
      const qc = byTicket.get(t.id)
      if (!qc) continue
      t.assigned_qc = qc
      t.assigned_at = res.data?.assigned_at
    }
    const skipped = res.data?.skipped || 0
    autoMsg.value = `${res.data?.assigned || 0} ticket dibagi ke ${res.data?.qc_count || 0} QC.`
      + (skipped ? ` ${skipped} dilewati (di luar cakupan atau sudah di-assign).` : '')
  } catch (e) {
    errorMsg.value = e.response?.data?.detail || 'Gagal membagi ticket otomatis.'
  } finally {
    autoBusy.value = false
  }
}

async function unassign(t) {
  busy.value = t.id
  errorMsg.value = ''
  try {
    await apiClient.delete(`/qc_assignment/${encodeURIComponent(t.id)}`)
    t.assigned_qc = null
    t.assigned_at = null
    pick.value[t.id] = ''
  } catch (e) {
    errorMsg.value = e.response?.data?.detail || 'Gagal melepas assignment.'
  } finally {
    busy.value = null
  }
}

onMounted(loadAll)
</script>

<style scoped>
.assign-page { display: flex; flex-direction: column; gap: 20px; }
.card { background: #fff; border: 1px solid var(--border); border-radius: 16px; padding: 28px 32px; display: flex; flex-direction: column; gap: 14px; }
.card-title { font-size: 17px; font-weight: 700; }
.card-subtitle { font-size: 13px; color: var(--text-muted); margin-top: -8px; }

.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.text-input { padding: 9px 12px; border: 1.5px solid var(--border); border-radius: 8px; font-size: 14px; outline: none; background: #fff; }
.search { flex: 1 1 220px; min-width: 180px; }
.filter { min-width: 160px; cursor: pointer; }
.count { margin-left: auto; font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.btn-auto {
  padding: 8px 14px; border: 1px solid var(--blue); border-radius: 6px; background: var(--blue);
  color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;
}
.btn-auto:hover:not(:disabled) { filter: brightness(0.94); }
.btn-auto:disabled { opacity: 0.5; cursor: not-allowed; }
.ok-msg {
  margin-bottom: 12px; padding: 10px 14px; border-radius: 6px; font-size: 13px;
  background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;
}

.btn-refresh { padding: 8px 12px; border: 1.5px solid var(--border); border-radius: 8px; background: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-refresh:disabled { opacity: 0.5; }

.table-wrap { overflow-x: auto; }
.assign-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.assign-table th { text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 2px solid var(--border); white-space: nowrap; }
.assign-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.mono { font-family: ui-monospace, monospace; }
.muted { color: var(--text-muted); }
.cell-date { white-space: nowrap; font-size: 12px; color: var(--text-muted); }
.approved-at { display: block; color: #16a34a; font-weight: 600; }
.approved-by { display: block; font-size: 11px; margin-top: 2px; }
.pill { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: #f1f5f9; color: var(--text-muted); text-transform: capitalize; }
.badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.badge-yellow { background: var(--yellow-bg); color: var(--yellow); }
.col-action { white-space: nowrap; }
.pick { padding: 6px 8px; min-width: 130px; font-size: 13px; }
.btn-assign { margin-left: 6px; padding: 6px 12px; background: var(--blue); color: #fff; border: none; border-radius: 7px; font-size: 13px; font-weight: 700; cursor: pointer; }
.btn-assign:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-unassign { margin-left: 6px; padding: 6px 10px; background: #fff; color: var(--red); border: 1.5px solid #fecaca; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; }
.empty { text-align: center; color: var(--text-muted); padding: 24px; }
.note { font-size: 12px; color: var(--text-muted); }
.error-msg { background: var(--red-bg); color: var(--red); border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; }
</style>
