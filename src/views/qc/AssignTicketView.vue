<template>
  <SidebarLayout title="Assign Ticket">
    <div class="assign-page">
      <div class="tab-group">
        <button :class="['tab', { active: tab === 'assign' }]" @click="tab = 'assign'">Assign Ticket</button>
        <button :class="['tab', { active: tab === 'log' }]" @click="tab = 'log'">Log QC</button>
      </div>

      <div v-if="tab === 'assign'" class="card">
        <h2 class="card-title">Assign Ticket ke QC</h2>
        <p class="card-subtitle">
          Bagikan Data Leads ke QC. Satu ticket hanya untuk satu QC — QC hanya bisa
          melihat &amp; mengajukan banding untuk ticket yang di-assign kepadanya.
        </p>

        <div class="toolbar">
          <input v-model.trim="search" class="text-input search" type="search" placeholder="Cari Data Leads… (tak ada di tanggal ini: semua tanggal)" />
          <input v-model="loadDate" class="text-input filter" type="date" title="Kosongkan = data kemarin (H-1)" @change="loadAll" />
          <select v-model="campaignFilter" class="text-input filter" title="Assign Otomatis &amp; Lepas Semua ikut campaign ini">
            <option value="">Semua campaign</option>
            <option v-for="c in campaigns" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-model="assigneeFilter" class="text-input filter">
            <option value="">Semua</option>
            <option value="__none__">Belum di-assign</option>
            <option v-for="q in qcUsers" :key="q.username" :value="q.username">{{ q.name || q.username }}</option>
          </select>
          <span class="count">{{ filtered.length }} / {{ tickets.length }} ticket</span>
          <!-- Membagi SEMUA ticket yang belum punya QC, bukan hanya yang lolos
               filter cari/QC: kedua filter itu alat pandang, bukan pilihan pembagian.
               Pengecualiannya filter CAMPAIGN (13 Oktober 2026): bila dipilih, hanya
               ticket campaign itu yang dibagi. -->
          <button
            class="btn-auto"
            :disabled="loading || autoBusy || !unassigned.length || !qcUsers.length"
            :title="describeSplit(autoCount, autoQcCount)"
            @click="autoAssign"
          >{{ autoBusy ? 'Membagi…' : `⚡ Assign Otomatis (${autoCount})` }}</button>
          <!-- Kebalikan dari Assign Otomatis: melepas assignment ticket TANGGAL yang
               sedang dimuat (12 Oktober 2026; sebelumnya seluruh tanggal), sekali
               klik lewat DELETE /qc_assignment. Filter cari/QC tidak ikut; filter
               campaign ikut — sama seperti Assign Otomatis. Riwayat Manual Status tidak ikut terhapus. -->
          <button class="btn-revoke" :disabled="loading || revokeBusy || !assignedOnDate.length" @click="revokeAll">
            {{ revokeBusy ? 'Melepas…' : revokeLabel }}
          </button>
          <button class="btn-refresh" :disabled="loading" @click="loadAll">↻ Muat ulang</button>
        </div>

        <!-- Jadwal batch otomatis (GET /qc_assignment/schedule, diport dari 4-service
             5 Oktober 2026). Sejak 13 Oktober 2026 jalan tiap 5 menit: tiket App C
             H-0/H-1 yang statusnya sudah done langsung dibagi rata harian; yang belum
             done dicoba lagi di putaran berikutnya. Tombol manual tetap jalan kapan saja. Saklarnya QC_AUTO_ASSIGN_ENABLED
             (default mati) — saat mati, banner hanya menyebut statusnya. -->
        <div v-if="schedule" class="schedule-bar" :class="{ off: !schedule.enabled }">
          <template v-if="schedule.enabled">
            <span class="countdown-label">Auto assign berikutnya</span>
            <span class="countdown mono">{{ countdownText }}</span>
            <span class="muted">({{ nextSlotLabel }} WIB)</span>
          </template>
          <span v-else class="countdown-label">Auto assign terjadwal dimatikan</span>
          <span class="slots">
            Jadwal (tiket done H-0/H-1):
            <span v-for="sl in schedule.slots" :key="sl" class="slot-chip"
                  :class="{ next: schedule.enabled && sl === nextSlotLabel }">{{ sl }}</span>
          </span>
        </div>

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        <div v-if="autoMsg" class="ok-msg">{{ autoMsg }}</div>
        <div v-if="revokeMsg" class="ok-msg">{{ revokeMsg }}</div>

        <div class="table-wrap">
          <table class="assign-table">
            <thead>
              <tr>
                <th>Data Leads</th>
                <th>Campaign</th>
                <th>Status</th>
                <th>QC ditugaskan</th>
                <th>Assign Date</th>
                <th>Checked At</th>
                <th>Approved At</th>
                <th class="col-action">Assign ke</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="8" class="empty">Memuat…</td></tr>
              <tr v-else-if="!filtered.length && outsideLoading"><td colspan="8" class="empty">Mencari di semua tanggal…</td></tr>
              <tr v-else-if="!filtered.length"><td colspan="8" class="empty">
                Tidak ada ticket yang cocok.<template v-if="search"> Ticket di luar tanggal ini dicari di semua tanggal (minimal 4 karakter).</template>
              </td></tr>
              <tr v-for="t in filtered" :key="t.id">
                <td class="mono">
                  {{ t.id || '—' }}
                  <span v-if="t.outsideDaily" class="pill pill-outside" title="Tidak ada di tickets-daily tanggal yang dimuat. Tidak ikut Assign Otomatis / Lepas Semua di layar ini.">di luar tanggal ini</span>
                </td>
                <td>{{ t.campaigns.join(', ') || '—' }}</td>
                <td><span class="pill">{{ t.status }}</span></td>
                <td>
                  <span v-if="t.assigned_qc" class="badge badge-yellow">{{ qcLabel(t.assigned_qc) }}</span>
                  <span v-else class="muted">— belum —</span>
                </td>
                <td class="cell-date">{{ t.assigned_at ? formatDate(t.assigned_at) : '—' }}</td>
                <!-- Tiga tahap sebuah tiket, terpisah supaya alurnya transparan
                     (3 September 2026):
                       Assign Date = kapan Team Leader QC menugaskannya,
                       Checked At  = kapan QC men-SUBMIT Manual Status-nya,
                       Approved At = kapan vonis itu DISETUJUI atasan.
                     Sebelumnya kolom bernama "Approved At" diisi qc_checked_at — dua
                     peristiwa berbeda ditampilkan sebagai satu. -->
                <td class="cell-date">
                  <template v-if="t.qc_checked_at">
                    <span class="approved-at">{{ formatDate(t.qc_checked_at) }}</span>
                    <span v-if="t.qc_checked_by" class="approved-by">{{ t.qc_checked_by }}</span>
                  </template>
                  <span v-else class="muted">— belum —</span>
                </td>
                <td class="cell-date">
                  <template v-if="t.manual_approved_at">
                    <span class="approved-at">{{ formatDate(t.manual_approved_at) }}</span>
                    <span v-if="t.manual_approved_by" class="approved-by">{{ t.manual_approved_by }}</span>
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
                  <button v-if="t.assigned_qc" class="btn-history" title="Riwayat assign ticket ini di semua tanggal" @click="openTicketHistory(t.id)">Riwayat</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="note">
          Sumber: tickets-daily (H-1). Kosongkan tanggal untuk memakai data kemarin.
          Kolom cari yang tidak cocok dengan tanggal ini mencari di <b>semua tanggal</b>,
          sama seperti menu Transkrip — hasilnya ditandai <i>di luar tanggal ini</i>.
          <b>Assign Otomatis</b> dan <b>Lepas Semua</b> mengikuti <b>tanggal</b> dan
          <b>campaign</b> yang dipilih (tidak terpengaruh kolom cari / filter QC). Lepas
          Semua tidak menghapus hasil Manual Status yang sudah disubmit QC.
        </div>
      </div>

      <div v-else class="card">
        <h2 class="card-title">Log Assign QC</h2>
        <p class="card-subtitle">
          <b>Riwayat</b>: setiap assign, pindah, dan lepas pada tanggal terpilih — dari QC
          mana ke QC mana, oleh siapa, lewat jalur apa (tercatat sejak 12 Oktober 2026).
          Isi <b>Riwayat ticket</b> untuk melihat seluruh riwayat satu ticket di semua tanggal.
          <b>Kepemilikan</b>: tiket yang dipegang tiap QC <b>saat ini</b>, menurut tanggal
          assign terakhirnya.
        </p>

        <div class="toolbar">
          <label class="dr-label">Tanggal</label>
          <input type="date" v-model="logDate" class="text-input" @change="onLogDateChange" />
          <button class="btn-refresh" :disabled="logLoading" @click="setToday">Hari Ini</button>
          <button class="btn-refresh" :disabled="logLoading || ticketLoading" @click="reloadLog">↻ Muat ulang</button>
        </div>

        <div v-if="logError" class="error-msg">{{ logError }}</div>

        <div class="tab-group">
          <button :class="['tab', 'tab-sm', { active: logView === 'riwayat' }]" @click="logView = 'riwayat'">Riwayat</button>
          <button :class="['tab', 'tab-sm', { active: logView === 'kepemilikan' }]" @click="logView = 'kepemilikan'">Kepemilikan</button>
        </div>

        <!-- Riwayat lengkap dari qc_assignment_events (GET /qc_assignment/events, 12
             Oktober 2026), terbaru dulu. Baris "Data awal" = kepemilikan yang sudah
             ada saat tabel riwayat dibuat; perpindahan sebelum itu tidak tersimpan. -->
        <template v-if="logView === 'riwayat'">
          <!-- Riwayat SATU ticket di semua tanggal (13 Oktober 2026): GET
               /qc_assignment/events?ticket_id=… tanpa batas tanggal. Ticket id harus
               persis — server mencocokkan dengan "=". Cakupan campaign tetap berlaku. -->
          <form class="toolbar" @submit.prevent="searchTicketHistory">
            <label class="dr-label">Riwayat ticket</label>
            <input v-model.trim="ticketQuery" class="text-input search" type="search" placeholder="Ticket id (persis), semua tanggal" />
            <button class="btn-refresh" type="submit" :disabled="!ticketQuery || ticketLoading">
              {{ ticketLoading ? 'Mencari…' : 'Cari semua tanggal' }}
            </button>
            <button v-if="ticketHistory" class="btn-refresh" type="button" @click="clearTicketHistory">✕ Kembali ke {{ logPeriodLabel }}</button>
          </form>
          <div v-if="ticketError" class="error-msg">{{ ticketError }}</div>

          <div class="toolbar">
            <span v-if="ticketHistory" class="panel-title">Riwayat Data Leads {{ ticketHistory.ticketId }} — semua tanggal</span>
            <span v-else class="panel-title">Riwayat Assignment — {{ logPeriodLabel }}</span>
            <input v-model.trim="eventSearch" class="text-input search" type="search" placeholder="Saring Data Leads / QC / pelaku…" />
            <span class="count">{{ filteredEvents.length }} / {{ shownEvents.length }} kejadian</span>
          </div>
          <div v-if="shownTruncated" class="note">Hanya 5.000 kejadian terbaru yang ditampilkan.</div>
          <div v-if="logLoading || ticketLoading" class="empty">Memuat…</div>
          <div v-else class="table-wrap">
            <table class="assign-table">
              <thead>
                <tr><th>Waktu</th><th>Data Leads</th><th>Aksi</th><th>Dari QC</th><th>Ke QC</th><th>Oleh</th><th>Jalur</th></tr>
              </thead>
              <tbody>
                <tr v-if="!filteredEvents.length"><td colspan="7" class="empty">{{ ticketHistory
                  ? 'Tidak ada riwayat untuk ticket ini (id tidak persis sama, di luar cakupan Anda, atau perpindahannya sebelum 12 Oktober 2026).'
                  : 'Tidak ada riwayat pada tanggal ini.' }}</td></tr>
                <tr v-for="e in filteredEvents" :key="e.id">
                  <td class="cell-date">{{ formatDate(e.created_at) }}</td>
                  <td class="mono">{{ e.ticket_id }}</td>
                  <td><span :class="['badge', `badge-${eventActionLabel(e.action).tone}`]">{{ eventActionLabel(e.action).text }}</span></td>
                  <td>{{ e.previous_qc_name || '—' }}</td>
                  <td>{{ e.qc_name || '—' }}</td>
                  <td class="muted">{{ e.actor_username || '—' }}</td>
                  <td><span class="pill">{{ eventSourceLabel(e.source) }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-else>

        <!-- Ringkasan per QC — total tiket & persentasenya terhadap SELURUH tiket yang
             ter-assign pada HARI terpilih, supaya ketahuan apakah pembagiannya sudah
             merata. Untuk hari ini mencakup SEMUA QC aktif walau jatahnya 0 — QC yang
             tidak kebagian sama sekali justru info paling penting untuk pengecekan
             merata. -->
        <div class="panel-title">Ringkasan per QC — {{ logPeriodLabel }}</div>
        <div v-if="logLoading" class="empty">Memuat…</div>
        <div v-else class="table-wrap">
          <table class="assign-table">
            <thead>
              <tr><th>QC</th><th>Jumlah Data Leads</th></tr>
            </thead>
            <tbody>
              <tr v-if="!dailySummary.length"><td colspan="2" class="empty">Tidak ada QC untuk ditampilkan.</td></tr>
              <tr v-for="row in dailySummary" :key="row.qc_username">
                <td><span class="badge badge-yellow">{{ row.qc_name }}</span></td>
                <td>{{ row.count }} <span class="muted">({{ row.pct }}%)</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="panel-title" style="margin-top: 18px">Rincian Tiket</div>
        <div v-if="logLoading" class="empty">Memuat…</div>
        <div v-else-if="!logDays.length" class="empty">Tidak ada assignment pada tanggal ini.</div>
        <div v-else class="log-days">
          <div v-for="day in logDays" :key="day.date" class="day-card">
            <div class="day-head">
              <span class="day-label">{{ dayLabel(day.date) }}</span>
              <span class="day-total">{{ day.total }} ticket</span>
            </div>
            <div class="table-wrap">
              <table class="assign-table">
                <thead>
                  <tr>
                    <th>QC</th>
                    <th class="num-col">Jumlah</th>
                    <th>Data Leads</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="q in day.qc" :key="q.qc_username">
                    <td><span class="badge badge-yellow">{{ q.qc_name }}</span></td>
                    <td class="num-col mono">{{ q.count }}</td>
                    <td class="ticket-ids">
                      <span v-for="tid in q.ticket_ids" :key="tid" class="mono ticket-chip">{{ tid }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </template>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'
import {
  groupTickets, joinLocalResults, describeSplit, chunkTicketIds,
  campaignOptions, filterByCampaign, rowsOutsideDaily,
  eventActionLabel, eventSourceLabel, filterEvents,
} from './assignTicketData.js'

// Baris tiket diambil lewat App B (`GET /tickets_daily`), bukan menembak App C
// langsung dari browser: permintaan langsung tidak melewati App B sehingga
// pembatasan campaign (`rbac.effective_campaigns_for`) tidak berlaku — login yang
// dibatasi ke campaign Collection tetap bisa meng-assign tiket ACT02/LOC26.
// Paginasi App C (maks 100/halaman) dan X-API-Key ikut pindah ke server.
// Sama seperti TranscriptsView.vue.

// Paginasi /list_results (App B) — masih dilakukan di sini, lihat fetchLocalResults.
const FETCH_LIMIT = 100
const MAX_FETCH_PAGES = 100
// Banyaknya ticket id per permintaan. Bukan batas server, melainkan batas panjang
// query string yang masuk akal — daftar dipotong, bukan dipendekkan.
const TICKET_IDS_PER_REQUEST = 200

const tab = ref('assign') // 'assign' | 'log'
const tickets = ref([])
const qcUsers = ref([])
const loading = ref(true)
const errorMsg = ref('')
const search = ref('')
const assigneeFilter = ref('')
const campaignFilter = ref('') // kosong = semua campaign
const loadDate = ref('')   // kosong -> tidak dikirim -> API pakai mode "yesterday"
const pick = ref({})       // ticket_id -> selected qc username
const busy = ref(null)     // ticket_id currently mutating
const autoBusy = ref(false)
const autoMsg = ref('')

let inFlight = null        // AbortController permintaan tickets-daily terakhir
let requestId = 0          // penanda anti balapan antar-permintaan
// "Lepas Semua" (DELETE /qc_assignment) — lihat assignedOnDate.
const revokeBusy = ref(false)
const revokeMsg = ref('')

function qcLabel(username) {
  const q = qcUsers.value.find((u) => u.username === username)
  return q?.name || username
}

const campaigns = computed(() => campaignOptions(tickets.value))
// Baris termuat yang masuk campaign terpilih. Berbeda dengan filter cari/QC, filter
// campaign ikut menentukan apa yang dibagi Assign Otomatis dan dilepas Lepas Semua.
// Server tetap mengiris ticket_ids-nya dengan cakupan login, jadi filter ini hanya
// bisa mempersempit, tidak pernah melebarkan.
const campaignRows = computed(() => filterByCampaign(tickets.value, campaignFilter.value))

// Yang belum punya QC DI ANTARA baris yang termuat (dan campaign terpilih). Dipakai
// untuk mengirim daftar ticket_ids ke server — bukan untuk angka di tombol, lihat
// scopeUnassigned.
const unassigned = computed(() => campaignRows.value.filter((t) => !t.assigned_qc))

// Angka SEBENARNYA antrean dalam cakupan login ini, dari GET /qc_assignment/unassigned.
// Tabel ini hanya memuat ticket H-1 yang lolos filter, sedangkan Auto Assign membagi
// SELURUH antrean dalam cakupan — memakai panjang baris di layar akan menjanjikan
// jumlah yang salah. null = belum/ gagal dimuat, dan tombolnya lalu jatuh kembali ke
// hitungan baris yang termuat.
const scopeUnassigned = ref(null)
const scopeQcCount = ref(null)
// Yang dilepas "Lepas Semua": ticket TANGGAL yang dimuat yang sudah punya QC.
// Semua baris tanggal itu termuat (tickets-daily dipaginasi server) dan kolom QC-nya
// dari GET /qc_assignments dengan cakupan yang sama dengan DELETE, jadi angka di
// tombol = yang akan dilepas.
const assignedOnDate = computed(() => campaignRows.value.filter((t) => t.assigned_qc))
const revokeLabel = computed(() =>
  assignedOnDate.value.length ? `✕ Lepas Semua (${assignedOnDate.value.length})` : '✕ Lepas Semua')
// Dengan filter campaign, yang dikirim ke server persis `unassigned` — angka antrean
// se-cakupan dari /qc_assignment/unassigned tidak lagi berlaku (server mengenal nama
// campaign `results`, bukan kode App C di baris ini).
const autoCount = computed(() =>
  campaignFilter.value ? unassigned.value.length : (scopeUnassigned.value ?? unassigned.value.length))
const autoQcCount = computed(() => scopeQcCount.value ?? qcUsers.value.length)

async function loadUnassignedSummary() {
  try {
    const res = await apiClient.get('/qc_assignment/unassigned')
    scopeUnassigned.value = Number(res.data?.unassigned ?? 0)
    scopeQcCount.value = Number(res.data?.qc_count ?? 0)
  } catch {
    scopeUnassigned.value = null
    scopeQcCount.value = null
  }
}

function passesAssignee(t) {
  if (assigneeFilter.value === '__none__' && t.assigned_qc) return false
  if (assigneeFilter.value && assigneeFilter.value !== '__none__' && t.assigned_qc !== assigneeFilter.value) return false
  return true
}

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  const rows = campaignRows.value.filter((t) => {
    if (q && !String(t.id || '').toLowerCase().includes(q)) return false
    return passesAssignee(t)
  })
  // Hasil cari lintas tanggal hanya mengisi tabel bila tanggal ini tidak punya
  // yang cocok — lihat lookupOutsideDaily.
  return rows.length ? rows : outsideRows.value.filter(passesAssignee)
})

