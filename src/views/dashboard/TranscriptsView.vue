<template>
  <SidebarLayout title="Recording Tickets">
    <div class="filter-bar">
      <select v-model="filterAiStatus" class="select-input" @change="applyFilter">
        <option value="">Semua AI Status</option>
        <option value="PASS">Qualified</option>
        <option value="FAIL">Not Qualified</option>
        <option value="PENDING">Pending</option>
      </select>

      <input
        v-model="searchDate"
        type="date"
        class="text-input date-input"
        title="Pilih tanggal load_date"
        @change="applyFilter"
      />
      <button class="btn-clear" @click="clearSearch">Reset</button>
      <span class="mode-hint">{{ modeHint }}</span>
    </div>

    <div v-if="error" class="error-box">{{ error }}</div>

    <div v-if="loading" class="skeleton-list">
      <div class="skeleton-row" v-for="i in 5" :key="i"></div>
    </div>

    <div v-else class="table-card">
      <table class="data-table">
        <colgroup>
          <col style="width: 26%" />
          <col style="width: 24%" />
          <col style="width: 12%" />
          <col style="width: 24%" />
        </colgroup>
        <thead>
          <tr>
            <th>ID</th>
            <th>Campaign</th>
            <th class="num">Jumlah Tiket</th>
            <th>Tanggal Submit</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="pagedGroups.length === 0">
            <tr><td colspan="4" class="empty">Tidak ada data.</td></tr>
          </template>
          <template v-for="group in pagedGroups" :key="group.id">
            <tr
              class="data-row"
              :class="{ expanded: expandedId === group.id }"
              tabindex="0"
              role="button"
              :aria-expanded="expandedId === group.id"
              @click="toggleGroup(group)"
              @keydown.enter.prevent="toggleGroup(group)"
              @keydown.space.prevent="toggleGroup(group)"
            >
              <td class="cell-strong">
                <span class="expand-icon">{{ expandedId === group.id ? '▼' : '▶' }}</span>
                {{ group.id || '—' }}
              </td>
              <td>{{ group.campaigns.join(', ') || '—' }}</td>
              <td class="num">{{ group.items.length }}</td>
              <td class="cell-date">{{ formatDate(group.latest) }}</td>
            </tr>
            <tr v-if="expandedId === group.id" class="expand-row">
              <td colspan="4">
                <div class="expand-content">
                  <table class="sub-table">
                    <colgroup>
                      <col style="width: 26%" />
                      <col style="width: 30%" />
                      <col style="width: 12%" />
                      <col style="width: 18%" />
                      <col style="width: 14%" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Tiket ID</th>
                        <th>Agent ID</th>
                        <th>Customer</th>
                        <th>Tanggal Submit</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <!-- FIX: key gabungan. `tiket_id` saja bisa duplikat kalau satu
                           tiket di-reprocess -> Vue salah render / warning. -->
                      <tr
                        v-for="(t, i) in group.items"
                        :key="`${t.id ?? ''}-${t.tiket_id ?? ''}-${t.processed_at ?? i}`"
                        class="sub-row"
                      >
                        <td class="cell-file">{{ t.tiket_id }}</td>
                        <td>{{ t.agent_id || '—' }}</td>
                        <td>{{ t.a_number || '—' }}</td>
                        <td class="cell-upload">{{ formatDate(t.created_time) }}</td>
                        <td class="cell-open">
                          <!-- Anchor sungguhan dengan target=_blank: dibuka browser
                               secara native, jadi TIDAK kena popup blocker seperti
                               window.open() sebelumnya. Halaman tujuan yang mengambil
                               PDF dari App C dan merendernya dengan pdf.js. -->
                          <RouterLink
                            class="btn-open-row"
                            :to="pdfRoute(t)"
                            target="_blank"
                            rel="noopener"
                            @click.stop
                          >
                            Buka PDF ↗
                          </RouterLink>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <div class="pagination">
        <span class="total-info">Total: {{ groups.length }} id ({{ filteredItems.length }} tiket)</span>
        <div class="page-controls">
          <button :disabled="page === 1" @click="goPage(page - 1)" class="page-btn">‹</button>
          <span class="page-info">Hal {{ page }} / {{ totalPages }}</span>
          <button :disabled="page >= totalPages" @click="goPage(page + 1)" class="page-btn">›</button>
        </div>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'
import { campaignsInScope } from '../../utils/campaignScope.js'

// --- Konfigurasi App C (recording_tms_api + PDF stream) ---
// Same-origin call-qc; base dipakai untuk /tickets-daily dan /api/view-streams.
const C_API_BASE = (import.meta.env.VITE_TMS_API_URL || 'https://call-qc.bankmega.local').replace(/\/+$/, '')

