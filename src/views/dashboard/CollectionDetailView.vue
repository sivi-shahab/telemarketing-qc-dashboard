<template>
  <SidebarLayout title="Collection Results">
    <div class="detail-top">
      <RouterLink to="/dashboard/collection" class="back">‹ Kembali ke daftar</RouterLink>
      <div class="layout-toggle" v-if="data?.report">
        <button type="button" :class="{ on: layout === 'split' }" @click="setLayout('split')">Laporan + PDF</button>
        <button type="button" :class="{ on: layout === 'report' }" @click="setLayout('report')">Laporan saja</button>
      </div>
    </div>

    <div v-if="loading" class="col-card">Memuat…</div>
    <div v-else-if="error" class="error-box">{{ error }}</div>

    <template v-else-if="data">
      <div v-if="data.status === 'failed'" class="error-box">Pemrosesan gagal: {{ data.error }}</div>

      <div v-else-if="data.status !== 'done'" class="col-card">
        <h2 class="stage-title">Tiket sedang diproses</h2>
        <ol class="stages">
          <li v-for="s in data.stages" :key="s.key" :class="s.state">{{ s.label }}</li>
        </ol>
      </div>

      <div v-else-if="!data.report" class="error-box">Hasil tiket ini bukan laporan berbobot Collection (mungkin diproses sebelum fitur ini aktif). Reprocess tiket untuk menilainya ulang.</div>

      <div v-else class="detail-grid" :class="layout">
        <div class="report-col">
          <CollectionReportHeader :report="data.report" :campaign="data.campaign" />
          <CriticalCheckCard :report="data.report" />
          <DataVerificationTable :report="data.report" />
          <CategorySummaryGrid :report="data.report" />
          <ErrorCodeList :report="data.report" />
          <ScorecardDetail :report="data.report" />
        </div>
        <aside v-if="layout === 'split'" class="pdf-col">
          <CollectionPdfPanel :result-id="data.result_id" :files="data.source_files" />
        </aside>
      </div>

      <div v-if="data.report && layout === 'report'" class="pdf-below">
        <CollectionPdfPanel :result-id="data.result_id" :files="data.source_files" />
      </div>
    </template>
  </SidebarLayout>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'
import CollectionReportHeader from '../../components/collection/CollectionReportHeader.vue'
import CriticalCheckCard from '../../components/collection/CriticalCheckCard.vue'
import DataVerificationTable from '../../components/collection/DataVerificationTable.vue'
import CategorySummaryGrid from '../../components/collection/CategorySummaryGrid.vue'
import ErrorCodeList from '../../components/collection/ErrorCodeList.vue'
import ScorecardDetail from '../../components/collection/ScorecardDetail.vue'
import CollectionPdfPanel from '../../components/collection/CollectionPdfPanel.vue'
import '../../components/collection/collection.css'

const LAYOUT_KEY = 'collection.detail.layout'
const route = useRoute()
const data = ref(null)
const loading = ref(true)
const error = ref('')
const layout = ref(readLayout())
let pollTimer = null

function readLayout() {
  try { return localStorage.getItem(LAYOUT_KEY) === 'report' ? 'report' : 'split' } catch { return 'split' }
}
function setLayout(v) {
  layout.value = v
  try { localStorage.setItem(LAYOUT_KEY, v) } catch { /* abaikan */ }
}

// Guard anti race-condition, pola sama dengan CollectionView.vue (reload) dan
// CollectionPdfPanel.vue (load): AbortController membatalkan permintaan poll
// sebelumnya, requestId memastikan respons yang telat (mis. poll lama yang
// baru selesai SETELAH poll baru sudah dikirim, atau setelah param route
// berganti ke tiket lain) tidak pernah menimpa state dengan data tiket yang
// sudah tidak sedang dilihat.
let requestId = 0
let inFlight = null // AbortController

async function load() {
  clearTimeout(pollTimer)
  if (inFlight) inFlight.abort()
  const ctrl = new AbortController()
  inFlight = ctrl
  const myId = ++requestId
  const resultId = route.params.resultId

  // Poll 5-detik memanggil load() lagi dengan `data` sudah terisi — jangan
  // tampilkan lagi placeholder "Memuat…" dan menyembunyikan tahapan yang
  // sedang dipantau; hanya permintaan PERTAMA untuk sebuah tiket (data belum
  // ada, termasuk sesudah param route berganti — lihat watch di bawah, yang
  // mengosongkan `data` lebih dulu) menunjukkan placeholder tersebut.
  if (!data.value) loading.value = true
  try {
    const res = await apiClient.get(`/collection/results/${encodeURIComponent(resultId)}`, { signal: ctrl.signal })
    if (myId !== requestId) return // sudah ada permintaan yang lebih baru (poll berikut atau param route berganti)
    data.value = res.data
    error.value = ''
    // Tiket yang masih berjalan dipantau tiap 5 detik sampai selesai/gagal.
    if (['pending', 'processing'].includes(res.data.status)) pollTimer = setTimeout(load, 5000)
  } catch (e) {
    if (e.name === 'AbortError' || e.name === 'CanceledError') return
    if (myId !== requestId) return
    error.value = e?.response?.data?.detail || 'Gagal memuat detail hasil.'
  } finally {
    if (myId === requestId) {
      loading.value = false
      inFlight = null
    }
  }
}

watch(() => route.params.resultId, (next, prev) => {
  if (next && next !== prev) {
    data.value = null
    load()
  }
})

onMounted(load)
onBeforeUnmount(() => {
  clearTimeout(pollTimer)
  if (inFlight) inFlight.abort()
})
</script>

<style scoped>
.detail-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.back { font-size: 13px; font-weight: 600; color: var(--text-muted); text-decoration: none; }
.back:hover { color: var(--mega-orange); }
.layout-toggle { display: inline-flex; border: 1px solid var(--border); border-radius: 999px; overflow: hidden; background: #fff; }
.layout-toggle button { border: 0; background: transparent; padding: 6px 14px; font-size: 12px; font-weight: 600; color: var(--mega-gray-600); cursor: pointer; }
.layout-toggle button.on { background: var(--text); color: #fff; }
.detail-grid.split { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(360px, 1fr); gap: 16px; align-items: start; }
.pdf-col { position: sticky; top: 16px; height: calc(100vh - 110px); }
.pdf-below { margin-top: 16px; }
.report-col > * + * { margin-top: 16px; }
.stage-title { margin: 0 0 10px; font-size: 15px; }
.stages { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 13px; }
.stages .selesai { color: var(--green); } .stages .berjalan { color: var(--mega-orange); font-weight: 700; } .stages .menunggu { color: var(--gray); }
.error-box { background: var(--red-bg); border: 1px solid #f0bcbc; color: #7f1d1d; border-radius: 10px; padding: 12px 14px; font-size: 13px; }
@media (max-width: 1100px) { .detail-grid.split { grid-template-columns: 1fr; } .pdf-col { position: static; height: 80vh; } }
</style>
