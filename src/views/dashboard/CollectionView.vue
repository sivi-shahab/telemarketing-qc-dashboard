<template>
  <SidebarLayout title="Collection Results">
    <div class="filter-bar">
      <input v-model="ticketId" type="text" class="text-input" placeholder="Cari Tiket ID…" @input="debounced" />
      <input v-model="dateStart" type="date" class="text-input date-input" title="Dari tanggal transkrip" @change="reload(1)" />
      <input v-model="dateEnd" type="date" class="text-input date-input" title="Sampai tanggal transkrip" @change="reload(1)" />
      <select v-model="aiStatus" class="text-input select-input" @change="reload(1)">
        <option value="">Semua Hasil</option>
        <option value="PASS">Pass</option>
        <option value="FAIL">Fail</option>
      </select>
      <select v-model="status" class="text-input select-input" @change="reload(1)">
        <option value="">Semua Status Proses</option>
        <option value="done">Selesai</option>
        <option value="processing">Diproses</option>
        <option value="pending">Menunggu</option>
        <option value="failed">Gagal</option>
      </select>
      <button class="btn-clear" @click="reset">Reset</button>
    </div>

    <div class="summary-strip" v-if="!loading && items.length">
      <div class="summary-tile"><span class="k">Total tiket</span><span class="v">{{ total }}</span></div>
      <div class="summary-tile"><span class="k">Pass (halaman ini)</span><span class="v tone-success">{{ passCount }}</span></div>
      <div class="summary-tile"><span class="k">Fail (halaman ini)</span><span class="v tone-danger">{{ failCount }}</span></div>
      <div class="summary-tile"><span class="k">Rata-rata skor</span><span class="v">{{ avgPercent }}%</span></div>
    </div>

    <div v-if="error" class="error-box">{{ error }}</div>
    <div v-if="loading" class="skeleton-list"><div class="skeleton-row" v-for="i in 5" :key="i"></div></div>

    <div v-else class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Tiket ID</th>
            <th>Tanggal Upload</th>
            <th>Agent</th>
            <th>Konsumen</th>
            <th class="num">Skor</th>
            <th>Hasil</th>
            <th>Kritis</th>
            <th class="num">Error Code</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="items.length === 0"><td colspan="9" class="empty">Tidak ada data.</td></tr>
          <template v-for="row in items" :key="row.result_id">
            <tr
              class="data-row" :class="{ expanded: expandedResultId === row.result_id }"
              tabindex="0" role="button" :aria-expanded="expandedResultId === row.result_id"
              @click="toggleRow(row)" @keydown.enter.prevent="toggleRow(row)" @keydown.space.prevent="toggleRow(row)"
            >
              <td class="cell-strong mono">
                <span class="expand-icon">{{ expandedResultId === row.result_id ? '▼' : '▶' }}</span>
                {{ row.ticket_id || '—' }}
              </td>
              <td class="cell-date">{{ formatDateTime(row.uploaded_at) }}</td>
              <td>{{ row.agent_name || '—' }}</td>
              <td>{{ row.consumer_full_name || '—' }}</td>
              <td class="num mono">
                <template v-if="row.score != null">{{ row.score }} / {{ row.maximum_score }}</template>
                <template v-else>—</template>
              </td>
              <td><span class="pill" :class="`tone-${verdictTone(row.ai_status)}`">{{ verdictLabel(row.ai_status) }}</span></td>
              <td><span class="pill" :class="`tone-${verdictTone(row.critical_status)}`">{{ verdictLabel(row.critical_status) }}</span></td>
              <td class="num">{{ row.error_code_count }}</td>
              <td>{{ STATUS_LABEL[row.status] || row.status }}</td>
            </tr>
            <tr v-if="expandedResultId === row.result_id" class="expand-row">
              <td colspan="9">
                <div class="expand-content">
                  <RouterLink :to="`/dashboard/collection/${row.result_id}`" class="full-page-link">Buka halaman penuh ↗</RouterLink>
                  <CollectionResultPanel :result-id="row.result_id" />
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <TablePager :v="pager" label="tiket" />
    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import TablePager from '../../components/TablePager.vue'