// Cari LINTAS TANGGAL (13 Oktober 2026), sama seperti kolom cari menu Transkrip:
// bila kolom cari tidak cocok dengan satu baris pun di tanggal yang dimuat,
// GET /tickets_daily?tiket_id= (substring, tanpa tanggal = semua tanggal) lalu
// diperkaya /list_results + /qc_assignments seperti baris biasa. Ticket yang tidak
// pernah lewat App C (upload langsung ke `results`) jatuh ke pencarian id PERSIS di
// /list_results + /qc_assignments. Baris ini sengaja di luar `tickets`: Assign
// Otomatis & Lepas Semua tetap per tanggal.
const OUTSIDE_MIN_CHARS = 4 // substring sependek ini bisa menarik puluhan ribu baris
const outsideRows = ref([])
const outsideLoading = ref(false)
let outsideTimer = null
let outsideReq = 0

async function fetchOutsideDaily(q) {
  const loaded = new Set(tickets.value.map((t) => t.id))
  const res = await apiClient.get('/tickets_daily', { params: { tiket_id: q } })
  const groups = groupTickets(res.data.items || []).filter((g) => !loaded.has(g.id))
  if (!groups.length) {
    const [local, assignments] = await Promise.all([fetchLocalResults([q]), fetchAssignments([q])])
    return rowsOutsideDaily([q], local, assignments)
  }
  const ids = groups.map((g) => g.id)
  const [local, assignments] = await Promise.all([
    fetchLocalResults(ids).catch(() => []),
    fetchAssignments(ids).catch(() => []),
  ])
  return joinLocalResults(groups, local, assignments).map((r) => ({ ...r, outsideDaily: true }))
}

