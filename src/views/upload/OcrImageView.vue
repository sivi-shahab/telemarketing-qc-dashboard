<template>
  <SidebarLayout title="OCR Gambar">
    <div class="ocr-page">
      <div class="upload-card">
        <h2 class="card-title">OCR Gambar</h2>
        <p class="card-subtitle">Upload gambar format apa pun (JPG, PNG, HEIC, TIFF, WEBP, BMP, …) — maks {{ OCR_MAX_FILES }} gambar, 10 MB per file; TIFF multi-halaman dihitung per halaman. Teks di dalam gambar disalin apa adanya.</p>

        <div
          class="drop-zone"
          :class="{ dragging: isDragging, 'has-file': files.length }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
          @click="fileInput.click()"
        >
          <input ref="fileInput" type="file" :accept="OCR_ACCEPT" multiple class="hidden-input" @change="onSelect" />
          <div v-if="!files.length" class="drop-placeholder">
            <p>Drag & drop gambar di sini</p>
            <p class="drop-hint">atau klik untuk browse (multi-file)</p>
          </div>
          <div v-else class="file-list">
            <div v-for="(f, i) in files" :key="i" class="file-row">
              <span class="file-name">{{ f.name }}</span>
              <span class="file-size">{{ formatSize(f.size) }}</span>
              <button class="remove-btn" @click.stop="files.splice(i, 1); formatError = validateOcrFiles(files)">✕</button>
            </div>
          </div>
        </div>

        <div v-if="formatError" class="error-msg">{{ formatError }}</div>
        <div v-if="uploadError" class="error-msg">{{ uploadError }}</div>

        <button class="btn-upload" :disabled="uploading || !files.length || !!formatError" @click="upload">
          {{ uploading ? 'Mengunggah…' : 'Proses OCR' }}
        </button>
      </div>

      <div class="history-card">
        <h2 class="card-title">Riwayat</h2>
        <div v-if="listError" class="error-msg">{{ listError }}</div>
        <table v-if="items.length" class="history-table">
          <thead>
            <tr>
              <th>File</th><th>Waktu</th><th>Status</th><th v-if="showUploader">Pengunggah</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in items" :key="it.id" :class="{ selected: detail && detail.id === it.id }">
              <td class="file-name">{{ it.filename }}</td>
              <td>{{ formatTime(it.created_at) }}</td>
              <td><span class="badge" :class="it.status">{{ STATUS_LABEL[it.status] || it.status }}</span></td>
              <td v-if="showUploader">{{ it.uploader_name || '-' }}</td>
              <td class="actions">
                <button class="link-btn" @click="openDetail(it.id)">Lihat</button>
                <button v-if="it.status === 'failed'" class="link-btn" @click="retry(it.id)">Proses ulang</button>
                <button class="link-btn danger" @click="remove(it)">Hapus</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else-if="!loading" class="field-hint">Belum ada riwayat.</p>
        <div v-if="total > pageSize" class="pager">
          <button class="link-btn" :disabled="page <= 1" @click="page--; load()">‹ Sebelumnya</button>
          <span>Halaman {{ page }} / {{ Math.ceil(total / pageSize) }}</span>
          <button class="link-btn" :disabled="page * pageSize >= total" @click="page++; load()">Berikutnya ›</button>
        </div>
      </div>

      <div v-if="detail || detailError" class="detail-card">
        <div class="detail-head">
          <h2 class="card-title">{{ detail ? detail.filename : 'Detail' }}</h2>
          <button class="link-btn" @click="closeDetail">Tutup ✕</button>
        </div>
        <div v-if="detailError" class="error-msg">{{ detailError }}</div>
        <div v-if="detail" class="detail-body">
          <div class="detail-image">
            <img v-if="imageUrl" :src="imageUrl" :alt="detail.filename" />
          </div>
          <div class="detail-text">
            <div class="text-actions">
              <button class="btn-small" :disabled="detail.status !== 'done'" @click="copyText">{{ copyLabel }}</button>
              <button class="btn-small" :disabled="detail.status !== 'done'" @click="downloadText">Unduh .txt</button>
            </div>
            <pre v-if="detail.status === 'done'" class="ocr-text">{{ detail.text }}</pre>
            <p v-else-if="detail.status === 'failed'" class="error-msg">Gagal: {{ detail.error_message }}</p>
            <p v-else class="field-hint">{{ STATUS_LABEL[detail.status] }}…</p>
          </div>
        </div>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'
