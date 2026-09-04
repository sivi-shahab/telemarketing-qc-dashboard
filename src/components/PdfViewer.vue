<template>
  <div class="pdf-block">
    <div class="pdf-head" @click.stop="toggle">
      <span class="pdf-name">{{ filename }}</span>
      <span class="pdf-head-right">
        <a
          v-if="downloadUrl"
          class="pdf-action"
          :href="downloadUrl"
          :download="filename"
          @click.stop
        >Unduh</a>
        <a
          class="pdf-action"
          :href="nativeUrl"
          target="_blank"
          rel="noopener"
          title="Buka di viewer PDF bawaan browser"
          @click.stop
        >Tab baru</a>
        <span class="pdf-toggle">{{ open ? '▲' : '▼' }}</span>
      </span>
    </div>
    <div v-show="open" class="pdf-body">
      <!-- Dirender pdf.js ke canvas + lapisan teks, BUKAN <iframe>. Dengan iframe
           isinya dipegang PDFium di proses terpisah: teksnya tak pernah masuk DOM
           halaman, jadi ctrl+F di halaman evaluasi tidak menemukan apa pun. Lapisan
           teks pdf.js menaruh teks aslinya sebagai <span> transparan di atas canvas,
           sehingga find-in-page menemukannya dan menyorotnya di posisi katanya. -->
      <div v-if="loading" class="pdf-state"><span class="spinner"></span> Memuat PDF…</div>
      <div v-else-if="error" class="pdf-state pdf-failed">{{ error }}</div>
      <div v-show="!loading && !error" ref="pagesEl" class="pdf-pages"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createPdfPageRenderer } from '../utils/pdfRender.js'
import apiClient from '../api/client.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const props = defineProps({ resultId: String, filename: String })

const open = ref(false)
const loading = ref(false)
const error = ref('')
const pagesEl = ref(null)
const downloadUrl = ref('')

const { renderAll: renderPages } = createPdfPageRenderer()
let pdfDoc = null
let resizeObserver = null
let lastWidth = 0

// Hanya untuk tautan "Tab baru": <a target="_blank"> tidak bisa mengirim header
// Authorization, jadi token dititipkan di query — jalur yang memang diterima
// `get_current_user` (api/dependencies.py). Isi halamannya sendiri TIDAK lewat
// URL ini; PDF-nya diambil apiClient dengan token di header seperti biasa.
const nativeUrl = computed(() => {
  const base = apiClient.defaults.baseURL || ''
  const token = localStorage.getItem('access_token') || ''
  return `${base}/transcript_pdf/${encodeURIComponent(props.resultId)}`
    + `?filename=${encodeURIComponent(props.filename)}&token=${encodeURIComponent(token)}`
})

function toggle() {
  open.value = !open.value
  if (open.value && !pdfDoc && !loading.value) load()
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiClient.get(`/transcript_pdf/${encodeURIComponent(props.resultId)}`, {
      params: { filename: props.filename },
      responseType: 'arraybuffer',
      headers: { Accept: 'application/pdf' },
    })
    // Satu salinan byte-nya dipakai dua kali: dirender pdf.js, dan disajikan
    // sebagai blob untuk tombol Unduh — supaya mengunduh tidak menembak server
    // lagi dan tidak butuh token di URL.
    const bytes = new Uint8Array(res.data)
    // Blob menyalin isinya saat dibuat, jadi tombol Unduh tetap sahih walau
    // pdf.js kemudian men-detach buffer ini saat mengoper byte-nya ke worker.
    downloadUrl.value = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise
    loading.value = false
    await nextTick()
    await render()
    watchResize()
  } catch (e) {
    error.value = errorMessage(e)
    loading.value = false
  }
}

// Body galat pun terbaca sebagai ArrayBuffer (responseType di atas), jadi `detail`
// dari server harus dibongkar sendiri; tanpa ini yang tampil hanya "Request failed
// with status code 404", yang tidak memberi tahu bahwa tiketnya di luar cakupan.
function errorMessage(e) {
  let detail = ''
  try {
    const raw = e?.response?.data
    if (raw) detail = JSON.parse(new TextDecoder().decode(raw))?.detail || ''
  } catch { /* body bukan JSON */ }
  const status = e?.response?.status
  return detail || (status ? `Gagal memuat PDF (HTTP ${status}).` : 'Gagal memuat PDF.')
}

async function render() {
  if (!pagesEl.value) return
  lastWidth = pagesEl.value.clientWidth || 800
  await renderPages(pdfDoc, pagesEl.value)
}

function watchResize() {
  if (!pagesEl.value || resizeObserver || !('ResizeObserver' in window)) return
  let t
  resizeObserver = new ResizeObserver(() => {
    const w = pagesEl.value?.clientWidth || 0
    // w === 0 berarti bloknya sedang dilipat (display:none), bukan diubah ukurannya.
    if (!w || Math.abs(w - lastWidth) < 4) return
    clearTimeout(t)
    t = setTimeout(render, 150)
  })
  resizeObserver.observe(pagesEl.value)
}

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
  if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value)
  try { pdfDoc?.destroy?.() } catch { /* ignore */ }
})
</script>

<style scoped>
.pdf-block { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: #fff; margin-top: 8px; }
.pdf-head {
  padding: 10px 14px; cursor: pointer; font-size: 13px; transition: background 0.15s;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.pdf-head:hover { background: #f1f5f9; }
.pdf-name { font-family: monospace; color: var(--blue); word-break: break-all; }
.pdf-head-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.pdf-action { font-size: 12px; font-weight: 600; color: var(--text-muted); text-decoration: none; }
.pdf-action:hover { color: var(--blue); text-decoration: underline; }
.pdf-toggle { font-size: 12px; font-weight: 600; color: var(--text-muted); }

.pdf-body { border-top: 1px solid var(--border); background: #525659; max-height: 80vh; overflow: auto; }
.pdf-pages { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 16px; }
:deep(.pdf-page) { width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.4); background: #fff; }
.pdf-state { display: flex; align-items: center; gap: 10px; justify-content: center; color: #fff; font-size: 13px; padding: 32px; }
.pdf-failed { color: #fca5a5; text-align: center; }
.spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