async function lookupOutsideDaily() {
  const q = search.value
  const myId = ++outsideReq
  const known = q && tickets.value.some((t) => String(t.id || '').toLowerCase().includes(q.toLowerCase()))
  if (!q || q.length < OUTSIDE_MIN_CHARS || known) {
    outsideRows.value = []
    outsideLoading.value = false
    return
  }
  outsideLoading.value = true
  try {
    const rows = await fetchOutsideDaily(q)
    if (myId === outsideReq) outsideRows.value = rows
  } catch {
    if (myId === outsideReq) outsideRows.value = []
  } finally {
    if (myId === outsideReq) outsideLoading.value = false
  }
}

watch(search, () => {
  clearTimeout(outsideTimer)
  outsideRows.value = []
  outsideLoading.value = search.value.length >= OUTSIDE_MIN_CHARS
  outsideTimer = setTimeout(lookupOutsideDaily, 400)
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

// Data lokal untuk ticket yang TAMPIL saja (`ticket_ids`), dipotong supaya query
// string tidak tak terbatas. Tiap potongan tetap dipaginasi: satu ticket bisa
// punya beberapa result (upload ulang), jadi jumlah barisnya tidak sama dengan
// jumlah ticket yang diminta.
//
// Sebelum ini halaman menarik /list_results halaman demi halaman TANPA satu pun
// filter — sampai 10.000 baris — lalu membuang hampir semuanya, padahal tabelnya
// cuma menampilkan tiket satu hari.
async function fetchLocalResults(ticketIds) {
  const collected = []
  for (const chunk of chunkTicketIds(ticketIds, TICKET_IDS_PER_REQUEST)) {
    const ids = chunk.join(',')
    let p = 1
    while (p <= MAX_FETCH_PAGES) {
      const res = await apiClient.get('/list_results', {
        params: { page: p, limit: FETCH_LIMIT, ticket_ids: ids },
      })
      const items = res.data.items || []
      collected.push(...items)
      if (collected.length >= (res.data.total || 0) || items.length === 0) break
      p += 1
    }
  }
  return collected
}

// Assignment untuk ticket yang tampil saja — dulu seluruh riwayat assignment.
async function fetchAssignments(ticketIds) {
  const collected = []
  for (const chunk of chunkTicketIds(ticketIds, TICKET_IDS_PER_REQUEST)) {
    const res = await apiClient.get('/qc_assignments', { params: { ticket_ids: chunk.join(',') } })
    collected.push(...(res.data || []))
  }
  return collected
}

async function loadAll() {
  // Sengaja tidak di-await: angka antrean tidak boleh menunda tabelnya, dan
  // kegagalannya sudah ditangani sendiri (jatuh ke hitungan baris yang termuat).
  loadUnassignedSummary()
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
    // Pengayaan diminta untuk ticket yang akan DITAMPILKAN saja — id-nya baru
    // diketahui setelah tickets-daily selesai, jadi dua permintaan di bawah tidak
    // bisa ikut Promise.all di atas.
    const groups = groupTickets(daily)
    const ticketIds = groups.map((g) => g.id)
    // Kegagalan /list_results TIDAK membatalkan tabel: assign hanya butuh ticket
    // id, jadi baris tetap tampil dengan kolom QC kosong.
    let local = []
    try {
      local = await fetchLocalResults(ticketIds)
    } catch {
      local = []
    }
    // Sumber kebenaran kolom QC. Wajib dibaca terpisah: /list_results hanya
    // memuat ticket yang sudah punya baris result, sehingga assignment untuk
    // ticket yang belum diproses tidak akan pernah ikut terbawa di sana.
    let assignments = []
    try {
      assignments = await fetchAssignments(ticketIds)
    } catch {
      assignments = []
    }
    if (myId !== requestId) return
    tickets.value = joinLocalResults(groups, local, assignments)
    lookupOutsideDaily()
    // Campaign terpilih tidak ada di tanggal yang baru dimuat -> kembali ke semua,
    // supaya tabel tidak kosong tanpa sebab yang terlihat.
    if (campaignFilter.value && !campaigns.value.includes(campaignFilter.value)) campaignFilter.value = ''
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
    // Kosongkan pilihan setelah berhasil — sama seperti unassign(). Tanpa ini
    // dropdown & tombol Assign tetap "aktif" seolah belum ke-submit (25 September 2026).
    pick.value[t.id] = ''
    loadUnassignedSummary()
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
  const camp = campaignFilter.value ? `Campaign ${campaignFilter.value}: ` : ''
  if (!window.confirm(`${camp}${describeSplit(pending.length, autoQcCount.value)}\n\nLanjutkan?`)) return

  autoBusy.value = true
  errorMsg.value = ''
  autoMsg.value = ''
  try {
    const form = new FormData()
    for (const t of pending) form.append('ticket_ids', t.id)
    // Tanggal yang sama dengan tabel ini, supaya server membaca campaign App C
    // tiket-tiketnya untuk pembagian rata per campaign.
    if (loadDate.value) form.append('load_date', loadDate.value)
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
    // Antreannya baru saja menyusut — angka di tombol harus ikut, tanpa memuat
    // ulang seluruh tabel.
    loadUnassignedSummary()
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
    loadUnassignedSummary()
  } catch (e) {
    errorMsg.value = e.response?.data?.detail || 'Gagal melepas assignment.'
  } finally {
    busy.value = null
  }
}

// Lepas assignment ticket tanggal yang dimuat sekaligus (DELETE /qc_assignment
// dengan `ticket_ids`, 12 Oktober 2026) — kebalikan dari autoAssign(), dan seperti
// tombol itu mengikuti tanggal. Server mengiris daftarnya dengan cakupan login dan
// melepas semuanya dalam satu commit.
async function revokeAll() {
  const ids = assignedOnDate.value.map((t) => t.id)
  if (!ids.length) return
  const tanggal = loadDate.value || 'kemarin (H-1)'
  if (!window.confirm(
    `Lepas ${ids.length} ticket yang sudah di-assign pada tanggal ${tanggal}`
      + (campaignFilter.value ? ` (campaign ${campaignFilter.value})` : '') + '?\n\n' +
    'Assignment-nya akan dihapus (QC kehilangan akses ke tiket itu), tetapi hasil ' +
    'Manual Status yang sudah disubmit QC TIDAK ikut terhapus. Tindakan ini tidak bisa dibatalkan.'
  )) return
  revokeBusy.value = true
  errorMsg.value = ''
  revokeMsg.value = ''
  try {
    const form = new FormData()
    for (const id of ids) form.append('ticket_ids', id)
    const res = await apiClient.delete('/qc_assignment', { data: form })
    const removed = res.data?.removed ?? 0
    revokeMsg.value = removed
      ? `${removed} assignment dilepas.`
      : 'Tidak ada assignment untuk dilepas.'
    await loadAll()
  } catch (e) {
    errorMsg.value = e.response?.data?.detail || 'Gagal melepas semua assignment.'
  } finally {
    revokeBusy.value = false
  }
}

// --- Jadwal auto assign + countdown ---------------------------------------
// Hitung mundur memakai jam SERVER (selisih `now` server vs jam browser disimpan di
// `clockSkewMs`), jadi tetap benar walau jam browser pemakai meleset. Saat mencapai
// nol, jadwal diminta ulang dan tabel dimuat ulang (batch-nya mungkin baru jalan).
const schedule = ref(null)
const remainingSec = ref(0)
let clockSkewMs = 0
let tickTimer = null

const pad2 = (n) => String(n).padStart(2, '0')
const countdownText = computed(() => {
  const t = Math.max(0, remainingSec.value)
  return `${pad2(Math.floor(t / 3600))}:${pad2(Math.floor((t % 3600) / 60))}:${pad2(t % 60)}`
})
// Jam:menit WIB dari next_run_at. Server mengirim offset +07:00, tapi sengaja
// diformat ulang ke Asia/Jakarta ketimbang dipotong dari string, supaya tidak ikut
// salah kalau suatu saat server mengirim UTC.
const nextSlotLabel = computed(() => {
  if (!schedule.value?.next_run_at) return ''
  return new Date(schedule.value.next_run_at).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
  })
})