import CollectionResultPanel from '../../components/collection/CollectionResultPanel.vue'
import apiClient from '../../api/client.js'
import { formatDateTime, verdictTone, verdictLabel } from '../../utils/collectionReport.js'

const STATUS_LABEL = { done: 'Selesai', processing: 'Diproses', pending: 'Menunggu', failed: 'Gagal' }
const LIMIT = 20

const items = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const error = ref('')
const ticketId = ref('')
const dateStart = ref('')
const dateEnd = ref('')
const aiStatus = ref('')
const status = ref('')
// Hanya satu tiket boleh terbuka sekaligus (mirip pola ResultsView.vue
// expandedGroupId) — v-if pada baris expand memastikan CollectionResultPanel
// tiket lama benar-benar di-unmount (poll/abort berhenti) begitu tiket lain
// dibuka atau baris ditutup.
const expandedResultId = ref(null)

// Bentuk objek `v` untuk TablePager (lihat src/components/TablePager.vue):
// { total, from, to, page, pageCount, go() } — bukan event `@page` seperti dugaan
// awal, TablePager memanggil `v.go(next)` langsung dari tombolnya.
const pager = computed(() => {
  const pageCount = Math.max(1, Math.ceil(total.value / LIMIT))
  const current = Math.min(page.value, pageCount)
  return {
    total: total.value,
    page: current,
    pageCount,
    from: total.value ? (current - 1) * LIMIT + 1 : 0,
    to: Math.min(current * LIMIT, total.value),
    go: (p) => reload(p),
  }
})
const passCount = computed(() => items.value.filter(r => r.ai_status === 'PASS').length)
const failCount = computed(() => items.value.filter(r => r.ai_status === 'FAIL').length)
const avgPercent = computed(() => {
  const scored = items.value.filter(r => r.score != null && r.maximum_score > 0)
  if (!scored.length) return 0
  return Math.round(scored.reduce((s, r) => s + r.score / r.maximum_score, 0) / scored.length * 1000) / 10
})

// Guard anti race-condition: hanya respons dari request TERAKHIR yang dipakai.
// Pola sama persis dengan TranscriptsView.vue (fetchTickets): AbortController
// membatalkan request sebelumnya, requestId memastikan respons/error yang
// telat dari request lama tidak pernah menimpa state dengan data basi yang
// filter-nya sudah tidak cocok (mis. dua filter diganti cepat, atau pager
// diklik dobel).
let requestId = 0
let inFlight = null // AbortController

async function reload(p = page.value) {
  page.value = p
  // Filter/halaman berganti → daftar akan dimuat ulang, jadi baris yang
  // sedang terbuka (kalau ada) ditutup dulu supaya CollectionResultPanel-nya
  // di-unmount (poll/abort berhenti) alih-alih menampilkan hasil tiket yang
  // mungkin sudah tidak ada di halaman/filter baru.
  expandedResultId.value = null
  if (inFlight) inFlight.abort()
  const ctrl = new AbortController()
  inFlight = ctrl
  const myId = ++requestId

  loading.value = true
  error.value = ''
  try {
    const { data } = await apiClient.get('/collection/results', {
      params: {
        page: page.value, limit: LIMIT,
        ticket_id: ticketId.value || undefined, ai_status: aiStatus.value || undefined,
        status: status.value || undefined,
        date_start: dateStart.value || undefined, date_end: dateEnd.value || undefined,
      },
      signal: ctrl.signal,
    })
    if (myId !== requestId) return // sudah ada request yang lebih baru
    items.value = data.items
    total.value = data.total
  } catch (e) {
    if (e.name === 'AbortError' || e.name === 'CanceledError') return
    if (myId !== requestId) return
    error.value = e?.response?.data?.detail || 'Gagal memuat hasil Collection.'
  } finally {
    if (myId === requestId) {
      loading.value = false
      inFlight = null
    }
  }
}