// KEAMANAN: fallback key literal DIHAPUS dari source (key lama sudah bocor ke git
// -> harus di-rotate). Perlu diingat: semua VITE_* di-inline ke bundle JS, jadi
// key ini TETAP terlihat di DevTools siapa pun yang membuka aplikasi. Solusi
// jangka menengah: pindahkan X-API-Key ke backend call-qc dan proxy
// /tickets-daily + /api/view-streams lewat apiClient (ikut auth session user).
const X_API_KEY = import.meta.env.VITE_TMS_API_KEY || ''

const FETCH_LIMIT = 100 // /tickets-daily maks 100 per page
const MAX_FETCH_PAGES = 100 // pengaman loop
const GROUP_LIMIT = 20 // paginasi grup (per id) di layar

const allItems = ref([])
const page = ref(1)
const loading = ref(true)
const error = ref(null)
const expandedId = ref(null)

const searchTiketId = ref('')
const searchCampaign = ref('')
const searchDate = ref('')
const filterAiStatus = ref('') // filter AI status (client-side): PASS / FAIL / PENDING

// PORT dari TranscriptsView: daftar campaign aktif untuk dropdown.
const campaignOptions = ref([])

// Guard anti race-condition: hanya respons dari request TERAKHIR yang dipakai.
let requestId = 0
let inFlight = null // AbortController
let debounceTimer = null

const modeHint = computed(() => {
  if (searchDate.value) return `Mode: tanggal ${searchDate.value}`
  if (searchTiketId.value.trim() || searchCampaign.value.trim()) return 'Mode: pencarian (semua tanggal)'
  return 'Mode: load_date kemarin'
})

// Filter AI status diterapkan client-side sebelum grouping.
const filteredItems = computed(() => {
  if (!filterAiStatus.value) return allItems.value
  return allItems.value.filter((it) => normAiStatus(it.ai_status) === filterAiStatus.value)
})

// Group by `id` (satu id bisa punya banyak tiket_id). Terbaru dulu.
// [GANTI] group.latest & sort item sekarang pakai `created_time` (Tanggal
// Submit), BUKAN processed_at/inserted_at lagi -- konsisten dengan kolom
// tampilan "Tanggal Submit" di tabel induk maupun sub-tabel.
const groups = computed(() => {
  const map = new Map()
  for (const it of filteredItems.value) {
    const key = it.id ?? it.tiket_id
    let g = map.get(key)
    if (!g) {
      g = { id: key, campaigns: [], items: [], latest: it.created_time }
      map.set(key, g)
    }
    g.items.push(it)
    if (it.campaign && !g.campaigns.includes(it.campaign)) g.campaigns.push(it.campaign)
    const ts = it.created_time || 0
    if (!g.latest || ts > g.latest) g.latest = ts
  }
  const arr = Array.from(map.values())
  arr.forEach((g) =>
    g.items.sort((a, b) => (b.created_time || 0) - (a.created_time || 0)),
  )
  arr.sort((a, b) => (b.latest || 0) - (a.latest || 0))
  return arr
})

const totalPages = computed(() => Math.max(1, Math.ceil(groups.value.length / GROUP_LIMIT)))

const pagedGroups = computed(() => {
  const start = (page.value - 1) * GROUP_LIMIT
  return groups.value.slice(start, start + GROUP_LIMIT)
})

// FIX: kalau jumlah grup menyusut (mis. setelah filter status), jangan terjebak
// di halaman kosong.
watch(totalPages, (tp) => {
  if (page.value > tp) page.value = tp
})

function normAiStatus(status) {
  return (status || '').toString().trim().toUpperCase()
}

