<template>
  <section ref="rootEl" class="cpdf" :class="{ fullscreen: isFullscreen }">
    <header class="cpdf-head">
      <div class="cpdf-title">
        <span class="cpdf-icon" aria-hidden="true">PDF</span>
        <div class="cpdf-title-text">
          <h3>Dokumen Transkrip</h3>
          <p>Berkas: <span class="cpdf-file">{{ active || '—' }}</span></p>
        </div>
      </div>
      <div class="cpdf-actions">
        <a v-if="downloadUrl" class="cpdf-btn" :href="downloadUrl" :download="active">Unduh</a>
        <a v-if="active" class="cpdf-btn" :href="nativeUrl" target="_blank" rel="noopener">Tab baru</a>
        <button class="cpdf-btn" type="button" @click="toggleFullscreen">{{ isFullscreen ? 'Keluar layar penuh' : 'Layar penuh' }}</button>
      </div>
    </header>

    <nav v-if="files.length > 1" class="cpdf-tabs" role="tablist">
      <button
        v-for="(f, i) in files" :key="f" type="button" role="tab" class="cpdf-tab"
        :class="{ on: f === active }" :aria-selected="f === active" @click="select(f)"
      >Rekaman {{ i + 1 }}</button>
    </nav>

    <div class="cpdf-toolbar">
      <div class="cpdf-group">
        <button type="button" :disabled="page <= 1" @click="goTo(page - 1)" aria-label="Halaman sebelumnya">‹</button>
        <span class="cpdf-page">{{ numPages ? `${page} / ${numPages}` : '—' }}</span>
        <button type="button" :disabled="page >= numPages" @click="goTo(page + 1)" aria-label="Halaman berikutnya">›</button>
      </div>
      <div class="cpdf-group">
        <button type="button" :disabled="zoom <= 0.5" @click="setZoom(zoom - 0.25)" aria-label="Perkecil">−</button>
        <span class="cpdf-zoom">{{ Math.round(zoom * 100) }}%</span>
        <button type="button" :disabled="zoom >= 2" @click="setZoom(zoom + 0.25)" aria-label="Perbesar">+</button>
        <button type="button" class="cpdf-fit" :disabled="zoom === 1" @click="setZoom(1)">Pas lebar</button>
      </div>
    </div>

    <div ref="scrollEl" class="cpdf-body" @scroll.passive="onScroll">
      <div v-if="loading" class="cpdf-skeleton"><div class="sk-page" v-for="i in 2" :key="i"></div></div>
      <div v-else-if="error" class="cpdf-state">{{ error }}</div>
      <div v-show="!loading && !error" ref="pagesEl" class="cpdf-pages"></div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createPdfPageRenderer } from '../../utils/pdfRender.js'
import apiClient from '../../api/client.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const props = defineProps({
  resultId: { type: String, required: true },
  files: { type: Array, default: () => [] },
})

const rootEl = ref(null)
const scrollEl = ref(null)
const pagesEl = ref(null)
const active = ref(props.files[0] || '')
const loading = ref(false)
const error = ref('')
const downloadUrl = ref('')
const numPages = ref(0)
const page = ref(1)
const zoom = ref(1)
const isFullscreen = ref(false)

const { renderAll } = createPdfPageRenderer()
let pdfDoc = null
let resizeObserver = null
let lastWidth = 0

// Lihat PdfViewer.vue: <a target=_blank> tak bisa membawa header Authorization.
const nativeUrl = computed(() => {
  const base = apiClient.defaults.baseURL || ''
  const token = localStorage.getItem('access_token') || ''
  return `${base}/transcript_pdf/${encodeURIComponent(props.resultId)}`
    + `?filename=${encodeURIComponent(active.value)}&token=${encodeURIComponent(token)}`
})

function cleanupDoc() {
  if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value)
  downloadUrl.value = ''
  try { pdfDoc?.destroy?.() } catch { /* ignore */ }
  pdfDoc = null
  numPages.value = 0
  page.value = 1
}

async function load() {
  if (!active.value) return
  cleanupDoc()
  loading.value = true
  error.value = ''
  try {
    const res = await apiClient.get(`/transcript_pdf/${encodeURIComponent(props.resultId)}`, {
      params: { filename: active.value }, responseType: 'arraybuffer', headers: { Accept: 'application/pdf' },
    })
    const bytes = new Uint8Array(res.data)
    downloadUrl.value = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise
    numPages.value = pdfDoc.numPages
    loading.value = false
    await nextTick()
    await render()
  } catch (e) {
    let detail = ''
    try { detail = JSON.parse(new TextDecoder().decode(e?.response?.data))?.detail || '' } catch { /* bukan JSON */ }
    error.value = detail || (e?.response?.status ? `Gagal memuat PDF (HTTP ${e.response.status}).` : 'Gagal memuat PDF.')
    loading.value = false
  }
}

// Lebar "pas" dihitung dari elemen SCROLL (`.cpdf-body`, yang punya
// `overflow: auto` dan karenanya lebar tampilan yang stabil), BUKAN dari
// `.cpdf-pages` (`pagesEl`, wadah `width: max-content` yang dioper ke
// `renderAll` sebagai `container`). Mengukur lebar dari `pagesEl` sendiri
// melingkar balik ke render sebelumnya — lihat catatan di
// `utils/pdfRender.js` pada fungsi `contentWidth`. Karena itu lebarnya
// dihitung di sini dan dioper sebagai `options.fitWidth`, dikurangi padding
// horizontal `.cpdf-pages` supaya halaman pas di dalam kotak isinya, sama
// seperti yang dilakukan `contentWidth` untuk wadah biasa.
async function render() {
  if (!pdfDoc || !pagesEl.value || !scrollEl.value) return
  lastWidth = scrollEl.value.clientWidth || 0
  const padStyle = getComputedStyle(pagesEl.value)
  const pad = parseFloat(padStyle.paddingLeft || '0') + parseFloat(padStyle.paddingRight || '0')
  const fitWidth = Math.max(0, lastWidth - pad)
  await renderAll(pdfDoc, pagesEl.value, { zoom: zoom.value, fitWidth })
}