let timer
function debounced() { clearTimeout(timer); timer = setTimeout(() => reload(1), 350) }
function reset() { ticketId.value = dateStart.value = dateEnd.value = aiStatus.value = status.value = ''; reload(1) }
function toggleRow(row) {
  expandedResultId.value = expandedResultId.value === row.result_id ? null : row.result_id
}

onMounted(() => reload(1))
onUnmounted(() => {
  clearTimeout(timer)
  if (inFlight) inFlight.abort()
})
</script>

<style scoped>
/* Kelas berikut disalin apa adanya dari TranscriptsView.vue (Step 1) supaya tampilan
   filter bar/tabel/skeleton/error konsisten dengan menu lain. */
.filter-bar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.text-input, .select-input {
  padding: 8px 12px; border: 1.5px solid var(--border); border-radius: 8px;
  font-size: 13px; color: var(--text); outline: none; background: #fff; transition: border-color 0.2s;
}
.text-input { min-width: 240px; }
.date-input { min-width: 160px; }
.select-input { min-width: 150px; }
.text-input:focus, .select-input:focus { border-color: var(--blue); }
.btn-clear { padding: 8px 16px; background: #f1f5f9; border: 1.5px solid var(--border); border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--text-muted); transition: all 0.15s; }
.btn-clear:hover { background: #e2e8f0; color: var(--text); }
.error-box { padding: 10px 14px; margin-bottom: 12px; background: var(--red-bg); color: var(--red); border: 1px solid var(--red); border-radius: 8px; font-size: 13px; }
.table-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.data-table th { background: #f8fafc; padding: 10px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 1px solid var(--border); text-align: left; word-break: break-word; }
.data-row { cursor: pointer; }
.data-row td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px; vertical-align: top; word-break: break-word; }
.data-row:hover td { background: #f8fafc; }
.data-row:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.data-row.expanded td { background: var(--blue-bg); }
.expand-icon { margin-right: 4px; color: var(--text-muted); font-size: 10px; }
.expand-row td { padding: 0; background: #fafbfc; }
.expand-content { padding: 16px 20px; border-bottom: 1px solid var(--border); }
.full-page-link { display: inline-block; margin-bottom: 12px; font-size: 12px; font-weight: 600; color: var(--blue); text-decoration: none; }
.full-page-link:hover { text-decoration: underline; }
.cell-strong { font-weight: 700; word-break: break-all; }
.cell-date { color: var(--text-muted); }
.num { text-align: left; }
.empty { text-align: center; padding: 40px; color: var(--text-muted); }
.skeleton-list { display: flex; flex-direction: column; gap: 8px; }
.skeleton-row { height: 52px; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200%; border-radius: 8px; animation: shimmer 1.2s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Ringkasan halaman + badge verdict, mengikuti token warna yang sudah ada di
   App.vue (:root) — bukan hex baru — supaya konsisten dengan tema dashboard. */
.summary-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 14px; }
.summary-tile { background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.summary-tile .k { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); font-weight: 600; }
.summary-tile .v { font-size: 22px; font-weight: 700; }
.mono { font-family: var(--font-mono), 'IBM Plex Mono', ui-monospace, monospace; }
.pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid transparent; }
.tone-success { color: var(--green); } .pill.tone-success { background: var(--green-bg); border-color: var(--green); }
.tone-danger { color: var(--red); }  .pill.tone-danger { background: var(--red-bg); border-color: var(--red); }
.tone-warning { color: var(--yellow); } .pill.tone-warning { background: var(--yellow-bg); border-color: var(--yellow); }
.tone-muted { color: var(--text-muted); }   .pill.tone-muted { background: #f1f5f9; border-color: var(--border); }
</style>
