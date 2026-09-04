<template>
  <div class="viewer-page">
    <header class="viewer-header">
      <div class="viewer-info">
        <span class="viewer-ticket">{{ tiketId || '—' }}</span>
        <span v-if="campaign" class="viewer-campaign">{{ campaign }}</span>
      </div>
    </header>
    <div class="viewer-body">
      <!-- PDF diambil lewat App B (`GET /tickets_daily_pdf/{tiket_id}`) lalu dirender
           pdf.js ke canvas + lapisan teks. Tidak bisa memakai <iframe>: elemen itu
           tak bisa mengirim header Authorization, dan isi PDF di dalam frame tak
           pernah masuk DOM halaman sehingga ctrl+F tidak menemukan apa pun.
           Lapisan teksnya dipasang createPdfPageRenderer (utils/pdfRender.js). -->
      <div v-if="loading" class="viewer-loading">
        <span class="spinner"></span> Memuat PDF…
      </div>
      <div v-else-if="error" class="viewer-failed">{{ error }}</div>
      <div v-else ref="pagesEl" class="pdf-pages"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createPdfPageRenderer } from '../../utils/pdfRender.js'
import apiClient from '../../api/client.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// PDF-nya diambil lewat App B, BUKAN lagi menembak App C langsung dari browser.
// Dua alasannya, sama dengan yang berlaku untuk daftar tiketnya (TranscriptsView):
//
// 1. Kredensial. `X-API-Key` App C dulu ditulis di sini sebagai nilai fallback
//    literal, jadi key-nya terbawa ke bundle produksi bahkan ketika env var-nya
//    tidak disetel — terbaca siapa pun yang membuka DevTools. Sekarang key itu
//    tinggal di server (services/view_streams.py).
// 2. RBAC. Permintaan langsung ke App C tidak pernah melewati App B, jadi
//    `rbac.effective_campaigns_for` tidak berlaku dan siapa pun yang memegang key
//    itu bisa mengunduh PDF tiket campaign mana pun. Sekarang server yang
//    memeriksanya (api/routers/tickets_daily_pdf.py).

const route = useRoute()
// tiket_id dari route param (/dashboard/transcripts/:tiketId) atau query.
// `resultId` ikut dibaca demi tautan lama yang memakai nama param itu.
const tiketId = route.params.tiketId || route.params.resultId || route.query.tiket_id || ''
const campaign = route.query.campaign || ''

const loading = ref(true)
const error = ref('')
const pagesEl = ref(null)
const { renderAll: renderPages } = createPdfPageRenderer()
let pdfDoc = null
let resizeObserver = null
let lastWidth = 0

async function loadAndRender() {
  loading.value = true
  error.value = ''
  try {
    // apiClient menyisipkan token login; server yang memutuskan boleh/tidaknya.
    const res = await apiClient.get(`/tickets_daily_pdf/${encodeURIComponent(tiketId)}`, {
      responseType: 'arraybuffer',
      headers: { Accept: 'application/pdf' },
    })
    pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(res.data) }).promise
    loading.value = false
    await nextTick()
    await renderAll()
    if (pagesEl.value && 'ResizeObserver' in window) {
      let t
      resizeObserver = new ResizeObserver(() => {
        const w = pagesEl.value?.clientWidth || 0
        if (Math.abs(w - lastWidth) < 4) return
        clearTimeout(t)
        t = setTimeout(renderAll, 150)
      })
      resizeObserver.observe(pagesEl.value)
    }
  } catch (e) {
    // Body galat pun ikut terbaca sebagai ArrayBuffer (responseType di atas), jadi
    // `detail` dari server harus dibongkar sendiri. Tanpa ini yang tampil cuma
    // "Request failed with status code 404" — pesan yang tidak memberi tahu
    // pemakainya bahwa tiket itu di luar cakupan campaign-nya.
    let detail = ''
    try {
      const raw = e?.response?.data
      if (raw) detail = JSON.parse(new TextDecoder().decode(raw))?.detail || ''
    } catch { /* body bukan JSON */ }
    const status = e?.response?.status
    error.value = detail || (status ? `Gagal memuat PDF (HTTP ${status}).` : 'Gagal memuat PDF.')
    loading.value = false
  }
}

async function renderAll() {
  if (!pagesEl.value) return
  lastWidth = pagesEl.value.clientWidth || 800
  await renderPages(pdfDoc, pagesEl.value)
}

onMounted(loadAndRender)

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
  try { pdfDoc?.destroy?.() } catch { /* ignore */ }
})

</script>

<style scoped>
.viewer-page { min-height: 100vh; display: flex; flex-direction: column; background: #525659; }
.viewer-header {
  padding: 12px 20px; background: #fff; border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 10;
}
.viewer-info { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.viewer-ticket { font-weight: 700; font-size: 14px; color: var(--text); font-family: monospace; word-break: break-all; }
.viewer-campaign {
  font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;
  background: var(--blue-bg); color: var(--blue); text-transform: uppercase; letter-spacing: 0.04em;
}
.viewer-body { flex: 1; display: flex; overflow: auto; }
/* `flex: 1` + `min-width: 0` WAJIB: .viewer-body adalah flex row, dan tanpa ini
   wadah ini lebarnya mengikuti isi (shrink-to-fit). Saat renderer mengukurnya,
   isinya baru saja dikosongkan — yang terukur cuma padding, dan halaman pun
   dirender selebar 1px: tidak ada error, layarnya sekadar kosong.
   `margin: 0 auto` tetap menengahkan karena max-width menyisakan ruang bebas. */
.pdf-pages {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  flex: 1; min-width: 0; padding: 20px; max-width: 900px; margin: 0 auto;
}
:deep(.pdf-page) { display: block; width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.4); background: #fff; }
.viewer-loading { display: flex; align-items: center; gap: 10px; color: #fff; font-size: 14px; padding: 40px; justify-content: center; }
.viewer-failed { color: #fca5a5; font-size: 14px; padding: 40px; text-align: center; }
.spinner {
  width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; display: inline-block;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>