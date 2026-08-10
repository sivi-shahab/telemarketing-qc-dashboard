<template>
  <div class="viewer-page">
    <header class="viewer-header">
      <div class="viewer-info">
        <span class="viewer-ticket">{{ tiketId || '—' }}</span>
        <span v-if="campaign" class="viewer-campaign">{{ campaign }}</span>
      </div>
    </header>
    <div class="viewer-body">
      <!-- PDF di-stream dari App C dengan X-API-Key lalu dirender pdf.js ke canvas.
           Tidak bisa memakai <iframe> karena elemen itu tak bisa mengirim header
           X-API-Key, dan App C tidak menerima token lewat query string. -->
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

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// --- Konfigurasi App C (API stream PDF) ---
const C_API_BASE = (import.meta.env.VITE_TMS_API_URL || 'https://call-qc.bankmega.local').replace(/\/+$/, '')
const X_API_KEY = import.meta.env.VITE_TMS_API_KEY || 'zTkQMeKmvq9D59z0NhWczv9o9KrPSfnSs8hLJ0J4r1s'

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
    // Stream PDF dari App C dengan X-API-Key (fetch, bukan apiClient App B).
    // Jamak: nginx hanya mem-proxy `location /api/view-streams/`. Bentuk tunggal
    // lolos ke catch-all SPA dan mengembalikan index.html, bukan PDF.
    const res = await fetch(`${C_API_BASE}/api/view-streams/${encodeURIComponent(tiketId)}`, {
      headers: { 'X-API-Key': X_API_KEY, Accept: 'application/pdf' },
    })
    if (!res.ok) throw new Error(`Gagal memuat PDF (HTTP ${res.status})`)
    const buf = await res.arrayBuffer()
    pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
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
    error.value = e.message || 'Gagal memuat PDF.'
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
.pdf-pages { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 20px; max-width: 900px; margin: 0 auto; }
:deep(.pdf-page) { display: block; width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.4); background: #fff; }
.viewer-loading { display: flex; align-items: center; gap: 10px; color: #fff; font-size: 14px; padding: 40px; justify-content: center; }
.viewer-failed { color: #fca5a5; font-size: 14px; padding: 40px; text-align: center; }
.spinner {
  width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; display: inline-block;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>