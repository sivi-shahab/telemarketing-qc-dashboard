<template>
  <div class="crp">
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

      <div v-else class="crp-grid" :class="layout">
        <div class="report-col">
          <CollectionReportHeader :report="data.report" :campaign="data.campaign" />
          <CriticalCheckCard :report="data.report" />
          <DataVerificationTable :report="data.report" />
          <CategorySummaryGrid :report="data.report" />
          <ErrorCodeList :report="data.report" />
          <ScorecardDetail :report="data.report" />
        </div>
        <aside v-if="layout !== 'report'" class="pdf-col">
          <CollectionPdfPanel :result-id="data.result_id" :files="data.source_files" />
        </aside>
      </div>

      <div v-if="data.report && layout === 'report'" class="pdf-below">
        <CollectionPdfPanel :result-id="data.result_id" :files="data.source_files" />
      </div>
    </template>
  </div>
</template>

<script setup>
// Panel yang bisa dipakai ulang untuk menampilkan satu hasil Collection —
// dipakai baik oleh CollectionDetailView.vue (halaman penuh) maupun expand
// row di CollectionView.vue (daftar). Semua logika fetch/poll/abort tinggal
// di SATU tempat ini supaya tidak ada duplikasi (lihat catatan desain di
// spec 2026-09-17-collection-weighted-results).
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import apiClient from '../../api/client.js'
import CollectionReportHeader from './CollectionReportHeader.vue'
import CriticalCheckCard from './CriticalCheckCard.vue'
import DataVerificationTable from './DataVerificationTable.vue'
import CategorySummaryGrid from './CategorySummaryGrid.vue'
import ErrorCodeList from './ErrorCodeList.vue'
import ScorecardDetail from './ScorecardDetail.vue'
import CollectionPdfPanel from './CollectionPdfPanel.vue'
import './collection.css'

const props = defineProps({
  resultId: { type: String, required: true },
  // 'split'  : laporan + panel PDF sticky berdampingan (dipakai CollectionDetailView)
  // 'report' : laporan saja, panel PDF penuh di bawah (dipakai CollectionDetailView)
  // 'inline' : laporan + panel PDF berdampingan TANPA sticky, tinggi dibatasi
  //            (dipakai expand row CollectionView.vue — lihat .crp-grid.inline)
  layout: { type: String, default: 'split' },
})

// emit 'loaded' tiap kali respons baru diterima, supaya parent (mis. toggle
// layout di CollectionDetailView) bisa tahu status/isi laporan tanpa perlu
// menduplikasi fetch-nya sendiri.
const emit = defineEmits(['loaded'])

const data = ref(null)
const loading = ref(true)
const error = ref('')
let pollTimer = null

// Guard anti race-condition, pola sama dengan CollectionView.vue (reload) dan
// CollectionDetailView.vue (load) sebelumnya: AbortController membatalkan
// permintaan poll/permintaan sebelumnya, requestId memastikan respons yang
// telat tidak pernah menimpa state dengan data tiket yang sudah tidak
// sedang dilihat (mis. resultId prop berganti sebelum poll lama selesai).
let requestId = 0
let inFlight = null // AbortController

async function load() {
  clearTimeout(pollTimer)
  if (inFlight) inFlight.abort()
  const ctrl = new AbortController()
  inFlight = ctrl
  const myId = ++requestId
  const resultId = props.resultId

  // Poll 5-detik memanggil load() lagi dengan `data` sudah terisi — jangan
  // tampilkan lagi placeholder "Memuat…" dan menyembunyikan tahapan yang
  // sedang dipantau; hanya permintaan PERTAMA untuk sebuah tiket (data belum
  // ada, termasuk sesudah prop resultId berganti — lihat watch di bawah,
  // yang mengosongkan `data` lebih dulu) menunjukkan placeholder tersebut.
  if (!data.value) loading.value = true
  try {
    const res = await apiClient.get(`/collection/results/${encodeURIComponent(resultId)}`, { signal: ctrl.signal })
    if (myId !== requestId) return // sudah ada permintaan yang lebih baru
    data.value = res.data
    error.value = ''
    emit('loaded', res.data)
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

watch(() => props.resultId, (next, prev) => {
  if (next && next !== prev) {
    data.value = null
    load()
  }
})

onMounted(load)
// Polling/abort WAJIB berhenti begitu panel ini dibongkar — baik karena baris
// expand ditutup, tiket lain dibuka (v-if baris lama jadi false), maupun
// halaman ditinggalkan. onBeforeUnmount menangani ketiganya karena semuanya
// memicu Vue melepas instance komponen ini.
onBeforeUnmount(() => {
  clearTimeout(pollTimer)
  if (inFlight) inFlight.abort()
})
</script>

<style scoped>
.stage-title { margin: 0 0 10px; font-size: 15px; }
.stages { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 13px; }
.stages .selesai { color: var(--green); } .stages .berjalan { color: var(--mega-orange); font-weight: 700; } .stages .menunggu { color: var(--gray); }
.error-box { background: var(--red-bg); border: 1px solid #f0bcbc; color: #7f1d1d; border-radius: 10px; padding: 12px 14px; font-size: 13px; }
.report-col > * + * { margin-top: 16px; }

.crp-grid.split, .crp-grid.inline { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(360px, 1fr); gap: 16px; align-items: start; }
.crp-grid.report { display: block; }
.crp-grid.split .pdf-col { position: sticky; top: 16px; height: calc(100vh - 110px); }
/* 'inline' (expand row) tidak pernah sticky — barisnya ada di tengah tabel,
   bukan halaman penuh — jadi tingginya dibatasi 80vh sejak awal. */
.crp-grid.inline .pdf-col { position: static; height: 80vh; }
.pdf-below { margin-top: 16px; }

@media (max-width: 1100px) {
  .crp-grid.split, .crp-grid.inline { grid-template-columns: 1fr; }
  .crp-grid.split .pdf-col, .crp-grid.inline .pdf-col { position: static; height: 80vh; }
}
</style>