function select(f) { if (f !== active.value) { active.value = f; load() } }

function setZoom(z) {
  zoom.value = Math.min(2, Math.max(0.5, Math.round(z * 100) / 100))
  render()
}

function pageEls() { return pagesEl.value ? [...pagesEl.value.querySelectorAll('.pdf-page')] : [] }

function goTo(n) {
  const el = pageEls()[n - 1]
  if (el && scrollEl.value) scrollEl.value.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' })
}

function onScroll() {
  const els = pageEls()
  if (!els.length || !scrollEl.value) return
  const mid = scrollEl.value.scrollTop + scrollEl.value.clientHeight / 3
  let current = 1
  els.forEach((el, i) => { if (el.offsetTop <= mid) current = i + 1 })
  page.value = current
}

async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen()
  else await rootEl.value?.requestFullscreen?.()
}
function onFullscreenChange() {
  isFullscreen.value = document.fullscreenElement === rootEl.value
  nextTick(render)
}

watch(() => props.files, (fs) => {
  if (!fs.includes(active.value)) { active.value = fs[0] || ''; load() }
})

onMounted(() => {
  load()
  document.addEventListener('fullscreenchange', onFullscreenChange)
  if ('ResizeObserver' in window && scrollEl.value) {
    let t
    resizeObserver = new ResizeObserver(() => {
      const w = scrollEl.value?.clientWidth || 0
      if (!w || Math.abs(w - lastWidth) < 4) return
      clearTimeout(t)
      t = setTimeout(render, 150)
    })
    resizeObserver.observe(scrollEl.value)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  resizeObserver?.disconnect()
  cleanupDoc()
})
</script>

<style scoped>
.cpdf { display: flex; flex-direction: column; background: #fff; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(30,31,33,.06); height: 100%; min-height: 0; }
.cpdf.fullscreen { border-radius: 0; }
.cpdf-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; color: #fff; background: linear-gradient(90deg, var(--text) 0%, #002D62 100%); }
.cpdf-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
.cpdf-icon { flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px; background: var(--mega-orange); display: grid; place-items: center; font-size: 10px; font-weight: 800; letter-spacing: .04em; }
.cpdf-title-text { min-width: 0; }
.cpdf-title-text h3 { margin: 0; font-size: 14px; font-weight: 700; }
.cpdf-title-text p { margin: 2px 0 0; font-size: 11px; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cpdf-file { font-family: var(--font-mono); color: var(--mega-gold); font-weight: 600; }
.cpdf-actions { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
.cpdf-btn { font-size: 12px; font-weight: 600; color: #fff; text-decoration: none; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 5px 10px; cursor: pointer; }
.cpdf-btn:hover { background: rgba(255,255,255,.2); }
.cpdf-tabs { display: flex; gap: 4px; padding: 8px 12px 0; background: #F4F5F6; border-bottom: 1px solid var(--border); overflow-x: auto; }
.cpdf-tab { border: 1px solid transparent; border-bottom: none; background: transparent; padding: 7px 14px; font-size: 12px; font-weight: 600; color: var(--mega-gray-600); border-radius: 8px 8px 0 0; cursor: pointer; white-space: nowrap; }
.cpdf-tab.on { background: #fff; color: var(--text); border-color: var(--border); box-shadow: inset 0 2px 0 var(--mega-orange); }
.cpdf-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 12px; background: #FAFBFC; border-bottom: 1px solid var(--border); }
.cpdf-group { display: flex; align-items: center; gap: 4px; }
.cpdf-group button { min-width: 30px; height: 30px; border: 1px solid var(--border); background: #fff; border-radius: 8px; font-size: 15px; font-weight: 700; color: var(--text); cursor: pointer; }
.cpdf-group button:disabled { opacity: .4; cursor: default; }
.cpdf-group .cpdf-fit { font-size: 12px; padding: 0 10px; }
.cpdf-page, .cpdf-zoom { min-width: 64px; text-align: center; font-size: 12px; font-weight: 600; font-family: var(--font-mono); color: #4A4B4E; }
.cpdf-body { flex: 1; min-height: 480px; max-height: calc(100vh - 220px); overflow: auto; background: #3f4246; }
.cpdf.fullscreen .cpdf-body { max-height: none; }
.cpdf-pages { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 18px; width: max-content; min-width: 100%; box-sizing: border-box; }
.cpdf-pages :deep(.pdf-page) { box-shadow: 0 4px 14px rgba(0,0,0,.45); background: #fff; border-radius: 2px; }
.cpdf-state { color: #fca5a5; text-align: center; padding: 40px 16px; font-size: 13px; }
.cpdf-skeleton { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 18px; }
.sk-page { width: min(100%, 720px); aspect-ratio: 1 / 1.414; background: linear-gradient(90deg, #55585c 0%, #62666a 50%, #55585c 100%); background-size: 200% 100%; animation: shimmer 1.2s linear infinite; border-radius: 2px; }
@keyframes shimmer { to { background-position: -200% 0; } }
</style>
