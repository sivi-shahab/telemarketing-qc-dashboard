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
      <!-- Reprocess All / Delete All (Admin only) — sama dengan menu Results:
           menyasar SELURUH tiket yang cocok dengan filter di atas, bukan hanya
           halaman yang tampak. Server memilih tiketnya lewat filter & cakupan
           menu Collection (POST /collection/...), bukan /list_results. -->
      <button
        v-if="canReprocessTicket"
        class="btn-reprocess-all"
        :disabled="bulkPreviewLoading || !!bulkJob"
        title="Proses ulang semua tiket yang cocok dengan filter saat ini"
        @click="openBulkModal"
      >
        <span v-if="bulkPreviewLoading" class="spinner spinner-blue"></span>
        {{ bulkPreviewLoading ? 'Menghitung...' : 'Reprocess All' }}
      </button>
      <button
        v-if="canDeleteTicket"
        class="btn-delete-all"
        :disabled="delAllPreviewLoading || !!bulkJob"
        title="Hapus semua tiket yang cocok dengan filter saat ini"
        @click="openDelAllModal"
      >
        <span v-if="delAllPreviewLoading" class="spinner spinner-red"></span>
        {{ delAllPreviewLoading ? 'Menghitung...' : 'Delete All' }}
      </button>
      <span v-if="delAllBarError" class="bulk-err">{{ delAllBarError }}</span>
    </div>

    <!-- Strip progres job Reprocess All. Job massal berlaku global (satu pada satu
         waktu), jadi job yang dimulai dari menu Results juga tampil di sini. -->
    <div v-if="bulkJob" class="bulk-bar">
      <span class="spinner spinner-blue"></span>
      <span class="bulk-text">
        Reprocess All berjalan —
        <strong>{{ bulkDone }}/{{ bulkJob.total_tickets }}</strong> selesai
        <template v-if="bulkJob.counts?.failed"> · {{ bulkJob.counts.failed }} gagal</template>
      </span>
      <button class="bulk-cancel" :disabled="bulkCancelling" @click="cancelBulkJob">
        {{ bulkCancelling ? 'Membatalkan...' : 'Batalkan' }}
      </button>
      <span v-if="bulkError" class="bulk-err">{{ bulkError }}</span>
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
            <th v-if="showActionColumn">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="items.length === 0"><td :colspan="colCount" class="empty">Tidak ada data.</td></tr>
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
              <!-- Reprocess di atas, Delete di bawah — sama dengan menu Results.
                   Keduanya bekerja per ticket id (semua entry tiket ini), bukan
                   per baris result. @click/@keydown.stop: jangan ikut membuka baris. -->
              <td v-if="showActionColumn" class="cell-actions" @click.stop @keydown.stop>
                <button
                  v-if="canReprocessTicket"
                  class="btn-reprocess-row"
                  :disabled="!row.ticket_id || reprocessBusy(row)"
                  :title="reprocessTitle(row)"
                  @click="openReprocessModal(row)"
                >
                  <span v-if="reprocessBusy(row)" class="spinner spinner-blue"></span>
                  {{ reprocessBusy(row) ? 'Memproses...' : 'Reprocess' }}
                </button>
                <button
                  v-if="canDeleteTicket"
                  class="btn-delete-row"
                  :disabled="!row.ticket_id || reprocessBusy(row)"
                  @click="openDeleteModal(row)"
                >Delete</button>
                <span
                  v-if="reprocessError[row.ticket_id]"
                  class="row-reprocess-err"
                  :title="reprocessError[row.ticket_id]"
                >Reprocess gagal</span>
              </td>
            </tr>
            <tr v-if="expandedResultId === row.result_id" class="expand-row">
              <td :colspan="colCount">
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

    <!-- Delete per tiket: dua langkah, sama dengan menu Results. -->
    <Teleport to="body">
      <div v-if="deleteItem" class="modal-overlay" @click.self="closeDeleteModal">
        <div class="del-modal-card" role="dialog" aria-modal="true">
          <header class="del-modal-head">
            <h2 class="del-modal-title">Hapus Record</h2>
            <button class="del-close-x" @click="closeDeleteModal">✕</button>
          </header>
          <div v-if="deleteStep === 1" class="del-modal-body">
            <p>Anda akan menghapus <strong>SEMUA entry</strong> untuk tiket
              <strong>{{ deleteItem.ticket_id }}</strong>.</p>
            <p class="del-warn">Tindakan ini permanen dan tidak dapat dibatalkan.</p>
          </div>
          <div v-else class="del-modal-body">
            <p>Konfirmasi sekali lagi. Ketik Tiket ID <strong>{{ deleteItem.ticket_id }}</strong> untuk menghapus semua entry-nya.</p>
            <input v-model="deleteConfirmText" class="del-input" placeholder="Ketik Tiket ID..." @keyup.enter="confirmDelete" />
            <p v-if="deleteError" class="del-error">{{ deleteError }}</p>
          </div>
          <footer class="del-modal-foot">
            <button class="del-btn-cancel" :disabled="deleting" @click="closeDeleteModal">Batal</button>
            <button v-if="deleteStep === 1" class="del-btn-next" @click="deleteStep = 2">Lanjut</button>
            <button v-else class="del-btn-confirm" :disabled="deleting || deleteConfirmText.trim() !== deleteItem.ticket_id" @click="confirmDelete">
              <span v-if="deleting" class="spinner"></span>
              {{ deleting ? 'Menghapus...' : 'Hapus Permanen' }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- Reprocess per tiket: satu konfirmasi; entry lama dihapus worker setelah
         hasil barunya jadi. -->
    <Teleport to="body">
      <div v-if="reprocessItem" class="modal-overlay" @click.self="closeReprocessModal">
        <div class="del-modal-card" role="dialog" aria-modal="true">
          <header class="del-modal-head">
            <h2 class="del-modal-title title-blue">Reprocess Ticket</h2>
            <button class="del-close-x" @click="closeReprocessModal">✕</button>
          </header>
          <div class="del-modal-body">
            <p>Tiket <strong>{{ reprocessItem.ticket_id }}</strong> akan dievaluasi ulang
              memakai konfigurasi campaign
              <strong>{{ reprocessItem.campaign || '—' }}</strong> yang berlaku sekarang.</p>
            <p>Setelah hasil barunya jadi, <strong>semua entry lama</strong> tiket ini
              dihapus sehingga tersisa tepat satu entry.</p>
            <p class="del-warn">Kalau reproses gagal, entry lama dipertahankan apa adanya.</p>
            <p v-if="reprocessModalError" class="del-error">{{ reprocessModalError }}</p>
          </div>
          <footer class="del-modal-foot">
            <button class="del-btn-cancel" :disabled="reprocessStarting" @click="closeReprocessModal">Batal</button>
            <button class="del-btn-run" :disabled="reprocessStarting" @click="confirmReprocess">
              <span v-if="reprocessStarting" class="spinner"></span>
              {{ reprocessStarting ? 'Menjalankan...' : 'Proses Ulang' }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- Reprocess All: konfirmasi yang menyebut ONGKOSNYA (jumlah panggilan LLM). -->
    <Teleport to="body">
      <div v-if="bulkPreview" class="modal-overlay" @click.self="closeBulkModal">
        <div class="del-modal-card" role="dialog" aria-modal="true">
          <header class="del-modal-head">
            <h2 class="del-modal-title title-blue">Reprocess All</h2>
            <button class="del-close-x" @click="closeBulkModal">✕</button>
          </header>
          <div class="del-modal-body">
            <p v-if="activeFilterLabels.length">Filter yang berlaku:</p>
            <ul v-if="activeFilterLabels.length" class="bulk-filters">
              <li v-for="f in activeFilterLabels" :key="f">{{ f }}</li>
            </ul>
            <p v-else class="del-warn"><strong>Tidak ada filter aktif</strong> — ini
              menyentuh SELURUH tiket Collection yang bisa Anda lihat.</p>
            <table class="bulk-count">
              <tr><td>Cocok dengan filter</td><td>{{ bulkPreview.matched }} tiket</td></tr>
              <tr v-if="bulkPreview.skipped">
                <td>Sedang direproses</td><td>{{ bulkPreview.skipped }} tiket → dilewati</td>
              </tr>
              <tr class="bulk-count-total">
                <td>Diproses</td><td><strong>{{ bulkPreview.will_process }} tiket</strong></td>
              </tr>
            </table>
            <p v-if="bulkPreview.will_process">Sebanyak itu pula panggilan LLM-nya,
              sekitar <strong>{{ bulkEta }}</strong>. Tiap tiket dievaluasi ulang memakai
              konfigurasi campaign yang berlaku sekarang, lalu entry lamanya dihapus
              setelah hasil barunya jadi.</p>
            <p class="del-warn">Tiket yang gagal dipertahankan apa adanya.</p>
            <p v-if="bulkModalError" class="del-error">{{ bulkModalError }}</p>
          </div>
          <footer class="del-modal-foot">
            <button class="del-btn-cancel" :disabled="bulkStarting" @click="closeBulkModal">Batal</button>
            <button
              class="del-btn-run"
              :disabled="bulkStarting || !bulkPreview.will_process"
              @click="confirmBulkReprocess"
            >
              <span v-if="bulkStarting" class="spinner"></span>
              {{ bulkStarting ? 'Menjalankan...' : `Proses Ulang ${bulkPreview.will_process} Tiket` }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- Delete All: dua langkah dengan ketikan, sama dengan menu Results. -->
    <Teleport to="body">
      <div v-if="delAllPreview" class="modal-overlay" @click.self="closeDelAllModal">
        <div class="del-modal-card" role="dialog" aria-modal="true">
          <header class="del-modal-head">
            <h2 class="del-modal-title">Delete All</h2>
            <button class="del-close-x" @click="closeDelAllModal">✕</button>
          </header>
          <div v-if="delAllStep === 1" class="del-modal-body">
            <p v-if="activeFilterLabels.length">Filter yang berlaku:</p>
            <ul v-if="activeFilterLabels.length" class="bulk-filters">
              <li v-for="f in activeFilterLabels" :key="f">{{ f }}</li>
            </ul>
            <p v-else class="del-warn"><strong>Tidak ada filter aktif</strong> — ini
              menghapus SELURUH tiket Collection yang bisa Anda lihat.</p>
            <table class="bulk-count">
              <tr><td>Cocok dengan filter</td><td>{{ delAllPreview.matched }} tiket</td></tr>
              <tr v-if="delAllPreview.skipped">
                <td>Sedang direproses</td><td>{{ delAllPreview.skipped }} tiket → dilewati</td>
              </tr>
              <tr class="bulk-count-total">
                <td>Dihapus</td>
                <td><strong>{{ delAllPreview.will_delete }} tiket · {{ delAllPreview.results }} entry</strong></td>
              </tr>
            </table>
            <p v-if="delAllPreview.campaigns.length">Campaign yang tersentuh:
              <strong>{{ delAllPreview.campaigns.join(', ') }}</strong>.</p>
            <p class="del-warn"><strong>Tindakan ini tidak bisa dibatalkan.</strong></p>
          </div>
          <div v-else class="del-modal-body">
            <p>Konfirmasi sekali lagi. Ketik <strong>{{ DEL_ALL_PHRASE }}</strong> untuk
              menghapus <strong>{{ delAllPreview.will_delete }} tiket</strong>
              ({{ delAllPreview.results }} entry) secara permanen.</p>
            <input
              v-model="delAllConfirmText"
              class="del-input"
              :placeholder="`Ketik ${DEL_ALL_PHRASE}...`"
              @keyup.enter="confirmDeleteAll"
            />
            <p v-if="delAllModalError" class="del-error">{{ delAllModalError }}</p>
          </div>
          <footer class="del-modal-foot">
            <button class="del-btn-cancel" :disabled="delAllDeleting" @click="closeDelAllModal">Batal</button>
            <button
              v-if="delAllStep === 1"
              class="del-btn-next"
              :disabled="!delAllPreview.will_delete"
              @click="delAllStep = 2"
            >Lanjut</button>
            <button
              v-else
              class="del-btn-confirm"
              :disabled="delAllDeleting || delAllConfirmText.trim() !== DEL_ALL_PHRASE"
              @click="confirmDeleteAll"
            >
              <span v-if="delAllDeleting" class="spinner"></span>
              {{ delAllDeleting ? 'Menghapus...' : 'Hapus Permanen' }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </SidebarLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import TablePager from '../../components/TablePager.vue'
import CollectionResultPanel from '../../components/collection/CollectionResultPanel.vue'
import apiClient from '../../api/client.js'
import { useAuthStore } from '../../stores/auth.js'
import { P } from '../../permissions.js'
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

// `silent`: muat ulang di belakang layar (poll job reproses) — tanpa skeleton dan
// tanpa menutup baris yang sedang terbuka.
async function reload(p = page.value, { silent = false } = {}) {
  page.value = p
  // Filter/halaman berganti → daftar akan dimuat ulang, jadi baris yang
  // sedang terbuka (kalau ada) ditutup dulu supaya CollectionResultPanel-nya
  // di-unmount (poll/abort berhenti) alih-alih menampilkan hasil tiket yang
  // mungkin sudah tidak ada di halaman/filter baru.
  if (!silent) expandedResultId.value = null
  if (inFlight) inFlight.abort()
  const ctrl = new AbortController()
  inFlight = ctrl
  const myId = ++requestId

  if (!silent) loading.value = true
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
    // Result yang sedang terbuka sudah tidak ada (dihapus / diganti hasil reproses).
    if (expandedResultId.value && !data.items.some(r => r.result_id === expandedResultId.value)) {
      expandedResultId.value = null
    }
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

// --- Reprocess / Delete (Admin only) ------------------------------------------
// Kembaran aksi di menu Results (ResultsView.vue) dan memakai endpoint yang SAMA
// untuk per-tiket (/reprocess_ticket, /delete_ticket — keduanya per ticket id;
// worker sendiri yang membelokkan tiket Collection ke jalur berbobot). Hanya
// Reprocess All / Delete All yang punya endpoint sendiri di /collection/, karena
// pemilihan tiketnya harus mengikuti filter menu INI.
const auth = useAuthStore()
const canDeleteTicket = computed(() => auth.can(P.ADMIN_TICKET_DELETE))
const canReprocessTicket = computed(() => auth.can(P.ADMIN_TICKET_REPROCESS))
const showActionColumn = computed(() => canDeleteTicket.value || canReprocessTicket.value)
const colCount = computed(() => 9 + (showActionColumn.value ? 1 : 0))

// Filter layar dalam bentuk body POST — nama field sama persis dengan parameter
// GET /collection/results supaya tidak ada filter yang diam-diam hilang.
function filterBody() {
  return {
    ticket_id: ticketId.value || undefined, ai_status: aiStatus.value || undefined,
    status: status.value || undefined,
    date_start: dateStart.value || undefined, date_end: dateEnd.value || undefined,
  }
}
const activeFilterLabels = computed(() => {
  const out = []
  if (ticketId.value) out.push(`Tiket ID mengandung: ${ticketId.value.trim()}`)
  if (aiStatus.value) out.push(`Hasil: ${aiStatus.value === 'PASS' ? 'Pass' : 'Fail'}`)
  if (status.value) out.push(`Status Proses: ${STATUS_LABEL[status.value] || status.value}`)
  if (dateStart.value || dateEnd.value) out.push(`Tanggal: ${dateStart.value || '…'} s/d ${dateEnd.value || '…'}`)
  return out
})

// Setelah sebuah aksi menghapus baris: halaman terakhir yang kosong mundur satu.
function reloadAfterRemoval() {
  const p = items.value.length <= 1 && page.value > 1 ? page.value - 1 : page.value
  return reload(p, { silent: true })
}

// Delete per tiket.
const deleteItem = ref(null)
const deleteStep = ref(1)
const deleteConfirmText = ref('')
const deleting = ref(false)
const deleteError = ref('')

function openDeleteModal(row) {
  deleteItem.value = row
  deleteStep.value = 1
  deleteConfirmText.value = ''
  deleteError.value = ''
}
function closeDeleteModal() {
  if (deleting.value) return
  deleteItem.value = null
}
async function confirmDelete() {
  if (!deleteItem.value) return
  const tid = deleteItem.value.ticket_id
  if (deleteConfirmText.value.trim() !== tid) {
    deleteError.value = 'Ketikan Tiket ID tidak cocok.'
    return
  }
  deleting.value = true
  deleteError.value = ''
  try {
    await apiClient.delete('/delete_ticket', { params: { ticket_id: tid } })
    deleting.value = false
    deleteItem.value = null
    await reloadAfterRemoval()
  } catch (e) {
    deleting.value = false
    if (e.response?.status === 403) deleteError.value = 'Anda tidak punya izin menghapus record.'
    else if (e.response?.status === 404) deleteError.value = 'Tiket tidak ditemukan (mungkin sudah terhapus).'
    else deleteError.value = 'Gagal menghapus record. Coba lagi.'
  }
}

// Reprocess per tiket. Dua sumber status "sibuk", sama alasannya dengan
// ResultsView: `reprocessActive` = job yang dimulai dari layar ini (tombol
// langsung berubah), `row.reprocess_active` = menurut server (bertahan setelah
// refresh / pindah menu).
const reprocessItem = ref(null)
const reprocessStarting = ref(false)
const reprocessModalError = ref('')
const reprocessActive = ref({})   // ticket_id -> job_id
const reprocessError = ref({})    // ticket_id -> pesan kegagalan terakhir
const reprocessTimers = {}

const reprocessBusy = (row) => !!row && (!!reprocessActive.value[row.ticket_id] || !!row.reprocess_active)
const reprocessTitle = (row) => (reprocessBusy(row)
  ? 'Tiket ini sedang diproses ulang'
  : 'Proses ulang tiket ini dengan konfigurasi campaign terbaru, lalu hapus entry lamanya')

function openReprocessModal(row) {
  if (reprocessBusy(row)) return
  reprocessItem.value = row
  reprocessModalError.value = ''
}
function closeReprocessModal() {
  if (reprocessStarting.value) return
  reprocessItem.value = null
}
function setMapEntry(mapRef, key, value) {
  const next = { ...mapRef.value }
  if (value) next[key] = value
  else delete next[key]
  mapRef.value = next
}
async function confirmReprocess() {
  if (!reprocessItem.value) return
  const tid = reprocessItem.value.ticket_id
  reprocessStarting.value = true
  reprocessModalError.value = ''
  try {
    const res = await apiClient.post('/reprocess_ticket', null, { params: { ticket_id: tid } })
    setMapEntry(reprocessError, tid, '')
    setMapEntry(reprocessActive, tid, res.data.job_id)
    reprocessItem.value = null
    pollReprocess(tid, res.data.job_id)
  } catch (e) {
    const detail = e.response?.data?.detail
    reprocessModalError.value = typeof detail === 'string' ? detail : 'Gagal menjalankan reproses. Coba lagi.'
  } finally {
    reprocessStarting.value = false
  }
}
async function pollReprocess(tid, jobId) {
  try {
    const { data: job } = await apiClient.get(`/reprocess_job/${jobId}`)
    if (job.status === 'running') {
      reprocessTimers[tid] = setTimeout(() => pollReprocess(tid, jobId), 4000)
      return
    }
    setMapEntry(reprocessActive, tid, null)
    const it = (job.items || [])[0]
    if (it && it.status === 'done') await reload(page.value, { silent: true })
    else setMapEntry(reprocessError, tid, it?.error_message || 'Reproses tidak selesai — entry lama dipertahankan.')
  } catch {
    // Gagal memantau bukan berarti jobnya gagal — lepaskan tombolnya saja.
    setMapEntry(reprocessActive, tid, null)
  }
}

// Reprocess All.
const bulkPreview = ref(null)
const bulkPreviewLoading = ref(false)
const bulkStarting = ref(false)
const bulkCancelling = ref(false)
const bulkModalError = ref('')
const bulkError = ref('')
const bulkJob = ref(null)
let bulkTimer = null

const bulkDone = computed(() => {
  const c = bulkJob.value?.counts
  return c ? (c.done || 0) + (c.failed || 0) + (c.skipped || 0) : 0
})
// Perkiraan kasar yang sama dengan menu Results: 8 worker paralel, ~4,5 menit/tiket.
const bulkEta = computed(() => {
  const n = bulkPreview.value?.will_process || 0
  const menit = Math.ceil((n / 8) * 4.5)
  if (menit < 60) return `${menit} menit`
  const jam = Math.floor(menit / 60)
  const sisa = menit % 60
  return sisa ? `${jam} jam ${sisa} menit` : `${jam} jam`
})

async function openBulkModal() {
  bulkPreviewLoading.value = true
  bulkModalError.value = ''
  bulkError.value = ''
  try {
    const res = await apiClient.post('/collection/reprocess_filter_preview', filterBody())
    bulkPreview.value = res.data
  } catch (e) {
    const detail = e.response?.data?.detail
    bulkError.value = typeof detail === 'string' ? detail : 'Gagal menghitung jumlah tiket.'
  } finally {
    bulkPreviewLoading.value = false
  }
}
function closeBulkModal() {
  if (bulkStarting.value) return
  bulkPreview.value = null
}
async function confirmBulkReprocess() {
  bulkStarting.value = true
  bulkModalError.value = ''
  try {
    const res = await apiClient.post('/collection/reprocess_filtered', filterBody())
    bulkJob.value = res.data
    bulkPreview.value = null
    scheduleBulkPoll(res.data.job_id)
    await reload(page.value, { silent: true })
  } catch (e) {
    const detail = e.response?.data?.detail
    bulkModalError.value = typeof detail === 'string' ? detail : 'Gagal menjalankan reproses massal.'
  } finally {
    bulkStarting.value = false
  }
}
async function loadBulkJob(jobId) {
  try {
    const res = await apiClient.get(`/reprocess_job/${jobId}`)
    if (res.data.status === 'running') {
      bulkJob.value = res.data
      scheduleBulkPoll(jobId)
      return
    }
    bulkJob.value = null
    stopBulkPolling()
    await reload(page.value, { silent: true })
  } catch {
    bulkJob.value = null
    stopBulkPolling()
  }
}
function scheduleBulkPoll(jobId) {
  stopBulkPolling()
  bulkTimer = setTimeout(() => loadBulkJob(jobId), 7000)
}
function stopBulkPolling() {
  if (bulkTimer) clearTimeout(bulkTimer)
  bulkTimer = null
}
async function cancelBulkJob() {
  if (!bulkJob.value) return
  if (!window.confirm('Batalkan job? Tiket yang sedang diproses tetap diselesaikan.')) return
  bulkCancelling.value = true
  bulkError.value = ''
  try {
    await apiClient.post(`/reprocess_job/${bulkJob.value.job_id}/cancel`)
    await loadBulkJob(bulkJob.value.job_id)
  } catch {
    bulkError.value = 'Gagal membatalkan job.'
  } finally {
    bulkCancelling.value = false
  }
}
// Sambung kembali job massal yang masih berjalan setelah refresh / pindah menu.
async function resumeBulkJob() {
  if (!canReprocessTicket.value) return
  try {
    const res = await apiClient.get('/reprocess_jobs', { params: { limit: 5 } })
    const running = (res.data.jobs || []).find((j) => j.status === 'running')
    if (running) await loadBulkJob(running.job_id)
  } catch { /* strip progres memang tidak wajib ada */ }
}

// Delete All.
const DEL_ALL_PHRASE = 'HAPUS SEMUA'
const delAllPreview = ref(null)
const delAllPreviewLoading = ref(false)
const delAllStep = ref(1)
const delAllConfirmText = ref('')
const delAllDeleting = ref(false)
const delAllModalError = ref('')
const delAllBarError = ref('')

async function openDelAllModal() {
  delAllPreviewLoading.value = true
  delAllBarError.value = ''
  delAllModalError.value = ''
  delAllStep.value = 1
  delAllConfirmText.value = ''
  try {
    const res = await apiClient.post('/collection/delete_tickets_preview', filterBody())
    delAllPreview.value = res.data
  } catch (e) {
    const detail = e.response?.data?.detail
    delAllBarError.value = typeof detail === 'string' ? detail : 'Gagal menghitung jumlah tiket.'
  } finally {
    delAllPreviewLoading.value = false
  }
}
function closeDelAllModal() {
  if (delAllDeleting.value) return
  delAllPreview.value = null
}
async function confirmDeleteAll() {
  if (!delAllPreview.value) return
  if (delAllConfirmText.value.trim() !== DEL_ALL_PHRASE) {
    delAllModalError.value = `Ketikan tidak cocok — ketik persis ${DEL_ALL_PHRASE}.`
    return
  }
  delAllDeleting.value = true
  delAllModalError.value = ''
  try {
    // Filternya dikirim ULANG — server menghitung sasarannya sendiri.
    await apiClient.post('/collection/delete_tickets_filtered', filterBody())
    delAllPreview.value = null
    await reload(1)
  } catch (e) {
    const st = e.response?.status
    const detail = e.response?.data?.detail
    if (st === 403) delAllModalError.value = 'Anda tidak punya izin menghapus record.'
    else if (st === 404) delAllModalError.value = typeof detail === 'string' ? detail : 'Tidak ada tiket yang cocok (mungkin sudah terhapus).'
    else delAllModalError.value = 'Gagal menghapus record. Coba lagi.'
  } finally {
    delAllDeleting.value = false
  }
}

onMounted(() => {
  reload(1)
  resumeBulkJob()
})
onUnmounted(() => {
  clearTimeout(timer)
  if (inFlight) inFlight.abort()
  Object.values(reprocessTimers).forEach((t) => clearTimeout(t))
  stopBulkPolling()
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

/* Reprocess / Delete — disalin dari ResultsView.vue supaya kedua menu identik. */
.btn-reprocess-all, .btn-delete-all {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 16px; background: #fff; border: 1.5px solid var(--blue);
  border-radius: 8px; font-size: 13px; font-weight: 700; color: var(--blue);
  transition: all 0.15s;
}
.btn-reprocess-all:hover:not(:disabled) { background: var(--blue); color: #fff; }
.btn-delete-all { border-color: #dc2626; color: #dc2626; }
.btn-delete-all:hover:not(:disabled) { background: #dc2626; color: #fff; }
.btn-reprocess-all:disabled, .btn-delete-all:disabled { opacity: 0.55; cursor: not-allowed; }
.bulk-bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 10px 14px; margin-bottom: 16px;
  background: #f0f7ff; border: 1.5px solid #b9d9f7; border-radius: 8px;
  font-size: 13px; color: #14406b;
}
.bulk-bar .bulk-text { flex: 1 1 320px; }
.bulk-cancel {
  padding: 7px 14px; border-radius: 8px; border: 1.5px solid currentColor;
  background: transparent; font-size: 12px; font-weight: 700; color: inherit;
}
.bulk-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
.bulk-err { font-size: 12px; font-weight: 700; color: var(--red); }
.bulk-filters { margin: 4px 0 12px; padding-left: 20px; display: flex; flex-direction: column; gap: 3px; }
.bulk-count { width: 100%; margin: 4px 0 12px; border-collapse: collapse; font-size: 13px; }
.bulk-count td { padding: 5px 0; }
.bulk-count td:last-child { text-align: right; }
.bulk-count-total td { border-top: 1.5px solid var(--border); padding-top: 8px; }

.data-row td.cell-actions { cursor: default; }
.cell-actions > * + * { margin-top: 5px; }
.btn-reprocess-row, .btn-delete-row {
  display: flex; width: 100%; align-items: center; justify-content: center; gap: 6px;
  padding: 5px 10px; background: var(--blue-bg); border: 1.5px solid var(--blue);
  border-radius: 8px; font-size: 12px; font-weight: 700; color: var(--blue);
  transition: all 0.15s; white-space: nowrap; cursor: pointer;
}
.btn-reprocess-row:hover:not(:disabled) { background: var(--blue); color: #fff; }
.btn-delete-row { background: #fef2f2; border-color: #dc2626; color: #dc2626; }
.btn-delete-row:hover:not(:disabled) { background: #dc2626; color: #fff; }
.btn-reprocess-row:disabled, .btn-delete-row:disabled { opacity: 0.55; cursor: not-allowed; }
.row-reprocess-err { display: block; font-size: 11px; font-weight: 700; color: var(--red); cursor: help; }

.spinner {
  display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
.spinner-blue { border-color: rgba(37, 99, 235, 0.25); border-top-color: var(--blue); width: 12px; height: 12px; }
.spinner-red { border-color: rgba(220, 38, 38, 0.25); border-top-color: #dc2626; width: 12px; height: 12px; }
@keyframes spin { to { transform: rotate(360deg); } }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;
}
.del-modal-card {
  background: #fff; border-radius: 14px; width: 100%; max-width: 440px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); overflow: hidden;
}
.del-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid #e2e8f0;
}
.del-modal-title { font-size: 16px; font-weight: 800; color: #dc2626; margin: 0; }
.title-blue { color: var(--blue); }
.del-close-x { background: none; border: none; font-size: 16px; color: #1E1F21; cursor: pointer; }
.del-modal-body { padding: 18px 20px; font-size: 14px; color: #334155; line-height: 1.5; }
.del-modal-body p { margin: 0 0 10px; }
.del-warn { color: #dc2626; font-weight: 700; }
.del-input {
  width: 100%; padding: 9px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px;
  font-size: 14px; margin-top: 4px; box-sizing: border-box;
}
.del-input:focus { outline: none; border-color: #dc2626; }
.del-error { color: #dc2626; font-size: 13px; font-weight: 600; margin-top: 8px; }
.del-modal-foot {
  display: flex; align-items: center; justify-content: flex-end; gap: 10px;
  padding: 14px 20px; border-top: 1px solid #e2e8f0;
}
.del-btn-cancel {
  padding: 8px 16px; background: #f1f5f9; border: 1.5px solid #cbd5e1;
  border-radius: 8px; font-size: 13px; font-weight: 700; color: #475569; cursor: pointer;
}
.del-btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
.del-btn-next, .del-btn-confirm, .del-btn-run {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 16px; background: #dc2626; border: 1.5px solid #dc2626;
  border-radius: 8px; font-size: 13px; font-weight: 800; color: #fff; cursor: pointer;
}
.del-btn-run { background: var(--blue); border-color: var(--blue); }
.del-btn-next:disabled, .del-btn-confirm:disabled, .del-btn-run:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