async function loadSchedule() {
  try {
    const res = await apiClient.get('/qc_assignment/schedule')
    schedule.value = res.data
    clockSkewMs = new Date(res.data.now).getTime() - Date.now()
    tick()
  } catch {
    schedule.value = null // jadwal hanya pelengkap; layar tetap bisa dipakai tanpanya
  }
}

let refreshing = false
async function tick() {
  if (!schedule.value?.enabled) return
  const target = new Date(schedule.value.next_run_at).getTime()
  remainingSec.value = Math.max(0, Math.ceil((target - (Date.now() + clockSkewMs)) / 1000))
  if (remainingSec.value === 0 && !refreshing) {
    refreshing = true
    try {
      // Beri worker beberapa detik menyelesaikan batch sebelum data dimuat ulang.
      await new Promise((r) => setTimeout(r, 5000))
      await loadSchedule()
      await loadAll()
    } finally {
      refreshing = false
    }
  }
}

onMounted(() => {
  loadAll()
  loadSchedule()
  tickTimer = setInterval(tick, 1000)
})
onBeforeUnmount(() => { clearInterval(tickTimer); clearTimeout(outsideTimer) })

// --- Log QC (tab kedua) ----------------------------------------------------
const logDays = ref([])
const logLoading = ref(false)
const logError = ref('')
// Riwayat lengkap (qc_assignment_events) — tampilan bawaan tab Log QC.
const logView = ref('riwayat')
const events = ref([])
const eventsTruncated = ref(false)
const eventSearch = ref('')
// Riwayat satu ticket lintas tanggal. null = tidak aktif (tabel menampilkan tanggal
// terpilih); selain itu { ticketId, events, truncated }.
const ticketQuery = ref('')
const ticketHistory = ref(null)
const ticketLoading = ref(false)
const ticketError = ref('')
const shownEvents = computed(() => (ticketHistory.value ? ticketHistory.value.events : events.value))
const shownTruncated = computed(() => (ticketHistory.value ? ticketHistory.value.truncated : eventsTruncated.value))
const filteredEvents = computed(() => filterEvents(shownEvents.value, eventSearch.value))