// [FIX] Deklarasi `function formatDate(value) { ... }` beserta `}` penutupnya
// hilang saat resolve konflik merge, menyisakan badan fungsi menggantung di
// scope modul -> "'return' outside of function" saat build.
function formatDate(value) {
  if (!value) return '—'

  if (typeof value === 'number') {
    return new Date(value * 1000).toLocaleString('id-ID', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    })
  }

  // String "YYYY-MM-DD HH:MM:SS.mmm" -> ganti spasi jadi 'T' (format ISO),
  // tambah 'Z' kalau belum ada info timezone -> di-parse sebagai UTC.
  const iso = String(value).trim().replace(' ', 'T')
  const withTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`
  const d = new Date(withTz)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  })
}

function pdfKey(item) {
  return item.tiket_id || item.id
}

async function fetchTickets() {
  // [FIX] Blok anti race-condition ini hilang saat merge, menyisakan `myId` dan
  // `ctrl` yang dipakai di bawah tanpa pernah didefinisikan -> ReferenceError.
  // Batalkan request sebelumnya, lalu tandai request ini dengan id unik sehingga
  // hanya respons dari panggilan TERAKHIR yang boleh menulis ke state.
  if (inFlight) inFlight.abort()
  const ctrl = new AbortController()
  inFlight = ctrl
  const myId = ++requestId

  loading.value = true
  error.value = null
  expandedId.value = null

  try {
    const collected = []
    let p = 1
    while (p <= MAX_FETCH_PAGES) {
      const url = new URL(`${C_API_BASE}/tickets-daily`)
      if (searchTiketId.value.trim()) url.searchParams.set('tiket_id', searchTiketId.value.trim())
      if (searchCampaign.value.trim()) url.searchParams.set('campaign', searchCampaign.value.trim())
      if (searchDate.value) url.searchParams.set('load_date', searchDate.value)
      url.searchParams.set('page', String(p))
      url.searchParams.set('limit', String(FETCH_LIMIT))

      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'X-API-Key': X_API_KEY },
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`Gagal memuat data tiket (HTTP ${res.status})`)
      const data = await res.json()
      const items = data.items || []
      collected.push(...items)
      if (collected.length >= (data.total || 0) || items.length === 0) break
      p += 1
    }

    if (myId !== requestId) return // sudah ada request yang lebih baru
    allItems.value = collected
  } catch (e) {
    if (e.name === 'AbortError') return
    if (myId !== requestId) return
    error.value = e.message || 'Gagal memuat data'
    allItems.value = []
  } finally {
    if (myId === requestId) {
      loading.value = false
      inFlight = null
    }
  }
}

// Active campaign names for the Campaign filter dropdown, dipersempit ke cakupan
// campaign login ini (campaignsInScope).
async function fetchCampaigns() {
  try {
    const res = await apiClient.get('/list_campaigns')
    campaignOptions.value = campaignsInScope(
      (res.data.campaigns || []).filter((c) => c.is_active).map((c) => c.name)
    )
  } catch {
    campaignOptions.value = []
  }
}

function applyFilter() {
  page.value = 1
  fetchTickets()
}

function debouncedFilter() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(applyFilter, 400)
}

function clearSearch() {
  searchTiketId.value = ''
  searchCampaign.value = ''
  searchDate.value = ''
  filterAiStatus.value = ''
  applyFilter()
}

function goPage(p) {
  page.value = p
  expandedId.value = null
}

function toggleGroup(group) {
  expandedId.value = expandedId.value === group.id ? null : group.id
}

// Route ke halaman viewer transkrip. Halaman itu yang mengambil PDF dari App C
// (/api/view-streams) dengan X-API-Key lalu merendernya via pdf.js.
//
// Menggantikan openPdf() lama yang fetch -> Blob -> window.open(). Pendekatan itu
// perlu akal-akalan popup blocker (buka tab kosong dulu, isi setelah blob siap)
// karena window.open() setelah `await` kehilangan user activation. Anchor biasa
// dengan target=_blank tidak punya masalah itu sama sekali.
function pdfRoute(item) {
  return `/dashboard/transcripts/${encodeURIComponent(pdfKey(item) || '')}`
}

onMounted(() => {
  fetchTickets()
  fetchCampaigns()
})

// FIX: bersihkan timer & request yang menggantung saat komponen di-unmount.
onUnmounted(() => {
  clearTimeout(debounceTimer)
  if (inFlight) inFlight.abort()
})
</script>

<style scoped>
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
.mode-hint { font-size: 12px; color: var(--text-muted); }
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
.cell-strong { font-weight: 700; word-break: break-all; }
.cell-date { color: var(--text-muted); }
.num { text-align: left; }
.expand-row td { padding: 0; background: #fafbfc; }
.expand-content { padding: 12px 16px 16px; border-bottom: 1px solid var(--border); }
.sub-table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.sub-table th { background: #f8fafc; padding: 8px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); text-align: left; }
.sub-row td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; vertical-align: top; word-break: break-word; }
.sub-row:last-child td { border-bottom: none; }
.sub-row:hover td { background: #f8fafc; }
.cell-file { font-family: monospace; color: var(--blue); word-break: break-all; }
.status-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; text-transform: capitalize; white-space: nowrap; }
.badge-gray { background: #f1f5f9; color: var(--text-muted); }
.badge-blue { background: var(--blue-bg); color: var(--blue); }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-red { background: var(--red-bg); color: var(--red); }
.cell-open { text-align: left; }
/* Elemen <a>, bukan <button>: perlu inline-block + reset text-decoration supaya
   tampil sama persis seperti tombol sebelumnya. */
.btn-open-row { display: inline-block; padding: 5px 10px; background: var(--blue-bg); border: 1.5px solid var(--blue); border-radius: 8px; font-size: 12px; font-weight: 700; color: var(--blue); text-decoration: none; transition: all 0.15s; white-space: nowrap; }
.btn-open-row:hover { background: var(--blue); color: #fff; }
.empty { text-align: center; padding: 40px; color: var(--text-muted); }
.pagination { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; font-size: 13px; color: var(--text-muted); border-top: 1px solid var(--border); }
.page-controls { display: flex; align-items: center; gap: 10px; }
.page-btn { padding: 4px 12px; background: #f1f5f9; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; font-weight: 700; color: var(--text); transition: background 0.15s; }
.page-btn:hover:not(:disabled) { background: #e2e8f0; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.skeleton-list { display: flex; flex-direction: column; gap: 8px; }
.skeleton-row { height: 52px; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200%; border-radius: 8px; animation: shimmer 1.2s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
</style>