import { OCR_ACCEPT, OCR_MAX_FILES, STATUS_LABEL, hasActive, txtFilename, validateOcrFiles } from '../../utils/ocrImage.js'

const POLL_MS = 3000

const fileInput = ref(null)
const files = ref([])
const isDragging = ref(false)
const formatError = ref('')
const uploadError = ref('')
const uploading = ref(false)

const items = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const listError = ref('')

const detail = ref(null)
const imageUrl = ref('')
const copied = ref(false)
const copyFailed = ref(false)
const detailError = ref('')
const copyLabel = computed(() => (copyFailed.value ? 'Gagal menyalin' : copied.value ? 'Tersalin ✓' : 'Salin'))
// Diset saat komponen dilepas supaya request yang masih berjalan tidak menjadwalkan polling lagi.
let unmounted = false
let pollTimer = null

const showUploader = computed(() => items.value.some((i) => 'uploader_name' in i))

function addFiles(list) {
  files.value = [...files.value, ...Array.from(list || [])]
  formatError.value = validateOcrFiles(files.value)
}
function onSelect(e) { addFiles(e.target.files); e.target.value = '' }
function onDrop(e) { isDragging.value = false; addFiles(e.dataTransfer.files) }

function formatSize(n) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`
}
function formatTime(s) {
  return s ? new Date(s).toLocaleString('id-ID') : '-'
}
function errorText(err, fallback) {
  const d = err?.response?.data?.detail
  return typeof d === 'string' ? d : fallback
}

async function upload() {
  formatError.value = validateOcrFiles(files.value)
  if (formatError.value) return
  uploading.value = true
  uploadError.value = ''
  try {
    const form = new FormData()
    files.value.forEach((f) => form.append('files', f))
    await apiClient.post('/ocr_images', form, { timeout: 120000 })
    files.value = []
    page.value = 1
    await load()
  } catch (err) {
    uploadError.value = errorText(err, 'Upload gagal, coba lagi')
  } finally {
    uploading.value = false
  }
}

async function load() {
  loading.value = true
  listError.value = ''
  try {
    const { data } = await apiClient.get('/ocr_images', { params: { page: page.value, page_size: pageSize } })
    if (unmounted) return
    items.value = data.items
    total.value = data.total
    if (detail.value) {
      const fresh = data.items.find((i) => i.id === detail.value.id)
      if (fresh && fresh.status !== detail.value.status) await openDetail(fresh.id)
    }
  } catch (err) {
    if (unmounted) return
    listError.value = errorText(err, 'Gagal memuat riwayat')
  } finally {
    loading.value = false
    schedulePoll()
  }
}

function schedulePoll() {
  clearTimeout(pollTimer)
  if (unmounted) return
  pollTimer = hasActive(items.value) ? setTimeout(load, POLL_MS) : null
}

async function openDetail(id) {
  detailError.value = ''
  try {
    const { data } = await apiClient.get(`/ocr_images/${id}`)
    if (unmounted) return
    const sameImage = detail.value && detail.value.id === id
    detail.value = data
    copied.value = false
    copyFailed.value = false
    if (!sameImage) {
      if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
      imageUrl.value = ''
      const res = await apiClient.get(`/ocr_images/${id}/image`, { responseType: 'blob' })
      if (unmounted) return
      imageUrl.value = URL.createObjectURL(res.data)
    }
  } catch (err) {
    // Kegagalan detail ditampilkan di panel detail, bukan sebagai galat riwayat.
    if (!unmounted) detailError.value = errorText(err, 'Gagal memuat detail')
  }
}

function closeDetail() {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = ''
  detail.value = null
  detailError.value = ''
}

async function retry(id) {
  try {
    await apiClient.post(`/ocr_images/${id}/retry`)
    await load()
  } catch (err) {
    listError.value = errorText(err, 'Gagal memproses ulang')
  }
}

async function remove(it) {
  if (!window.confirm(`Hapus "${it.filename}" beserta teks hasil OCR-nya?`)) return
  try {
    await apiClient.delete(`/ocr_images/${it.id}`)
    if (detail.value && detail.value.id === it.id) closeDetail()
    await load()
  } catch (err) {
    listError.value = errorText(err, 'Gagal menghapus')
  }
}

// Dashboard bisa dibuka lewat http biasa (bukan secure context) sehingga
// navigator.clipboard tidak ada; jatuh ke textarea tersembunyi + execCommand.
async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try {
    if (!document.execCommand('copy')) throw new Error('execCommand gagal')
  } finally {
    document.body.removeChild(ta)
  }
}

async function copyText() {
  try {
    await writeClipboard(detail.value.text || '')
    copied.value = true
    copyFailed.value = false
  } catch {
    copied.value = false
    copyFailed.value = true
  }
}

function downloadText() {
  const blob = new Blob([detail.value.text || ''], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = txtFilename(detail.value.filename)
  a.click()
  URL.revokeObjectURL(a.href)
}

onMounted(load)
onBeforeUnmount(() => {
  unmounted = true
  clearTimeout(pollTimer)
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
})
</script>

<style scoped>
.ocr-page { display: flex; flex-direction: column; gap: 20px; max-width: 1100px; margin: 0 auto; }
.upload-card, .history-card, .detail-card {
  background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 24px;
  display: flex; flex-direction: column; gap: 16px;
}
.card-title { font-size: 17px; font-weight: 700; }
.card-subtitle { font-size: 13px; color: var(--text-muted); margin-top: -10px; }
.drop-zone { border: 2px dashed var(--border); border-radius: 10px; padding: 28px; cursor: pointer; display: flex; justify-content: center; }
.drop-zone:hover, .drop-zone.dragging { border-color: var(--blue); background: var(--blue-bg); }
.drop-zone.has-file { border-color: var(--green); background: var(--green-bg); }
.hidden-input { display: none; }
.drop-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.drop-placeholder p { font-size: 14px; font-weight: 500; color: var(--text); }
.drop-hint { font-size: 12px; color: var(--text-muted) !important; }
.file-list { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.file-row { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; }
.file-name { flex: 1; font-weight: 600; font-size: 13px; word-break: break-all; }
.file-size { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.remove-btn { border: none; background: #fee2e2; color: var(--red); border-radius: 6px; width: 26px; height: 26px; cursor: pointer; }
.remove-btn:hover { background: #fecaca; }
.btn-upload { align-self: flex-start; background: var(--blue); color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-weight: 600; cursor: pointer; }
.btn-upload:hover:not(:disabled) { background: #2563eb; }
.btn-upload:disabled { opacity: 0.5; cursor: not-allowed; }
.error-msg { color: var(--red); font-size: 13px; }
.field-hint { font-size: 12px; color: var(--text-muted); }
.history-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.history-table th, .history-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
.history-table tr.selected { background: var(--blue-bg); }
.actions { white-space: nowrap; display: flex; gap: 10px; }
.link-btn { background: none; border: none; color: var(--blue); font-weight: 600; cursor: pointer; padding: 0; }
.link-btn.danger { color: var(--red); }
.link-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.badge { padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; background: #f1f5f9; }
.badge.done { background: var(--green-bg); color: var(--green); }
.badge.failed { background: #fee2e2; color: var(--red); }
.badge.processing, .badge.pending { background: var(--blue-bg); color: var(--blue); }
.pager { display: flex; gap: 12px; align-items: center; font-size: 13px; }
.detail-head { display: flex; justify-content: space-between; align-items: center; }
.detail-body { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 800px) { .detail-body { grid-template-columns: 1fr; } }
.detail-image img { max-width: 100%; border: 1px solid var(--border); border-radius: 8px; }
.text-actions { display: flex; gap: 8px; margin-bottom: 8px; }
.btn-small { border: 1px solid var(--border); background: #fff; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
.btn-small:disabled { opacity: 0.4; cursor: not-allowed; }
.ocr-text { white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, monospace; font-size: 13px; background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 12px; max-height: 70vh; overflow: auto; }
</style>
