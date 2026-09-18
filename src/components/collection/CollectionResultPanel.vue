<template>
  <div class="crp">
    <div v-if="loading" class="state-box">Memuat…</div>
    <div v-else-if="error" class="error-box">{{ error }}</div>

    <template v-else-if="data">
      <div v-if="data.status === 'failed'" class="error-box">Pemrosesan gagal: {{ data.error }}</div>

      <div v-else-if="data.status !== 'done'" class="state-box">
        <h2 class="stage-title">Tiket sedang diproses</h2>
        <ol class="stages">
          <li v-for="s in data.stages" :key="s.key" :class="s.state">{{ s.label }}</li>
        </ol>
      </div>

      <div v-else-if="!data.report" class="error-box">Hasil tiket ini bukan laporan berbobot Collection (mungkin diproses sebelum fitur ini aktif). Reprocess tiket untuk menilainya ulang.</div>

      <!-- Urutan & gaya mengikuti hasil Cashline (EvaluationView.vue): ringkasan
           skor, Executive Summary berisi tabel, Hasil Scorecard, lalu Transkrip
           PDF di paling bawah (bukan panel di samping). -->
      <div v-else class="col-report">
        <CollectionReportHeader :report="data.report" :campaign="data.campaign" />

        <div class="block exec-summary">
          <div class="block-title">Executive Summary</div>
          <p class="summary">{{ data.report.ai_summary || 'Model tidak mengembalikan ringkasan.' }}</p>
          <CriticalCheckCard :report="data.report" />
          <CommitmentStatus :report="data.report" />
          <CategorySummaryGrid :report="data.report" />
          <DataVerificationTable :report="data.report" />
          <ErrorCodeList :report="data.report" />
        </div>

        <ScorecardDetail :report="data.report" />

        <div v-if="data.source_files?.length" class="block">
          <div class="block-title">File Sumber ({{ data.source_files.length }})</div>
          <div class="chips">
            <span v-for="f in data.source_files" :key="f" class="chip chip-blue">{{ f }}</span>
          </div>
        </div>

        <div v-if="data.result_id && data.source_files?.length" class="block">
          <div class="block-title">Transkrip PDF ({{ data.source_files.length }} file)</div>
          <PdfViewer
            v-for="fn in sortedFiles"
            :key="fn"
            :result-id="data.result_id"
            :filename="fn"
          />
        </div>
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import apiClient from '../../api/client.js'
import PdfViewer from '../PdfViewer.vue'
import CollectionReportHeader from './CollectionReportHeader.vue'
import CriticalCheckCard from './CriticalCheckCard.vue'
import CommitmentStatus from './CommitmentStatus.vue'
import DataVerificationTable from './DataVerificationTable.vue'
import CategorySummaryGrid from './CategorySummaryGrid.vue'
import ErrorCodeList from './ErrorCodeList.vue'
import ScorecardDetail from './ScorecardDetail.vue'
import './collection.css'

const props = defineProps({
  resultId: { type: String, required: true },
})

// emit 'loaded' tiap kali respons baru diterima, supaya parent bisa tahu
// status/isi laporan tanpa perlu menduplikasi fetch-nya sendiri.
const emit = defineEmits(['loaded'])

const data = ref(null)
// Urut nama berkas seperti sortedFiles() di EvaluationView (Cashline) — stempel
// YYYYMMDDHHMMSS di nama membuat urutan leksikal = urutan waktu.
const sortedFiles = computed(() => [...(data.value?.source_files || [])].sort((a, b) => a.localeCompare(b)))
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
.state-box { background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 16px 18px; }
.stage-title { margin: 0 0 10px; font-size: 15px; }
.stages { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 13px; }
.stages .selesai { color: var(--green); } .stages .berjalan { color: var(--mega-orange); font-weight: 700; } .stages .menunggu { color: var(--gray); }
.error-box { background: var(--red-bg); border: 1px solid #f0bcbc; color: #7f1d1d; border-radius: 10px; padding: 12px 14px; font-size: 13px; }
</style>