async function searchTicketHistory() {
  const tid = ticketQuery.value
  if (!tid) return
  ticketLoading.value = true
  ticketError.value = ''
  try {
    const res = await apiClient.get('/qc_assignment/events', { params: { ticket_id: tid } })
    ticketHistory.value = {
      ticketId: tid,
      events: res.data?.events || [],
      truncated: !!res.data?.truncated,
    }
  } catch (e) {
    ticketError.value = e.response?.data?.detail || 'Gagal memuat riwayat ticket.'
  } finally {
    ticketLoading.value = false
  }
}

// Dari baris tabel Assign Ticket: langsung ke riwayat ticket itu di tab Log QC.
function openTicketHistory(id) {
  ticketQuery.value = id
  logView.value = 'riwayat'
  tab.value = 'log'
  searchTicketHistory()
}

function clearTicketHistory() {
  ticketHistory.value = null
  ticketError.value = ''
}

// Ganti tanggal = kembali ke tampilan per tanggal; muat ulang ikut memuat ulang
// riwayat ticket yang sedang dibuka.
function onLogDateChange() {
  clearTicketHistory()
  loadLog()
}

function reloadLog() {
  loadLog()
  if (ticketHistory.value) {
    ticketQuery.value = ticketHistory.value.ticketId
    searchTicketHistory()
  }
}
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
// Satu hari saja — default hari ini menurut kalender WIB, bukan zona waktu browser,
// supaya cocok dengan tanggal yang dikelompokkan backend.
const wibToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
const logDate = ref(wibToday())

function setToday() {
  logDate.value = wibToday()
  onLogDateChange()
}

function formatDateID(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d} ${MONTHS_ID[m - 1]} ${y}`
}

const logPeriodLabel = computed(() => formatDateID(logDate.value) || 'pilih tanggal')

// Ringkasan per QC untuk tanggal terpilih: total tiket + persentasenya terhadap
// SELURUH tiket yang ter-assign hari itu. Daftar QC aktif hanya dipakai untuk HARI
// INI: riwayat aktif/nonaktif per hari tidak disimpan, jadi untuk tanggal lampau
// yang ditampilkan hanya QC yang benar-benar kebagian tiket hari itu.
const dailySummary = computed(() => {
  const totals = new Map()
  if (logDate.value === wibToday()) {
    for (const u of qcUsers.value) {
      totals.set(u.username, { qc_username: u.username, qc_name: u.name || u.username, count: 0 })
    }
  }
  for (const day of logDays.value) {
    for (const q of day.qc) {
      if (!totals.has(q.qc_username)) {
        totals.set(q.qc_username, { qc_username: q.qc_username, qc_name: q.qc_name, count: 0 })
      }
      totals.get(q.qc_username).count += q.count
    }
  }
  const rows = Array.from(totals.values())
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  return rows
    .map((r) => ({ ...r, pct: total ? Math.round((r.count / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.count - a.count || a.qc_name.localeCompare(b.qc_name))
})

// "Hari ini"/"Kemarin" dihitung dari kalender WIB, tidak dari mem-parse `day.date`
// sebagai Date (bisa geser sehari kalau zona waktu browser bukan WIB).
function dayLabel(dateStr) {
  const formatted = formatDateID(dateStr)
  const yesterdayWib = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  if (dateStr === wibToday()) return `Hari Ini — ${formatted}`
  if (dateStr === yesterdayWib) return `Kemarin — ${formatted}`
  return formatted
}

async function loadLog() {
  logLoading.value = true
  logError.value = ''
  try {
    const params = {
      date_start: logDate.value || undefined,
      date_end: logDate.value || undefined,
    }
    const [res, ev] = await Promise.all([
      apiClient.get('/qc_assignment/log', { params }),
      apiClient.get('/qc_assignment/events', { params }),
    ])
    logDays.value = res.data?.days || []
    events.value = ev.data?.events || []
    eventsTruncated.value = !!ev.data?.truncated
  } catch (e) {
    logError.value = e.response?.data?.detail || 'Gagal memuat log QC.'
  } finally {
    logLoading.value = false
  }
}

// Muat saat tab Log QC pertama kali dibuka, bukan saat halaman dimuat.
let logLoaded = false
watch(tab, (t) => {
  if (t === 'log' && !logLoaded) {
    logLoaded = true
    loadLog()
  }
})
</script>

<style scoped>
.assign-page { display: flex; flex-direction: column; gap: 20px; }
.tab-group { display: flex; gap: 6px; }
.tab { padding: 9px 16px; border: 1.5px solid var(--border); border-radius: 8px; background: #fff; font-size: 13px; font-weight: 700; color: var(--text-muted); cursor: pointer; }
.tab.active { background: var(--blue); border-color: var(--blue); color: #fff; }
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
.btn-revoke { padding: 8px 14px; border: 1.5px solid #fecaca; border-radius: 8px; background: #fff; color: var(--red); font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.btn-revoke:disabled { opacity: 0.5; cursor: not-allowed; }

.table-wrap { overflow-x: auto; }
.assign-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.assign-table th { text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 2px solid var(--border); white-space: nowrap; }
.assign-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.mono { font-family: ui-monospace, monospace; }
.muted { color: var(--text-muted); }
.cell-date { white-space: nowrap; font-size: 12px; color: var(--text-muted); }
.approved-at { display: block; color: #16a34a; font-weight: 600; }
.approved-by { display: block; font-size: 11px; margin-top: 2px; }
.btn-history { margin-left: 4px; padding: 6px 10px; border: 1.5px solid var(--border); border-radius: 6px; background: #fff; font-size: 12px; font-weight: 700; color: var(--blue); cursor: pointer; }
.pill { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: #f1f5f9; color: var(--text-muted); text-transform: capitalize; }
.pill-outside { margin-left: 6px; background: #fef3c7; color: #92400e; text-transform: none; }
.badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.badge-yellow { background: var(--yellow-bg); color: var(--yellow); }
.badge-green { background: #dcfce7; color: #15803d; }
.badge-blue { background: #dbeafe; color: #1d4ed8; }
.badge-red { background: var(--red-bg); color: var(--red); }
.badge-gray { background: #f1f5f9; color: var(--text-muted); }
.tab-sm { padding: 6px 12px; font-size: 12px; }
.col-action { white-space: nowrap; }
.pick { padding: 6px 8px; min-width: 130px; font-size: 13px; }
.btn-assign { margin-left: 6px; padding: 6px 12px; background: var(--blue); color: #fff; border: none; border-radius: 7px; font-size: 13px; font-weight: 700; cursor: pointer; }
.btn-assign:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-unassign { margin-left: 6px; padding: 6px 10px; background: #fff; color: var(--red); border: 1.5px solid #fecaca; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; }
.empty { text-align: center; color: var(--text-muted); padding: 24px; }
.note { font-size: 12px; color: var(--text-muted); }
.error-msg { background: var(--red-bg); color: var(--red); border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; }

.panel-title { font-size: 14px; font-weight: 700; }
.schedule-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 14px; border: 1px solid #bfdbfe; border-radius: 8px; background: #eff6ff; font-size: 13px; }
.schedule-bar.off { background: #f1f5f9; border-color: var(--border); }
.countdown-label { font-weight: 700; }
.countdown { font-size: 16px; font-weight: 700; color: var(--blue); }
.slots { margin-left: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: var(--text-muted); font-size: 12px; }
.slot-chip { font-family: ui-monospace, monospace; padding: 2px 8px; border-radius: 999px; background: #fff; border: 1px solid var(--border); }
.slot-chip.next { background: var(--blue); border-color: var(--blue); color: #fff; font-weight: 700; }

.dr-label { font-size: 13px; color: var(--text-muted); font-weight: 600; }
.log-days { display: flex; flex-direction: column; gap: 18px; }
.day-card { border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; }
.day-head { display: flex; align-items: baseline; justify-content: space-between; }
.day-label { font-size: 14px; font-weight: 700; }
.day-total { font-size: 12px; color: var(--text-muted); }
.num-col { white-space: nowrap; }
.ticket-ids { display: flex; flex-wrap: wrap; gap: 6px; }
.ticket-chip { font-size: 11px; background: #f1f5f9; color: var(--text-muted); padding: 2px 8px; border-radius: 999px; }
</style>
